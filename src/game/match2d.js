// Partida jogável em 2D (arcade, estilo FIFA Mobile).
// playMatch2D(container, config) monta canvas + HUD + controles dentro do
// container e devolve uma Promise com o resultado:
//   { teamGoals, oppGoals, playerGoals, playerAssists, playerShots }
//
// Sem dependências externas; todo o estado vive em variáveis locais.

const M2D_FW = 68;   // largura do campo (unidades)
const M2D_FH = 105;  // comprimento do campo
const M2D_GOAL_W = 14; // largura do gol
const M2D_MATCH_SECONDS = 150; // duração real (mapeia para 90')
const M2D_PLAYER_R = 1.5;
const M2D_BALL_R = 0.7;

function m2dClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// formação base (frações do campo) — 5 de linha + goleiro. Own ataca para cima.
const M2D_OWN_FORM = [
  { x: 0.50, y: 0.94, gk: true, role: 'GK' },
  { x: 0.28, y: 0.72, role: 'DEF' },
  { x: 0.72, y: 0.72, role: 'DEF' },
  { x: 0.50, y: 0.56, role: 'MID' },
  { x: 0.34, y: 0.38, role: 'FWD' },
  { x: 0.66, y: 0.38, role: 'FWD' },
];

// papel do "astro" (jogador do usuário) conforme a posição de carreira
function m2dStarSlot(position) {
  if (position === 'GK') return 0;
  if (['CB', 'RB', 'LB'].includes(position)) return 1;
  if (['CDM', 'CM'].includes(position)) return 3;
  return 4; // atacantes e meias ofensivos
}

function m2dHue(hsl) {
  const m = /hsl\((\d+)/.exec(hsl || '');
  return m ? parseInt(m[1], 10) : 0;
}

export function playMatch2D(container, config) {
  return new Promise((resolve) => {
    // garante contraste entre os kits (o hash pode gerar tons próximos)
    const oh = m2dHue(config.own.color), ph = m2dHue(config.opp.color);
    let diff = Math.abs(oh - ph); diff = Math.min(diff, 360 - diff);
    if (diff < 45) config.opp = { ...config.opp, color: `hsl(${(oh + 165) % 360}, 68%, 55%)` };

    // ---------- DOM ----------
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'm2d-wrap';
    wrap.innerHTML = `
      <div class="m2d-hud">
        <div class="m2d-score">
          <span class="m2d-team" style="color:${config.own.color}">${abbr(config.own.name)}</span>
          <span class="m2d-goals" id="m2d-goals">0 - 0</span>
          <span class="m2d-team" style="color:${config.opp.color}">${abbr(config.opp.name)}</span>
        </div>
        <div class="m2d-clock" id="m2d-clock">0'</div>
        <div class="m2d-comp">${config.comp}</div>
      </div>
      <canvas id="m2d-canvas"></canvas>
      <div class="m2d-flash" id="m2d-flash"></div>
      <div class="m2d-controls">
        <div class="m2d-joy" id="m2d-joy"><div class="m2d-knob" id="m2d-knob"></div></div>
        <div class="m2d-buttons">
          <button class="m2d-btn m2d-sprint" id="m2d-sprint">⚡</button>
          <button class="m2d-btn m2d-pass" id="m2d-pass">A</button>
          <button class="m2d-btn m2d-shoot" id="m2d-shoot">B</button>
          <button class="m2d-btn m2d-switch" id="m2d-switch">⇄</button>
        </div>
      </div>
      <button class="m2d-quit" id="m2d-quit">Sair</button>`;
    container.appendChild(wrap);

    const canvas = wrap.querySelector('#m2d-canvas');
    const ctx = canvas.getContext('2d');
    const goalsEl = wrap.querySelector('#m2d-goals');
    const clockEl = wrap.querySelector('#m2d-clock');
    const flashEl = wrap.querySelector('#m2d-flash');
    const passBtn = wrap.querySelector('#m2d-pass');
    const shootBtn = wrap.querySelector('#m2d-shoot');

    let cw = 0, ch = 0, scale = 1, offX = 0, offY = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      cw = rect.width; ch = rect.height;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      const pad = 8;
      scale = Math.min((cw - pad * 2) / M2D_FW, (ch - pad * 2) / M2D_FH);
      offX = (cw - M2D_FW * scale) / 2;
      offY = (ch - M2D_FH * scale) / 2;
    }
    const sx = (x) => offX + x * scale;
    const sy = (y) => offY + y * scale;

    // ---------- Estado ----------
    const P = config.player;
    const starIdx = m2dStarSlot(P.position);
    const teamSkill = m2dClamp(config.teamStr, 40, 99);
    const oppSkill = m2dClamp(config.opp.str, 40, 99);

    function mkPlayers(form, team, skill, mirror, color) {
      return form.map((f, i) => {
        const isStar = team === 'own' && i === starIdx;
        const fx = f.x * M2D_FW;
        const fy = (mirror ? 1 - f.y : f.y) * M2D_FH;
        // atributos efetivos (0-100) do jogador
        let atk = skill, pace = skill, drib = skill, pass = skill, tackle = skill, fin = skill;
        if (isStar) {
          const a = P.attrs;
          pace = (a.pace + a.acceleration) / 2;
          drib = (a.dribbling + a.ballControl) / 2;
          pass = (a.shortPass + a.vision) / 2;
          tackle = (a.tackling + a.interceptions) / 2;
          fin = (a.finishing + a.positioning) / 2;
          atk = fin;
        }
        return {
          id: `${team}${i}`, team, i, role: f.role, gk: !!f.gk, isStar,
          x: fx, y: fy, vx: 0, vy: 0, hx: fx, hy: fy, // home position
          color, num: isStar ? P.shirt : (f.gk ? 1 : i + 1),
          atk, pace, drib, pass, tackle, fin,
        };
      });
    }
    const own = mkPlayers(M2D_OWN_FORM, 'own', teamSkill, false, config.own.color);
    const opp = mkPlayers(M2D_OWN_FORM, 'opp', oppSkill, true, config.opp.color);
    const players = own.concat(opp);
    const ball = { x: M2D_FW / 2, y: M2D_FH / 2, vx: 0, vy: 0, owner: null, kickCd: 0, lastOwnerTeam: null };

    let userId = own[starIdx].id;
    let scoreOwn = 0, scoreOpp = 0;
    let playerGoals = 0, playerAssists = 0, playerShots = 0;
    let clock = 0; // minutos 0..90
    let real = 0;  // segundos reais
    let running = true, finished = false;
    let flashUntil = 0, kickoffFreeze = 0, halftimeShown = false;
    let assistPending = null; // { receiver, until } pass do humano

    // ---------- Input ----------
    const input = { mvx: 0, mvy: 0, sprint: false };
    const keys = {};
    let joyId = null, joyCx = 0, joyCy = 0;
    const joy = wrap.querySelector('#m2d-joy');
    const knob = wrap.querySelector('#m2d-knob');
    const JOY_R = 46;

    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId;
      const r = joy.getBoundingClientRect();
      joyCx = r.left + r.width / 2; joyCy = r.top + r.height / 2;
      moveJoy(e.clientX, e.clientY);
      e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e.clientX, e.clientY); });
    window.addEventListener('pointerup', (e) => { if (e.pointerId === joyId) { joyId = null; input.mvx = 0; input.mvy = 0; knob.style.transform = 'translate(0,0)'; } });
    function moveJoy(cx, cy) {
      let dx = cx - joyCx, dy = cy - joyCy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, JOY_R);
      const kx = dx / d * cl, ky = dy / d * cl;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      input.mvx = dx / d * Math.min(1, d / JOY_R);
      input.mvy = dy / d * Math.min(1, d / JOY_R);
    }

    const btn = (id, on, off) => {
      const el = wrap.querySelector('#' + id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
      if (off) el.addEventListener('pointerup', (e) => { e.preventDefault(); off(); });
    };
    btn('m2d-shoot', () => doShoot());
    btn('m2d-pass', () => doPass());
    btn('m2d-sprint', () => { input.sprint = true; }, () => { input.sprint = false; });
    btn('m2d-switch', () => switchPlayer());
    wrap.querySelector('#m2d-quit').addEventListener('click', () => finish());

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    function onKey(e) {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') { doShoot(); e.preventDefault(); }
      if (e.key.toLowerCase() === 'j') doPass();
      if (e.key.toLowerCase() === 'e') switchPlayer();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    function keyVec() {
      let x = 0, y = 0;
      if (keys['a'] || keys['arrowleft']) x -= 1;
      if (keys['d'] || keys['arrowright']) x += 1;
      if (keys['w'] || keys['arrowup']) y -= 1;
      if (keys['s'] || keys['arrowdown']) y += 1;
      const d = Math.hypot(x, y);
      return d ? { x: x / d, y: y / d, sprint: keys['shift'] } : null;
    }

    function userPlayer() { return players.find((p) => p.id === userId); }
    function ownOutfield() { return own.filter((p) => !p.gk); }

    function switchPlayer() {
      const list = ownOutfield();
      const cur = list.findIndex((p) => p.id === userId);
      // troca para o companheiro mais próximo da bola
      const sorted = list.slice().sort((a, b) => dist2(a, ball) - dist2(b, ball));
      const next = sorted.find((p) => p.id !== userId) || list[(cur + 1) % list.length];
      userId = next.id;
    }

    // ---------- Física / ações ----------
    function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
    function dist(a, b) { return Math.sqrt(dist2(a, b)); }

    function doShoot() {
      const u = userPlayer();
      if (ball.owner !== u.id || u.gk) return;
      const goalY = 0; // gol adversário no topo
      const tx = M2D_FW / 2 + (Math.random() - 0.5) * (M2D_GOAL_W - 3);
      let dx = tx - u.x, dy = goalY - u.y;
      const d = Math.hypot(dx, dy) || 1;
      // mira imperfeita conforme finalização e distância
      const acc = m2dClamp(u.fin / 100, 0.3, 1.2);
      const spread = (1 - acc) * 0.22 + Math.min(0.16, d / M2D_FH * 0.2);
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread;
      const power = 52 + u.fin / 100 * 22;
      ball.vx = Math.cos(ang) * power;
      ball.vy = Math.sin(ang) * power;
      ball.owner = null; ball.kickCd = 0.25; ball.lastOwnerTeam = 'own';
      playerShots++;
      lastShot = { by: u.id, human: true, team: 'own' };
      assistPending = null;
    }

    function doPass(auto) {
      const u = auto || userPlayer();
      if (ball.owner !== u.id) return;
      // melhor companheiro à frente
      const mates = (u.team === 'own' ? own : opp).filter((m) => m.id !== u.id && !m.gk);
      const fwd = u.team === 'own' ? -1 : 1; // own ataca para cima
      let best = null, bestScore = -Infinity;
      for (const m of mates) {
        const ahead = (m.y - u.y) * fwd; // positivo = mais à frente
        const d = dist(u, m);
        const score = ahead * 1.5 - d * 0.5 - nearestOppDist(m) * -0.3;
        if (score > bestScore) { bestScore = score; best = m; }
      }
      if (!best) return;
      let dx = best.x - u.x, dy = best.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const power = m2dClamp(d * 1.7, 22, 46);
      ball.vx = dx / d * power; ball.vy = dy / d * power;
      ball.owner = null; ball.kickCd = 0.18; ball.lastOwnerTeam = u.team;
      if (u.team === 'own' && u.id === userId) assistPending = { receiver: best.id, until: real + 4 };
      else assistPending = null;
      lastShot = null;
    }

    let lastShot = null;

    function tryPossession() {
      if (ball.owner || ball.kickCd > 0) return;
      let closest = null, cd = Infinity;
      for (const p of players) {
        const d = dist2(p, ball);
        if (d < cd) { cd = d; closest = p; }
      }
      const ctrl = (M2D_PLAYER_R + M2D_BALL_R + 0.8);
      if (closest && cd < ctrl * ctrl) {
        ball.owner = closest.id;
        ball.lastOwnerTeam = closest.team;
        ball.vx = 0; ball.vy = 0;
        // assistência: companheiro do humano recebeu o passe
        if (assistPending && !assistPending.received) {
          if (closest.id === assistPending.receiver && real < assistPending.until) assistPending.received = true;
          else if (closest.team === 'opp') assistPending = null;
        }
      }
    }

    // Defesa do goleiro: bola solta indo para o próprio gol e perto do arqueiro
    function gkSave() {
      if (ball.owner) return;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed < 7) return;
      for (const team of ['own', 'opp']) {
        const gk = (team === 'own' ? own : opp).find((p) => p.gk);
        const goalY = team === 'own' ? M2D_FH : 0;
        const toward = team === 'own' ? ball.vy > 0 : ball.vy < 0;
        if (!toward || Math.abs(ball.y - goalY) > 20) continue;
        const reach = 2.8 + gk.tackle / 100 * 2.4;
        if (dist(gk, ball) < reach) {
          if (Math.random() < 0.4 + gk.tackle / 320) {
            ball.owner = gk.id; ball.vx = 0; ball.vy = 0; ball.lastOwnerTeam = team; ball.kickCd = 0.25;
          } else {
            ball.vy = -ball.vy * 0.55; ball.vx = (Math.random() - 0.5) * 28; ball.kickCd = 0.15;
          }
          lastShot = null;
        }
      }
    }

    function goalKick(team) {
      const gk = (team === 'own' ? own : opp).find((p) => p.gk);
      const goalY = team === 'own' ? M2D_FH : 0;
      ball.x = M2D_FW / 2 + (Math.random() - 0.5) * 20;
      ball.y = goalY + (team === 'own' ? -6 : 6);
      gk.x = ball.x; gk.y = goalY + (team === 'own' ? -3 : 3);
      ball.owner = gk.id; ball.vx = 0; ball.vy = 0; ball.lastOwnerTeam = team; ball.kickCd = 0.25;
      assistPending = null;
    }

    function nearestOppDist(p) {
      const foes = p.team === 'own' ? opp : own;
      let m = Infinity;
      for (const f of foes) m = Math.min(m, dist(p, f));
      return m;
    }
    function nearest(list, target) {
      let best = null, bd = Infinity;
      for (const p of list) { const d = dist2(p, target); if (d < bd) { bd = d; best = p; } }
      return best;
    }

    // ---------- IA ----------
    function aiPlayer(p, dt) {
      const owner = ball.owner ? players.find((x) => x.id === ball.owner) : null;
      const hasBall = owner && owner.id === p.id;
      const teamHasBall = owner && owner.team === p.team;
      const fwd = p.team === 'own' ? -1 : 1;
      const ownGoalY = p.team === 'own' ? M2D_FH : 0;
      const foeGoalY = p.team === 'own' ? 0 : M2D_FH;
      let tx = p.hx, ty = p.hy, sprint = false;

      if (p.gk) { aiGoalie(p, dt); return; }

      if (hasBall) {
        // conduz em direção ao gol, desviando do marcador
        const foe = nearest(p.team === 'own' ? opp : own, p);
        tx = M2D_FW / 2 + (p.x - M2D_FW / 2) * 0.6;
        ty = foeGoalY;
        if (foe && dist(p, foe) < 8) { tx += (p.x - foe.x) * 1.5; }
        sprint = true;
        const dGoal = Math.abs(p.y - foeGoalY);
        const central = Math.abs(p.x - M2D_FW / 2) < 19;
        if (dGoal < 25 && central && Math.random() < 0.02 + p.fin / 6000) { aiShoot(p); return; }
        if (Math.random() < 0.014 && nearestOppDist(p) < 6) { doPass(p); return; }
      } else if (teamHasBall) {
        // oferece linha de passe / avança
        ty = p.hy + fwd * 12;
        tx = p.hx + (ball.x - M2D_FW / 2) * 0.3;
      } else {
        // defende: o mais próximo pressiona, os outros marcam zona goalside
        const chaser = nearest((p.team === 'own' ? own : opp).filter((x) => !x.gk), ball);
        const press = chaser && chaser.id === p.id;
        if (press) { tx = ball.x; ty = ball.y; sprint = true; }
        else {
          tx = (p.hx + ball.x) / 2;
          ty = p.hy + (ownGoalY - p.hy) * 0.12 * (ballInOwnHalf(p) ? 1.6 : 0.4);
        }
      }
      steer(p, tx, ty, sprint, dt);
    }

    function ballInOwnHalf(p) {
      return p.team === 'own' ? ball.y > M2D_FH / 2 : ball.y < M2D_FH / 2;
    }

    function aiShoot(p) {
      const foeGoalY = p.team === 'own' ? 0 : M2D_FH;
      const tx = M2D_FW / 2 + (Math.random() - 0.5) * (M2D_GOAL_W - 2);
      let dx = tx - p.x, dy = foeGoalY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const spread = (1 - p.fin / 100) * 0.2;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread;
      const power = 50 + p.fin / 100 * 20;
      ball.vx = Math.cos(ang) * power; ball.vy = Math.sin(ang) * power;
      ball.owner = null; ball.kickCd = 0.25; ball.lastOwnerTeam = p.team;
      lastShot = { by: p.id, human: false, team: p.team };
    }

    function aiGoalie(p, dt) {
      const goalY = p.team === 'own' ? M2D_FH : 0;
      const lineY = goalY + (p.team === 'own' ? -3.5 : 3.5);
      let tx = m2dClamp(ball.x, M2D_FW / 2 - M2D_GOAL_W / 2, M2D_FW / 2 + M2D_GOAL_W / 2);
      // sai um pouco se a bola está muito perto
      const near = Math.abs(ball.y - goalY) < 20 && ballInOwnHalf(p);
      let ty = lineY + (near ? (ball.y - lineY) * 0.25 : 0);
      steer(p, tx, ty, near, dt, 0.85);
    }

    function steer(p, tx, ty, sprint, dt, speedMul = 1) {
      let dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const desired = d < 0.4 ? 0 : 1;
      const maxSpd = (13 + p.pace / 100 * 9) * (sprint ? 1.28 : 1) * speedMul;
      const ax = dx / d * maxSpd * desired, ay = dy / d * maxSpd * desired;
      p.vx += (ax - p.vx) * Math.min(1, dt * 8);
      p.vy += (ay - p.vy) * Math.min(1, dt * 8);
    }

    function controlUser(p, dt) {
      const k = keyVec();
      let mvx = input.mvx, mvy = input.mvy, sprint = input.sprint;
      if (k) { mvx = k.x; mvy = k.y; sprint = sprint || k.sprint; }
      const mag = Math.hypot(mvx, mvy);
      // sem comando do jogador: o astro joga sozinho (IA). Toque assume o controle.
      if (mag <= 0.05) { aiPlayer(p, dt); return; }
      const maxSpd = (13 + p.pace / 100 * 9) * (sprint ? 1.3 : 1);
      const ax = mvx / mag * maxSpd * Math.min(1, mag), ay = mvy / mag * maxSpd * Math.min(1, mag);
      p.vx += (ax - p.vx) * Math.min(1, dt * 10);
      p.vy += (ay - p.vy) * Math.min(1, dt * 10);
    }

    // ---------- Update ----------
    function update(dt) {
      if (kickoffFreeze > 0) { kickoffFreeze -= dt; return; }
      real += dt;
      clock = Math.min(90, real / M2D_MATCH_SECONDS * 90);

      // auto-switch: controla o dono (se own) ou o mais próximo da bola
      const owner = ball.owner ? players.find((x) => x.id === ball.owner) : null;
      if (owner && owner.team === 'own' && !owner.gk) userId = owner.id;
      else if (!owner || owner.team === 'opp') {
        const near = nearest(ownOutfield(), ball);
        if (near && dist(near, ball) < 22) userId = near.id;
      }

      for (const p of players) {
        if (p.id === userId && !p.gk) controlUser(p, dt);
        else aiPlayer(p, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = m2dClamp(p.x, 1, M2D_FW - 1);
        p.y = m2dClamp(p.y, 1, M2D_FH - 1);
      }

      // desarmes
      if (owner) {
        const foes = owner.team === 'own' ? opp : own;
        for (const f of foes) {
          if (f.gk) continue;
          if (dist(f, owner) < M2D_PLAYER_R + 1.4) {
            const chance = 0.5 + (f.tackle - owner.drib) / 200;
            if (Math.random() < chance * dt * 3.2) {
              ball.owner = f.id; ball.lastOwnerTeam = f.team; ball.kickCd = 0.12;
              assistPending = null;
              break;
            }
          }
        }
      }

      // bola
      if (ball.kickCd > 0) ball.kickCd -= dt;
      const cur = ball.owner ? players.find((x) => x.id === ball.owner) : null;
      if (cur) {
        // drible: bola à frente do condutor no sentido do movimento
        const spd = Math.hypot(cur.vx, cur.vy);
        let dirx = spd > 0.5 ? cur.vx / spd : (cur.team === 'own' ? 0 : 0);
        let diry = spd > 0.5 ? cur.vy / spd : (cur.team === 'own' ? -1 : 1);
        const lead = M2D_PLAYER_R + M2D_BALL_R + 0.4;
        ball.x = cur.x + dirx * lead; ball.y = cur.y + diry * lead;
        ball.vx = cur.vx; ball.vy = cur.vy;
      } else {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        ball.vx *= Math.pow(0.14, dt); ball.vy *= Math.pow(0.14, dt);
        // paredes laterais
        if (ball.x < M2D_BALL_R) { ball.x = M2D_BALL_R; ball.vx *= -0.5; }
        if (ball.x > M2D_FW - M2D_BALL_R) { ball.x = M2D_FW - M2D_BALL_R; ball.vx *= -0.5; }
        gkSave();
        tryPossession();
      }

      checkBallBounds();

      // meio-tempo
      if (!halftimeShown && clock >= 45) { halftimeShown = true; flash('Intervalo', 1.1); kickoff('own'); }
      if (clock >= 90) finish();
    }

    function checkBallBounds() {
      if (ball.owner) return;
      const cx = M2D_FW / 2;
      const inGoalX = Math.abs(ball.x - cx) < M2D_GOAL_W / 2;
      if (ball.y <= 0.1) {
        if (inGoalX) registerGoal('own'); // gol no gol de cima
        else goalKick('opp');             // tiro de meta adversário
      } else if (ball.y >= M2D_FH - 0.1) {
        if (inGoalX) registerGoal('opp'); // seu gol
        else goalKick('own');
      }
    }

    function registerGoal(team) {
      if (team === 'own') {
        scoreOwn++;
        if (lastShot && lastShot.team === 'own' && lastShot.human) playerGoals++;
        if (assistPending && assistPending.received && lastShot && lastShot.by === assistPending.receiver) playerAssists++;
        flash('GOOOL!', 1.4, config.own.color);
        kickoff('opp');
      } else {
        scoreOpp++;
        flash('Gol sofrido', 1.2, config.opp.color);
        kickoff('own');
      }
      goalsEl.textContent = `${scoreOwn} - ${scoreOpp}`;
      lastShot = null; assistPending = null;
    }

    function kickoff(who) {
      for (const p of players) { p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; }
      ball.x = M2D_FW / 2; ball.y = M2D_FH / 2; ball.vx = 0; ball.vy = 0;
      ball.owner = null; ball.kickCd = 0.3; ball.lastOwnerTeam = who;
      // dá a posse a um jogador central do time "who"
      const list = who === 'own' ? own : opp;
      const mid = list.find((p) => p.role === 'MID') || list[3];
      mid.x = M2D_FW / 2; mid.y = M2D_FH / 2 + (who === 'own' ? 2 : -2);
      ball.owner = mid.id;
      kickoffFreeze = 0.5;
      userId = own[starIdx].id;
    }

    function flash(text, secs, color) {
      flashEl.textContent = text;
      flashEl.style.color = color || '#fff';
      flashEl.classList.add('show');
      flashUntil = real + secs;
    }

    // ---------- Render ----------
    function draw() {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);
      drawPitch();
      // sombra da bola + jogadores
      for (const p of players) drawShadow(p.x, p.y, M2D_PLAYER_R);
      drawShadow(ball.x, ball.y, M2D_BALL_R);
      for (const p of players) drawPlayer(p);
      drawBall();
      ctx.restore();
      if (real > flashUntil) flashEl.classList.remove('show');
      clockEl.textContent = `${Math.floor(clock)}'`;
      updateBtnLabels();
    }

    function drawPitch() {
      const x0 = sx(0), y0 = sy(0), w = M2D_FW * scale, h = M2D_FH * scale;
      // grama com listras
      const stripes = 12;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2f8f43' : '#2a833c';
        ctx.fillRect(x0, y0 + h / stripes * i, w, h / stripes + 1);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      // borda
      ctx.strokeRect(x0, y0, w, h);
      // meio
      ctx.beginPath(); ctx.moveTo(x0, sy(M2D_FH / 2)); ctx.lineTo(x0 + w, sy(M2D_FH / 2)); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx(M2D_FW / 2), sy(M2D_FH / 2), 9.15 * scale, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx(M2D_FW / 2), sy(M2D_FH / 2), 0.9, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      // áreas
      const boxW = 40, boxH = 16, sixW = 18, sixH = 5.5;
      const bx = (M2D_FW - boxW) / 2, sxx = (M2D_FW - sixW) / 2;
      ctx.strokeRect(sx(bx), sy(0), boxW * scale, boxH * scale);
      ctx.strokeRect(sx(sxx), sy(0), sixW * scale, sixH * scale);
      ctx.strokeRect(sx(bx), sy(M2D_FH - boxH), boxW * scale, boxH * scale);
      ctx.strokeRect(sx(sxx), sy(M2D_FH - sixH), sixW * scale, sixH * scale);
      // gols
      const gx = (M2D_FW - M2D_GOAL_W) / 2;
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
      ctx.strokeRect(sx(gx), sy(-1.6), M2D_GOAL_W * scale, 1.6 * scale);
      ctx.strokeRect(sx(gx), sy(M2D_FH), M2D_GOAL_W * scale, 1.6 * scale);
      ctx.lineWidth = 2;
    }

    function drawShadow(x, y, r) {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(sx(x) + 2, sy(y) + 3, r * scale, r * scale * 0.7, 0, 0, 7); ctx.fill();
    }

    function drawPlayer(p) {
      const px = sx(p.x), py = sy(p.y), r = M2D_PLAYER_R * scale;
      if (p.id === userId && !p.gk) {
        ctx.beginPath(); ctx.arc(px, py, r + 5, 0, 7);
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 2;
      }
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7);
      ctx.fillStyle = p.gk ? '#111' : p.color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.stroke();
      if (p.isStar) { ctx.beginPath(); ctx.arc(px, py, r + 2, 0, 7); ctx.strokeStyle = '#ffe14d'; ctx.stroke(); ctx.strokeStyle = '#fff'; }
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.num, px, py);
    }

    function drawBall() {
      const bx = sx(ball.x), by = sy(ball.y), r = M2D_BALL_R * scale * 1.3;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, 7);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke(); ctx.lineWidth = 2;
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(bx, by, r * 0.34, 0, 7); ctx.fill();
    }

    function updateBtnLabels() {
      const owner = ball.owner ? players.find((x) => x.id === ball.owner) : null;
      const attacking = owner && owner.team === 'own';
      shootBtn.textContent = attacking ? '⚽' : '⇱';
      shootBtn.classList.toggle('def', !attacking);
      passBtn.textContent = attacking ? '↗' : '⤣';
    }

    // ---------- Loop ----------
    let raf = 0, last = performance.now();
    function loop(now) {
      if (!running) return;
      let dt = (now - last) / 1000; last = now;
      dt = Math.min(dt, 0.05);
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    function finish() {
      if (finished) return;
      finished = true; running = false;
      cancelAnimationFrame(raf);
      cleanup();
      resolve({
        teamGoals: scoreOwn, oppGoals: scoreOpp,
        playerGoals, playerAssists, playerShots,
        saves: config.player.position === 'GK' ? Math.round(scoreOpp === 0 ? 4 : 2) : 0,
      });
    }

    function cleanup() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
    }

    window.addEventListener('resize', resize);
    resize();
    kickoff('own');
    // pequena contagem antes do apito
    flash('Vai começar!', 1.0);
    raf = requestAnimationFrame(loop);
  });
}

function abbr(name) {
  const clean = name.replace(/\b(FC|CF|SC|AC|de|da|do|of)\b/gi, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1].slice(0, 2)).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}
