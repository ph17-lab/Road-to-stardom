// Interface do Modo Carreira — SPA responsiva (celular e PC).

import {
  newGame, doRollAcademy, confirmAcademy, advanceWeek, acceptOffer, rejectOffer,
  negotiate, setTrainingFocus, retirePlayer, careerTotals, nextFixture,
  playerClub, playerLeague, avgRating, fullName, tableStandings, MAX_REROLLS,
} from '../core/engine.js';
import { saveToStorage, loadFromStorage, clearStorage, serialize, deserialize } from '../core/save.js';
import { POSITIONS, POSITION_NAMES, PLAYER_STYLES, ATTR_GROUPS, ATTR_NAMES, trainingOptions } from '../core/attributes.js';
import { NATIONS, ORIGIN_COUNTRIES } from '../data/nations.js';
import { callupThreshold, isCalledUp, roundName } from '../core/competitions.js';

let G = null;
let activeTab = 'overview';
let eventQueue = [];

const $ = (sel) => document.querySelector(sel);

// ---------------- Navegação entre telas ----------------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ---------------- Tela inicial ----------------

function initStart() {
  const saved = loadFromStorage();
  if (saved) {
    $('#btn-continue').hidden = false;
    $('#btn-continue').onclick = () => {
      G = loadFromStorage();
      if (G.phase === 'retired') showRetired();
      else if (G.phase === 'roll') showRollScreen();
      else showCareer();
    };
  }
  $('#btn-new').onclick = () => {
    if (loadFromStorage() && !confirm('Já existe uma carreira salva. Começar uma nova irá substituí-la. Continuar?')) return;
    showScreen('#screen-create');
  };
  $('#btn-import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      G = deserialize(await file.text());
      saveToStorage(G);
      if (G.phase === 'retired') showRetired();
      else if (G.phase === 'roll') showRollScreen();
      else showCareer();
    } catch {
      alert('Arquivo de save inválido.');
    }
  };
}

// ---------------- Criação do jogador ----------------

function initCreate() {
  const form = $('#create-form');
  const fill = (name, options, selected) => {
    const sel = form.elements[name];
    sel.innerHTML = options.map(([v, label]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${label}</option>`).join('');
  };
  fill('age', [14, 15, 16, 17, 18].map((a) => [a, `${a} anos`]), 15);
  fill('nationality', Object.keys(NATIONS).map((n) => [n, n]), 'Brasil');
  fill('country', ORIGIN_COUNTRIES.map((c) => [c, c]), 'Brasil');
  fill('position', POSITIONS.map((p) => [p, `${POSITION_NAMES[p]} (${p})`]), 'ST');
  fill('style', Object.keys(PLAYER_STYLES).map((s) => [s, s]));

  $('#btn-back-start').onclick = () => showScreen('#screen-start');

  form.onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(form);
    G = newGame({
      firstName: d.get('firstName').trim(),
      lastName: d.get('lastName').trim(),
      age: parseInt(d.get('age'), 10),
      nationality: d.get('nationality'),
      country: d.get('country'),
      foot: d.get('foot'),
      position: d.get('position'),
      height: parseInt(d.get('height'), 10) || 178,
      shirt: parseInt(d.get('shirt'), 10) || 10,
      style: d.get('style'),
    });
    showRollScreen();
  };
}

// ---------------- Roleta da academia ----------------

function showRollScreen() {
  showScreen('#screen-roll');
  $('#roll-country').textContent = G.country;
  $('#roll-result').hidden = true;
  $('#btn-roll').hidden = !!G.lastRoll === false ? false : true;
  $('#btn-roll').hidden = !!G.lastRoll;
  $('#btn-reroll').hidden = true;
  $('#btn-accept-roll').hidden = true;
  if (G.lastRoll) revealRoll(G.lastRoll, true);
  $('#btn-roll').onclick = () => spinRoulette();
  $('#btn-reroll').onclick = () => spinRoulette();
  $('#btn-accept-roll').onclick = () => {
    confirmAcademy(G);
    saveToStorage(G);
    showCareer();
  };
}

function spinRoulette() {
  let roll;
  try {
    roll = doRollAcademy(G);
  } catch {
    return;
  }
  saveToStorage(G);
  const clubNames = G.clubs.filter((c) => c.country === G.country).map((c) => c.name);
  const display = $('#roulette-display');
  const box = $('#roulette');
  $('#roll-result').hidden = true;
  $('#btn-roll').hidden = true;
  $('#btn-reroll').hidden = true;
  $('#btn-accept-roll').hidden = true;
  box.classList.add('spinning');

  let ticks = 0;
  const total = 28;
  const spin = () => {
    ticks++;
    display.textContent = clubNames[Math.floor(Math.random() * clubNames.length)];
    if (ticks < total) {
      setTimeout(spin, 40 + ticks * 7); // desacelera aos poucos
    } else {
      box.classList.remove('spinning');
      revealRoll(roll, false);
    }
  };
  spin();
}

function revealRoll(roll, instant) {
  const display = $('#roulette-display');
  display.textContent = `⭐ ${roll.clubName} ⭐`;
  $('#roll-result').hidden = false;
  $('#roll-club').textContent = roll.clubName;
  $('#roll-text').textContent = `Você foi selecionado para a categoria de base do ${roll.clubName}!`;
  $('#roll-cat').textContent = roll.category;
  $('#roll-academy').textContent = '★'.repeat(Math.round(roll.academyLevel / 2)) + ` (${roll.academyLevel}/10)`;
  $('#roll-ovr').textContent = roll.profile.overall;
  $('#roll-pot').textContent = `${roll.profile.potential - 2}–${Math.min(99, roll.profile.potential + 2)}`;
  const reroll = $('#btn-reroll');
  if (G.rerollsLeft > 0) {
    reroll.hidden = false;
    reroll.textContent = `Roletar novamente (${G.rerollsLeft} restante${G.rerollsLeft > 1 ? 's' : ''})`;
  } else {
    reroll.hidden = true;
  }
  $('#btn-accept-roll').hidden = false;
  void instant;
}

// ---------------- Hub da carreira ----------------

const TABS = [
  ['overview', 'Meu jogador'],
  ['stats', 'Estatísticas'],
  ['tables', 'Ligas e copas'],
  ['calendar', 'Calendário'],
  ['transfers', 'Transferências'],
  ['training', 'Treinamento'],
  ['nation', 'Seleção'],
  ['history', 'História'],
  ['news', 'Notícias'],
];

function showCareer() {
  showScreen('#screen-career');
  renderTabs();
  renderHeader();
  renderTab();
  $('#btn-advance').onclick = () => doAdvance(1);
  $('#btn-advance4').onclick = () => doAdvance(4);
  $('#btn-save').onclick = () => {
    saveToStorage(G);
    toast('Carreira salva!');
  };
  $('#btn-export').onclick = exportSave;
}

function renderTabs() {
  const nav = $('#career-tabs');
  nav.innerHTML = '';
  for (const [id, label] of TABS) {
    const b = document.createElement('button');
    b.textContent = label;
    if (id === activeTab) b.classList.add('active');
    b.onclick = () => {
      activeTab = id;
      renderTabs();
      renderTab();
    };
    nav.appendChild(b);
  }
}

function fmtMoney(m) {
  if (m >= 1) return `€${m.toFixed(1).replace('.0', '')}M`;
  return `€${Math.round(m * 1000)} mil`;
}

function renderHeader() {
  const p = G.player;
  const club = playerClub(G);
  const rating = avgRating(p.seasonStats);
  const roleLabel = p.youth ? p.category : { starter: 'Titular', rotation: 'Rodízio', bench: 'Reserva' }[p.squadRole] || '';
  $('#career-header').innerHTML = `
    <div class="big-ovr">${p.overall}</div>
    <div class="who">
      <div class="name">${fullName(p)} <span class="muted">#${p.shirt}</span></div>
      <div class="meta">${POSITION_NAMES[p.position]} · ${p.age} anos · ${p.nationality} · ${club ? club.name : 'Sem clube'}</div>
      <div>
        <span class="badge ${p.youth ? '' : 'green'}">${p.youth ? 'Base — ' + p.category : roleLabel}</span>
        <span class="badge">POT ${p.potential - 2}–${Math.min(99, p.potential + 2)}</span>
        <span class="badge">Valor ${fmtMoney(p.value)}</span>
        ${p.injury ? `<span class="badge red">🤕 ${p.injury.desc} (${p.injury.weeks} sem)</span>` : ''}
        ${rating > 0 ? `<span class="badge gold">Nota ${rating.toFixed(2)}</span>` : ''}
      </div>
    </div>
    <div class="meta" style="text-align:right">
      <div><strong>Temporada ${G.seasonYear}</strong></div>
      <div>Semana ${G.week}</div>
    </div>`;
}

function renderTab() {
  const el = $('#tab-content');
  const renders = {
    overview: renderOverview, stats: renderStats, tables: renderTables, calendar: renderCalendar,
    transfers: renderTransfers, training: renderTraining, nation: renderNation,
    history: renderHistory, news: renderNews,
  };
  el.innerHTML = '';
  renders[activeTab](el);
}

// ---- Aba: visão geral ----

function renderOverview(el) {
  const p = G.player;
  const club = playerClub(G);
  const league = playerLeague(G);
  const fx = nextFixture(G);
  const s = p.seasonStats;
  const rating = avgRating(s);
  const morale = p.morale >= 75 ? '😄 Alta' : p.morale >= 50 ? '🙂 Estável' : p.morale >= 30 ? '😐 Baixa' : '😞 Péssima';
  const form = p.form >= 75 ? '🔥 Ótima' : p.form >= 55 ? '📈 Boa' : p.form >= 40 ? '➖ Regular' : '📉 Ruim';

  el.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Situação</h3>
        <p><strong>${club ? club.name : '—'}</strong> ${p.youth ? `(${p.category})` : ''} · ${league ? league.name : ''}</p>
        <p class="muted">Estádio: ${club ? club.stadium : '—'} · Técnico: ${club ? club.manager : '—'}</p>
        <p>Moral: ${morale} &nbsp;·&nbsp; Forma: ${form}</p>
        <p>Salário: <strong>${fmtMoney(p.contract.wage / 1000)}</strong>/semana · Contrato: ${p.youth ? 'formação' : p.contract.years + ' ano(s)'}</p>
        ${p.parentClubId !== null ? `<p class="muted">Emprestado pelo ${G.clubs[p.parentClubId].name}</p>` : ''}
      </div>
      <div class="card">
        <h3>Próximo compromisso</h3>
        <p><strong>${fx ? fx.desc : '—'}</strong></p>
        <p class="muted">${fx ? fx.comp : ''}</p>
        <h3 style="margin-top:14px">Temporada ${G.seasonYear}</h3>
        <p>Jogos <strong>${s.apps}</strong> · Gols <strong>${s.goals}</strong> · Assist. <strong>${s.assists}</strong>${rating > 0 ? ` · Nota média <strong>${rating.toFixed(2)}</strong>` : ''}</p>
        ${p.position === 'GK' ? `<p>Jogos sem sofrer gol: <strong>${s.cleanSheets}</strong></p>` : ''}
      </div>
    </div>
    <div class="card">
      <h3>Atributos <span class="muted">OVR ${p.overall} / POT ~${p.potential}</span></h3>
      <div class="grid2">${attrColumns(p)}</div>
    </div>
    ${retireCard()}`;
  const rbtn = $('#btn-retire');
  if (rbtn) {
    rbtn.onclick = () => {
      if (confirm('Anunciar aposentadoria ao fim desta temporada?')) {
        retirePlayer(G);
        toast('Você se aposentará ao fim da temporada.');
      }
    };
  }
}

function retireCard() {
  const p = G.player;
  if (p.age < 32 || G.wantRetire) return G.wantRetire ? '<div class="card"><p>📣 Você anunciou que se aposenta ao fim da temporada.</p></div>' : '';
  return '<div class="card"><h3>Fim de carreira?</h3><p class="muted">Você já passou dos 32. Pode se aposentar ao fim da temporada.</p><button id="btn-retire" class="btn">🪑 Anunciar aposentadoria</button></div>';
}

function attrColumns(p) {
  const isGk = p.position === 'GK';
  const groups = isGk
    ? ['goalkeeping', 'physical', 'passing']
    : ['attack', 'passing', 'dribbling', 'defense', 'physical'];
  const titles = {
    attack: 'Ataque', passing: 'Passe', dribbling: 'Drible', defense: 'Defesa',
    physical: 'Físico', goalkeeping: 'Goleiro',
  };
  return groups.map((g) => `
    <div>
      <h4 class="muted" style="margin:8px 0 4px">${titles[g]}</h4>
      ${ATTR_GROUPS[g].map((k) => {
        const v = p.attrs[k];
        return `<div class="attr-row">
          <span class="attr-name">${ATTR_NAMES[k]}</span>
          <span class="attr-val">${v}</span>
          <span class="bar ${v < 55 ? 'low' : ''}"><i style="width:${v}%"></i></span>
        </div>`;
      }).join('')}
    </div>`).join('');
}

// ---- Aba: estatísticas ----

function renderStats(el) {
  const p = G.player;
  const s = p.seasonStats;
  const rating = avgRating(s);
  const totals = careerTotals(G);
  el.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Temporada ${G.seasonYear}</h3>
        <table>
          <tr><td>Jogos (titular)</td><td class="num">${s.apps} (${s.starts})</td></tr>
          <tr><td>Minutos</td><td class="num">${s.minutes}</td></tr>
          <tr><td>Gols</td><td class="num">${s.goals}</td></tr>
          <tr><td>Assistências</td><td class="num">${s.assists}</td></tr>
          <tr><td>Nota média</td><td class="num">${rating > 0 ? rating.toFixed(2) : '—'}</td></tr>
          <tr><td>Melhor em campo</td><td class="num">${s.motm}</td></tr>
          <tr><td>Cartões (🟨/🟥)</td><td class="num">${s.yellow}/${s.red}</td></tr>
          ${p.position === 'GK' ? `<tr><td>Sem sofrer gol</td><td class="num">${s.cleanSheets}</td></tr>` : ''}
          <tr><td>Seleção (jogos/gols)</td><td class="num">${s.natApps}/${s.natGoals}</td></tr>
        </table>
      </div>
      <div class="card">
        <h3>Carreira</h3>
        <table>
          <tr><td>Temporadas</td><td class="num">${totals.seasons + 1}</td></tr>
          <tr><td>Jogos</td><td class="num">${totals.apps}</td></tr>
          <tr><td>Gols</td><td class="num">${totals.goals}</td></tr>
          <tr><td>Assistências</td><td class="num">${totals.assists}</td></tr>
          <tr><td>Títulos</td><td class="num">${p.titles.length}</td></tr>
          <tr><td>Prêmios individuais</td><td class="num">${p.awards.length}</td></tr>
          <tr><td>Jogos pela seleção</td><td class="num">${p.natTeam.caps}</td></tr>
          <tr><td>Gols pela seleção</td><td class="num">${p.natTeam.goals}</td></tr>
          <tr><td>Reputação</td><td class="num">${Math.round(p.reputation)}/100</td></tr>
        </table>
      </div>
    </div>
    <div class="card">
      <h3>Temporada a temporada</h3>
      <div class="table-scroll">${seasonHistoryTable()}</div>
    </div>`;
}

function seasonHistoryTable() {
  const rows = G.player.seasonHistory;
  if (rows.length === 0) return '<p class="muted">Sua primeira temporada ainda está em andamento.</p>';
  return `<table>
    <tr><th>Ano</th><th>Idade</th><th>Clube</th><th>Divisão</th><th class="num">J</th><th class="num">G</th><th class="num">A</th><th class="num">Nota</th><th class="num">OVR</th></tr>
    ${rows.map((s) => `<tr><td>${s.year}</td><td>${s.age}</td><td>${s.club}</td><td>${s.division}</td><td class="num">${s.apps}</td><td class="num">${s.goals}</td><td class="num">${s.assists}</td><td class="num">${s.avgRating || '—'}</td><td class="num">${s.ovr}</td></tr>`).join('')}
  </table>`;
}

// ---- Aba: ligas e copas ----

let selectedLeagueId = null;

function renderTables(el) {
  const myLeague = playerLeague(G);
  if (!selectedLeagueId) selectedLeagueId = myLeague ? myLeague.id : G.leagues[0].id;
  const league = G.leagues.find((l) => l.id === selectedLeagueId);
  const standings = tableStandings(league);
  const cup = G.cups[league.id];

  el.innerHTML = `
    <select id="league-select" class="inline">
      ${G.leagues.map((l) => `<option value="${l.id}"${l.id === selectedLeagueId ? ' selected' : ''}>${l.name} (${l.country})</option>`).join('')}
    </select>
    <div class="card">
      <h3>${league.name} — Temporada ${G.seasonYear}</h3>
      <div class="table-scroll">
        <table>
          <tr><th>#</th><th>Clube</th><th class="num">P</th><th class="num">J</th><th class="num">V</th><th class="num">E</th><th class="num">D</th><th class="num">SG</th></tr>
          ${standings.map((id, i) => {
            const c = G.clubs[id];
            const t = league.table[id];
            const mine = G.player.clubId === id;
            return `<tr class="${mine ? 'highlight' : ''}"><td>${i + 1}</td><td>${c.name}</td><td class="num"><strong>${t.pts}</strong></td><td class="num">${t.p}</td><td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td><td class="num">${t.gf - t.ga}</td></tr>`;
          }).join('')}
        </table>
      </div>
    </div>
    <div class="grid2">
      <div class="card">
        <h3>${cup ? cup.name : 'Copa nacional'}</h3>
        ${cupStatus(cup)}
      </div>
      <div class="card">
        <h3>Competições continentais</h3>
        ${G.continentals.map((c) => `<p><strong>${c.name}</strong>: ${contStatus(c)}</p>`).join('')}
        ${G.wccWinnerId !== null ? `<p><strong>Mundial de Clubes</strong>: 🏆 ${G.clubs[G.wccWinnerId].name}</p>` : ''}
      </div>
    </div>`;
  $('#league-select').onchange = (e) => {
    selectedLeagueId = e.target.value;
    renderTab();
  };
}

function cupStatus(cup) {
  if (!cup) return '<p class="muted">—</p>';
  if (cup.winnerId !== null) return `<p>🏆 Campeão: <strong>${G.clubs[cup.winnerId].name}</strong></p>`;
  return `<p>Fase atual: <strong>${roundName(cup)}</strong></p>
    <p class="muted">${cup.alive.map((id) => G.clubs[id].name).join(' · ')}</p>`;
}

function contStatus(c) {
  if (c.winnerId !== null) return `🏆 ${G.clubs[c.winnerId].name}`;
  return `${roundName(c)} — ${c.alive.length} clubes vivos${c.alive.includes(G.player.clubId) ? ' (seu clube está vivo! 🔥)' : ''}`;
}

// ---- Aba: calendário ----

function renderCalendar(el) {
  const log = (G.matchLog || []).filter((m) => m.year === G.seasonYear);
  const fx = nextFixture(G);
  el.innerHTML = `
    <div class="card">
      <h3>Próximo compromisso</h3>
      <p><strong>${fx ? fx.desc : '—'}</strong> <span class="muted">${fx ? '· ' + fx.comp : ''}</span></p>
      <p class="muted">Semana ${G.week} de 40 · Copas nas semanas 6/14/22/30 · Continentais 10/18/26/34 · Datas FIFA 16/32</p>
    </div>
    <div class="card">
      <h3>Partidas da temporada</h3>
      ${log.length === 0 ? '<p class="muted">Nenhuma partida disputada ainda.</p>' : `
      <div class="table-scroll"><table>
        <tr><th>Sem</th><th>Competição</th><th>Partida</th><th class="num">Placar</th><th class="num">Nota</th><th class="num">G+A</th></tr>
        ${log.slice().reverse().map((m) => `<tr>
          <td>${m.week}</td><td>${m.comp}</td><td>${m.homeName} x ${m.awayName}</td>
          <td class="num"><strong>${m.gh}-${m.ga}</strong></td>
          <td class="num">${m.stats ? m.stats.rating.toFixed(1) : 'DNP'}</td>
          <td class="num">${m.stats ? (m.stats.goals || 0) + '+' + (m.stats.assists || 0) : '—'}</td>
        </tr>`).join('')}
      </table></div>`}
    </div>`;
}

// ---- Aba: transferências ----

function renderTransfers(el) {
  const p = G.player;
  const offers = G.offers;
  el.innerHTML = `
    <div class="card">
      <h3>Meu passe</h3>
      <p>Valor de mercado: <strong>${fmtMoney(p.value)}</strong> · Salário: <strong>${fmtMoney(p.contract.wage / 1000)}</strong>/semana</p>
      <p class="muted">Janelas de transferência: semanas 2–5 e 20–24. Bom desempenho atrai clubes maiores.</p>
    </div>
    <div class="card">
      <h3>Propostas recebidas</h3>
      ${offers.length === 0 ? '<p class="muted">Nenhuma proposta no momento. Continue se destacando!</p>' : ''}
      ${offers.map((o) => `
        <div class="offer" data-id="${o.id}">
          <div class="offer-club">${o.clubName} <span class="badge">${G.clubs[o.clubId].avgOvr} OVR médio</span></div>
          <div class="offer-terms">
            ${o.type === 'loan' ? 'Empréstimo (1 temporada)' : `Transferência · €${o.fee}M · ${o.years} anos`}
            · Salário ${fmtMoney(o.wage / 1000)}/sem
          </div>
          <div class="offer-buttons">
            <button class="btn primary small-btn" data-act="accept">Aceitar</button>
            <button class="btn small-btn" data-act="negotiate" ${o.negotiated ? 'disabled' : ''}>Negociar salário</button>
            <button class="btn small-btn" data-act="reject">Recusar</button>
          </div>
        </div>`).join('')}
    </div>`;
  el.querySelectorAll('.offer button').forEach((b) => {
    b.onclick = () => {
      const id = parseInt(b.closest('.offer').dataset.id, 10);
      const act = b.dataset.act;
      if (act === 'accept') {
        const offer = G.offers.find((o) => o.id === id);
        if (!confirm(`Assinar com ${offer.clubName}?`)) return;
        const text = acceptOffer(G, id);
        saveToStorage(G);
        renderHeader();
        toast(text);
      } else if (act === 'negotiate') {
        const r = negotiate(G, id);
        toast(r.ok ? 'O clube melhorou a oferta salarial! 💰' : r.withdrawn ? 'O clube retirou a proposta. 😬' : 'Sem acordo.');
        saveToStorage(G);
      } else {
        rejectOffer(G, id);
        saveToStorage(G);
      }
      renderTab();
    };
  });
}

// ---- Aba: treinamento ----

function renderTraining(el) {
  const p = G.player;
  const opts = trainingOptions(p.position);
  el.innerHTML = `
    <div class="card">
      <h3>Foco de treinamento</h3>
      <p class="muted">O treino melhora gradualmente os atributos escolhidos. Minutos em campo, notas altas e boas academias aceleram a evolução — sempre limitada pelo seu potencial.</p>
      ${opts.map((o) => `
        <label style="display:flex;gap:8px;align-items:center;padding:8px 0;cursor:pointer">
          <input type="radio" name="focus" value="${o}" ${p.trainingFocus === o ? 'checked' : ''}>
          <span>${o}</span>
        </label>`).join('')}
    </div>
    <div class="card">
      <h3>Fatores de evolução</h3>
      <table>
        <tr><td>Idade</td><td class="num">${p.age} anos ${p.age <= 20 ? '(pico de aprendizado 🚀)' : p.age >= 32 ? '(declínio físico 📉)' : ''}</td></tr>
        <tr><td>Potencial restante</td><td class="num">${Math.max(0, p.potential - p.overall)} pontos</td></tr>
        <tr><td>Estrutura do clube</td><td class="num">${playerClub(G) ? (G.player.youth ? playerClub(G).academy : playerClub(G).rep) + '/10' : '—'}</td></tr>
        <tr><td>Forma</td><td class="num">${Math.round(p.form)}/100</td></tr>
        <tr><td>Moral</td><td class="num">${Math.round(p.morale)}/100</td></tr>
      </table>
    </div>`;
  el.querySelectorAll('input[name=focus]').forEach((r) => {
    r.onchange = () => {
      setTrainingFocus(G, r.value);
      saveToStorage(G);
      toast(`Foco de treino: ${r.value}`);
    };
  });
}

// ---- Aba: seleção ----

function renderNation(el) {
  const p = G.player;
  const thr = callupThreshold(p.nationality);
  const called = isCalledUp(p);
  el.innerHTML = `
    <div class="card">
      <h3>Seleção de ${p.nationality}</h3>
      <p>${called ? '✅ Você está no radar do treinador da seleção!' : `Convocações exigem cerca de <strong>${thr} OVR</strong> e boa reputação. ${p.youth ? 'Chegue ao profissional primeiro!' : 'Continue evoluindo!'}`}</p>
      <table>
        <tr><td>Jogos pela seleção</td><td class="num">${p.natTeam.caps}</td></tr>
        <tr><td>Gols pela seleção</td><td class="num">${p.natTeam.goals}</td></tr>
        <tr><td>Primeira convocação</td><td class="num">${p.natTeam.called ? 'Sim' : 'Ainda não'}</td></tr>
      </table>
      <p class="muted" style="margin-top:8px">Copa do Mundo a cada 4 anos (2026, 2030…). Torneios continentais nos anos 2028, 2032… Amistosos nas datas FIFA (semanas 16 e 32).</p>
    </div>`;
}

// ---- Aba: história ----

function renderHistory(el) {
  const p = G.player;
  el.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>🏆 Títulos (${p.titles.length})</h3>
        ${p.titles.length === 0 ? '<p class="muted">Nenhum título ainda. Vá buscar!</p>'
          : `<table>${p.titles.map((t) => `<tr><td>${t.year}</td><td>${t.name}</td><td class="muted">${t.club}</td></tr>`).join('')}</table>`}
      </div>
      <div class="card">
        <h3>🏅 Prêmios individuais (${p.awards.length})</h3>
        ${p.awards.length === 0 ? '<p class="muted">Nenhum prêmio ainda.</p>'
          : `<table>${p.awards.map((a) => `<tr><td>${a.year}</td><td>${a.name}</td></tr>`).join('')}</table>`}
      </div>
    </div>
    <div class="card">
      <h3>Linha do tempo</h3>
      <div class="table-scroll">${seasonHistoryTable()}</div>
    </div>`;
}

// ---- Aba: notícias ----

function renderNews(el) {
  el.innerHTML = `
    <div class="card">
      <h3>📰 Notícias do mundo do futebol</h3>
      ${G.news.length === 0 ? '<p class="muted">Sem notícias.</p>' : G.news.map((n) => `
        <div class="news-item"><span class="when">${n.year} · sem ${n.week}</span><br>${n.text}</div>`).join('')}
    </div>`;
}

// ---------------- Avançar semana + eventos ----------------

function doAdvance(weeks) {
  const btn = $('#btn-advance');
  btn.disabled = true;
  const allEvents = [];
  for (let i = 0; i < weeks && G.phase === 'career'; i++) {
    const events = advanceWeek(G);
    // registra partidas no calendário
    for (const e of events) {
      if (e.type === 'match') {
        G.matchLog = G.matchLog || [];
        G.matchLog.push(e.report);
        if (G.matchLog.length > 120) G.matchLog.shift();
      }
    }
    allEvents.push(...events);
  }
  saveToStorage(G);
  btn.disabled = false;
  renderHeader();
  renderTab();
  eventQueue = allEvents.filter((e) => ['match', 'promotion', 'offers', 'callup', 'title', 'award', 'released', 'newSeason', 'retired', 'recovered', 'growth'].includes(e.type));
  showNextEvent();
}

function showNextEvent() {
  if (eventQueue.length === 0) {
    if (G.phase === 'retired') showRetired();
    return;
  }
  const e = eventQueue.shift();
  const box = $('#modal-content');
  if (e.type === 'match') {
    const m = e.report;
    box.innerHTML = `
      <div class="match-comp">${m.comp}</div>
      <div class="scoreline">${m.homeName} ${m.gh} × ${m.ga} ${m.awayName}</div>
      <p class="muted">${m.stadium}</p>
      ${m.stats ? `
        <p><strong>Seu desempenho</strong></p>
        <div class="pstats">
          <div class="stat-chip">Minutos<br><strong>${m.stats.minutes}</strong></div>
          <div class="stat-chip">Nota<br><strong>${m.stats.rating.toFixed(1)}${m.stats.motm ? ' ⭐' : ''}</strong></div>
          ${G.player.position === 'GK'
            ? `<div class="stat-chip">Defesas<br><strong>${m.stats.saves}</strong></div>
               <div class="stat-chip">Sem sofrer gol<br><strong>${m.stats.cleanSheet ? 'Sim' : 'Não'}</strong></div>`
            : `<div class="stat-chip">Gols<br><strong>${m.stats.goals}</strong></div>
               <div class="stat-chip">Assist.<br><strong>${m.stats.assists}</strong></div>
               <div class="stat-chip">Finalizações<br><strong>${m.stats.shots}</strong></div>
               <div class="stat-chip">Passes<br><strong>${m.stats.passes} (${m.stats.passAcc}%)</strong></div>
               <div class="stat-chip">Desarmes<br><strong>${m.stats.tackles}</strong></div>`}
          ${m.stats.yellow ? '<div class="stat-chip">🟨</div>' : ''}${m.stats.red ? '<div class="stat-chip">🟥</div>' : ''}
        </div>` : '<p class="muted">Você não entrou em campo nesta partida.</p>'}`;
  } else {
    const cls = e.type === 'title' || e.type === 'award' ? 'title' : '';
    box.innerHTML = `<div class="event-line ${cls}">${e.text}</div>`;
  }
  $('#modal').hidden = false;
}

$('#modal-close').onclick = () => {
  $('#modal').hidden = true;
  showNextEvent();
};

// ---------------- Aposentadoria ----------------

function showRetired() {
  showScreen('#screen-retired');
  const p = G.player;
  const totals = careerTotals(G);
  $('#retired-summary').innerHTML = `
    <div class="hero" style="padding-top:6vh">
      <h1>👑 Fim de carreira</h1>
      <p class="subtitle">${fullName(p)} — ${POSITION_NAMES[p.position]} · aposentado aos ${p.age} anos</p>
    </div>
    <div class="grid2">
      <div class="card">
        <h3>Números da carreira</h3>
        <table>
          <tr><td>Temporadas</td><td class="num">${p.seasonHistory.length}</td></tr>
          <tr><td>Jogos</td><td class="num">${totals.apps}</td></tr>
          <tr><td>Gols</td><td class="num">${totals.goals}</td></tr>
          <tr><td>Assistências</td><td class="num">${totals.assists}</td></tr>
          <tr><td>Jogos pela seleção</td><td class="num">${p.natTeam.caps}</td></tr>
          <tr><td>Gols pela seleção</td><td class="num">${p.natTeam.goals}</td></tr>
          <tr><td>Pico de overall</td><td class="num">${Math.max(...p.seasonHistory.map((s) => s.ovr), p.overall)}</td></tr>
        </table>
      </div>
      <div class="card">
        <h3>🏆 Conquistas</h3>
        <p><strong>${p.titles.length}</strong> títulos · <strong>${p.awards.length}</strong> prêmios individuais</p>
        ${p.awards.some((a) => a.name === 'Bola de Ouro') ? '<p>🥇 Vencedor da <strong>Bola de Ouro</strong>!</p>' : ''}
        ${p.titles.slice(0, 12).map((t) => `<div class="news-item">${t.year} — ${t.name} (${t.club})</div>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Linha do tempo</h3>
      <div class="table-scroll">${seasonHistoryTable()}</div>
    </div>`;
  $('#btn-retired-new').onclick = () => {
    clearStorage();
    location.reload();
  };
}

// ---------------- Utilidades ----------------

function toast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#1d2d4d;border:1px solid #33d17a;color:#e8eefc;padding:10px 18px;border-radius:10px;z-index:99;max-width:90vw;text-align:center';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function exportSave() {
  const blob = new Blob([serialize(G)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `road-to-stardom-${G.player.lastName}-${G.seasonYear}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------- Boot ----------------

initStart();
initCreate();
showScreen('#screen-start');
