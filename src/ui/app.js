// Interface do Modo Carreira — SPA responsiva (celular e PC).

import {
  newGame, doRollAcademy, confirmAcademy, advanceWeek, acceptOffer, rejectOffer,
  negotiate, setTrainingFocus, retirePlayer, careerTotals, nextFixture,
  playerClub, playerLeague, avgRating, fullName, tableStandings,
} from '../core/engine.js';
import { saveToStorage, loadFromStorage, clearStorage, serialize, deserialize } from '../core/save.js';
import { POSITIONS, POSITION_NAMES, PLAYER_STYLES, ATTR_GROUPS, ATTR_NAMES, trainingOptions } from '../core/attributes.js';
import { NATIONS, ORIGIN_COUNTRIES } from '../data/nations.js';
import { callupThreshold, isCalledUp, roundName } from '../core/competitions.js';

let G = null;
let activeTab = 'overview';
let eventQueue = [];

const $ = (sel) => document.querySelector(sel);

// ---------------- Bandeiras e textos ----------------

const FLAGS = {
  'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Espanha': '🇪🇸', 'Alemanha': '🇩🇪',
  'Itália': '🇮🇹', 'França': '🇫🇷', 'Portugal': '🇵🇹', 'Holanda': '🇳🇱', 'Bélgica': '🇧🇪',
  'Estados Unidos': '🇺🇸', 'México': '🇲🇽', 'Arábia Saudita': '🇸🇦', 'Turquia': '🇹🇷', 'Escócia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Uruguai': '🇺🇾', 'Colômbia': '🇨🇴', 'Chile': '🇨🇱', 'Croácia': '🇭🇷', 'Japão': '🇯🇵',
  'Nigéria': '🇳🇬', 'Senegal': '🇸🇳', 'Gana': '🇬🇭', 'Marrocos': '🇲🇦',
};
const flag = (n) => FLAGS[n] || '🏳️';

const STYLE_DESC = {
  'Finalizador': 'Faro de gol — finalização, posicionamento e voleios.',
  'Craque técnico': 'Magia com a bola — drible, controle e visão.',
  'Velocista': 'Explosão pura — velocidade, aceleração e agilidade.',
  'Motor (box-to-box)': 'Pulmão infinito — resistência, desarme e chutes de longe.',
  'Cérebro (armador)': 'O maestro — visão e passes curtos e longos.',
  'Muralha (defensivo)': 'Intransponível — marcação, posicionamento e força.',
  'Completo': 'Equilibrado em todas as áreas do jogo.',
};

const POS_GROUP_ICON = { GK: '🧤', CB: '🛡️', RB: '🛡️', LB: '🛡️', CDM: '⚙️', CM: '⚙️', CAM: '🎯', RW: '⚡', LW: '⚡', CF: '🎯', ST: '🥅' };

// tier do overall geral -> classe do anel
function ovrTierClass(ovr) {
  if (ovr >= 85) return 'tier-elite';
  if (ovr >= 78) return 'tier-gold';
  if (ovr >= 68) return 'tier-silver';
  return 'tier-bronze';
}
// tier de um atributo individual
function attrTier(v) {
  if (v >= 80) return 'elite';
  if (v >= 70) return 'good';
  if (v >= 60) return 'ok';
  return 'low';
}
function ovrRing(ovr, extraClass = '') {
  return `<div class="ovr-ring ${ovrTierClass(ovr)} ${extraClass}" style="--p:${ovr}"><span class="ovr-num">${ovr}</span></div>`;
}

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
      routeToScreen();
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
      routeToScreen();
    } catch {
      alert('Arquivo de save inválido.');
    }
  };
}

function routeToScreen() {
  if (G.phase === 'retired') showRetired();
  else if (G.phase === 'roll') showRollScreen();
  else showCareer();
}

// ---------------- Criação do jogador (chips) ----------------

const createState = {
  age: 15, position: 'ST', foot: 'Direito', style: 'Finalizador',
  nationality: 'Brasil', country: 'Brasil', height: 178, shirt: 10,
};

function buildChips(field, options, onChange) {
  const el = document.querySelector(`.chips[data-field="${field}"]`);
  el.innerHTML = '';
  for (const opt of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (createState[field] === opt.value ? ' selected' : '');
    b.innerHTML = opt.label;
    b.onclick = () => {
      createState[field] = opt.value;
      el.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
      b.classList.add('selected');
      if (onChange) onChange(opt.value);
    };
    el.appendChild(b);
  }
}

function buildStepper(field, min, max, fmt) {
  const wrap = document.querySelector(`.stepper[data-stepper="${field}"]`);
  const valEl = document.getElementById(`${field}-val`);
  const paint = () => { valEl.textContent = fmt(createState[field]); };
  wrap.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      const d = parseInt(btn.dataset.d, 10);
      createState[field] = Math.max(min, Math.min(max, createState[field] + d));
      paint();
    };
  });
  paint();
}

function initCreate() {
  buildChips('age', [14, 15, 16, 17, 18].map((a) => ({ value: a, label: `${a} anos` })));
  buildChips('position', POSITIONS.map((p) => ({ value: p, label: `<strong>${p}</strong> ${POSITION_NAMES[p]}` })));
  buildChips('foot', ['Direito', 'Esquerdo', 'Ambidestro'].map((f) => ({ value: f, label: f })));
  buildChips('style', Object.keys(PLAYER_STYLES).map((s) => ({ value: s, label: s })), (v) => {
    $('#style-desc').textContent = STYLE_DESC[v] || '';
  });
  buildChips('nationality', Object.keys(NATIONS).map((n) => ({ value: n, label: `<span class="flag">${flag(n)}</span>${n}` })));
  buildChips('country', ORIGIN_COUNTRIES.map((c) => ({ value: c, label: `<span class="flag">${flag(c)}</span>${c}` })));
  buildStepper('height', 160, 205, (v) => `${v} cm`);
  buildStepper('shirt', 1, 99, (v) => `${v}`);
  $('#style-desc').textContent = STYLE_DESC[createState.style];

  $('#btn-back-start').onclick = () => showScreen('#screen-start');

  $('#create-form').onsubmit = (e) => {
    e.preventDefault();
    const first = $('#create-form input[name=firstName]').value.trim();
    const last = $('#create-form input[name=lastName]').value.trim();
    if (!first || !last) { toast('Preencha nome e sobrenome.'); return; }
    G = newGame({
      firstName: first, lastName: last,
      age: createState.age, nationality: createState.nationality, country: createState.country,
      foot: createState.foot, position: createState.position, height: createState.height,
      shirt: createState.shirt, style: createState.style,
    });
    showRollScreen();
  };
}

// ---------------- Roleta da academia ----------------

function showRollScreen() {
  showScreen('#screen-roll');
  $('#roll-country').textContent = `${flag(G.country)} ${G.country}`;
  $('#roll-result').hidden = true;
  $('#btn-roll').hidden = !!G.lastRoll;
  $('#btn-reroll').hidden = true;
  $('#btn-accept-roll').hidden = true;
  $('#roulette-display').textContent = '?';
  if (G.lastRoll) revealRoll(G.lastRoll);
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
  box.classList.remove('landed');
  box.classList.add('spinning');

  let ticks = 0;
  const total = 30;
  const spin = () => {
    ticks++;
    display.textContent = clubNames[Math.floor(Math.random() * clubNames.length)];
    if (ticks < total) {
      setTimeout(spin, 38 + ticks * 8); // desacelera aos poucos
    } else {
      box.classList.remove('spinning');
      box.classList.add('landed');
      revealRoll(roll);
    }
  };
  spin();
}

function revealRoll(roll) {
  const display = $('#roulette-display');
  display.textContent = `⭐ ${roll.clubName} ⭐`;
  $('#roulette').classList.add('landed');
  $('#roll-result').hidden = false;
  $('#roll-club').textContent = roll.clubName;
  $('#roll-text').textContent = `Você foi selecionado para a categoria de base do ${roll.clubName}!`;
  $('#roll-cat').textContent = roll.category;
  $('#roll-academy').textContent = '★'.repeat(Math.round(roll.academyLevel / 2)) || '★';
  $('#roll-ovr').textContent = roll.profile.overall;
  $('#roll-pot').textContent = `${roll.profile.potential - 2}–${Math.min(99, roll.profile.potential + 2)}`;
  const reroll = $('#btn-reroll');
  if (G.rerollsLeft > 0) {
    reroll.hidden = false;
    reroll.textContent = `🔄 Roletar novamente (${G.rerollsLeft})`;
  } else {
    reroll.hidden = true;
  }
  $('#btn-accept-roll').hidden = false;
}

// ---------------- Hub da carreira ----------------

const TABS = [
  ['overview', '👤 Jogador'],
  ['stats', '📊 Estatísticas'],
  ['tables', '🏆 Ligas'],
  ['calendar', '📅 Calendário'],
  ['transfers', '💸 Transferências'],
  ['training', '🏋️ Treino'],
  ['nation', '🌍 Seleção'],
  ['history', '📜 História'],
  ['news', '📰 Notícias'],
];

function showCareer() {
  showScreen('#screen-career');
  renderTabs();
  renderHeader();
  renderTab();
  $('#btn-advance').onclick = () => doAdvance(1);
  $('#btn-advance4').onclick = () => doAdvance(4);
  $('#btn-save').onclick = () => { saveToStorage(G); toast('💾 Carreira salva!'); };
  $('#btn-export').onclick = exportSave;
}

function renderTabs() {
  const nav = $('#career-tabs');
  nav.innerHTML = '';
  for (const [id, label] of TABS) {
    const b = document.createElement('button');
    b.innerHTML = label;
    if (id === activeTab) b.classList.add('active');
    b.onclick = () => { activeTab = id; renderTabs(); renderTab(); };
    nav.appendChild(b);
  }
}

function fmtMoney(m) {
  if (m >= 1) return `€${(+m.toFixed(1)).toString()}M`;
  return `€${Math.round(m * 1000)} mil`;
}

function clubDotColor(club) {
  const r = club.rep;
  return r >= 9 ? 'var(--purple)' : r >= 7 ? 'var(--gold)' : r >= 5 ? 'var(--accent2)' : 'var(--faint)';
}

function renderHeader() {
  const p = G.player;
  const club = playerClub(G);
  const rating = avgRating(p.seasonStats);
  const roleLabel = p.youth ? p.category : { starter: 'Titular', rotation: 'Rodízio', bench: 'Reserva' }[p.squadRole] || '';
  const roleBadge = p.youth ? '' : { starter: 'green', rotation: 'blue', bench: '' }[p.squadRole] || '';
  const prog = Math.round((G.week - 1) / 40 * 100);
  $('#career-header').innerHTML = `
    ${ovrRing(p.overall)}
    <div class="who">
      <div class="name">${fullName(p)} <span class="shirt">#${p.shirt}</span></div>
      <div class="meta">${POS_GROUP_ICON[p.position] || ''} ${POSITION_NAMES[p.position]} · ${p.age} anos · ${flag(p.nationality)} ${p.nationality}</div>
      <div>
        <span class="badge ${p.youth ? 'blue' : roleBadge}">${p.youth ? '🎓 ' + p.category : roleLabel}</span>
        ${club ? `<span class="badge">${club.name}</span>` : ''}
        <span class="badge">POT ~${p.potential}</span>
        <span class="badge">💰 ${fmtMoney(p.value)}</span>
        ${p.injury ? `<span class="badge red">🤕 ${p.injury.weeks} sem</span>` : ''}
        ${rating > 0 ? `<span class="badge gold">⭐ ${rating.toFixed(2)}</span>` : ''}
      </div>
    </div>
    <div class="season-box">
      <div class="yr">Temporada ${G.seasonYear}</div>
      <div>Semana ${G.week} de 40</div>
      <div style="height:5px;width:130px;background:var(--bg2);border-radius:3px;overflow:hidden;margin-top:7px;margin-left:auto">
        <i style="display:block;height:100%;width:${prog}%;background:linear-gradient(90deg,var(--accent-d),var(--accent))"></i>
      </div>
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

function meter(value, color = 'var(--accent)') {
  const v = Math.round(value);
  return `<span style="display:inline-block;vertical-align:middle;width:70px;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden;margin-left:6px">
    <i style="display:block;height:100%;width:${v}%;background:${color}"></i></span>`;
}

// ---- Aba: visão geral ----

function renderOverview(el) {
  const p = G.player;
  const club = playerClub(G);
  const league = playerLeague(G);
  const fx = nextFixture(G);
  const s = p.seasonStats;
  const rating = avgRating(s);
  const moraleColor = p.morale >= 66 ? 'var(--accent)' : p.morale >= 40 ? 'var(--gold)' : 'var(--red)';
  const formColor = p.form >= 66 ? 'var(--accent)' : p.form >= 45 ? 'var(--gold)' : 'var(--red)';
  const moraleTxt = p.morale >= 75 ? '😄 Alta' : p.morale >= 50 ? '🙂 Estável' : p.morale >= 30 ? '😐 Baixa' : '😞 Péssima';
  const formTxt = p.form >= 75 ? '🔥 Ótima' : p.form >= 55 ? '📈 Boa' : p.form >= 40 ? '➖ Regular' : '📉 Ruim';

  el.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Situação <span class="section-tag">clube</span></h3>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span class="club-dot" style="width:14px;height:14px;background:${club ? clubDotColor(club) : 'var(--faint)'}"></span>
          <div>
            <div style="font-weight:900;font-size:1.15rem">${club ? club.name : 'Sem clube'} ${p.youth ? `<span class="faint">(${p.category})</span>` : ''}</div>
            <div class="muted" style="font-size:.85rem">${league ? league.name : ''} ${club ? '· ' + club.stadium : ''}</div>
          </div>
        </div>
        <div class="kv"><span class="k">Moral</span><span class="v">${moraleTxt}${meter(p.morale, moraleColor)}</span></div>
        <div class="kv"><span class="k">Forma</span><span class="v">${formTxt}${meter(p.form, formColor)}</span></div>
        <div class="kv"><span class="k">Salário</span><span class="v">${fmtMoney(p.contract.wage / 1000)}/sem</span></div>
        <div class="kv"><span class="k">Contrato</span><span class="v">${p.youth ? 'Formação' : p.contract.years + ' ano(s)'}</span></div>
        ${p.parentClubId !== null ? `<div class="kv"><span class="k">Empréstimo</span><span class="v">de ${G.clubs[p.parentClubId].name}</span></div>` : ''}
      </div>
      <div class="card">
        <h3>Próximo jogo <span class="section-tag">agenda</span></h3>
        <div style="text-align:center;padding:8px 0 14px">
          <div style="font-size:1.4rem;font-weight:900">${fx ? fx.desc : '—'}</div>
          <div class="muted" style="font-size:.85rem;margin-top:2px">${fx ? fx.comp : ''}</div>
        </div>
        <h4 class="faint" style="text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Temporada ${G.seasonYear}</h4>
        <div class="tiles">
          <div class="tile"><div class="t-val">${s.apps}</div><div class="t-label">Jogos</div></div>
          <div class="tile green"><div class="t-val">${s.goals}</div><div class="t-label">Gols</div></div>
          <div class="tile"><div class="t-val">${s.assists}</div><div class="t-label">Assist.</div></div>
          <div class="tile gold"><div class="t-val">${rating > 0 ? rating.toFixed(1) : '—'}</div><div class="t-label">Nota</div></div>
          ${p.position === 'GK' ? `<div class="tile"><div class="t-val">${s.cleanSheets}</div><div class="t-label">Sem sofrer</div></div>` : ''}
        </div>
      </div>
    </div>
    <div class="card">
      <h3>Atributos <span class="section-tag">OVR ${p.overall} · POT ~${p.potential}</span></h3>
      <div class="grid2">${attrColumns(p)}</div>
    </div>
    ${retireCard()}`;

  const rbtn = $('#btn-retire');
  if (rbtn) {
    rbtn.onclick = () => {
      if (confirm('Anunciar aposentadoria ao fim desta temporada?')) {
        retirePlayer(G);
        saveToStorage(G);
        toast('📣 Você se aposentará ao fim da temporada.');
        renderTab();
      }
    };
  }
}

function retireCard() {
  const p = G.player;
  if (G.wantRetire) return '<div class="card"><p>📣 Você anunciou que se aposenta ao fim da temporada.</p></div>';
  if (p.age < 32) return '';
  return `<div class="card"><h3>Fim de carreira?</h3>
    <p class="muted" style="margin-bottom:10px">Você já passou dos 32. Pode pendurar as chuteiras ao fim da temporada.</p>
    <button id="btn-retire" class="btn">🪑 Anunciar aposentadoria</button></div>`;
}

function attrColumns(p) {
  const isGk = p.position === 'GK';
  const groups = isGk ? ['goalkeeping', 'physical', 'passing'] : ['attack', 'passing', 'dribbling', 'defense', 'physical'];
  const titles = { attack: '⚔️ Ataque', passing: '🎯 Passe', dribbling: '✨ Drible', defense: '🛡️ Defesa', physical: '💪 Físico', goalkeeping: '🧤 Goleiro' };
  return groups.map((g) => {
    const keys = ATTR_GROUPS[g];
    const avg = Math.round(keys.reduce((a, k) => a + p.attrs[k], 0) / keys.length);
    return `
    <div class="attr-block">
      <h4>${titles[g]} <span class="g-avg v-${attrTier(avg)}">${avg}</span></h4>
      ${keys.map((k) => {
        const v = p.attrs[k];
        const t = attrTier(v);
        return `<div class="attr-row">
          <span class="attr-name">${ATTR_NAMES[k]}</span>
          <span class="attr-val v-${t}">${v}</span>
          <span class="bar"><i class="bar-${t}" style="width:${v}%"></i></span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// ---- Aba: estatísticas ----

function renderStats(el) {
  const p = G.player;
  const s = p.seasonStats;
  const rating = avgRating(s);
  const totals = careerTotals(G);
  el.innerHTML = `
    <div class="card">
      <h3>Temporada ${G.seasonYear} <span class="section-tag">${playerClub(G) ? playerClub(G).name : ''}</span></h3>
      <div class="tiles">
        <div class="tile"><div class="t-val">${s.apps}</div><div class="t-label">Jogos</div></div>
        <div class="tile"><div class="t-val">${s.starts}</div><div class="t-label">Titular</div></div>
        <div class="tile"><div class="t-val">${s.minutes}</div><div class="t-label">Minutos</div></div>
        <div class="tile green"><div class="t-val">${s.goals}</div><div class="t-label">Gols</div></div>
        <div class="tile"><div class="t-val">${s.assists}</div><div class="t-label">Assist.</div></div>
        <div class="tile gold"><div class="t-val">${rating > 0 ? rating.toFixed(2) : '—'}</div><div class="t-label">Nota média</div></div>
        <div class="tile gold"><div class="t-val">${s.motm}</div><div class="t-label">Craque do jogo</div></div>
        ${p.position === 'GK' ? `<div class="tile"><div class="t-val">${s.cleanSheets}</div><div class="t-label">Sem sofrer gol</div></div>` : ''}
        <div class="tile"><div class="t-val">${s.yellow}/${s.red}</div><div class="t-label">🟨/🟥</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Carreira <span class="section-tag">totais</span></h3>
      <div class="tiles">
        <div class="tile"><div class="t-val">${totals.seasons + 1}</div><div class="t-label">Temporadas</div></div>
        <div class="tile"><div class="t-val">${totals.apps}</div><div class="t-label">Jogos</div></div>
        <div class="tile green"><div class="t-val">${totals.goals}</div><div class="t-label">Gols</div></div>
        <div class="tile"><div class="t-val">${totals.assists}</div><div class="t-label">Assist.</div></div>
        <div class="tile gold"><div class="t-val">${p.titles.length}</div><div class="t-label">Títulos</div></div>
        <div class="tile gold"><div class="t-val">${p.awards.length}</div><div class="t-label">Prêmios</div></div>
        <div class="tile"><div class="t-val">${p.natTeam.caps}</div><div class="t-label">Seleção (J)</div></div>
        <div class="tile"><div class="t-val">${Math.round(p.reputation)}</div><div class="t-label">Reputação</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Temporada a temporada</h3>
      <div class="table-scroll">${seasonHistoryTable()}</div>
    </div>`;
}

function seasonHistoryTable() {
  const rows = G.player.seasonHistory;
  if (rows.length === 0) return emptyState('⏳', 'Sua primeira temporada ainda está em andamento.');
  return `<table>
    <thead><tr><th>Ano</th><th>Clube</th><th>Divisão</th><th class="num">J</th><th class="num">G</th><th class="num">A</th><th class="num">Nota</th><th class="num">OVR</th></tr></thead>
    <tbody>${rows.slice().reverse().map((s) => `<tr>
      <td>${s.year}<div class="faint" style="font-size:.72rem">${s.age} anos</div></td>
      <td>${s.club}</td><td class="muted">${s.division}</td>
      <td class="num">${s.apps}</td><td class="num">${s.goals}</td><td class="num">${s.assists}</td>
      <td class="num">${s.avgRating || '—'}</td><td class="num"><strong>${s.ovr}</strong></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ---- Aba: ligas e copas ----

let selectedLeagueId = null;

function renderTables(el) {
  const myLeague = playerLeague(G);
  if (!selectedLeagueId) selectedLeagueId = myLeague ? myLeague.id : G.leagues[0].id;
  const league = G.leagues.find((l) => l.id === selectedLeagueId) || G.leagues[0];
  const standings = tableStandings(league);
  const cup = G.cups[league.id];
  const n = standings.length;

  el.innerHTML = `
    <select id="league-select" class="inline">
      ${G.leagues.map((l) => `<option value="${l.id}"${l.id === selectedLeagueId ? ' selected' : ''}>${l.name} — ${l.country}</option>`).join('')}
    </select>
    <div class="card">
      <h3>${league.name} <span class="section-tag">${G.seasonYear}</span></h3>
      <div class="table-scroll">
        <table>
          <thead><tr><th></th><th>Clube</th><th class="num">P</th><th class="num">J</th><th class="num">V</th><th class="num">E</th><th class="num">D</th><th class="num">SG</th></tr></thead>
          <tbody>${standings.map((id, i) => {
            const c = G.clubs[id];
            const t = league.table[id];
            const mine = G.player.clubId === id;
            let posCls = '';
            if (i < 4) posCls = 'ucl'; else if (i < 6) posCls = 'uel'; else if (i >= n - 3) posCls = 'rel';
            return `<tr class="${mine ? 'highlight' : ''}">
              <td><span class="pos-badge ${posCls}">${i + 1}</span></td>
              <td><div class="club-cell"><span class="club-dot" style="background:${clubDotColor(c)}"></span>${c.name}${mine ? ' 👈' : ''}</div></td>
              <td class="num"><strong>${t.pts}</strong></td><td class="num">${t.p}</td>
              <td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td>
              <td class="num">${t.gf - t.ga > 0 ? '+' : ''}${t.gf - t.ga}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="faint" style="font-size:.74rem;margin-top:8px">
        <span class="pos-badge ucl" style="width:14px;height:14px">·</span> Continental principal ·
        <span class="pos-badge uel" style="width:14px;height:14px">·</span> Continental secundária ·
        <span class="pos-badge rel" style="width:14px;height:14px">·</span> Rebaixamento
      </div>
    </div>
    <div class="grid2">
      <div class="card">
        <h3>${cup ? cup.name : 'Copa nacional'} <span class="section-tag">copa</span></h3>
        ${cupStatus(cup)}
      </div>
      <div class="card">
        <h3>Continentais <span class="section-tag">mundo</span></h3>
        ${G.continentals.map((c) => `<div class="kv"><span class="k">${c.name}</span><span class="v" style="font-size:.85rem">${contStatus(c)}</span></div>`).join('')}
        ${G.wccWinnerId !== null ? `<div class="kv"><span class="k">Mundial de Clubes</span><span class="v">🏆 ${G.clubs[G.wccWinnerId].name}</span></div>` : ''}
      </div>
    </div>`;
  $('#league-select').onchange = (e) => { selectedLeagueId = e.target.value; renderTab(); };
}

function cupStatus(cup) {
  if (!cup) return '<p class="muted">—</p>';
  if (cup.winnerId !== null) return `<p style="font-size:1.05rem">🏆 Campeão: <strong>${G.clubs[cup.winnerId].name}</strong></p>`;
  return `<p>Fase: <strong>${roundName(cup)}</strong></p>
    <p class="muted" style="font-size:.82rem;margin-top:6px">${cup.alive.map((id) => G.clubs[id].name).join(' · ')}</p>`;
}

function contStatus(c) {
  if (c.winnerId !== null) return `🏆 ${G.clubs[c.winnerId].name}`;
  const alive = c.alive.includes(G.player.clubId) ? ' 🔥' : '';
  return `${roundName(c)} (${c.alive.length})${alive}`;
}

// ---- Aba: calendário ----

function renderCalendar(el) {
  const log = (G.matchLog || []).filter((m) => m.year === G.seasonYear);
  const fx = nextFixture(G);
  el.innerHTML = `
    <div class="card">
      <h3>Próximo compromisso</h3>
      <div style="text-align:center;padding:6px 0">
        <div style="font-size:1.5rem;font-weight:900">${fx ? fx.desc : '—'}</div>
        <div class="muted">${fx ? fx.comp : ''}</div>
      </div>
      <p class="faint" style="font-size:.76rem;text-align:center;margin-top:8px">Copas: sem 6/14/22/30 · Continentais: 10/18/26/34 · Datas FIFA: 16/32</p>
    </div>
    <div class="card">
      <h3>Partidas da temporada <span class="section-tag">${log.length} jogos</span></h3>
      ${log.length === 0 ? emptyState('📅', 'Nenhuma partida disputada ainda.') : `
      <div class="table-scroll"><table>
        <thead><tr><th>Sem</th><th>Competição</th><th>Partida</th><th class="num">Placar</th><th class="num">Nota</th><th class="num">G+A</th></tr></thead>
        <tbody>${log.slice().reverse().map((m) => {
          const res = m.teamGoals > m.oppGoals ? 'var(--accent)' : m.teamGoals < m.oppGoals ? 'var(--red)' : 'var(--muted)';
          return `<tr>
            <td class="faint">${m.week}</td><td class="muted" style="font-size:.8rem">${m.comp}</td>
            <td style="font-size:.82rem">${m.homeName} <span class="faint">x</span> ${m.awayName}</td>
            <td class="num"><strong style="color:${res}">${m.gh}-${m.ga}</strong></td>
            <td class="num">${m.stats ? `<span class="v-${attrTier(m.stats.rating * 10)}">${m.stats.rating.toFixed(1)}</span>` : '<span class="faint">DNP</span>'}</td>
            <td class="num">${m.stats ? (m.stats.goals || 0) + '+' + (m.stats.assists || 0) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`}
    </div>`;
}

// ---- Aba: transferências ----

function renderTransfers(el) {
  const p = G.player;
  const offers = G.offers;
  el.innerHTML = `
    <div class="card">
      <h3>Meu passe <span class="section-tag">mercado</span></h3>
      <div class="tiles">
        <div class="tile green"><div class="t-val" style="font-size:1.2rem">${fmtMoney(p.value)}</div><div class="t-label">Valor</div></div>
        <div class="tile"><div class="t-val" style="font-size:1.2rem">${fmtMoney(p.contract.wage / 1000)}</div><div class="t-label">Salário/sem</div></div>
        <div class="tile"><div class="t-val">${Math.round(p.reputation)}</div><div class="t-label">Reputação</div></div>
      </div>
      <p class="faint" style="font-size:.78rem;margin-top:10px">Janelas: semanas 2–5 e 20–24. Bom desempenho atrai clubes maiores.</p>
    </div>
    <div class="card">
      <h3>Propostas recebidas <span class="section-tag">${offers.length}</span></h3>
      ${offers.length === 0 ? emptyState('📭', 'Nenhuma proposta no momento. Continue se destacando!') : ''}
      ${offers.map((o) => {
        const c = G.clubs[o.clubId];
        return `
        <div class="offer" data-id="${o.id}">
          <div class="offer-top">
            ${ovrRing(c.avgOvr, 'sm')}
            <div class="offer-club">${c.name}<div class="muted" style="font-size:.8rem;font-weight:600">${G.leagues.find((l) => l.id === c.leagueId).name}</div></div>
            <span class="badge ${o.type === 'loan' ? 'blue' : 'gold'}">${o.type === 'loan' ? 'Empréstimo' : 'Transferência'}</span>
          </div>
          <div class="offer-terms">
            ${o.type === 'loan' ? '<span class="term">1 temporada</span>' : `<span class="term">Taxa <strong>€${o.fee}M</strong></span><span class="term">Contrato <strong>${o.years} anos</strong></span>`}
            <span class="term">Salário <strong>${fmtMoney(o.wage / 1000)}</strong>/sem</span>
          </div>
          <div class="offer-buttons">
            <button class="btn primary small-btn" data-act="accept">✔ Aceitar</button>
            <button class="btn small-btn" data-act="negotiate" ${o.negotiated ? 'disabled' : ''}>💬 Negociar</button>
            <button class="btn small-btn" data-act="reject">✕ Recusar</button>
          </div>
        </div>`;
      }).join('')}
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
        toast(r.ok ? '💰 O clube melhorou a oferta!' : r.withdrawn ? '😬 O clube retirou a proposta.' : '🤝 Sem acordo.');
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
      <p class="muted" style="font-size:.86rem;margin-bottom:12px">O treino melhora gradualmente os atributos escolhidos. Minutos em campo, notas altas e boas estruturas aceleram a evolução — sempre limitada pelo potencial.</p>
      <div class="chips">
        ${opts.map((o) => `<button class="chip ${p.trainingFocus === o ? 'selected' : ''}" data-focus="${o}">${o}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Fatores de evolução</h3>
      <div class="kv"><span class="k">Idade</span><span class="v">${p.age} anos ${p.age <= 20 ? '🚀' : p.age >= 32 ? '📉' : ''}</span></div>
      <div class="kv"><span class="k">Potencial restante</span><span class="v v-${attrTier(Math.min(99, 60 + (p.potential - p.overall) * 2))}">${Math.max(0, p.potential - p.overall)} pts</span></div>
      <div class="kv"><span class="k">Estrutura do clube</span><span class="v">${playerClub(G) ? (p.youth ? playerClub(G).academy : playerClub(G).rep) + '/10' : '—'}</span></div>
      <div class="kv"><span class="k">Forma</span><span class="v">${Math.round(p.form)}/100</span></div>
      <div class="kv"><span class="k">Moral</span><span class="v">${Math.round(p.morale)}/100</span></div>
    </div>`;
  el.querySelectorAll('.chip[data-focus]').forEach((c) => {
    c.onclick = () => {
      setTrainingFocus(G, c.dataset.focus);
      saveToStorage(G);
      el.querySelectorAll('.chip[data-focus]').forEach((x) => x.classList.remove('selected'));
      c.classList.add('selected');
      toast(`🏋️ Foco: ${c.dataset.focus}`);
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
      <h3>${flag(p.nationality)} Seleção de ${p.nationality}</h3>
      <div style="padding:8px 0 12px;font-size:.95rem">${called
        ? '✅ Você está no radar do treinador da seleção!'
        : `Convocações exigem cerca de <strong>${thr} OVR</strong> e boa reputação. ${p.youth ? 'Chegue ao profissional primeiro!' : 'Continue evoluindo!'}`}</div>
      <div class="tiles">
        <div class="tile"><div class="t-val">${p.natTeam.caps}</div><div class="t-label">Jogos</div></div>
        <div class="tile green"><div class="t-val">${p.natTeam.goals}</div><div class="t-label">Gols</div></div>
        <div class="tile"><div class="t-val">${p.natTeam.called ? 'Sim' : 'Não'}</div><div class="t-label">Convocado</div></div>
      </div>
      <p class="faint" style="font-size:.78rem;margin-top:12px">Copa do Mundo a cada 4 anos (2026, 2030…). Torneios continentais em 2028, 2032… Amistosos nas datas FIFA (semanas 16 e 32).</p>
    </div>`;
}

// ---- Aba: história ----

function renderHistory(el) {
  const p = G.player;
  el.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>🏆 Títulos <span class="section-tag">${p.titles.length}</span></h3>
        ${p.titles.length === 0 ? emptyState('🏆', 'Nenhum título ainda. Vá buscar!')
          : `<div class="table-scroll"><table><tbody>${p.titles.slice().reverse().map((t) => `<tr><td class="faint">${t.year}</td><td><strong>${t.name}</strong></td><td class="muted">${t.club}</td></tr>`).join('')}</tbody></table></div>`}
      </div>
      <div class="card">
        <h3>🏅 Prêmios <span class="section-tag">${p.awards.length}</span></h3>
        ${p.awards.length === 0 ? emptyState('🏅', 'Nenhum prêmio ainda.')
          : `<div class="table-scroll"><table><tbody>${p.awards.slice().reverse().map((a) => `<tr><td class="faint">${a.year}</td><td>${a.name === 'Bola de Ouro' ? '🥇 ' : ''}<strong>${a.name}</strong></td></tr>`).join('')}</tbody></table></div>`}
      </div>
    </div>
    <div class="card">
      <h3>Linha do tempo</h3>
      <div class="table-scroll">${seasonHistoryTable()}</div>
    </div>`;
}

// ---- Aba: notícias ----

const NEWS_ICON = (t) => {
  if (/campeão|conquista|título|vence/i.test(t)) return '🏆';
  if (/gol|marca/i.test(t)) return '⚽';
  if (/interesse|contrata|proposta|assina|empréstimo/i.test(t)) return '💸';
  if (/convocad|seleção/i.test(t)) return '🌍';
  if (/lesion|lesão/i.test(t)) return '🤕';
  if (/promovid|promoção/i.test(t)) return '⬆️';
  if (/treinador/i.test(t)) return '📋';
  if (/aposenta/i.test(t)) return '👋';
  if (/Bola de Ouro/i.test(t)) return '🥇';
  return '📰';
};

function renderNews(el) {
  el.innerHTML = `
    <div class="card">
      <h3>📰 Notícias do mundo do futebol</h3>
      ${G.news.length === 0 ? emptyState('📰', 'Sem notícias.') : G.news.map((n) => `
        <div class="news-item">
          <span class="news-ico">${NEWS_ICON(n.text)}</span>
          <div class="news-txt">${n.text}<div class="when">${n.year} · semana ${n.week}</div></div>
        </div>`).join('')}
    </div>`;
}

function emptyState(emoji, text) {
  return `<div class="empty"><span class="big-emoji">${emoji}</span>${text}</div>`;
}

// ---------------- Avançar semana + eventos ----------------

function doAdvance(weeks) {
  const btn = $('#btn-advance');
  const btn4 = $('#btn-advance4');
  btn.disabled = true; btn4.disabled = true;
  const allEvents = [];
  for (let i = 0; i < weeks && G.phase === 'career'; i++) {
    const events = advanceWeek(G);
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
  btn.disabled = false; btn4.disabled = false;
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
    const tag = m.won ? '<span class="result-tag win">VITÓRIA</span>' : m.lost ? '<span class="result-tag loss">DERROTA</span>' : '<span class="result-tag draw">EMPATE</span>';
    box.innerHTML = `
      <div class="match-comp">${m.comp}</div>
      <div class="scoreline">
        <span class="team home">${m.homeName}</span>
        <span class="score">${m.gh} <span class="faint">-</span> ${m.ga}</span>
        <span class="team away">${m.awayName}</span>
      </div>
      <div>${tag}</div>
      <div class="faint" style="font-size:.8rem;margin-top:6px">${m.stadium}</div>
      ${m.stats ? `
        <div class="pstats">
          <div class="stat-chip">Minutos<strong>${m.stats.minutes}'</strong></div>
          <div class="stat-chip">Nota<strong class="v-${attrTier(m.stats.rating * 10)}">${m.stats.rating.toFixed(1)}${m.stats.motm ? ' ⭐' : ''}</strong></div>
          ${G.player.position === 'GK'
            ? `<div class="stat-chip">Defesas<strong>${m.stats.saves}</strong></div>
               <div class="stat-chip">Sem sofrer<strong>${m.stats.cleanSheet ? '✔' : '✕'}</strong></div>`
            : `<div class="stat-chip">Gols<strong>${m.stats.goals}</strong></div>
               <div class="stat-chip">Assist.<strong>${m.stats.assists}</strong></div>
               <div class="stat-chip">Finaliz.<strong>${m.stats.shots}</strong></div>
               <div class="stat-chip">Passes<strong>${m.stats.passes} · ${m.stats.passAcc}%</strong></div>
               <div class="stat-chip">Desarmes<strong>${m.stats.tackles}</strong></div>`}
          ${m.stats.yellow ? '<div class="stat-chip">Cartão<strong>🟨</strong></div>' : ''}${m.stats.red ? '<div class="stat-chip">Cartão<strong>🟥</strong></div>' : ''}
        </div>` : '<div class="event-line" style="margin-top:12px">Você não entrou em campo nesta partida.</div>'}`;
    $('#modal-close').textContent = 'Continuar ▶';
  } else {
    const gold = e.type === 'title' || e.type === 'award';
    const emoji = { promotion: '⬆️', offers: '💸', callup: '🌍', title: '🏆', award: '🏅', released: '📄', newSeason: '📆', retired: '👋', recovered: '💪', growth: '📈' }[e.type] || '📢';
    box.innerHTML = `<div class="event-line ${gold ? 'gold-ev' : 'big'}"><span class="event-emoji">${emoji}</span>${e.text}</div>`;
    $('#modal-close').textContent = 'Ok';
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
  const peak = Math.max(...p.seasonHistory.map((s) => s.ovr), p.overall);
  const ballon = p.awards.filter((a) => a.name === 'Bola de Ouro').length;
  $('#retired-summary').innerHTML = `
    <div class="hero" style="padding-top:6vh">
      <span class="logo-badge">👑</span>
      <h1>Fim de carreira</h1>
      <p class="subtitle">${fullName(p)} — ${POSITION_NAMES[p.position]} · aposentado aos ${p.age} anos</p>
    </div>
    <div class="card">
      <h3>Números da lenda</h3>
      <div class="tiles">
        <div class="tile"><div class="t-val">${p.seasonHistory.length}</div><div class="t-label">Temporadas</div></div>
        <div class="tile"><div class="t-val">${totals.apps}</div><div class="t-label">Jogos</div></div>
        <div class="tile green"><div class="t-val">${totals.goals}</div><div class="t-label">Gols</div></div>
        <div class="tile"><div class="t-val">${totals.assists}</div><div class="t-label">Assist.</div></div>
        <div class="tile gold"><div class="t-val">${p.titles.length}</div><div class="t-label">Títulos</div></div>
        <div class="tile gold"><div class="t-val">${p.awards.length}</div><div class="t-label">Prêmios</div></div>
        <div class="tile"><div class="t-val">${p.natTeam.caps}</div><div class="t-label">Seleção (J)</div></div>
        <div class="tile"><div class="t-val" style="color:${peak >= 85 ? 'var(--purple)' : 'var(--gold)'}">${peak}</div><div class="t-label">Pico OVR</div></div>
      </div>
      ${ballon ? `<p style="text-align:center;margin-top:14px;font-size:1.1rem">🥇 Vencedor da <strong>Bola de Ouro</strong>${ballon > 1 ? ` (${ballon}×)` : ''}!</p>` : ''}
    </div>
    <div class="card">
      <h3>🏆 Galeria de títulos</h3>
      ${p.titles.length === 0 ? emptyState('🏆', 'Sem títulos na carreira.')
        : p.titles.slice().reverse().map((t) => `<div class="news-item"><span class="news-ico">🏆</span><div class="news-txt"><strong>${t.name}</strong> <span class="faint">— ${t.club}</span><div class="when">${t.year}</div></div></div>`).join('')}
    </div>`;
  $('#btn-retired-new').onclick = () => { clearStorage(); location.reload(); };
}

// ---------------- Utilidades ----------------

let toastTimer = null;
function toast(text) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = text;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
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
