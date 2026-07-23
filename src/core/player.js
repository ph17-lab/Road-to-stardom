// Criação do jogador do usuário, valor de mercado, salário e utilidades.

import { createAttributes, calcOverall } from './attributes.js';
import { ri, gauss, clamp } from './rng.js';

// Faixas de overall inicial por idade (ajustadas pela academia sorteada)
export function initialOvrRange(age) {
  if (age <= 14) return [46, 60];
  if (age === 15) return [50, 65];
  if (age === 16) return [55, 70];
  if (age === 17) return [60, 75];
  return [62, 78];
}

export function youthCategory(age) {
  if (age <= 15) return 'Sub-15';
  if (age <= 17) return 'Sub-17';
  return 'Sub-20';
}

export function createPlayer(cfg) {
  return {
    firstName: cfg.firstName,
    lastName: cfg.lastName,
    nationality: cfg.nationality || 'Brasil',
    foot: cfg.foot || 'Direito',
    position: cfg.position || 'ST',
    height: cfg.height || 175,
    shirt: cfg.shirt || 10,
    style: cfg.style || 'Completo',
    age: cfg.age || 15,
    attrs: null,
    overall: 0,
    potential: 0,
    form: 60,
    morale: 70,
    reputation: 5,
    injury: null, // { weeks, desc }
    clubId: null,
    parentClubId: null, // clube de origem quando emprestado
    youth: true,
    category: youthCategory(cfg.age),
    squadRole: 'youth',
    contract: { wage: 0.5, years: 3 },
    value: 0.1,
    trainingFocus: 'Específico da posição',
    seasonStats: emptySeasonStats(),
    seasonHistory: [],
    titles: [],
    awards: [],
    natTeam: { caps: 0, goals: 0, called: false },
    retired: false,
  };
}

export function emptySeasonStats() {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0,
    ratingSum: 0, ratingCount: 0, motm: 0, yellow: 0, red: 0, cleanSheets: 0,
    natApps: 0, natGoals: 0,
  };
}

export function avgRating(stats) {
  return stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : 0;
}

// Gera atributos e overall inicial de acordo com idade, academia e potencial
export function rollInitialProfile(player, academyLevel) {
  const [lo, hi] = initialOvrRange(player.age);
  const target = clamp(Math.round(gauss((lo + hi) / 2 + (academyLevel - 5) * 1.2, 3)), lo, hi);
  const attrs = createAttributes(player.position, target, player.style, player.height);
  const ovr = calcOverall(attrs, player.position);
  // Potencial: distribui entre ~70 e 96, com leve bônus de academias melhores
  let pot = Math.round(gauss(77 + academyLevel * 1.3, 6));
  pot = clamp(Math.max(pot, ovr + 8), 68, 96);
  // pequena chance de "geração craque"
  if (ri(1, 100) <= 6) pot = clamp(pot + ri(2, 5), 68, 97);
  return { attrs, overall: ovr, potential: pot };
}

// Valor de mercado em M€ (interpolação sobre pontos de controle)
const VALUE_POINTS = [[45, 0.05], [50, 0.2], [55, 0.5], [60, 1], [65, 3], [70, 8], [75, 18], [80, 38], [85, 75], [90, 130], [95, 210]];

export function marketValue(player) {
  const ovr = player.overall;
  let base = VALUE_POINTS[0][1];
  for (let i = 0; i < VALUE_POINTS.length - 1; i++) {
    const [o1, v1] = VALUE_POINTS[i];
    const [o2, v2] = VALUE_POINTS[i + 1];
    if (ovr >= o1 && ovr <= o2) {
      base = v1 + ((ovr - o1) / (o2 - o1)) * (v2 - v1);
      break;
    }
    if (ovr > o2) base = v2;
  }
  const age = player.age;
  const ageFactor = age <= 21 ? 1.3 : age <= 25 ? 1.2 : age <= 28 ? 1.0 : age <= 30 ? 0.8 : age <= 32 ? 0.55 : 0.3;
  const potFactor = 1 + Math.max(0, player.potential - ovr) / 60;
  return Math.round(base * ageFactor * potFactor * 10) / 10;
}

// Salário semanal em mil € — proporcional ao valor e ao orçamento do clube
export function wageFor(player, club) {
  const base = marketValue(player) * 1.4 + 1;
  const budgetFactor = 0.6 + (club ? club.budget / 200 : 0.2);
  return Math.round(clamp(base * budgetFactor, 0.5, 900) * 10) / 10;
}

export function fullName(player) {
  return `${player.firstName} ${player.lastName}`;
}
