/* ============================================================
   Interfaz: selección de facción, HUD, barra de mando, minimapa
   ============================================================ */
import { CFG, COL, FACTION } from './config.js';
import { UNIT_DEFS, STRUCT_DEFS, BUILD_MENU, CLS_LABEL, WORKER_OF } from './units.js';

const ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l7 2v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V5l7-2z"/><path d="M12 7v7M8.5 10.5h7"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>`,
  sling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l7-7"/><circle cx="15" cy="9" r="4"/><path d="M18 6l2-2"/></svg>`,
  worker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="7" r="3"/><path d="M6 21v-4a6 6 0 0 1 12 0v4"/></svg>`,
  build: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 20h18M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/></svg>`,
  temple: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 20h18M5 20V9h14v11M9 9V5h6v4"/><path d="M10 20v-4h4v4"/></svg>`,
  tower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 21V6h10v15M5 6h14M9 3h6v3H9z"/><path d="M11 12h2v3h-2z"/></svg>`,
  sword: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l6-6M14 4h6v6l-9 9-6-6 9-9z"/></svg>`,
  pop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 20v-1.5a4.5 4.5 0 0 1 6 0V20"/></svg>`,
  heal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.4-7-9.3C5 8.4 7.2 6.5 9.7 6.5c1.2 0 2 .6 2.3 1.1.3-.5 1.1-1.1 2.3-1.1 2.5 0 4.7 1.9 4.7 5.2C19 16.6 12 21 12 21z"/></svg>`,
};

const fmt = (n) => Math.floor(n).toLocaleString('es-ES');
const iconOf = (k) => ICONS[k] || ICONS.build;

export class UI {
  constructor() {
    this.game = null;
    this.el = {
      app: document.getElementById('app'),
      oro: document.getElementById('res-oro'),
      piedra: document.getElementById('res-piedra'),
      inti: document.getElementById('res-inti'),
      pop: document.getElementById('res-pop'),
      wave: document.getElementById('wave-info'),
      cmd: document.getElementById('cmdbar'),
      cmdInfo: document.getElementById('cmd-info'),
      cmdActions: document.getElementById('cmd-actions'),
      log: document.getElementById('log-list'),
      minimap: document.getElementById('minimap'),
      toast: document.getElementById('toast'),
      modal: document.getElementById('modal'),
      modalBody: document.getElementById('modal-body'),
      donate: document.getElementById('btn-donate'),
      screen: document.getElementById('faction-screen'),
      startBtn: document.getElementById('btn-start'),
    };
    this.mmCtx = this.el.minimap.getContext('2d');
    this.mmBase = null;
    this.mmTimer = 0;
    this._toastTimer = null;
    this._selKey = '';
    this.chosenFaction = 'inca';

    this._bindCommon();
    this._bindFactionScreen();
  }

  /* ================= enlace con la partida ================= */
  attach(game) {
    this.game = game;
    this.el.donate.href = CFG.PAYPAL_URL;
    this.el.donate.title = CFG.PAYPAL_LABEL;
    this._buildMinimapBase();
    this.onSelectionChanged([]);
    this.refresh();
  }

  /* ================= eventos comunes ================= */
  _bindCommon() {
    // el enlace de donación debe estar activo desde el primer segundo
    this.el.donate.href = CFG.PAYPAL_URL;
    this.el.donate.title = CFG.PAYPAL_LABEL;

    document.getElementById('modal-x').addEventListener('click', () => this.closeModal());
    this.el.modal.addEventListener('click', (e) => { if (e.target === this.el.modal) this.closeModal(); });
    document.getElementById('btn-lore').addEventListener('click', () => this.openModal('lore'));
    document.getElementById('btn-help').addEventListener('click', () => this.openModal('help'));

    this.el.cmdActions.addEventListener('click', (e) => {
      const btn = e.target.closest('.cmd-btn');
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === 'train') this.game.train(btn.dataset.type);
      else if (act === 'build') this.game.beginPlace(btn.dataset.type);
      else if (act === 'bless') this.game.castBlessing();
      else if (act === 'pop') this.game.upgradePop();
      else if (act === 'base') this.game.setSelection([this.game.playerBase]);
      else if (act === 'idle') this.selectIdleWorker();
      this.refresh();
    });

    this.el.minimap.addEventListener('pointerdown', (e) => {
      if (!this.game) return;
      const r = this.el.minimap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const nz = (e.clientY - r.top) / r.height;
      const half = this.game.terrain.half;
      this.game.onFocus((nx * 2 - 1) * half, (nz * 2 - 1) * half);
    });

    // Pantalla completa
    const fsBtn = document.getElementById('btn-fullscreen');
    fsBtn.addEventListener('click', () => this.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => {
      fsBtn.classList.toggle('active', !!document.fullscreenElement);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.modal.classList.contains('hidden')) this.closeModal();
    });
  }

  toggleFullscreen() {
    const doc = document;
    const el = doc.documentElement;
    try {
      if (!doc.fullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const r = req ? req.call(el) : null;
        if (r && r.catch) r.catch(() => {});
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } else {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        const r = exit ? exit.call(doc) : null;
        if (r && r.catch) r.catch(() => {});
      }
    } catch (e) { /* algunos navegadores lo bloquean sin gesto */ }
  }

  /* ================= pantalla de facción ================= */
  _bindFactionScreen() {
    const cards = this.el.screen.querySelectorAll('.faction-pick');
    cards.forEach((c) => {
      c.addEventListener('click', () => {
        cards.forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        this.chosenFaction = c.dataset.faction;
      });
    });
    cards[0]?.classList.add('selected');
  }

  hideFactionScreen() {
    const s = this.el.screen;
    s.classList.add('gone');
    s.style.pointerEvents = 'none';
    this.el.app.classList.remove('intro-mode');
    // se retira del árbol visual cuando termina el fundido (evita bloquear el canvas)
    setTimeout(() => { s.style.display = 'none'; }, 500);
  }

  /* ================= recursos / estado ================= */
  refresh() {
    const g = this.game;
    if (!g) return;
    this.el.oro.textContent = fmt(g.res.oro);
    this.el.piedra.textContent = fmt(g.res.piedra);
    this.el.inti.textContent = fmt(g.res.inti);
    this.el.pop.textContent = `${g.pop}/${g.popCap}`;

    const t = Math.max(0, Math.ceil(g.waveTimer));
    this.el.wave.textContent = `Oleada ${g.wave + 1} · ${t}s`;

    this.el.cmdActions.querySelectorAll('.cmd-btn').forEach((b) => {
      const act = b.dataset.act;
      if (act === 'train') {
        const def = UNIT_DEFS[b.dataset.type];
        b.disabled = !g.canPay(def.cost) || (g.pop >= g.popCap && def.cls !== 'worker');
      } else if (act === 'build') {
        b.disabled = !g.canPay(STRUCT_DEFS[b.dataset.type].cost);
      } else if (act === 'bless') {
        b.disabled = g.res.inti < 30 || g.blessCd > 0;
        const sub = b.querySelector('.sub');
        if (sub) sub.textContent = g.blessCd > 0 ? `${Math.ceil(g.blessCd)}s` : '30 Inti';
      } else if (act === 'pop') {
        b.disabled = !g.canPay(CFG.POP_UP_COST) || g.popCap >= CFG.POP_MAX;
      }
    });

    const b = g.trainingBuilding;
    const qi = document.getElementById('queue-info');
    if (b && qi) {
      if (b.queue.length) {
        const job = b.queue[0];
        const pct = (1 - job.left / job.total) * 100;
        qi.classList.remove('hidden');
        qi.innerHTML = `<span>${UNIT_DEFS[job.type].name} · ${job.left.toFixed(1)}s</span><i style="width:${pct}%"></i>`;
      } else qi.classList.add('hidden');
    }

    this._updateHp();
  }

  _updateHp() {
    const g = this.game;
    const s = g.selection[0];
    const fill = document.getElementById('sel-hp-fill');
    const num = document.getElementById('sel-hp');
    if (!fill) return;
    if (!s) { fill.style.width = '0%'; if (num) num.textContent = ''; return; }
    if (g.selection.length > 1) {
      const total = g.selection.reduce((a, e) => a + e.hp, 0);
      const max = g.selection.reduce((a, e) => a + e.maxHp, 0);
      fill.style.width = `${(total / max) * 100}%`;
      if (num) num.textContent = `${Math.ceil(total)} / ${max}`;
    } else {
      const ratio = Math.max(0, s.hp / s.maxHp);
      fill.style.width = `${ratio * 100}%`;
      if (num) num.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    }
  }

  /* ================= selección ================= */
  onSelectionChanged(sel) {
    const g = this.game;
    if (!g) return;

    const key = sel.length ? sel.map((e) => e.id).join(',') : 'none';
    const changed = key !== this._selKey;
    this._selKey = key;

    if (changed) this._renderCmdHead(sel);
    if (changed) this._renderCmdActions(sel);
    this.refresh();
  }

  _renderCmdHead(sel) {
    const head = this.el.cmdInfo;
    if (!sel.length) {
      head.innerHTML = `<div class="cmd-hint">
        <span class="k">Toca</span> para seleccionar · <span class="k">arrastra</span> para mover la cámara
      </div>`;
      return;
    }
    const first = sel[0];
    if (sel.length > 1) {
      const names = {};
      sel.forEach((e) => { names[e.def.name] = (names[e.def.name] || 0) + 1; });
      head.innerHTML = `
        <div class="portrait">${iconOf(first.def.icon)}</div>
        <div class="cmd-meta">
          <h3>${sel.length} unidades</h3>
          <p>${Object.entries(names).map(([n, c]) => `${c}× ${n}`).join(' · ')}</p>
          <div class="hpbar"><i id="sel-hp-fill"></i></div>
        </div>
        <span class="hpnum" id="sel-hp"></span>`;
      return;
    }

    const d = first.def;
    const stats = first.kind === 'unit'
      ? `<span class="stat"><b>ATQ</b> ${d.atk}</span>
         <span class="stat"><b>DEF</b> ${d.def}</span>
         <span class="stat cls">${CLS_LABEL[d.cls]}</span>`
      : `<span class="stat cls">${d.role}</span>`;

    const wr = first.kind === 'unit' && d.strong
      ? `<p class="wr"><span class="up">▲ ${d.strong}</span><span class="down">▼ ${d.weak}</span></p>`
      : '';

    head.innerHTML = `
      <div class="portrait">${iconOf(d.icon || 'temple')}</div>
      <div class="cmd-meta">
        <h3>${d.name}</h3>
        <p class="stats">${stats}</p>
        ${wr}
        <div class="hpbar"><i id="sel-hp-fill"></i></div>
      </div>
      <span class="hpnum" id="sel-hp"></span>`;
  }

  _renderCmdActions(sel) {
    const g = this.game;
    const acts = [];
    const first = sel[0];

    if (first && first.kind === 'structure' && first.faction === g.playerFaction) {
      if (first.def.trains) {
        first.def.trains.forEach((t, i) => {
          const d = UNIT_DEFS[t];
          acts.push(this._btn({
            act: 'train', type: t, icon: d.icon, label: d.name,
            sub: this._costLabel(d.cost), hotkey: `${i + 1}`,
          }));
        });
        if (first.def.upgradePop) {
          acts.push(this._btn({
            act: 'pop', icon: 'pop', label: 'Ampliar hueste', sub: `+${CFG.POP_STEP} · 220o 120p`,
          }));
        }
      }
    }

    if (first && first.kind === 'unit' && first.def.cls === 'special') {
      acts.push(this._btn({ act: 'bless', icon: 'heal', label: 'Bendición', sub: '30 Inti' }));
    }

    // menú de obra siempre disponible
    const menu = BUILD_MENU[g.playerFaction] || [];
    menu.forEach((t) => {
      const d = STRUCT_DEFS[t];
      acts.push(this._btn({
        act: 'build', type: t, icon: d.id.includes('torre') || d.id.includes('atalaya') ? 'tower' : 'build',
        label: d.name, sub: this._costLabel(d.cost),
      }));
    });

    if (!sel.length) {
      acts.push(this._btn({ act: 'base', icon: 'temple', label: 'Centro urbano', sub: 'Seleccionar' }));
    }

    this.el.cmdActions.innerHTML = acts.join('') + `<div id="queue-info" class="hidden"></div>`;
  }

  _btn({ act, type = '', icon, label, sub, hotkey }) {
    return `<button class="cmd-btn" data-act="${act}" data-type="${type}" type="button">
      <span class="ico">${iconOf(icon)}</span>
      <span class="lbl">${label}</span>
      <span class="sub">${sub}</span>
      ${hotkey ? `<span class="hk">${hotkey}</span>` : ''}
    </button>`;
  }

  _costLabel(cost = {}) {
    const p = [];
    if (cost.oro) p.push(`${cost.oro}o`);
    if (cost.piedra) p.push(`${cost.piedra}p`);
    if (cost.inti) p.push(`${cost.inti}i`);
    return p.join(' ');
  }

  selectIdleWorker() {
    const g = this.game;
    const idle = g.units.find((u) => u.alive && u.faction === g.playerFaction && u.def.cls === 'worker' && !u.node);
    if (idle) g.setSelection([idle]);
    else this.toast('No hay aldeanos libres');
  }

  /* ================= avisos ================= */
  log(msg, cls = '') {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = msg;
    this.el.log.appendChild(li);
    while (this.el.log.children.length > 20) this.el.log.removeChild(this.el.log.firstChild);
  }

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.remove('hidden');
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.classList.add('hidden'), 220);
    }, 2000);
  }

  floatRes(kind, amount) {
    const target = kind === 'oro' ? this.el.oro : kind === 'piedra' ? this.el.piedra : this.el.inti;
    if (!target) return;
    const chip = target.closest('.res');
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
  }

  /* ================= minimapa ================= */
  _buildMinimapBase() {
    const T = this.game.terrain;
    const size = this.el.minimap.width;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const cell = size / T.N;

    for (let j = 0; j < T.N; j++) {
      for (let i = 0; i < T.N; i++) {
        const h = T.heightAtCell(i, j);
        const walk = T.isWalkableCell(i, j);
        let color = '#0a2233';
        if (h > CFG.WATER + 0.2) {
          if (!walk) color = '#3d4a55';
          else if (h < 1.4) color = '#1d3a35';
          else if (h < 3.5) color = '#254438';
          else if (h < 7) color = '#33454a';
          else color = '#59677a';
        }
        ctx.fillStyle = color;
        ctx.fillRect(i * cell, j * cell, Math.ceil(cell) + 0.4, Math.ceil(cell) + 0.4);
      }
    }
    this.mmBase = c;
  }

  drawMinimap(dt) {
    if (!this.game) return;
    this.mmTimer += dt;
    if (this.mmTimer < 0.1) return;
    this.mmTimer = 0;

    const ctx = this.mmCtx;
    const g = this.game;
    const T = g.terrain;
    const size = this.el.minimap.width;
    const k = size / (T.N * T.T);

    ctx.clearRect(0, 0, size, size);
    if (this.mmBase) ctx.drawImage(this.mmBase, 0, 0);

    const toX = (x) => (x + T.half) * k;
    const toY = (z) => (z + T.half) * k;

    // yacimientos
    for (const n of g.nodes) {
      if (!n.alive) continue;
      ctx.fillStyle = n.type === 'oro' ? '#d9a93a' : '#9fb0c4';
      ctx.fillRect(toX(n.pos.x) - 1.5, toY(n.pos.z) - 1.5, 3, 3);
    }

    for (const s of g.structures) {
      if (!s.alive) continue;
      const mine = s.faction === g.playerFaction;
      ctx.fillStyle = mine ? FACTION[g.playerFaction].css : '#e6eef8';
      const w = Math.max(3, s.radius * k * 1.1);
      ctx.fillRect(toX(s.pos.x) - w / 2, toY(s.pos.z) - w / 2, w, w);
      if (s === g.playerBase || s === g.enemyBase) {
        ctx.strokeStyle = mine ? '#ffffff' : '#7fd8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(toX(s.pos.x) - w / 2 - 1, toY(s.pos.z) - w / 2 - 1, w + 2, w + 2);
      }
    }

    for (const u of g.units) {
      if (!u.alive) continue;
      ctx.fillStyle = u.faction === g.playerFaction ? '#9fe4ff' : '#ff9db0';
      ctx.fillRect(toX(u.pos.x) - 1.2, toY(u.pos.z) - 1.2, 2.4, 2.4);
    }

    const target = g.camTarget;
    if (target) {
      const view = g.camera.position.distanceTo(target) * 0.42;
      ctx.strokeStyle = 'rgba(127,216,255,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(toX(target.x) - view * k, toY(target.z) - view * k, view * 2 * k, view * 2 * k);
    }
  }

  /* ================= modales ================= */
  openModal(kind) {
    this.el.modalBody.innerHTML = this._modalContent(kind);
    this.el.modal.classList.remove('hidden');
  }

  closeModal() { this.el.modal.classList.add('hidden'); }

  _supportBlock() {
    return `
      <div class="donate-card">
        <div>
          <h4>Apoyar el desarrollo de este RTS</h4>
          <p>Sin anuncios, sin afiliados y sin rastreadores. Si te gusta el prototipo, puedes invitar un café al estudio.</p>
        </div>
        <a class="btn donate" href="${CFG.PAYPAL_URL}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.3-9.1C1.2 8.2 3.4 4.8 6.9 4.8c2 0 3.5 1.1 4.3 2.3.8-1.2 2.3-2.3 4.3-2.3 3.5 0 5.7 3.4 4.2 7.1C19.5 16.3 12 21 12 21z" fill="currentColor"/></svg>
          Donar con PayPal
        </a>
      </div>`;
  }

  _modalContent(kind) {
    const support = this._supportBlock();

    if (kind === 'lore') {
      return `
        <div class="kicker">Lore · Monuments of War</div>
        <h2>EL ALTIPLANO PARTIDO</h2>
        <p>Cuando la <em>piedra encajada</em> de los Andes todavía no tenía nombre, los ingenieros del Sol levantaron
        muros que se sostenían sin mortero. Del otro lado del mundo conocido, los astrónomos del Mayab alineaban
        escalinatas con el paso de Venus y contaban los días en piedra.</p>
        <p>La guerra no empieza por un territorio, sino por una pregunta: <b>¿quién conserva la memoria de los muertos?</b></p>
        <div class="cols">
          <div class="card"><h4>Sacsayhuamán</h4><p>Tres muros en zigzag de bloques de hasta cien toneladas.
          En el juego es el <b>cuartel inca</b>: de ahí salen la infantería y los honderos.</p></div>
          <div class="card"><h4>Coricancha</h4><p>El recinto del Sol. Produce <b>chasquis</b>, almacena recursos y
          amplía la hueste. Si cae, la campaña termina.</p></div>
          <div class="card"><h4>Willaq Umu</h4><p>El que dice la palabra del Inca: unidad <b>especial</b>, cura en área
          y machaca a la infantería pesada.</p></div>
          <div class="card"><h4>El Caracol</h4><p>El observatorio maya. De su cúpula salen los <b>chamanes de Chichén</b>,
          élite de veneno y liturgia.</p></div>
        </div>
        <h3>Mecánicas tácticas</h3>
        <p><b>Piedra, papel o tijera.</b> Infantería ▸ Distancia ▸ Especial ▸ Infantería. Acertar la clase
        vale un <b>+50 % de daño</b>: gana quien compone mejor, no quien tiene más tropas.</p>
        <p><b>Economía real.</b> Los aldeanos recogen oro y piedra de los yacimientos y los llevan al centro urbano.
        Sin economía no hay ejército.</p>
        <p><b>Terreno.</b> Las torres disparan solas y los pasos estrechos multiplican su valor.</p>
        ${support}`;
    }

    if (kind === 'help') {
      return `
        <div class="kicker">Manual de campaña</div>
        <h2>CÓMO JUGAR</h2>
        <p>Elige facción, levanta economía y destruye el <b>centro urbano enemigo</b> sin perder el tuyo.</p>
        <table class="keys">
          <tr><td>Tocar unidad</td><td>Seleccionar</td></tr>
          <tr><td>Tocar el suelo</td><td>Mover las unidades seleccionadas</td></tr>
          <tr><td>Tocar enemigo</td><td>Atacar</td></tr>
          <tr><td>Tocar yacimiento</td><td>Enviar aldeanos a recolectar</td></tr>
          <tr><td>Arrastrar 1 dedo</td><td>Mover la cámara</td></tr>
          <tr><td>Pellizcar</td><td>Zoom</td></tr>
          <tr><td>Arrastrar (ratón)</td><td>Selección por caja</td></tr>
          <tr><td>Clic derecho</td><td>Mover · atacar · punto de reunión</td></tr>
          <tr><td>W A S D · rueda</td><td>Cámara y zoom (teclado)</td></tr>
          <tr><td>Esc</td><td>Cancelar construcción</td></tr>
        </table>
        <h3>Primeros tres minutos</h3>
        <p>1. Selecciona el <b>centro urbano</b> y entrena dos <b>aldeanos</b> más.<br>
           2. Manda los aldeanos a un <b>yacimiento</b> de oro tocándolo con ellos seleccionados.<br>
           3. Construye el <b>cuartel</b> y saca infantería.<br>
           4. Antes de la primera oleada, suma un <b>especial</b> y una <b>torre</b>.</p>
        <p><b>Truco:</b> la infantería destroza a los hostigadores. Si el enemigo saca arqueros, responde con
        infantería; si saca élites, responde con distancia.</p>
        ${support}`;
    }

    return `
      <div class="kicker">Monetización directa</div>
      <h2>APOYO AL PROYECTO</h2>
      <p>Este prototipo no tiene anuncios, ni redes de afiliados, ni cookies de terceros. Todo el juego se ejecuta
      en tu navegador y no hay servidores que mantener.</p>
      ${support}`;
  }

  /* ================= fin ================= */
  showEnd(victory) {
    const div = document.createElement('div');
    div.id = 'intro';
    div.style.zIndex = 80;
    this.el.app.classList.add('intro-mode');
    div.innerHTML = `
      <div class="intro-inner">
        <div class="intro-kicker">${victory ? 'Campaña completada' : 'Campaña perdida'}</div>
        <h2 style="font-size:clamp(28px,6vw,52px)">${victory ? 'LA PIEDRA<span>RECUERDA</span>' : 'EL SOL<span>SE APAGÓ</span>'}</h2>
        <p class="intro-sub">${victory
          ? 'El centro urbano enemigo ha caído. El valle queda para tu pueblo y los cronistas ya escriben tu nombre.'
          : 'Tu centro urbano ha ardido. Sin él no hay recursos, y sin recursos no hay ejército.'}</p>
        <button class="btn primary big" onclick="location.reload()">Volver a empezar</button>
      </div>`;
    this.el.app.appendChild(div);
  }
}
