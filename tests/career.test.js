// Testes de ponta a ponta do motor de carreira.
// Rodam o jogo por muitas temporadas de forma headless para garantir robustez.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newGame, doRollAcademy, confirmAcademy, advanceWeek, acceptOffer,
  setTrainingFocus, careerTotals, nextFixture, retirePlayer, spendStatPoint,
  spendStatPoints, spendableAttrs, canLimitBreak, doLimitBreak,
  getPlayableMatch,
  SEASON_WEEKS, MAX_REROLLS,
} from '../src/core/engine.js';
import { serialize, deserialize } from '../src/core/save.js';
import { calcOverall, createAttributes, applyHeightBias, POSITIONS, trainingOptions } from '../src/core/attributes.js';
import { offerInterview, answerInterview, getInterview } from '../src/core/press.js';
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

test('posição e potencial escolhidos na criação são respeitados', () => {
  const G = newGame({ firstName: 'Ana', lastName: 'Souza', height: 172, position: 'CAM', potential: 92, seed: 51 });
  assert.equal(G.player.nationality, 'Brasil', 'jogador é sempre brasileiro');
  for (let i = 0; i <= MAX_REROLLS; i++) {
    const r = doRollAcademy(G);
    assert.equal(r.position, 'CAM', 'posição escolhida se mantém em toda re-rolagem');
    assert.equal(r.profile.potential, 92, 'potencial escolhido se mantém');
  }
  confirmAcademy(G);
  assert.equal(G.player.position, 'CAM');
  assert.equal(G.player.potential, 92);
});

test('pontos de status: ganha por partida e distribui manualmente', () => {
  const G = newGame({ firstName: 'Ze', lastName: 'Gol', height: 180, position: 'ST', potential: 90, seed: 19 });
  doRollAcademy(G);
  confirmAcademy(G);
  let guard = 0;
  while ((G.player.statPoints || 0) === 0 && guard < 30) {
    guard++;
    advanceWeek(G);
  }
  assert.ok(G.player.statPoints > 0, 'boas atuações devem render pontos de status');

  const before = G.player.attrs.finishing;
  const pointsBefore = G.player.statPoints;
  const r = spendStatPoint(G, 'finishing');
  assert.equal(r.ok, true);
  assert.equal(G.player.attrs.finishing, before + 1);
  assert.equal(G.player.statPoints, pointsBefore - 1);

  // jogador de linha não pode gastar em atributo de goleiro
  assert.equal(spendStatPoint(G, 'reflexes').ok, false);

  // o gasto respeita o teto do potencial
  G.player.potential = G.player.overall;
  G.player.statPoints = 60;
  let blocked = false;
  for (let i = 0; i < 60; i++) {
    const res = spendStatPoint(G, 'finishing');
    if (!res.ok) { blocked = true; break; }
  }
  assert.ok(blocked, 'a distribuição deve parar no teto do potencial');
  assert.ok(G.player.overall <= G.player.potential);
});

test('gasto de pontos em lote (10, 100, máximo)', () => {
  const G = newGame({ firstName: 'Bulk', lastName: 'Teste', height: 180, position: 'ST', potential: 90, seed: 71 });
  doRollAcademy(G);
  confirmAcademy(G);
  G.player.statPoints = 500;

  // gasta 10 de uma vez em finalização
  const before = G.player.attrs.finishing;
  const r10 = spendStatPoints(G, 'finishing', 10);
  assert.equal(r10.spent, 10);
  assert.equal(G.player.attrs.finishing, before + 10);
  assert.equal(G.player.statPoints, 490);

  // "máximo" gasta até travar no teto do potencial
  const rMax = spendStatPoints(G, 'positioning', Infinity);
  assert.ok(rMax.spent > 0, 'deve gastar vários pontos de uma vez');
  assert.ok(G.player.overall <= G.player.potential, 'não ultrapassa o potencial');

  // sem pontos, retorna motivo
  G.player.statPoints = 0;
  const r0 = spendStatPoints(G, 'finishing', 10);
  assert.equal(r0.spent, 0);
  assert.ok(r0.reason);
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

test('limit break: teto sobe para 200 e overall 200 exige tudo em 200', () => {
  const G = newGame({ firstName: 'Goku', lastName: 'Silva', height: 180, position: 'ST', potential: 90, seed: 23 });
  doRollAcademy(G);
  confirmAcademy(G);

  // antes de atingir o potencial, o limit break é negado
  assert.equal(doLimitBreak(G).ok, false);
  assert.equal(canLimitBreak(G), false);

  // simula chegar ao potencial máximo
  G.player.potential = G.player.overall;
  assert.equal(canLimitBreak(G), true);
  const r = doLimitBreak(G);
  assert.equal(r.ok, true);
  assert.equal(G.player.limitBroken, true);
  assert.equal(G.player.potential, 200, 'após o limit break o teto é 200');

  // não há segundo limit break
  assert.equal(doLimitBreak(G).ok, false);

  // agora dá para upar um atributo além de 99, até 200
  G.player.statPoints = 5000;
  let guard = 0;
  while (spendStatPoint(G, 'finishing').ok && guard++ < 300) { /* upa até travar */ }
  assert.equal(G.player.attrs.finishing, 200, 'atributo pode chegar a 200');

  // overall 200 só com TODOS os atributos relevantes em 200
  assert.ok(G.player.overall < 200, 'um atributo só não basta para overall 200');
  for (const k of spendableAttrs('ST')) G.player.attrs[k] = 200;
  G.player.overall = calcOverall(G.player.attrs, 'ST');
  assert.equal(G.player.overall, 200, 'com tudo em 200 o overall é 200');

  // o jogo continua rodando normalmente após o limit break
  for (let w = 0; w < 10; w++) advanceWeek(G);
  assert.ok(G.player.seasonStats.apps >= 0);
});

test('pontos de status rendem 4x mais após o limit break', () => {
  const G = newGame({ firstName: 'Vegeta', lastName: 'Souza', height: 178, position: 'ST', potential: 90, seed: 41 });
  doRollAcademy(G);
  confirmAcademy(G);
  // carreira normal: acumula pontos por algumas semanas
  let normalPts = 0;
  for (let w = 0; w < 8; w++) {
    advanceWeek(G);
  }
  normalPts = G.player.statPoints;
  // ativa o limit break e joga o mesmo número de semanas
  G.player.potential = G.player.overall;
  doLimitBreak(G);
  const before = G.player.statPoints;
  for (let w = 0; w < 8; w++) advanceWeek(G);
  const brokenPts = G.player.statPoints - before;
  // com o multiplicador 4x, o ganho pós-break deve superar o ganho normal
  assert.ok(brokenPts > normalPts, `ganho pós-break (${brokenPts}) deve superar o normal (${normalPts})`);
});

test('overall acima de 85 atrai propostas de times grandes', () => {
  const G = makeGame({ seed: 61 });
  doRollAcademy(G);
  confirmAcademy(G);
  // simula um jogador de elite no meio da carreira
  G.player.youth = false;
  G.player.category = null;
  G.player.overall = 88;
  G.player.age = 22;
  let giantOffers = 0;
  for (let w = 0; w < 3; w++) {
    advanceWeek(G); // a janela abre na semana 2
    for (const o of G.offers) {
      if (G.clubs[o.clubId].rep >= 9) giantOffers++;
    }
  }
  assert.ok(giantOffers >= 1, `com OVR 88, gigantes devem mandar proposta (viu ${giantOffers})`);
  // e com overall modesto, nenhum gigante aparece garantido
  const G2 = makeGame({ seed: 62 });
  doRollAcademy(G2);
  confirmAcademy(G2);
  G2.player.youth = false;
  G2.player.overall = 70;
  G2.player.age = 22;
  for (let w = 0; w < 3; w++) advanceWeek(G2);
  const giants2 = G2.offers.filter((o) => G2.clubs[o.clubId].rep >= 9).length;
  assert.ok(giants2 === 0 || giants2 < giantOffers + 1, 'OVR 70 não deve garantir gigantes');
});

test('classificação continental vem da posição na tabela da temporada anterior', () => {
  const G = makeGame({ seed: 31 });
  doRollAcademy(G);
  confirmAcademy(G);
  for (let w = 0; w < SEASON_WEEKS; w++) advanceWeek(G); // fecha a temporada 1

  // G3 da Premier League vai para a Champions League
  const eng = G.leagues.find((l) => l.id === 'ENG1');
  const ucl = G.continentals.find((c) => c.id === 'UCL');
  for (const id of eng.lastStandings.slice(0, 3)) {
    assert.ok(ucl.teams.includes(id), `${G.clubs[id].name} (top 3 da Premier) deveria estar na Champions`);
  }
  // G8 do Brasileirão vai para a Libertadores
  const bra = G.leagues.find((l) => l.id === 'BRA1');
  const lib = G.continentals.find((c) => c.id === 'LIB');
  for (const id of bra.lastStandings.slice(0, 8)) {
    assert.ok(lib.teams.includes(id), `${G.clubs[id].name} (G8 do Brasileirão) deveria estar na Libertadores`);
  }
  // quem terminou no meio da tabela europeia não entra
  const mid = eng.lastStandings[10];
  assert.ok(!ucl.teams.includes(mid), 'clube de meio de tabela não deve ir para a Champions');
});

test('partida jogada em 2D: há jogo jogável e o resultado conta na carreira', () => {
  const G = makeGame({ seed: 88, position: 'ST' });
  doRollAcademy(G);
  confirmAcademy(G);
  // na base há jogo jogável na semana
  const playable = getPlayableMatch(G);
  assert.ok(playable, 'deve haver uma partida jogável');
  assert.ok(playable.kind === 'youth' || playable.kind === 'league');
  assert.ok(playable.ownName && playable.oppName && playable.ownColor);

  // injeta um resultado jogado (2 gols, 1 assist, vitória 3-1)
  const before = G.player.seasonStats.goals;
  const events = advanceWeek(G, { play: { teamGoals: 3, oppGoals: 1, playerGoals: 2, playerAssists: 1, playerShots: 5, oppClubId: playable.oppClubId } });
  const matchEv = events.find((e) => e.type === 'match');
  assert.ok(matchEv, 'deve gerar um evento de partida');
  assert.equal(G.player.seasonStats.goals, before + 2, 'gols marcados na partida jogada contam');
  assert.equal(G.player.seasonStats.assists, 1);
  assert.equal(G.player.seasonStats.apps, 1);
  assert.equal(matchEv.report.teamGoals, 3);
  assert.equal(matchEv.report.oppGoals, 1);
  assert.ok(matchEv.report.stats.rating > 6, 'boa atuação gera nota alta');
});

test('lesão impede jogar a partida em 2D', () => {
  const G = makeGame({ seed: 90, position: 'ST' });
  doRollAcademy(G);
  confirmAcademy(G);
  G.player.injury = { weeks: 3, desc: 'Lesão moderada', severity: 'moderada' };
  assert.equal(getPlayableMatch(G), null, 'lesionado não tem jogo jogável');
});

test('altura afeta atributos: mais alto cabeceia melhor, mais baixo é mais ágil', () => {
  const tall = createAttributes('ST', 70, 'Completo', 198);
  const short = createAttributes('ST', 70, 'Completo', 165);
  assert.ok(tall.heading > short.heading, `alto (${tall.heading}) deve cabecear melhor que baixo (${short.heading})`);
  assert.ok(short.agility > tall.agility, `baixo (${short.agility}) deve ser mais ágil que alto (${tall.agility})`);
  // aplicar o viés diretamente também funciona
  const base = { heading: 60, agility: 60, strength: 60, acceleration: 60, balance: 60 };
  const t = applyHeightBias({ ...base }, 200);
  assert.ok(t.heading > 60 && t.agility < 60);
});

test('sistema de entrevistas: gera matéria e aplica repercussão', () => {
  const G = makeGame({ seed: 44, position: 'ST' });
  doRollAcademy(G);
  confirmAcademy(G);
  const iv = offerInterview(G);
  assert.ok(iv && iv.opts.length >= 2, 'deve gerar uma entrevista com opções');
  assert.equal(getInterview(G), iv);
  const fansBefore = G.player.fanSupport;
  const newsBefore = G.news.length;
  const res = answerInterview(G, 0);
  assert.ok(res && res.headline && res.reactions.length > 0, 'gera manchete e reações');
  assert.equal(G.pendingInterview, null, 'entrevista some após responder');
  assert.ok(G.news.length > newsBefore, 'vira notícia');
  assert.ok(G.interviewHistory.length === 1, 'entra no histórico');
  assert.ok(typeof G.player.fanSupport === 'number' && G.player.fanSupport !== fansBefore || res.deltas.fans === 0);
});

test('ano de Copa do Mundo: a Copa é disputada no início do ano (2026)', () => {
  const G = makeGame({ seed: 8, position: 'ST' });
  doRollAcademy(G);
  confirmAcademy(G);
  assert.equal(G.seasonYear, 2026);
  assert.equal(G.seasonYear % 4, 2, '2026 é ano de Copa');
  let sawWorldCup = false;
  for (let w = 0; w < 8; w++) {
    const events = advanceWeek(G);
    if (events.some((e) => e.type === 'worldcup')) sawWorldCup = true;
  }
  assert.ok(sawWorldCup, 'a Copa do Mundo deve abrir o ano');
  assert.equal(G.wcPlayedYear, 2026, 'marca a Copa como já disputada no ano');
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
