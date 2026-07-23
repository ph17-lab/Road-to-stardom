// Simulação de partidas: resultado entre equipes e desempenho individual do jogador.

import { ri, gauss, clamp, chance, poisson, rand } from './rng.js';

// Fator ofensivo/defensivo por posição, usado nas estatísticas individuais
const ATTACK_FACTOR = { ST: 1.0, CF: 0.9, RW: 0.8, LW: 0.8, CAM: 0.65, CM: 0.4, CDM: 0.2, RB: 0.18, LB: 0.18, CB: 0.1, GK: 0 };
const ASSIST_FACTOR = { CAM: 0.5, RW: 0.45, LW: 0.45, CM: 0.38, CF: 0.4, ST: 0.28, CDM: 0.2, RB: 0.22, LB: 0.22, CB: 0.06, GK: 0.01 };
const DEF_FACTOR = { CB: 1.0, CDM: 0.9, RB: 0.8, LB: 0.8, CM: 0.5, CAM: 0.2, RW: 0.15, LW: 0.15, CF: 0.1, ST: 0.08, GK: 0 };

// Placar entre duas forças de equipe (0-100). homeAdv em pontos de overall.
export function simScore(strA, strB, homeAdv = 2.5) {
  const diff = strA + homeAdv - strB;
  const xgA = clamp(1.35 + diff / 14, 0.15, 4.2);
  const xgB = clamp(1.15 - diff / 16, 0.15, 4.0);
  return [poisson(xgA), poisson(xgB)];
}

// Minutos jogados conforme papel no elenco
export function rollMinutes(role) {
  if (role === 'starter') {
    return chance(0.25) ? ri(58, 84) : 90;
  }
  if (role === 'rotation') {
    if (chance(0.55)) return chance(0.3) ? ri(58, 84) : 90;
    return chance(0.55) ? ri(15, 35) : 0;
  }
  // banco
  return chance(0.22) ? ri(8, 25) : 0;
}

/**
 * Simula a partida do time do jogador com estatísticas individuais.
 * ctx: { position, ovr, attrs, form, morale, role, teamStr, oppStr, isHome, importance }
 * Retorna { gh, ga, stats } — stats null se o jogador não entrou em campo.
 */
export function simPlayerMatch(ctx) {
  const { position, ovr, attrs, form, role } = ctx;
  const playerBoost = role !== 'bench' ? clamp((ovr - ctx.teamStr) / 10, -1.5, 2.5) : 0;
  const [gh, ga] = simScore(ctx.teamStr + playerBoost, ctx.oppStr, ctx.isHome ? 2.5 : -2.5);
  const teamGoals = gh;
  const oppGoals = ga;
  const won = teamGoals > oppGoals;
  const lost = teamGoals < oppGoals;

  const minutes = rollMinutes(role);
  if (minutes === 0) {
    return { gh, ga, stats: null };
  }

  const minShare = minutes / 90;
  const formAdj = (form - 60) / 100; // -0.4..0.35
  const qualityAdj = clamp((ovr - ctx.oppStr) / 30, -0.5, 0.7);

  const stats = {
    minutes, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    passes: 0, passAcc: 0, tackles: 0, interceptions: 0, dribbles: 0,
    saves: 0, cleanSheet: false, yellow: false, red: false, rating: 6.0, motm: false,
  };

  if (position === 'GK') {
    stats.saves = clamp(Math.round(gauss(3 + ctx.oppStr / 40, 1.5)) - oppGoals, 0, 11);
    stats.cleanSheet = oppGoals === 0 && minutes >= 85;
    stats.passes = Math.round(ri(18, 30) * minShare);
    stats.passAcc = ri(70, 92);
    let r = 6.1 + stats.saves * 0.22 - oppGoals * 0.55 + (won ? 0.3 : lost ? -0.25 : 0) + (stats.cleanSheet ? 0.7 : 0);
    r += gauss(0, 0.3) + formAdj * 0.5;
    stats.rating = clamp(Math.round(r * 10) / 10, 3.5, 10);
  } else {
    const af = ATTACK_FACTOR[position];
    const shots = clamp(Math.round(gauss(af * 3.4 * (1 + qualityAdj), 1.2) * minShare), 0, 8);
    stats.shots = shots;
    const finQ = (attrs.finishing || 50) / 100;
    for (let i = 0; i < shots; i++) {
      if (rand() < 0.32 + finQ * 0.25) stats.shotsOnTarget++;
    }
    const goalP = clamp(0.10 + finQ * 0.18 + qualityAdj * 0.10 + formAdj * 0.06, 0.03, 0.55);
    // gols limitados pelos gols da equipe
    let goals = 0;
    for (let i = 0; i < stats.shotsOnTarget; i++) if (rand() < goalP) goals++;
    stats.goals = Math.min(goals, teamGoals);

    const assistP = clamp(ASSIST_FACTOR[position] * 0.35 * minShare * (1 + formAdj + qualityAdj * 0.5), 0.01, 0.5);
    for (let g = 0; g < teamGoals - stats.goals; g++) if (rand() < assistP) stats.assists++;
    stats.assists = Math.min(stats.assists, 2);

    const passBase = { CB: 45, RB: 40, LB: 40, CDM: 55, CM: 58, CAM: 48, RW: 32, LW: 32, CF: 30, ST: 24 }[position] || 35;
    stats.passes = Math.round(gauss(passBase, 8) * minShare);
    stats.passAcc = clamp(Math.round(70 + ((attrs.shortPass || 55) - 55) / 3 + gauss(0, 4)), 50, 97);
    const df = DEF_FACTOR[position];
    stats.tackles = clamp(Math.round(gauss(df * 3.2, 1.2) * minShare), 0, 9);
    stats.interceptions = clamp(Math.round(gauss(df * 2.4, 1) * minShare), 0, 8);
    stats.dribbles = clamp(Math.round(gauss((attrs.dribbling || 50) / 22 * af + 0.6, 1) * minShare), 0, 9);

    stats.yellow = chance(df > 0.6 ? 0.14 : 0.07);
    stats.red = chance(0.008);

    let r = 6.0
      + stats.goals * 1.05
      + stats.assists * 0.65
      + stats.shotsOnTarget * 0.06
      + (stats.tackles + stats.interceptions) * 0.055 * (df > 0.4 ? 1 : 0.4)
      + stats.dribbles * 0.03
      + (won ? 0.28 : lost ? -0.35 : 0)
      + (stats.red ? -1.2 : stats.yellow ? -0.15 : 0)
      + formAdj * 0.45
      + gauss(0, 0.35);
    if (df > 0.6 && oppGoals === 0) r += 0.35;
    stats.rating = clamp(Math.round(r * 10) / 10, 3.0, 10);
  }

  stats.motm = stats.rating >= 8.6;
  return { gh, ga, stats };
}
