// Copas nacionais, competições continentais e seleções nacionais.

import { NATIONS, CONF_TOURNAMENTS } from '../data/nations.js';
import { teamStrength, tableStandings } from './world.js';
import { simScore } from './match.js';
import { chance, shuffle, choice } from './rng.js';

export const CUP_WEEKS = [6, 14, 22, 30];
export const CONTINENTAL_WEEKS = [10, 18, 26, 34];
export const NAT_WINDOW_WEEKS = [16, 32];
export const WORLD_CLUB_CUP_WEEK = 39;

// Vagas por liga: quem termina bem na tabela vai para a competição
// continental na temporada seguinte (ex.: G3 da Premier League → Champions).
export const CONTINENTAL_DEFS = [
  {
    id: 'UCL', name: 'Champions League', conf: 'UEFA', size: 16,
    slots: { ENG1: 3, ESP1: 2, GER1: 2, ITA1: 2, FRA1: 2, POR1: 1, NED1: 1, BEL1: 1, TUR1: 1, SCO1: 1 },
  },
  {
    id: 'LIB', name: 'Copa Libertadores', conf: 'CONMEBOL', size: 16,
    slots: { BRA1: 8, ARG1: 8 },
  },
  {
    id: 'CCC', name: 'Champions Cup CONCACAF', conf: 'CONCACAF', size: 8,
    slots: { USA1: 4, MEX1: 4 },
  },
  {
    id: 'ACL', name: 'Champions League Asiática', conf: 'AFC', size: 8,
    slots: { SAU1: 8 },
  },
];

// Quantas vagas continentais uma liga tem (para a UI destacar a zona de classificação)
export function slotsForLeague(leagueId) {
  for (const def of CONTINENTAL_DEFS) {
    if (def.slots && def.slots[leagueId]) {
      return { n: def.slots[leagueId], name: def.name };
    }
  }
  return null;
}

function confOfLeague(G, league) {
  return (NATIONS[league.country] || {}).conf;
}

// ---------- Copas nacionais ----------

export function initCups(G) {
  G.cups = {};
  for (const league of G.leagues) {
    const sorted = league.clubIds.slice().sort((a, b) => G.clubs[b].rep - G.clubs[a].rep);
    const size = sorted.length >= 16 ? 16 : 8;
    const teams = shuffle(sorted.slice(0, size));
    const rounds = Math.log2(size);
    G.cups[league.id] = {
      name: league.cupName,
      leagueId: league.id,
      alive: teams,
      roundWeeks: CUP_WEEKS.slice(CUP_WEEKS.length - rounds),
      roundIdx: 0,
      pending: null,
      winnerId: null,
    };
  }
}

// ---------- Competições continentais ----------

export function initContinentals(G) {
  G.continentals = [];
  for (const def of CONTINENTAL_DEFS) {
    const leagues = G.leagues.filter((l) => confOfLeague(G, l) === def.conf);
    if (leagues.length === 0) continue;
    // Classificados pela POSIÇÃO NA TABELA da temporada anterior.
    // Na primeira temporada (sem tabela) usa a ordem de reputação.
    const picked = new Set();
    for (const l of leagues) {
      const n = (def.slots && def.slots[l.id]) || 1;
      const order = (l.lastStandings && l.lastStandings.length > 0)
        ? l.lastStandings
        : l.clubIds.slice().sort((a, b) => (G.clubs[b].rep * 10 + G.clubs[b].avgOvr) - (G.clubs[a].rep * 10 + G.clubs[a].avgOvr));
      for (const id of order.slice(0, n)) picked.add(id);
    }
    // completa vagas restantes com os melhores clubes de fora, se faltar
    if (picked.size < def.size) {
      const pool = leagues
        .flatMap((l) => l.clubIds)
        .filter((id) => !picked.has(id))
        .sort((a, b) => (G.clubs[b].rep * 10 + G.clubs[b].avgOvr) - (G.clubs[a].rep * 10 + G.clubs[a].avgOvr));
      for (const id of pool) {
        if (picked.size >= def.size) break;
        picked.add(id);
      }
    }
    const teams = [...picked].slice(0, def.size);
    const rounds = Math.log2(def.size);
    G.continentals.push({
      id: def.id,
      name: def.name,
      conf: def.conf,
      teams: teams.slice(), // lista de classificados (fixa; alive muda a cada fase)
      alive: shuffle(teams),
      roundWeeks: CONTINENTAL_WEEKS.slice(CONTINENTAL_WEEKS.length - rounds),
      roundIdx: 0,
      pending: null,
      winnerId: null,
    });
  }
}

// ---------- Mata-mata genérico ----------

// Prepara os confrontos da rodada se esta semana for de jogo
export function preparePairings(comp, week) {
  if (comp.winnerId !== null) return null;
  if (comp.roundIdx >= comp.roundWeeks.length) return null;
  if (comp.roundWeeks[comp.roundIdx] !== week) return null;
  if (!comp.pending) {
    const teams = shuffle(comp.alive);
    const pairs = [];
    for (let i = 0; i < teams.length; i += 2) pairs.push([teams[i], teams[i + 1]]);
    comp.pending = pairs;
  }
  return comp.pending;
}

// Resolve a rodada. playerResult: { clubId, oppId, won } se o clube do jogador jogou.
export function resolveRound(G, comp, playerResult) {
  if (!comp.pending) return [];
  const winners = [];
  const results = [];
  for (const [a, b] of comp.pending) {
    let winner;
    let score;
    if (playerResult && ((a === playerResult.clubId && b === playerResult.oppId) || (b === playerResult.clubId && a === playerResult.oppId))) {
      winner = playerResult.won ? playerResult.clubId : playerResult.oppId;
      score = playerResult.score;
    } else {
      const [gh, ga] = simScore(teamStrength(G.clubs[a]), teamStrength(G.clubs[b]));
      score = [gh, ga];
      if (gh > ga) winner = a;
      else if (ga > gh) winner = b;
      else winner = chance(0.5) ? a : b; // pênaltis
    }
    winners.push(winner);
    results.push({ home: a, away: b, score, winner });
  }
  comp.alive = winners;
  comp.pending = null;
  comp.roundIdx++;
  if (comp.alive.length === 1) comp.winnerId = comp.alive[0];
  return results;
}

export function roundName(comp) {
  const remaining = comp.alive.length;
  if (remaining <= 2) return 'Final';
  if (remaining <= 4) return 'Semifinal';
  if (remaining <= 8) return 'Quartas de final';
  return 'Oitavas de final';
}

// ---------- Seleções nacionais ----------

export function natTeamOvr(nation) {
  const rep = (NATIONS[nation] || { teamRep: 6 }).teamRep;
  return Math.round(56 + rep * 3.2);
}

export function callupThreshold(nation) {
  const rep = (NATIONS[nation] || { teamRep: 6 }).teamRep;
  return Math.round(55 + rep * 2.8);
}

export function isCalledUp(player) {
  if (player.retired || player.injury) return false;
  const thr = callupThreshold(player.nationality);
  return player.overall >= thr && player.reputation >= 20;
}

// Torneio de seleções no fim da temporada: Copa do Mundo (ano % 4 == 2)
// ou torneio continental (ano % 4 == 0).
export function tournamentForYear(year, nation) {
  const conf = (NATIONS[nation] || {}).conf;
  if (year % 4 === 2) return 'Copa do Mundo';
  if (year % 4 === 0) return CONF_TOURNAMENTS[conf] || null;
  return null;
}

/**
 * Simula um torneio de seleções (4 rodadas de mata-mata com 16 seleções).
 * Retorna { champion, playerReached, playerMatches } — playerMatches é o nº
 * de jogos que a seleção do jogador disputou.
 */
export function simNationalTournament(playerNation, isWorldCup) {
  const all = Object.keys(NATIONS)
    .filter((n) => isWorldCup || NATIONS[n].conf === NATIONS[playerNation].conf)
    .sort((a, b) => NATIONS[b].teamRep - NATIONS[a].teamRep);
  // tamanho do torneio: maior potência de 2 que cabe na confederação (máx. 16)
  let size = 16;
  while (size > all.length) size = Math.floor(size / 2);
  size = Math.max(2, size);
  let teams = all.slice(0, size);
  if (!teams.includes(playerNation)) {
    teams = [playerNation, ...teams.slice(0, size - 1)];
  }
  teams = shuffle(teams);
  let playerMatches = 0;
  let playerAlive = true;
  while (teams.length > 1) {
    const next = [];
    for (let i = 0; i < teams.length; i += 2) {
      const a = teams[i];
      const b = teams[i + 1];
      const [gh, ga] = simScore(natTeamOvr(a), natTeamOvr(b), 0);
      let winner = gh > ga ? a : ga > gh ? b : (chance(0.5) ? a : b);
      if ((a === playerNation || b === playerNation) && playerAlive) {
        playerMatches++;
        if (winner !== playerNation) playerAlive = false;
      }
      next.push(winner);
    }
    teams = next;
  }
  return { champion: teams[0], playerMatches, playerWon: teams[0] === playerNation };
}

export { tableStandings };
