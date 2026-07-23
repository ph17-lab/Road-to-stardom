// Testes de ponta a ponta do motor de carreira.
// Rodam o jogo por muitas temporadas de forma headless para garantir robustez.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newGame, doRollAcademy, confirmAcademy, advanceWeek, acceptOffer,
  setTrainingFocus, careerTotals, nextFixture, retirePlayer, SEASON_WEEKS, MAX_REROLLS,
} from '../src/core/engine.js';
import { serialize, deserialize } from '../src/core/save.js';
import { calcOverall, createAttributes, POSITIONS, trainingOptions } from '../src/core/attributes.js';
import { tableStandings } from '../src/core/world.js';
import { avgRating } from '../src/core/player.js';

function makeGame(overrides = {}) {
  return newGame({
    firstName: 'Pedro',
    lastName: 'Silva',
    nationality: 'Brasil',
    country: 'Brasil',
    foot: 'Direito',
    position: 'ST',
    height: 180,
    shirt: 9,
    age: 15,
    style: 'Finalizador',
    seed: 42,
    ...overrides,
  });
}

test('criação do jogo: mundo com ligas, clubes e jogador', () => {
  const G = makeGame();
  assert.ok(G.leagues.length >= 12, 'deve ter muitas ligas');
  assert.ok(G.clubs.length >= 180, 'deve ter muitos clubes');
  for (const club of G.clubs) {
    assert.ok(club.name && club.stadium && club.squad.length >= 20);
    assert.ok(club.academy >= 1 && club.academy <= 10);
  }
  assert.equal(G.player.firstName, 'Pedro');
  assert.equal(G.phase, 'roll');
});

test('atributos e overall coerentes para todas as posições', () => {
  for (const pos of POSITIONS) {
    const attrs = createAttributes(pos, 70, 'Completo', 180);
    const ovr = calcOverall(attrs, pos);
    assert.ok(Math.abs(ovr - 70) <= 6, `${pos}: overall ${ovr} deveria ficar perto de 70`);
    for (const v of Object.values(attrs)) {
      assert.ok(v >= 1 && v <= 99);
    }
    assert.ok(trainingOptions(pos).length >= 3);
  }
});

test('criação simplificada: só nome e altura; 15 anos fixo e perfil sorteado na roleta', () => {
  const G = newGame({ firstName: 'Ana', lastName: 'Souza', height: 170, seed: 77 });
  assert.equal(G.player.age, 15, 'idade sempre começa em 15');
  assert.equal(G.country, 'Brasil', 'país padrão é o Brasil');
  assert.equal(G.player.nationality, 'Brasil');
  const r1 = doRollAcademy(G);
  assert.ok(POSITIONS.includes(r1.position), 'roleta sorteia uma posição válida');
  assert.ok(['Direito', 'Esquerdo', 'Ambidestro'].includes(r1.foot));
  assert.ok(typeof r1.style === 'string' && r1.style.length > 0);
  assert.ok(r1.shirt >= 1 && r1.shirt <= 99);
  // re-rolagens continuam sorteando perfis válidos
  const positions = new Set([r1.position]);
  for (let i = 0; i < MAX_REROLLS; i++) {
    const r = doRollAcademy(G);
    assert.ok(POSITIONS.includes(r.position));
    positions.add(r.position);
  }
  confirmAcademy(G);
  assert.equal(G.player.position, G.lastRoll.position, 'posição do jogador é a do sorteio confirmado');
  assert.equal(G.player.category, 'Sub-15');
  // a carreira roda normalmente com o perfil sorteado
  for (let w = 0; w < 10; w++) advanceWeek(G);
  assert.ok(G.player.seasonStats.apps > 0);
});

test('perfil fixado na criação é respeitado pela roleta', () => {
  const G = makeGame({ seed: 88, position: 'GK', style: 'Completo', foot: 'Esquerdo' });
  for (let i = 0; i <= MAX_REROLLS; i++) {
    const r = doRollAcademy(G);
    assert.equal(r.position, 'GK');
    assert.equal(r.foot, 'Esquerdo');
  }
});

test('roleta da academia: sorteia clube do país, respeita limite de re-rolagens', () => {
  const G = makeGame();
  const roll1 = doRollAcademy(G);
  assert.equal(G.clubs[roll1.clubId].country, 'Brasil');
  assert.ok(roll1.profile.overall >= 45 && roll1.profile.overall <= 70);
  assert.ok(roll1.profile.potential > roll1.profile.overall);
  assert.equal(G.rerollsLeft, MAX_REROLLS);
  for (let i = 0; i < MAX_REROLLS; i++) {
    const r = doRollAcademy(G);
    assert.equal(G.clubs[r.clubId].country, 'Brasil');
  }
  assert.equal(G.rerollsLeft, 0);
  assert.throws(() => doRollAcademy(G));
  confirmAcademy(G);
  assert.equal(G.phase, 'career');
  assert.equal(G.player.youth, true);
  assert.equal(G.player.category, 'Sub-15');
});

test('roleta favorece academias menores estatisticamente', () => {
  // Na Inglaterra, 6 de 20 clubes (30%) têm academia >= 9. Com o sorteio
  // ponderado, eles devem sair bem menos que 30% das vezes.
  const N = 120;
  let elite = 0;
  let eliteShare = 0;
  for (let s = 0; s < N; s++) {
    const G = makeGame({ seed: 1000 + s, country: 'Inglaterra', nationality: 'Inglaterra' });
    if (s === 0) {
      const clubs = G.clubs.filter((c) => c.country === 'Inglaterra');
      eliteShare = clubs.filter((c) => c.academy >= 9).length / clubs.length;
    }
    const roll = doRollAcademy(G);
    if (G.clubs[roll.clubId].academy >= 9) elite++;
  }
  assert.ok(
    elite / N < eliteShare * 0.75,
    `academias de elite saíram ${elite}/${N} — deveria ser bem menos que a fração uniforme (${Math.round(eliteShare * N)})`
  );
});

test('temporada completa na base: joga partidas, evolui e tabela é preenchida', () => {
  const G = makeGame();
  doRollAcademy(G);
  confirmAcademy(G);
  const ovrBefore = G.player.overall;
  let matches = 0;
  for (let w = 0; w < SEASON_WEEKS; w++) {
    const events = advanceWeek(G);
    matches += events.filter((e) => e.type === 'match').length;
  }
  assert.ok(matches >= 15, `deveria ter jogado muitas partidas na base (jogou ${matches})`);
  assert.ok(G.player.overall >= ovrBefore, 'jogador jovem não deve regredir');
  assert.equal(G.seasonYear, 2027);
  assert.equal(G.player.age, 16);
  assert.equal(G.player.seasonHistory.length, 1);
  // tabelas de todas as ligas completas
  for (const league of G.leagues) {
    const standings = tableStandings(league);
    assert.equal(standings.length, league.clubIds.length);
    const games = (league.clubIds.length - 1) * 2;
    // a tabela foi resetada para a nova temporada; confere o histórico
    assert.ok(league.lastStandings.length === league.clubIds.length);
    assert.ok(league.lastChampionId !== null);
    void games;
  }
});

test('carreira longa: base -> profissional -> transferências -> aposentadoria', () => {
  const G = makeGame({ seed: 7 });
  doRollAcademy(G);
  confirmAcademy(G);
  setTrainingFocus(G, 'Finalização');

  let promoted = false;
  let offersSeen = 0;
  let transfers = 0;
  let natCalled = false;
  let guard = 0;

  while (G.phase === 'career' && guard < 30 * SEASON_WEEKS) {
    guard++;
    const events = advanceWeek(G);
    for (const e of events) {
      if (e.type === 'promotion') promoted = true;
      if (e.type === 'offers') offersSeen++;
      if (e.type === 'callup') natCalled = true;
    }
    // aceita a primeira proposta de clube maior que aparecer (a cada 2 ofertas)
    if (G.offers.length > 0 && offersSeen % 2 === 0) {
      const best = G.offers.slice().sort((a, b) => G.clubs[b.clubId].rep - G.clubs[a.clubId].rep)[0];
      acceptOffer(G, best.id);
      transfers++;
    }
    // invariantes semanais
    const p = G.player;
    assert.ok(p.overall >= 1 && p.overall <= 99, 'overall dentro dos limites');
    assert.ok(p.overall <= p.potential + 1, 'overall não deve estourar o potencial');
    assert.ok(p.clubId === null || G.clubs[p.clubId], 'clube válido');
    assert.ok(G.week >= 1 && G.week <= SEASON_WEEKS + 1);
  }

  assert.equal(G.phase, 'retired', 'a carreira deve terminar com aposentadoria');
  assert.ok(promoted || !G.player.youth, 'o jogador deve ter chegado ao profissional');
  assert.ok(G.player.age >= 30, `deve ter jogado muitas temporadas (aposentou aos ${G.player.age})`);
  assert.ok(offersSeen > 0, 'deve ter recebido propostas ao longo da carreira');
  assert.ok(transfers >= 1, 'deve ter trocado de clube ao menos uma vez');
  assert.ok(G.player.seasonHistory.length >= 10, 'histórico com muitas temporadas');

  const totals = careerTotals(G);
  assert.ok(totals.apps > 100, `muitos jogos na carreira (${totals.apps})`);
  assert.ok(totals.goals > 10, `atacante deve marcar gols (${totals.goals})`);
  void natCalled; // convocação depende do nível alcançado — não é obrigatória
});

test('jogador com potencial alto atinge nível de elite e recebe prêmios/convocações', () => {
  // roda algumas sementes e exige que pelo menos uma carreira chegue à elite
  let bestOvr = 0;
  let called = false;
  let anyAward = false;
  let titles = 0;
  for (const s of [3, 11, 21, 33, 55]) {
    const G = makeGame({ seed: s, position: 'ST' });
    doRollAcademy(G);
    // força um perfil promissor para o teste de teto de carreira
    G.lastRoll.profile.potential = 94;
    confirmAcademy(G);
    let guard = 0;
    while (G.phase === 'career' && guard < 30 * SEASON_WEEKS) {
      guard++;
      advanceWeek(G);
      if (G.offers.length > 0) {
        const best = G.offers.slice().sort((a, b) => G.clubs[b.clubId].avgOvr - G.clubs[a.clubId].avgOvr)[0];
        if (G.clubs[best.clubId].avgOvr > (G.clubs[G.player.clubId]?.avgOvr || 0)) acceptOffer(G, best.id);
      }
      bestOvr = Math.max(bestOvr, G.player.overall);
      if (G.player.natTeam.called) called = true;
    }
    if (G.player.awards.length > 0) anyAward = true;
    titles += G.player.titles.length;
  }
  assert.ok(bestOvr >= 85, `alguma carreira deve chegar à elite (melhor: ${bestOvr})`);
  assert.ok(called, 'jogador de elite deve ser convocado para a seleção');
  assert.ok(anyAward, 'jogador de elite deve ganhar prêmios individuais');
  assert.ok(titles > 0, 'deve conquistar títulos ao longo das carreiras');
});

test('save e load preservam o estado', () => {
  const G = makeGame({ seed: 99 });
  doRollAcademy(G);
  confirmAcademy(G);
  for (let i = 0; i < 10; i++) advanceWeek(G);
  const json = serialize(G);
  const G2 = deserialize(json);
  assert.equal(G2.player.overall, G.player.overall);
  assert.equal(G2.week, G.week);
  assert.equal(G2.clubs.length, G.clubs.length);
  // o jogo continua funcionando após o load
  for (let i = 0; i < 50; i++) advanceWeek(G2);
  assert.ok(G2.player.seasonStats.apps >= 0);
  assert.ok(nextFixture(G2) !== undefined);
});

test('aposentadoria manual', () => {
  const G = makeGame({ seed: 5 });
  doRollAcademy(G);
  confirmAcademy(G);
  retirePlayer(G);
  let guard = 0;
  while (G.phase === 'career' && guard < SEASON_WEEKS + 2) {
    guard++;
    advanceWeek(G);
  }
  assert.equal(G.phase, 'retired');
});

test('goleiro também tem carreira funcional', () => {
  const G = makeGame({ seed: 13, position: 'GK', style: 'Completo' });
  doRollAcademy(G);
  confirmAcademy(G);
  for (let i = 0; i < 3 * SEASON_WEEKS && G.phase === 'career'; i++) advanceWeek(G);
  const p = G.player;
  assert.ok(p.seasonHistory.length >= 2);
  const rating = avgRating(p.seasonStats);
  assert.ok(rating === 0 || (rating > 3 && rating <= 10));
});
