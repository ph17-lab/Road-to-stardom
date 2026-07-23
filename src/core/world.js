// Construção do mundo do jogo: ligas, clubes, elencos de IA e seleções.
// Todo o estado é serializável em JSON (sem classes) para facilitar o salvamento.

import { LEAGUES_DATA, stadiumFor } from '../data/leagues.js';
import { NATIONS } from '../data/nations.js';
import { poolFor } from '../data/names.js';
import { ri, gauss, clamp, choice, chance } from './rng.js';

// Modelo de elenco de IA por posição (24 jogadores)
const SQUAD_TEMPLATE = [
  'GK', 'GK', 'GK',
  'CB', 'CB', 'CB', 'CB',
  'RB', 'RB', 'LB', 'LB',
  'CDM', 'CDM', 'CM', 'CM', 'CM',
  'CAM', 'CAM', 'RW', 'RW', 'LW', 'LW',
  'ST', 'ST',
];

// Vagas de cada posição no 4-1-2-1-2/4-3-3 híbrido usado para disputa por titularidade
export const POSITION_SLOTS = { GK: 1, CB: 2, RB: 1, LB: 1, CDM: 1, CM: 2, CAM: 1, RW: 1, LW: 1, ST: 1, CF: 1 };

export function aiName(country) {
  const pool = poolFor((NATIONS[country] || { pool: 'en' }).pool);
  return `${choice(pool.first)} ${choice(pool.last)}`;
}

function makeAiPlayer(country, pos, avgOvr) {
  const age = ri(18, 34);
  // jogadores mais jovens tendem a ser um pouco piores que a média do elenco
  const ageAdj = age <= 20 ? -4 : age >= 31 ? -1 : 1;
  const ovr = clamp(Math.round(gauss(avgOvr + ageAdj, 4)), 45, 96);
  return { name: aiName(country), pos, age, ovr };
}

function makeSquad(country, avgOvr) {
  return SQUAD_TEMPLATE.map((pos) => makeAiPlayer(country, pos, avgOvr));
}

export function buildWorld() {
  const clubs = [];
  const leagues = [];
  let clubId = 0;

  for (const L of LEAGUES_DATA) {
    const clubIds = [];
    for (const [name, rep, academy, avgOvr, budget] of L.clubs) {
      // 15% dos jogadores de IA são estrangeiros de países vizinhos do banco
      const squad = makeSquad(L.country, avgOvr).map((p) => {
        if (chance(0.15)) p.name = aiName(choice(Object.keys(NATIONS)));
        return p;
      });
      clubs.push({
        id: clubId,
        name,
        country: L.country,
        leagueId: L.id,
        rep,
        academy,
        avgOvr,
        budget,
        stadium: stadiumFor(name),
        squad,
        manager: aiName(L.country),
        form: 0,
      });
      clubIds.push(clubId);
      clubId++;
    }
    leagues.push({
      id: L.id,
      name: L.name,
      country: L.country,
      strength: L.strength,
      cupName: L.cupName,
      clubIds,
      fixtures: [],
      round: 0,
      table: {},
      lastChampionId: null,
    });
  }
  return { clubs, leagues };
}

export function clubById(G, id) {
  return G.clubs[id];
}

export function leagueById(G, id) {
  return G.leagues.find((l) => l.id === id);
}

export function leagueOfClub(G, club) {
  return leagueById(G, club.leagueId);
}

// Força efetiva do elenco (média dos 18 melhores) com bônus de forma
export function teamStrength(club) {
  const top = club.squad.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 18);
  const avg = top.reduce((a, b) => a + b, 0) / top.length;
  return avg + club.form * 0.5;
}

export function emptyTable(clubIds) {
  const t = {};
  for (const id of clubIds) t[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return t;
}

export function tableStandings(league) {
  return league.clubIds
    .slice()
    .sort((a, b) => {
      const ta = league.table[a];
      const tb = league.table[b];
      return tb.pts - ta.pts || (tb.gf - tb.ga) - (ta.gf - ta.ga) || tb.gf - ta.gf;
    });
}

// Tabela de jogos: turno e returno (método do círculo)
export function generateFixtures(clubIds) {
  const ids = clubIds.slice();
  if (ids.length % 2 === 1) ids.push(-1); // folga
  const n = ids.length;
  const rounds = [];
  const rotating = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    const lineup = [ids[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const home = lineup[i];
      const away = lineup[n - 1 - i];
      if (home !== -1 && away !== -1) {
        round.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(round);
    rotating.unshift(rotating.pop());
  }
  const second = rounds.map((round) => round.map(([h, a]) => [a, h]));
  return rounds.concat(second);
}

export function updateTable(table, homeId, awayId, gh, ga) {
  const h = table[homeId];
  const a = table[awayId];
  h.p++; a.p++;
  h.gf += gh; h.ga += ga;
  a.gf += ga; a.ga += gh;
  if (gh > ga) { h.w++; a.l++; h.pts += 3; }
  else if (gh < ga) { a.w++; h.l++; a.pts += 3; }
  else { h.d++; a.d++; h.pts++; a.pts++; }
}
