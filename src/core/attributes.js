// Atributos individuais, pesos por posição e cálculo automático de Overall.

import { ri, gauss, clamp, choice } from './rng.js';

export const POSITIONS = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST'];

export const POSITION_NAMES = {
  GK: 'Goleiro', CB: 'Zagueiro', RB: 'Lateral-direito', LB: 'Lateral-esquerdo',
  CDM: 'Volante', CM: 'Meio-campista', CAM: 'Meia-atacante', RW: 'Ponta-direita',
  LW: 'Ponta-esquerda', CF: 'Segundo atacante', ST: 'Centroavante',
};

export const ATTR_GROUPS = {
  attack: ['finishing', 'positioning', 'longShots', 'heading', 'volleys'],
  passing: ['shortPass', 'longPass', 'vision', 'crossing'],
  dribbling: ['dribbling', 'ballControl', 'agility', 'balance'],
  defense: ['tackling', 'interceptions', 'marking', 'defPositioning'],
  physical: ['pace', 'acceleration', 'strength', 'stamina'],
  goalkeeping: ['reflexes', 'diving', 'gkPositioning', 'handling', 'kicking'],
};

export const ATTR_NAMES = {
  finishing: 'Finalização', positioning: 'Posicionamento', longShots: 'Chute de longe',
  heading: 'Cabeceio', volleys: 'Voleio', shortPass: 'Passe curto', longPass: 'Passe longo',
  vision: 'Visão', crossing: 'Cruzamento', dribbling: 'Drible', ballControl: 'Controle de bola',
  agility: 'Agilidade', balance: 'Equilíbrio', tackling: 'Desarme', interceptions: 'Interceptação',
  marking: 'Marcação', defPositioning: 'Posicionamento defensivo', pace: 'Velocidade',
  acceleration: 'Aceleração', strength: 'Força', stamina: 'Resistência', reflexes: 'Reflexos',
  diving: 'Mergulho', gkPositioning: 'Posicionamento (GK)', handling: 'Defesa', kicking: 'Jogo com os pés',
};

// Pesos dos grupos de atributos no Overall, por posição (somam 1).
export const POS_WEIGHTS = {
  GK:  { goalkeeping: 0.80, physical: 0.10, passing: 0.10 },
  CB:  { defense: 0.50, physical: 0.30, passing: 0.10, attack: 0.05, dribbling: 0.05 },
  RB:  { defense: 0.35, physical: 0.25, passing: 0.20, dribbling: 0.15, attack: 0.05 },
  LB:  { defense: 0.35, physical: 0.25, passing: 0.20, dribbling: 0.15, attack: 0.05 },
  CDM: { defense: 0.35, passing: 0.25, physical: 0.20, dribbling: 0.15, attack: 0.05 },
  CM:  { passing: 0.35, dribbling: 0.20, physical: 0.15, defense: 0.15, attack: 0.15 },
  CAM: { passing: 0.30, dribbling: 0.30, attack: 0.25, physical: 0.10, defense: 0.05 },
  RW:  { dribbling: 0.35, attack: 0.30, passing: 0.15, physical: 0.15, defense: 0.05 },
  LW:  { dribbling: 0.35, attack: 0.30, passing: 0.15, physical: 0.15, defense: 0.05 },
  CF:  { attack: 0.35, dribbling: 0.25, passing: 0.20, physical: 0.15, defense: 0.05 },
  ST:  { attack: 0.45, physical: 0.20, dribbling: 0.20, passing: 0.10, defense: 0.05 },
};

export const PLAYER_STYLES = {
  'Finalizador':        { boost: ['finishing', 'positioning', 'volleys'] },
  'Craque técnico':     { boost: ['dribbling', 'ballControl', 'vision'] },
  'Velocista':          { boost: ['pace', 'acceleration', 'agility'] },
  'Motor (box-to-box)': { boost: ['stamina', 'tackling', 'longShots'] },
  'Cérebro (armador)':  { boost: ['vision', 'shortPass', 'longPass'] },
  'Muralha (defensivo)':{ boost: ['marking', 'defPositioning', 'strength'] },
  'Completo':           { boost: [] },
};

export function groupAvg(attrs, group) {
  const keys = ATTR_GROUPS[group];
  return keys.reduce((sum, k) => sum + attrs[k], 0) / keys.length;
}

export function calcOverall(attrs, position) {
  const weights = POS_WEIGHTS[position];
  let ovr = 0;
  for (const [group, w] of Object.entries(weights)) {
    ovr += groupAvg(attrs, group) * w;
  }
  return clamp(Math.round(ovr), 1, 99);
}

// Grupos mais relevantes da posição (para treino/evolução direcionada)
export function primaryAttrs(position) {
  const weights = POS_WEIGHTS[position];
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).flatMap(([g]) => ATTR_GROUPS[g]);
}

// Gera o conjunto de atributos de forma que o Overall calculado fique próximo do alvo.
export function createAttributes(position, targetOvr, styleName = 'Completo', height = 178) {
  const attrs = {};
  const weights = POS_WEIGHTS[position];
  const style = PLAYER_STYLES[styleName] || PLAYER_STYLES['Completo'];

  for (const [group, keys] of Object.entries(ATTR_GROUPS)) {
    const w = weights[group] || 0;
    // grupos importantes ficam acima do alvo; irrelevantes, abaixo
    let groupBase = targetOvr + (w - 0.2) * 28;
    if (group === 'goalkeeping' && position !== 'GK') groupBase = ri(8, 20);
    if (group !== 'goalkeeping' && position === 'GK' && !(group in weights)) groupBase = targetOvr - 25;
    for (const k of keys) {
      let v = gauss(groupBase, 4);
      if (style.boost.includes(k)) v += 5;
      if (k === 'heading') v += (height - 178) * 0.25;
      if (k === 'agility' || k === 'balance') v -= (height - 178) * 0.2;
      attrs[k] = clamp(Math.round(v), 1, 99);
    }
  }

  // Ajuste iterativo para aproximar o Overall do alvo
  for (let pass = 0; pass < 6; pass++) {
    const ovr = calcOverall(attrs, position);
    const delta = targetOvr - ovr;
    if (delta === 0) break;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), 3);
    for (const group of Object.keys(weights)) {
      for (const k of ATTR_GROUPS[group]) {
        attrs[k] = clamp(attrs[k] + step, 1, 99);
      }
    }
  }
  return attrs;
}

// Sorteia um atributo para evoluir, ponderando foco de treino e posição.
export function pickGrowthAttr(position, trainingFocus) {
  const primary = primaryAttrs(position);
  const pool = [];
  const focusAttrs = TRAINING_FOCUS[trainingFocus] || [];
  for (const k of Object.keys(ATTR_NAMES)) {
    if (position !== 'GK' && ATTR_GROUPS.goalkeeping.includes(k)) continue;
    if (position === 'GK' && !ATTR_GROUPS.goalkeeping.includes(k) && !ATTR_GROUPS.physical.includes(k) && !ATTR_GROUPS.passing.includes(k)) continue;
    let w = 1;
    if (primary.includes(k)) w += 2;
    if (focusAttrs.includes(k)) w += 3;
    pool.push(...Array(w).fill(k));
  }
  return choice(pool);
}

export const TRAINING_FOCUS = {
  'Finalização': ATTR_GROUPS.attack,
  'Passe': ATTR_GROUPS.passing,
  'Drible': ATTR_GROUPS.dribbling,
  'Velocidade': ['pace', 'acceleration', 'agility'],
  'Físico': ['strength', 'stamina', 'balance'],
  'Defesa': ATTR_GROUPS.defense,
  'Goleiro': ATTR_GROUPS.goalkeeping,
  'Específico da posição': [], // resolvido dinamicamente via primaryAttrs
};

export function trainingOptions(position) {
  const opts = Object.keys(TRAINING_FOCUS).filter((f) => f !== 'Goleiro');
  if (position === 'GK') return ['Goleiro', 'Passe', 'Físico', 'Específico da posição'];
  return opts;
}
