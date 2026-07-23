// Sistema de "base roletada": sorteio ponderado da academia inicial.
// Academias de clubes grandes são mais raras; clubes menores têm maior probabilidade.
// A roleta também sorteia o perfil do jogador (posição, pé, estilo, camisa),
// a menos que um perfil fixo tenha sido definido na criação.

import { choice, chance, weightedChoice } from './rng.js';
import { youthCategory, rollInitialProfile } from './player.js';

export const MAX_REROLLS = 3;

// Peso do sorteio: quanto menor a academia, maior a chance
export function academyWeight(club) {
  return Math.pow(11.5 - club.academy, 1.7);
}

// Distribuição realista de posições sorteadas
const POSITION_WEIGHTS = [
  ['ST', 14], ['CAM', 10], ['CM', 12], ['CDM', 8], ['RW', 9], ['LW', 9],
  ['CF', 5], ['CB', 12], ['RB', 7], ['LB', 7], ['GK', 7],
];

function randomPosition() {
  return weightedChoice(POSITION_WEIGHTS, (p) => p[1])[0];
}

function randomFoot(position) {
  if (chance(0.05)) return 'Ambidestro';
  if (position === 'LB' || position === 'LW') return chance(0.65) ? 'Esquerdo' : 'Direito';
  return chance(0.75) ? 'Direito' : 'Esquerdo';
}

const STYLES_BY_POSITION = {
  GK: ['Completo'],
  CB: ['Muralha (defensivo)', 'Completo'],
  RB: ['Velocista', 'Motor (box-to-box)', 'Muralha (defensivo)'],
  LB: ['Velocista', 'Motor (box-to-box)', 'Muralha (defensivo)'],
  CDM: ['Motor (box-to-box)', 'Muralha (defensivo)', 'Cérebro (armador)'],
  CM: ['Motor (box-to-box)', 'Cérebro (armador)', 'Completo'],
  CAM: ['Craque técnico', 'Cérebro (armador)', 'Finalizador'],
  RW: ['Velocista', 'Craque técnico', 'Finalizador'],
  LW: ['Velocista', 'Craque técnico', 'Finalizador'],
  CF: ['Finalizador', 'Craque técnico', 'Completo'],
  ST: ['Finalizador', 'Velocista', 'Completo'],
};

function randomStyle(position) {
  return choice(STYLES_BY_POSITION[position] || ['Completo']);
}

const SHIRTS_BY_POSITION = {
  GK: [1, 12, 23, 25], CB: [3, 4, 2, 13], RB: [2, 22, 14], LB: [6, 3, 16],
  CDM: [5, 8, 15], CM: [8, 6, 18], CAM: [10, 21, 20], RW: [7, 11, 17],
  LW: [11, 7, 27], CF: [10, 9, 19], ST: [9, 7, 10, 99],
};

function typicalShirt(position) {
  return choice(SHIRTS_BY_POSITION[position] || [10]);
}

/**
 * Sorteia um clube do país escolhido e gera o perfil inicial do jogador.
 * Retorna { clubId, category, profile, position, foot, style, shirt } sem
 * aplicar ainda (o usuário pode confirmar ou roletar de novo).
 */
export function rollAcademy(G, country) {
  const candidates = G.clubs.filter((c) => c.country === country);
  if (candidates.length === 0) throw new Error(`Nenhum clube disponível no país: ${country}`);
  const club = weightedChoice(candidates, academyWeight);

  // perfil: usa o que foi fixado na criação, sorteia o resto
  const p = G.player;
  const custom = G.customProfile || {};
  p.position = custom.position || randomPosition();
  p.foot = custom.foot || randomFoot(p.position);
  p.style = custom.style || randomStyle(p.position);
  p.shirt = custom.shirt || typicalShirt(p.position);

  const profile = rollInitialProfile(p, club.academy);
  return {
    clubId: club.id,
    clubName: club.name,
    academyLevel: club.academy,
    category: youthCategory(p.age),
    profile,
    position: p.position,
    foot: p.foot,
    style: p.style,
    shirt: p.shirt,
  };
}

export function applyAcademy(G, roll) {
  const p = G.player;
  p.clubId = roll.clubId;
  p.attrs = roll.profile.attrs;
  p.overall = roll.profile.overall;
  p.potential = roll.profile.potential;
  p.category = roll.category;
  p.youth = true;
  p.squadRole = 'youth';
  p.reputation = 5 + G.clubs[roll.clubId].rep;
  p.contract = { wage: 0.5 + G.clubs[roll.clubId].rep * 0.15, years: 3 };
}
