// Motor principal: orquestra temporadas, semanas, partidas, evolução,
// transferências, seleções, prêmios e o mundo vivo.

import { buildWorld, teamStrength, generateFixtures, emptyTable, updateTable, tableStandings, POSITION_SLOTS, aiName } from './world.js';
import { createPlayer, emptySeasonStats, avgRating, rollInitialProfile, marketValue, wageFor, fullName, youthCategory } from './player.js';
import { rollAcademy, applyAcademy, MAX_REROLLS } from './academy.js';
import { simPlayerMatch, simScore } from './match.js';
import { monthlyDevelopment, updateFormMorale, weeklyFormDrift, rollInjury, updateReputation } from './development.js';
import { generateOffers, negotiateOffer, applyTransfer, aiMarketNews } from './transfers.js';
import {
  initCups, initContinentals, preparePairings, resolveRound, roundName,
  natTeamOvr, isCalledUp, tournamentForYear, simNationalTournament,
  NAT_WINDOW_WEEKS, WORLD_CLUB_CUP_WEEK,
} from './competitions.js';
import { NATIONS } from '../data/nations.js';
import { seed, getSeed, ri, gauss, clamp, chance, choice } from './rng.js';

export const SEASON_WEEKS = 40;
export const YOUTH_ROUNDS = 30;
export { MAX_REROLLS };

// ---------------- Criação e setup ----------------

export function newGame(cfg) {
  seed(cfg.seed || (Date.now() % 2147483647));
  const world = buildWorld();
  const G = {
    version: 1,
    seasonYear: 2026,
    seasonNumber: 1,
    week: 1,
    phase: 'roll', // roll -> career -> retired
    country: cfg.country,
    rerollsLeft: MAX_REROLLS,
    lastRoll: null,
    clubs: world.clubs,
    leagues: world.leagues,
    cups: {},
    continentals: [],
    wccWinnerId: null,
    player: createPlayer(cfg),
    offers: [],
    news: [],
    monthMinutes: 0,
    monthPossible: 0,
    wantRetire: false,
  };
  startSeasonStructures(G);
  addNews(G, `Sua jornada começa. Olheiros de ${cfg.country} estão avaliando jovens talentos.`);
  return G;
}

function startSeasonStructures(G) {
  for (const league of G.leagues) {
    league.fixtures = generateFixtures(league.clubIds);
    league.round = 0;
    league.table = emptyTable(league.clubIds);
  }
  initCups(G);
  initContinentals(G);
  G.wccWinnerId = null;
  G.week = 1;
  G.monthMinutes = 0;
  G.monthPossible = 0;
}

export function doRollAcademy(G) {
  if (G.phase !== 'roll') throw new Error('Fase inválida para roleta');
  if (G.lastRoll && G.rerollsLeft <= 0) throw new Error('Sem roletadas restantes');
  if (G.lastRoll) G.rerollsLeft--;
  G.lastRoll = rollAcademy(G, G.country);
  return G.lastRoll;
}

export function confirmAcademy(G) {
  if (!G.lastRoll) throw new Error('Nenhum sorteio para confirmar');
  applyAcademy(G, G.lastRoll);
  G.phase = 'career';
  const club = G.clubs[G.player.clubId];
  addNews(G, `Você foi selecionado para a categoria de base do ${club.name} (${G.player.category}).`);
  G.player.value = marketValue(G.player);
  return club;
}

// ---------------- Utilidades ----------------

export function addNews(G, text) {
  G.news.unshift({ year: G.seasonYear, week: G.week, text });
  if (G.news.length > 80) G.news.length = 80;
}

export function playerClub(G) {
  return G.player.clubId !== null ? G.clubs[G.player.clubId] : null;
}

export function playerLeague(G) {
  const club = playerClub(G);
  return club ? G.leagues.find((l) => l.id === club.leagueId) : null;
}

const POS_MAP = { CF: 'ST' };

export function computeSquadRole(G) {
  const p = G.player;
  if (p.youth || !playerClub(G)) return;
  const club = playerClub(G);
  const pos = POS_MAP[p.position] || p.position;
  const rivals = club.squad.filter((x) => (POS_MAP[x.pos] || x.pos) === pos).sort((a, b) => b.ovr - a.ovr);
  const slots = POSITION_SLOTS[pos] || 1;
  const rating = avgRating(p.seasonStats);
  const eff = p.overall + (rating > 0 ? (rating - 6.5) * 4 : 0) + (p.form - 60) / 10;
  const cut = rivals[slots - 1] ? rivals[slots - 1].ovr : 0;
  if (eff >= cut) p.squadRole = 'starter';
  else if (eff >= cut - 4) p.squadRole = 'rotation';
  else p.squadRole = 'bench';
}

function trainQuality(G) {
  const club = playerClub(G);
  if (!club) return 4;
  return G.player.youth ? club.academy : club.academy * 0.5 + club.rep * 0.5;
}

function applyStats(G, stats, comp) {
  const p = G.player;
  const s = p.seasonStats;
  s.apps++;
  if (stats.minutes >= 60) s.starts++;
  s.minutes += stats.minutes;
  s.goals += stats.goals || 0;
  s.assists += stats.assists || 0;
  s.ratingSum += stats.rating;
  s.ratingCount++;
  if (stats.motm) s.motm++;
  if (stats.yellow) s.yellow++;
  if (stats.red) s.red++;
  if (stats.cleanSheet) s.cleanSheets++;
  if (comp === 'league') {
    s.leagueGoals = (s.leagueGoals || 0) + (stats.goals || 0);
    s.leagueApps = (s.leagueApps || 0) + 1;
  }
  if (comp === 'nat') {
    s.natApps++;
    s.natGoals += stats.goals || 0;
    p.natTeam.caps++;
    p.natTeam.goals += stats.goals || 0;
  }
}

// ---------------- Partidas do jogador ----------------

function playPlayerMatch(G, homeId, awayId, comp, compLabel) {
  const p = G.player;
  const isHome = homeId === p.clubId;
  const own = G.clubs[p.clubId];
  const opp = G.clubs[isHome ? awayId : homeId];
  const result = simPlayerMatch({
    position: p.position, ovr: p.overall, attrs: p.attrs, form: p.form, morale: p.morale,
    role: p.squadRole, teamStr: teamStrength(own), oppStr: teamStrength(opp), isHome,
  });
  const teamGoals = result.gh;
  const oppGoals = result.ga;
  const won = teamGoals > oppGoals;
  const lost = teamGoals < oppGoals;

  if (result.stats) {
    applyStats(G, result.stats, comp);
    updateFormMorale(p, result.stats, won, lost);
    const injury = rollInjury(p, result.stats.minutes);
    if (injury) addNews(G, `${fullName(p)} sofreu uma ${injury.desc.toLowerCase()} e ficará fora por ${injury.weeks} semana(s).`);
    if (result.stats.goals >= 2) addNews(G, `${fullName(p)} marca ${result.stats.goals} gols na ${won ? 'vitória' : 'partida'} contra o ${opp.name}!`);
    else if (result.stats.motm) addNews(G, `Atuação de gala: ${fullName(p)} é eleito o melhor em campo contra o ${opp.name}.`);
  } else {
    updateFormMorale(p, null, won, lost);
  }
  own.form = clamp(own.form + (won ? 0.4 : lost ? -0.4 : 0), -3, 3);
  opp.form = clamp(opp.form + (lost ? 0.4 : won ? -0.4 : 0), -3, 3);

  return {
    comp: compLabel,
    isHome,
    homeName: isHome ? own.name : opp.name,
    awayName: isHome ? opp.name : own.name,
    gh: isHome ? teamGoals : oppGoals,
    ga: isHome ? oppGoals : teamGoals,
    teamGoals, oppGoals, won, lost,
    oppName: opp.name,
    stadium: (isHome ? own : opp).stadium,
    stats: result.stats,
    week: G.week,
    year: G.seasonYear,
  };
}

function playYouthMatch(G) {
  const p = G.player;
  const own = G.clubs[p.clubId];
  const others = G.clubs.filter((c) => c.country === own.country && c.id !== own.id);
  const oppClub = choice(others);
  const teamStr = 48 + own.academy * 2 + gauss(0, 2);
  const oppStr = 48 + oppClub.academy * 2 + gauss(0, 2);
  const result = simPlayerMatch({
    position: p.position, ovr: p.overall, attrs: p.attrs, form: p.form, morale: p.morale,
    role: 'starter', teamStr, oppStr, isHome: chance(0.5),
  });
  const won = result.gh > result.ga;
  const lost = result.gh < result.ga;
  if (result.stats) {
    applyStats(G, result.stats, 'youth');
    updateFormMorale(p, result.stats, won, lost);
    const injury = rollInjury(p, result.stats.minutes);
    if (injury) addNews(G, `${fullName(p)} se lesionou na base: ${injury.desc.toLowerCase()}, fora por ${injury.weeks} semana(s).`);
  }
  return {
    comp: `Campeonato ${p.category}`,
    homeName: `${own.name} ${p.category}`,
    awayName: `${oppClub.name} ${p.category}`,
    gh: result.gh, ga: result.ga,
    teamGoals: result.gh, oppGoals: result.ga, won, lost,
    oppName: `${oppClub.name} ${p.category}`,
    stadium: `CT ${own.name}`,
    stats: result.stats,
    week: G.week,
    year: G.seasonYear,
  };
}

function playNatMatch(G, events) {
  const p = G.player;
  if (!p.natTeam.called) {
    p.natTeam.called = true;
    addNews(G, `${fullName(p)} é convocado pela primeira vez para a seleção de ${p.nationality}!`);
    events.push({ type: 'callup', text: `Você foi convocado para a seleção de ${p.nationality}!` });
    p.morale = clamp(p.morale + 8, 10, 99);
    p.reputation = clamp(p.reputation + 3, 1, 100);
  }
  const opponents = Object.keys(NATIONS).filter((n) => n !== p.nationality);
  const oppNation = choice(opponents);
  const ownStr = natTeamOvr(p.nationality);
  const oppStr = natTeamOvr(oppNation);
  const role = p.overall >= ownStr - 2 ? 'starter' : 'rotation';
  const result = simPlayerMatch({
    position: p.position, ovr: p.overall, attrs: p.attrs, form: p.form, morale: p.morale,
    role, teamStr: ownStr, oppStr, isHome: chance(0.5),
  });
  if (result.stats) {
    applyStats(G, result.stats, 'nat');
    if (result.stats.goals > 0) addNews(G, `${fullName(p)} marca pela seleção de ${p.nationality}!`);
  }
  events.push({
    type: 'match',
    report: {
      comp: 'Amistoso internacional',
      homeName: p.nationality, awayName: oppNation,
      gh: result.gh, ga: result.ga,
      teamGoals: result.gh, oppGoals: result.ga,
      won: result.gh > result.ga, lost: result.gh < result.ga,
      oppName: oppNation, stadium: 'Estádio Nacional',
      stats: result.stats, week: G.week, year: G.seasonYear,
    },
  });
}

function quickMatch(G, league, homeId, awayId) {
  const home = G.clubs[homeId];
  const away = G.clubs[awayId];
  const [gh, ga] = simScore(teamStrength(home), teamStrength(away));
  updateTable(league.table, homeId, awayId, gh, ga);
  home.form = clamp(home.form + (gh > ga ? 0.3 : gh < ga ? -0.3 : 0), -3, 3);
  away.form = clamp(away.form + (ga > gh ? 0.3 : ga < gh ? -0.3 : 0), -3, 3);
}

// ---------------- Semana ----------------

export function advanceWeek(G) {
  if (G.phase !== 'career') return [];
  const events = [];
  const p = G.player;

  // recuperação de lesão
  if (p.injury) {
    p.injury.weeks--;
    if (p.injury.weeks <= 0) {
      p.injury = null;
      events.push({ type: 'recovered', text: 'Você se recuperou da lesão e está de volta aos treinos.' });
    }
  }

  computeSquadRole(G);
  let weekMinutes = 0;
  let possible = 0;

  // rodadas de liga (todas as ligas do mundo)
  for (const league of G.leagues) {
    if (league.round >= league.fixtures.length) continue;
    const roundFixtures = league.fixtures[league.round];
    const club = playerClub(G);
    const isPlayerLeague = !p.youth && club && club.leagueId === league.id;
    for (const [homeId, awayId] of roundFixtures) {
      const isPlayerMatch = isPlayerLeague && (homeId === p.clubId || awayId === p.clubId);
      if (isPlayerMatch && !p.injury) {
        const report = playPlayerMatch(G, homeId, awayId, 'league', league.name);
        events.push({ type: 'match', report });
        updateTable(league.table, homeId, awayId, report.gh, report.ga);
        weekMinutes += report.stats ? report.stats.minutes : 0;
        possible += 90;
      } else {
        quickMatch(G, league, homeId, awayId);
      }
    }
    league.round++;
  }

  // partida da base
  if (p.youth && G.week <= YOUTH_ROUNDS) {
    possible += 90;
    if (!p.injury) {
      const report = playYouthMatch(G);
      events.push({ type: 'match', report });
      weekMinutes += report.stats ? report.stats.minutes : 0;
    }
  }

  // copas nacionais
  for (const cup of Object.values(G.cups)) {
    const pairs = preparePairings(cup, G.week);
    if (!pairs) continue;
    let playerResult = null;
    const club = playerClub(G);
    if (club && !p.youth && !p.injury) {
      const pair = pairs.find(([a, b]) => a === p.clubId || b === p.clubId);
      if (pair) {
        const label = `${cup.name} — ${roundName(cup)}`;
        const report = playPlayerMatch(G, pair[0], pair[1], 'cup', label);
        events.push({ type: 'match', report });
        weekMinutes += report.stats ? report.stats.minutes : 0;
        possible += 90;
        let won = report.won;
        if (report.teamGoals === report.oppGoals) won = chance(0.5); // pênaltis
        playerResult = { clubId: p.clubId, oppId: pair[0] === p.clubId ? pair[1] : pair[0], won, score: [report.gh, report.ga] };
      }
    }
    resolveRound(G, cup, playerResult);
    if (cup.winnerId !== null) {
      const winner = G.clubs[cup.winnerId];
      addNews(G, `${winner.name} conquista a ${cup.name}!`);
    }
  }

  // competições continentais
  for (const comp of G.continentals) {
    const pairs = preparePairings(comp, G.week);
    if (!pairs) continue;
    let playerResult = null;
    const club = playerClub(G);
    if (club && !p.youth && !p.injury && comp.alive.includes(p.clubId)) {
      const pair = pairs.find(([a, b]) => a === p.clubId || b === p.clubId);
      if (pair) {
        const label = `${comp.name} — ${roundName(comp)}`;
        const report = playPlayerMatch(G, pair[0], pair[1], 'continental', label);
        events.push({ type: 'match', report });
        weekMinutes += report.stats ? report.stats.minutes : 0;
        possible += 90;
        let won = report.won;
        if (report.teamGoals === report.oppGoals) won = chance(0.5);
        playerResult = { clubId: p.clubId, oppId: pair[0] === p.clubId ? pair[1] : pair[0], won, score: [report.gh, report.ga] };
      }
    }
    resolveRound(G, comp, playerResult);
    if (comp.winnerId !== null) {
      addNews(G, `${G.clubs[comp.winnerId].name} é campeão da ${comp.name}!`);
    }
  }

  // Mundial de Clubes (campeão UCL x campeão Libertadores)
  if (G.week === WORLD_CLUB_CUP_WEEK) {
    playWorldClubCup(G, events);
  }

  // seleção nacional (datas FIFA)
  if (NAT_WINDOW_WEEKS.includes(G.week) && !p.youth && isCalledUp(p)) {
    playNatMatch(G, events);
  }

  // desenvolvimento mensal
  G.monthMinutes += weekMinutes;
  G.monthPossible += possible;
  if (G.week % 4 === 0) {
    const league = playerLeague(G);
    const minutesShare = G.monthPossible > 0 ? clamp(G.monthMinutes / G.monthPossible, 0, 1) : 0.3;
    const gained = monthlyDevelopment(p, {
      trainQuality: trainQuality(G),
      leagueStrength: p.youth ? (league ? league.strength * 0.8 : 5) : (league ? league.strength : 6),
      minutesShare,
    });
    if (gained >= 10) events.push({ type: 'growth', text: `Seus treinos estão rendendo: +${gained} pontos de atributo neste mês.` });
    G.monthMinutes = 0;
    G.monthPossible = 0;
    const club = playerClub(G);
    updateReputation(p, club ? club.rep : 3, league ? league.strength : 5);
    p.value = marketValue(p);
  }

  weeklyFormDrift(p);

  // janelas de transferência
  if (G.week === 2 || G.week === 20) {
    const offers = generateOffers(G);
    if (offers.length > 0) {
      G.offers = offers;
      for (const o of offers) {
        addNews(G, `${o.clubName} demonstrou interesse em ${fullName(p)}${o.type === 'loan' ? ' (empréstimo)' : ''}.`);
      }
      events.push({ type: 'offers', text: `Você recebeu ${offers.length} proposta(s)! Confira a aba Transferências.` });
    }
  }
  if (G.week === 6 || G.week === 25) {
    if (G.offers.length > 0) {
      addNews(G, 'A janela de transferências fechou. As propostas expiraram.');
      G.offers = [];
    }
  }

  // avaliação de promoção no meio da temporada
  if (G.week === 20) {
    maybePromote(G, events, false);
  }

  // mercado de IA gera notícias ocasionais
  if (chance(0.2)) {
    for (const n of aiMarketNews(G, 1)) addNews(G, n);
  }

  G.week++;
  if (G.week > SEASON_WEEKS) {
    endSeason(G, events);
  }
  return events;
}

function playWorldClubCup(G, events) {
  const ucl = G.continentals.find((c) => c.id === 'UCL');
  const lib = G.continentals.find((c) => c.id === 'LIB');
  if (!ucl || !lib || ucl.winnerId === null || lib.winnerId === null) return;
  const a = ucl.winnerId;
  const b = lib.winnerId;
  const p = G.player;
  if (!p.youth && !p.injury && (p.clubId === a || p.clubId === b)) {
    const report = playPlayerMatch(G, a, b, 'wcc', 'Mundial de Clubes — Final');
    events.push({ type: 'match', report });
    let won = report.won;
    if (report.teamGoals === report.oppGoals) won = chance(0.5);
    G.wccWinnerId = won ? p.clubId : (p.clubId === a ? b : a);
  } else {
    const [gh, ga] = simScore(teamStrength(G.clubs[a]), teamStrength(G.clubs[b]), 0);
    G.wccWinnerId = gh > ga ? a : ga > gh ? b : (chance(0.5) ? a : b);
  }
  addNews(G, `${G.clubs[G.wccWinnerId].name} é campeão do Mundial de Clubes!`);
}

// ---------------- Promoção, dispensa, aposentadoria ----------------

function promote(G, events) {
  const p = G.player;
  const club = playerClub(G);
  p.youth = false;
  p.category = null;
  p.contract.wage = Math.max(p.contract.wage, wageFor(p, club) * 0.5);
  p.contract.years = Math.max(p.contract.years, 2);
  computeSquadRole(G);
  p.morale = clamp(p.morale + 10, 10, 99);
  p.reputation = clamp(p.reputation + 4, 1, 100);
  events.push({ type: 'promotion', text: 'Seu treinador acredita que você está pronto para o futebol profissional. Você foi promovido ao elenco principal!' });
  addNews(G, `Jovem promessa: ${fullName(p)} é promovido ao time principal do ${club.name}.`);
}

function releaseToSmallerClub(G, events) {
  const p = G.player;
  const oldClub = playerClub(G);
  let candidates = G.clubs.filter((c) => c.id !== p.clubId && c.avgOvr <= p.overall + 6);
  if (candidates.length === 0) {
    candidates = G.clubs.slice().sort((a, b) => a.avgOvr - b.avgOvr).slice(0, 10);
  }
  candidates.sort((a, b) => b.avgOvr - a.avgOvr);
  const dest = choice(candidates.slice(0, Math.min(5, candidates.length)));
  p.clubId = dest.id;
  p.parentClubId = null;
  p.youth = false;
  p.category = null;
  p.contract = { wage: wageFor(p, dest) * 0.6, years: 2 };
  computeSquadRole(G);
  p.morale = clamp(p.morale - 10, 10, 99);
  events.push({ type: 'released', text: `O ${oldClub.name} decidiu não seguir com você. Você assinou com o ${dest.name}.` });
  addNews(G, `${fullName(p)} deixa o ${oldClub.name} e assina com o ${dest.name}.`);
}

function maybePromote(G, events, seasonEnd) {
  const p = G.player;
  if (!p.youth || p.clubId === null) return;
  const club = playerClub(G);
  const rating = avgRating(p.seasonStats);
  const ready = p.age >= 16 && (p.overall >= club.avgOvr - 9 || (rating >= 7.4 && p.overall >= club.avgOvr - 12));
  if (ready) {
    promote(G, events);
    return;
  }
  if (seasonEnd && p.age >= 19) {
    if (p.overall >= club.avgOvr - 13) promote(G, events);
    else releaseToSmallerClub(G, events);
  }
}

export function retirePlayer(G) {
  G.wantRetire = true;
}

function doRetire(G, events) {
  const p = G.player;
  p.retired = true;
  G.phase = 'retired';
  events.push({ type: 'retired', text: `Fim de uma era: ${fullName(p)} anuncia aposentadoria aos ${p.age} anos.` });
  addNews(G, `${fullName(p)} pendura as chuteiras. Obrigado, craque!`);
}

// ---------------- Fim de temporada ----------------

function endSeason(G, events) {
  const p = G.player;
  const seasonTitles = [];
  const seasonAwards = [];
  const playedEnough = p.seasonStats.apps >= 5;

  // campeões e classificação final
  for (const league of G.leagues) {
    const standings = tableStandings(league);
    league.lastStandings = standings;
    league.lastChampionId = standings[0];
  }
  const myLeague = playerLeague(G);
  const myClub = playerClub(G);

  if (myLeague && myClub) {
    const champion = G.clubs[myLeague.lastChampionId];
    addNews(G, `${champion.name} é o campeão da ${myLeague.name} de ${G.seasonYear}!`);
    if (!p.youth && myLeague.lastChampionId === p.clubId && playedEnough) {
      seasonTitles.push(myLeague.name);
    }
    const cup = G.cups[myLeague.id];
    if (cup && cup.winnerId === p.clubId && !p.youth && playedEnough) {
      seasonTitles.push(cup.name);
    }
    for (const comp of G.continentals) {
      if (comp.winnerId === p.clubId && !p.youth && playedEnough) seasonTitles.push(comp.name);
    }
    if (G.wccWinnerId === p.clubId && !p.youth && playedEnough) seasonTitles.push('Mundial de Clubes');
  }

  // prêmios individuais
  const rating = avgRating(p.seasonStats);
  if (!p.youth && myLeague && (p.seasonStats.leagueApps || 0) >= 15) {
    const aiTopScorer = ri(14, 26);
    if ((p.seasonStats.leagueGoals || 0) > aiTopScorer) {
      seasonAwards.push(`Artilheiro da ${myLeague.name}`);
    }
    if (p.age <= 21 && rating >= 7.15 && p.seasonStats.apps >= 15) {
      seasonAwards.push('Melhor jogador jovem da temporada');
    }
    if (rating >= 7.45 && p.seasonStats.apps >= 20) {
      const standing = myLeague.lastStandings.indexOf(p.clubId);
      if (standing >= 0 && standing < 6) seasonAwards.push(`Melhor jogador da ${myLeague.name}`);
    }
    if (rating >= 7.3 && p.seasonStats.apps >= 18) {
      seasonAwards.push(`Time da temporada — ${myLeague.name}`);
    }
  }

  // Torneio de seleções no verão
  const tournament = tournamentForYear(G.seasonYear, p.nationality);
  if (tournament) {
    const isWC = tournament === 'Copa do Mundo';
    const called = !p.youth && isCalledUp(p);
    const result = simNationalTournament(p.nationality, isWC);
    if (called) {
      // estatísticas do jogador no torneio
      for (let i = 0; i < result.playerMatches; i++) {
        p.natTeam.caps++;
        p.seasonStats.natApps++;
        if (chance(0.22 + (p.overall - 75) / 200)) {
          p.natTeam.goals++;
          p.seasonStats.natGoals++;
        }
      }
      if (result.playerWon) {
        seasonTitles.push(tournament);
        p.reputation = clamp(p.reputation + 12, 1, 100);
        addNews(G, `${p.nationality} vence a ${tournament} com ${fullName(p)} no elenco!`);
      } else {
        addNews(G, `${result.champion} conquista a ${tournament}. Sua seleção ficou pelo caminho.`);
      }
    } else {
      addNews(G, `${result.champion} conquista a ${tournament} de ${G.seasonYear}.`);
    }
  }

  // Bola de Ouro
  if (!p.youth && p.overall >= 88 && rating >= 7.3 && p.seasonStats.apps >= 25) {
    const bigTitle = seasonTitles.some((t) => ['Champions League', 'Copa Libertadores', 'Copa do Mundo'].includes(t));
    const score = (p.overall - 88) * 8 + (rating - 7.3) * 60 + (bigTitle ? 35 : 0) + p.seasonStats.goals;
    if (score >= 55 || chance(score / 140)) {
      seasonAwards.push('Bola de Ouro');
      p.reputation = clamp(p.reputation + 15, 1, 100);
      addNews(G, `${fullName(p)} vence a BOLA DE OURO de ${G.seasonYear}!`);
    }
  }

  for (const t of seasonTitles) {
    p.titles.push({ year: G.seasonYear, name: t, club: t === tournament ? p.nationality : (myClub ? myClub.name : '') });
    events.push({ type: 'title', text: `🏆 Título conquistado: ${t}!` });
  }
  for (const a of seasonAwards) {
    p.awards.push({ year: G.seasonYear, name: a });
    events.push({ type: 'award', text: `🏅 Prêmio individual: ${a}!` });
    addNews(G, `${fullName(p)} recebe o prêmio: ${a}.`);
  }

  // histórico da temporada
  p.seasonHistory.push({
    year: G.seasonYear,
    age: p.age,
    club: myClub ? myClub.name : '—',
    division: p.youth ? `Base (${p.category})` : (myLeague ? myLeague.name : '—'),
    apps: p.seasonStats.apps,
    goals: p.seasonStats.goals,
    assists: p.seasonStats.assists,
    avgRating: rating > 0 ? Math.round(rating * 100) / 100 : 0,
    ovr: p.overall,
    natApps: p.seasonStats.natApps,
    natGoals: p.seasonStats.natGoals,
    titles: seasonTitles,
    awards: seasonAwards,
  });

  // envelhecimento e contratos
  p.age++;
  if (p.youth) p.category = youthCategory(p.age);

  // retorno de empréstimo
  if (p.parentClubId !== null) {
    const parent = G.clubs[p.parentClubId];
    addNews(G, `${fullName(p)} retorna de empréstimo ao ${parent.name}.`);
    p.clubId = p.parentClubId;
    p.parentClubId = null;
    p.youth = false;
  }

  if (!p.youth) {
    p.contract.years--;
    const club = playerClub(G);
    if (p.contract.years <= 0 && club) {
      if (p.overall >= club.avgOvr - 10 && p.age <= 36) {
        p.contract = { wage: wageFor(p, club), years: ri(2, 4) };
        addNews(G, `${club.name} renova o contrato de ${fullName(p)} por ${p.contract.years} temporadas.`);
      } else {
        releaseToSmallerClub(G, events);
      }
    }
  }

  // promoção da base no fim da temporada
  maybePromote(G, events, true);

  // aposentadoria
  const mustRetire = p.age >= 40 || (p.age >= 36 && p.overall < 70) || (p.age >= 33 && p.overall < 62);
  if (G.wantRetire || mustRetire) {
    doRetire(G, events);
    return;
  }

  // evolução do mundo (IA)
  evolveWorld(G);

  p.value = marketValue(p);
  p.seasonStats = emptySeasonStats();
  G.offers = [];
  G.seasonYear++;
  G.seasonNumber++;
  startSeasonStructures(G);
  addNews(G, `Começa a temporada ${G.seasonYear}! Boa sorte.`);
  events.push({ type: 'newSeason', text: `Nova temporada: ${G.seasonYear}. Você tem ${p.age} anos.` });
}

// Mundo vivo: jogadores de IA evoluem, envelhecem, se aposentam; técnicos mudam.
function evolveWorld(G) {
  for (const club of G.clubs) {
    for (let i = 0; i < club.squad.length; i++) {
      const pl = club.squad[i];
      pl.age++;
      if (pl.age <= 23) pl.ovr = clamp(pl.ovr + ri(0, 3), 40, 97);
      else if (pl.age <= 29) pl.ovr = clamp(pl.ovr + ri(-1, 1), 40, 97);
      else pl.ovr = clamp(pl.ovr - ri(0, 3), 40, 97);
      if (pl.age >= 36 || (pl.age >= 33 && pl.ovr < 62)) {
        // aposenta e surge um garoto da base
        club.squad[i] = {
          name: aiName(club.country),
          pos: pl.pos,
          age: ri(17, 19),
          ovr: clamp(Math.round(gauss(club.avgOvr - 10, 5)), 45, 82),
        };
      }
    }
    // overall médio do clube acompanha o elenco
    const top = club.squad.map((x) => x.ovr).sort((a, b) => b - a).slice(0, 18);
    club.avgOvr = Math.round(top.reduce((a, b) => a + b, 0) / top.length);
    club.form = 0;
    if (chance(0.12)) {
      club.manager = aiName(club.country);
      addNews(G, `${club.name} anuncia novo treinador: ${club.manager}.`);
    }
  }
  for (const n of aiMarketNews(G, 5)) addNews(G, n);
}

// ---------------- Ações do usuário ----------------

export function acceptOffer(G, offerId) {
  const offer = G.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Proposta não encontrada');
  const text = applyTransfer(G, offer);
  addNews(G, text);
  G.offers = [];
  computeSquadRole(G);
  G.player.morale = clamp(G.player.morale + 6, 10, 99);
  G.player.value = marketValue(G.player);
  return text;
}

export function rejectOffer(G, offerId) {
  G.offers = G.offers.filter((o) => o.id !== offerId);
}

export function negotiate(G, offerId) {
  const offer = G.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, withdrawn: false };
  const result = negotiateOffer(offer);
  if (result.withdrawn) {
    G.offers = G.offers.filter((o) => o.id !== offerId);
    addNews(G, `${offer.clubName} retirou a proposta após a negociação.`);
  }
  return result;
}

export function setTrainingFocus(G, focus) {
  G.player.trainingFocus = focus;
}

// Totais de carreira (histórico + temporada atual)
export function careerTotals(G) {
  const p = G.player;
  const t = { apps: 0, goals: 0, assists: 0, motm: 0, seasons: p.seasonHistory.length };
  for (const s of p.seasonHistory) {
    t.apps += s.apps;
    t.goals += s.goals;
    t.assists += s.assists;
  }
  t.apps += p.seasonStats.apps;
  t.goals += p.seasonStats.goals;
  t.assists += p.seasonStats.assists;
  return t;
}

// Próximo compromisso do jogador (para a UI)
export function nextFixture(G) {
  const p = G.player;
  if (G.phase !== 'career') return null;
  if (p.youth) {
    if (G.week <= YOUTH_ROUNDS) return { comp: `Campeonato ${p.category}`, desc: 'Rodada da base' };
    return { comp: 'Férias da base', desc: 'Aguardando a nova temporada' };
  }
  const league = playerLeague(G);
  if (league && league.round < league.fixtures.length) {
    const fixture = league.fixtures[league.round].find(([h, a]) => h === p.clubId || a === p.clubId);
    if (fixture) {
      const isHome = fixture[0] === p.clubId;
      const opp = G.clubs[isHome ? fixture[1] : fixture[0]];
      return { comp: league.name, desc: `${isHome ? 'vs' : '@'} ${opp.name}`, opp: opp.name, isHome };
    }
  }
  return { comp: 'Sem jogos esta semana', desc: 'Treinamento' };
}

export { getSeed, seed, avgRating, fullName, marketValue, tableStandings, teamStrength };
