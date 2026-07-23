// Sistema de "base roletada": sorteio ponderado da academia inicial.
// Academias de clubes grandes são mais raras; clubes menores têm maior probabilidade.

import { weightedChoice } from './rng.js';
import { youthCategory, rollInitialProfile } from './player.js';

export const MAX_REROLLS = 3;

// Peso do sorteio: quanto menor a academia, maior a chance
export function academyWeight(club) {
  return Math.pow(11.5 - club.academy, 1.7);
}

/**
 * Sorteia um clube do país escolhido e gera o perfil inicial do jogador.
 * Retorna { clubId, category, profile } sem aplicar ainda (o usuário pode confirmar ou roletar de novo).
 */
export function rollAcademy(G, country) {
  const candidates = G.clubs.filter((c) => c.country === country);
  if (candidates.length === 0) throw new Error(`Nenhum clube disponível no país: ${country}`);
  const club = weightedChoice(candidates, academyWeight);
  const profile = rollInitialProfile(G.player, club.academy);
  return {
    clubId: club.id,
    clubName: club.name,
    academyLevel: club.academy,
    category: youthCategory(G.player.age),
    profile,
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
