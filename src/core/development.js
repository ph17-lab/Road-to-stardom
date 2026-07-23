// Evolução do jogador: crescimento mensal, declínio por idade, forma e moral.

import { calcOverall, pickGrowthAttr, primaryAttrs } from './attributes.js';
import { avgRating } from './player.js';
import { gauss, clamp, chance, choice, rand } from './rng.js';

// Pontos de ATRIBUTO por mês (cerca de 12 pontos de atributo ≈ 1 ponto de overall)
function baseGrowthByAge(age) {
  if (age <= 17) return 11;
  if (age <= 20) return 9;
  if (age <= 23) return 6;
  if (age <= 26) return 3.2;
  if (age <= 29) return 1.6;
  if (age <= 31) return 0.7;
  return 0;
}

/**
 * Tick mensal de desenvolvimento (a cada 4 semanas).
 * trainQuality: nível da academia/estrutura do clube (1-10)
 * leagueStrength: nível da competição (1-10)
 * minutesShare: fração de minutos possíveis jogados no mês (0-1)
 */
export function monthlyDevelopment(player, { trainQuality, leagueStrength, minutesShare }) {
  if (player.retired) return 0;
  const gap = player.potential - player.overall;
  const rating = avgRating(player.seasonStats);

  let gained = 0;
  if (gap > 0) {
    const base = baseGrowthByAge(player.age);
    const gapFactor = clamp(gap / 8, 0.2, 1.5);
    const perfFactor = clamp(
      0.75 + (rating > 0 ? (rating - 6.3) * 0.3 : 0) + minutesShare * 0.35 + (leagueStrength - 6) * 0.04,
      0.4, 1.7
    );
    const trainFactor = 0.8 + trainQuality / 25;
    let points = base * gapFactor * perfFactor * trainFactor * gauss(1, 0.15);
    points = Math.max(0, points);

    // aplica pontos inteiros + fração como probabilidade
    const cap = player.limitBroken ? 200 : 99;
    let whole = Math.floor(points);
    if (rand() < points - whole) whole++;
    for (let i = 0; i < whole; i++) {
      const attr = pickGrowthAttr(player.position, resolveFocus(player));
      if (player.attrs[attr] < cap) {
        player.attrs[attr]++;
        gained++;
      }
      const newOvr = calcOverall(player.attrs, player.position);
      if (newOvr > player.potential) { // não ultrapassa o potencial
        player.attrs[attr]--;
        gained--;
        break;
      }
    }
  }

  // Declínio físico a partir dos 32
  if (player.age >= 32) {
    const declinePts = (player.age - 31) * 1.6;
    let whole = Math.floor(declinePts);
    if (rand() < declinePts - whole) whole++;
    const physical = ['pace', 'acceleration', 'stamina', 'agility'];
    for (let i = 0; i < whole; i++) {
      const attr = choice(physical);
      if (player.attrs[attr] > 20) player.attrs[attr]--;
    }
  }

  player.overall = calcOverall(player.attrs, player.position);
  return gained;
}

function resolveFocus(player) {
  return player.trainingFocus === 'Específico da posição' ? `__pos_${player.position}` : player.trainingFocus;
}

// Atualização de forma/moral após uma partida
export function updateFormMorale(player, stats, teamWon, teamLost) {
  if (stats) {
    player.form = clamp(player.form + (stats.rating - 6.4) * 6, 20, 95);
    player.morale = clamp(player.morale + (stats.rating - 6.2) * 2 + (teamWon ? 2 : teamLost ? -2 : 0), 10, 99);
  } else {
    // não jogou
    player.morale = clamp(player.morale - 1.5, 10, 99);
    player.form = clamp(player.form - 1, 20, 95);
  }
}

// Deriva semanal da forma em direção ao neutro
export function weeklyFormDrift(player) {
  player.form += (60 - player.form) * 0.06;
}

// Sorteio de lesão após partida jogada
export function rollInjury(player, minutes) {
  if (!minutes) return null;
  const risk = 0.032 * (minutes / 90) * (player.age >= 30 ? 1.4 : 1);
  if (!chance(risk)) return null;
  const r = rand();
  let injury;
  if (r < 0.6) injury = { weeks: 1 + Math.floor(rand() * 2), desc: 'Lesão leve', severity: 'leve' };
  else if (r < 0.9) injury = { weeks: 3 + Math.floor(rand() * 4), desc: 'Lesão moderada', severity: 'moderada' };
  else injury = { weeks: 8 + Math.floor(rand() * 13), desc: 'Lesão grave', severity: 'grave' };
  player.injury = injury;
  player.form = clamp(player.form - 10, 20, 95);
  player.morale = clamp(player.morale - 8, 10, 99);
  return injury;
}

// Crescimento de reputação por desempenho
export function updateReputation(player, clubRep, leagueStrength) {
  const rating = avgRating(player.seasonStats);
  if (rating > 0) {
    const gain = clamp((rating - 6.5) * 0.3, -0.2, 0.6) * (0.5 + leagueStrength / 12) * (0.6 + clubRep / 15);
    player.reputation = clamp(player.reputation + gain, 1, 100);
  }
}

export { primaryAttrs };
