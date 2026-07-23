// Sistema de propostas e transferências.

import { marketValue, wageFor, avgRating, fullName } from './player.js';
import { aiName } from './world.js';
import { ri, gauss, clamp, chance, choice, shuffle } from './rng.js';

let offerSeq = 1;

/**
 * Gera propostas de clubes durante uma janela de transferências.
 * O nível dos clubes interessados depende de overall, potencial, idade,
 * desempenho, reputação e do clube atual.
 */
export function generateOffers(G) {
  const p = G.player;
  if (p.retired || p.clubId === null) return [];
  const club = G.clubs[p.clubId];
  const rating = avgRating(p.seasonStats);

  // pontuação de atratividade do jogador
  const score =
    p.overall +
    Math.max(0, p.potential - p.overall) * 0.35 * (p.age <= 21 ? 1.3 : 0.6) +
    (rating > 0 ? (rating - 6.5) * 6 : 0) +
    p.seasonStats.goals * 0.35 +
    p.seasonStats.assists * 0.25 +
    p.reputation * 0.15;

  // quantas propostas chegam
  let n = 0;
  if (score >= 95) n = ri(2, 3);
  else if (score >= 82) n = ri(1, 2);
  else if (score >= 72) n = chance(0.6) ? 1 : 0;
  else if (score >= 62) n = chance(0.3) ? 1 : 0;
  if (p.youth && p.age < 17) n = Math.min(n, 1);

  const offers = [];

  // clubes candidatos: elenco compatível com o nível do jogador
  if (n > 0) {
    const candidates = G.clubs.filter((c) => {
      if (c.id === p.clubId || c.id === p.parentClubId) return false;
      const fit = p.overall + Math.max(0, p.potential - p.overall) * 0.3;
      return c.avgOvr - 9 <= fit && c.avgOvr <= fit + 14;
    });
    const picked = shuffle(candidates).slice(0, n * 3);
    for (const c of picked) {
      if (offers.length >= n) break;
      // clubes grandes só vêm atrás de quem se destaca
      const repGapOk = c.rep <= club.rep + 1 || rating >= 7.0 || p.reputation >= 45 || chance(0.15);
      if (!repGapOk) continue;
      const isLoan = p.youth || (p.age <= 21 && p.overall < c.avgOvr - 3 && chance(0.5));
      const value = marketValue(p);
      offers.push({
        id: offerSeq++,
        clubId: c.id,
        clubName: c.name,
        type: isLoan ? 'loan' : 'transfer',
        fee: isLoan ? 0 : Math.round(value * gauss(1.05, 0.15) * 10) / 10,
        wage: Math.round(wageFor(p, c) * gauss(1.0, 0.1) * 10) / 10,
        years: isLoan ? 1 : ri(2, 5),
        negotiated: false,
      });
    }
  }

  // Elite: overall acima de 85 SEMPRE atrai os gigantes do futebol nas janelas
  if (p.overall > 85) {
    const already = new Set(offers.map((o) => o.clubId));
    const giants = shuffle(G.clubs.filter((c) =>
      c.rep >= 9 && c.id !== p.clubId && c.id !== p.parentClubId && !already.has(c.id)
    ));
    const value = marketValue(p);
    for (const g of giants.slice(0, ri(1, 2))) {
      offers.push({
        id: offerSeq++,
        clubId: g.id,
        clubName: g.name,
        type: 'transfer',
        // gigantes pagam ágio e salários de estrela
        fee: Math.round(value * gauss(1.2, 0.1) * 10) / 10,
        wage: Math.round(wageFor(p, g) * gauss(1.15, 0.08) * 10) / 10,
        years: ri(3, 5),
        negotiated: false,
      });
    }
  }

  return offers;
}

export function negotiateOffer(offer) {
  if (offer.negotiated) return { ok: false, withdrawn: false };
  offer.negotiated = true;
  if (chance(0.6)) {
    offer.wage = Math.round(offer.wage * (1.1 + gauss(0.08, 0.05)) * 10) / 10;
    return { ok: true, withdrawn: false };
  }
  return { ok: false, withdrawn: true };
}

/** Aplica a transferência/empréstimo aceito. Retorna texto para notícia. */
export function applyTransfer(G, offer) {
  const p = G.player;
  const from = G.clubs[p.clubId];
  const to = G.clubs[offer.clubId];
  if (offer.type === 'loan') {
    p.parentClubId = p.parentClubId ?? p.clubId;
    p.clubId = to.id;
    p.contract.wage = offer.wage;
    p.youth = false;
    p.squadRole = 'rotation';
    return `${fullName(p)} chega por empréstimo ao ${to.name}.`;
  }
  p.parentClubId = null;
  p.clubId = to.id;
  p.contract = { wage: offer.wage, years: offer.years };
  p.youth = false;
  p.squadRole = 'bench';
  return `OFICIAL: ${to.name} contrata ${fullName(p)} junto ao ${from ? from.name : 'clube anterior'} por €${offer.fee}M.`;
}

/** Mercado de IA: transferências aleatórias entre clubes para dar vida ao mundo. */
export function aiMarketNews(G, count = 3) {
  const news = [];
  for (let i = 0; i < count; i++) {
    const from = choice(G.clubs);
    const to = choice(G.clubs);
    if (from.id === to.id) continue;
    const idx = ri(0, from.squad.length - 1);
    const pl = from.squad[idx];
    if (!pl || pl.ovr < to.avgOvr - 6 || pl.ovr > to.avgOvr + 8) continue;
    // troca efetiva: jogador muda de elenco e o clube de origem gera um substituto
    to.squad.push(pl);
    to.squad.sort((a, b) => b.ovr - a.ovr);
    if (to.squad.length > 26) to.squad.length = 26;
    from.squad[idx] = { name: aiName(from.country), pos: pl.pos, age: ri(18, 27), ovr: clamp(Math.round(gauss(from.avgOvr - 2, 4)), 45, 92) };
    const fee = Math.max(1, Math.round(Math.pow(Math.max(pl.ovr - 55, 1), 1.7) / 3));
    news.push(`${to.name} contrata ${pl.name} (${pl.pos}, ${pl.ovr} OVR) junto ao ${from.name} por €${fee}M.`);
  }
  return news;
}
