/* ============================================================
   Interfaz: HUD, panel de selección, minimapa, modales
   ============================================================ */
import { CFG, COL } from './config.js';
import { UNIT_DEFS, STRUCT_DEFS } from './units.js';

const ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l7 2v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V5l7-2z"/><path d="M12 7v7M8.5 10.5h7"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>`,
  sling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l7-7"/><circle cx="15" cy="9" r="4"/><path d="M18 6l2-2"/></svg>`,
  build: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 20h18M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/></svg>`,
  temple: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 20h18M5 20V9h14v11M9 9V5h6v4"/><path d="M10 20v-4h4v4"/></svg>`,
  wall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 18h18M4 18V8h4v10M10 18V8h4v10M16 18V8h4v10M3 13h18"/></svg>`,
  heal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.4-7-9.3C5 8.4 7.2 6.5 9.7 6.5c1.2 0 2 .6 2.3 1.1.3-.5 1.1-1.1 2.3-1.1 2.5 0 4.7 1.9 4.7 5.2C19 16.6 12 21 12 21z"/></svg>`,
};

const fmt = (n) => Math.floor(n).toLocaleString('es-ES');

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      oro: document.getElementById('res-oro'),
      inti: document.getElementById('res-inti'),
      pop: document.getElementById('res-pop'),
      wave: document.getElementById('wave-info'),
      panel: document.getElementById('sel-panel'),
      portrait: document.getElementById('sel-portrait'),
      name: document.getElementById('sel-name'),
      kind: document.getElementById('sel-kind'),
      hpFill: document.getElementById('sel-hp-fill'),
      hp: document.getElementById('sel-hp'),
      actions: document.getElementById('sel-actions'),
      log: document.getElementById('log-list'),
      minimap: document.getElementById('minimap'),
      toast: document.getElementById('toast'),
      modal: document.getElementById('modal'),
      modalBody: document.getElementById('modal-body'),
      objective: document.getElementById('objective-txt'),
      donate: document.getElementById('btn-donate'),
    };
    this.mmCtx = this.el.minimap.getContext('2d');
    this.mmBase = null;
    this.mmTimer = 0;
    this._toastTimer = null;
    this._lastSelKey = '';

    this._bind();
    this._buildMinimapBase();
  }

  /* ---------------- eventos ---------------- */
  _bind() {
    this.el.donate.href = CFG.PAYPAL_URL;
    this.el.donate.title = CFG.PAYPAL_LABEL;

    document.getElementById('btn-lore').addEventListener('click', () => this.openModal('lore'));
    document.getElementById('btn-help').addEventListener('click', () => this.openModal('help'));
    document.getElementById('modal-x').addEventListener('click', () => this.closeModal());
    this.el.modal.addEventListener('click', (e) => { if (e.target === this.el.modal) this.closeModal(); });

    this.el.actions.addEventListener('click', (e) => {
      const btn = e.target.closest('.act');
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === 'train') this.game.train(btn.dataset.type);
      else if (act === 'build') this.game.beginPlace(btn.dataset.type);
      else if (act === 'bless') this.game.castBlessing();
      this.refresh();
    });

    this.el.minimap.addEventListener('pointerdown', (e) => {
      const r = this.el.minimap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const nz = (e.clientY - r.top) / r.height;
      const half = this.game.terrain.half;
      this.game.onFocus((nx * 2 - 1) * half, (nz * 2 - 1) * half);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.el.modal.classList.contains('hidden')) this.closeModal();
        else this.game.cancelPlace();
      }
    });
  }

  /* ---------------- recursos / estado ---------------- */
  refresh() {
    const g = this.game;
    this.el.oro.textContent = fmt(g.res.oro);
    this.el.inti.textContent = fmt(g.res.inti);
    this.el.pop.textContent = `${g.pop}/${g.popCap}`;
    const inc = g.income || { oro: 0, inti: 0 };
    this.el.oro.title = `+${inc.oro.toFixed(1)}/s`;
    this.el.inti.title = `+${inc.inti.toFixed(1)}/s`;

    const t = Math.max(0, Math.ceil(g.waveTimer));
    this.el.wave.textContent = `Oleada ${g.wave + 1} · ${t}s`;

    // estados de botones
    this.el.actions.querySelectorAll('.act').forEach((b) => {
      const act = b.dataset.act;
      if (act === 'train') {
        const def = UNIT_DEFS[b.dataset.type];
        b.disabled = !g.canPay(def.cost) || g.pop >= g.popCap;
      } else if (act === 'build') {
        const def = STRUCT_DEFS[b.dataset.type];
        b.disabled = !g.canPay(def.cost);
      } else if (act === 'bless') {
        b.disabled = g.res.inti < 30 || g.blessCd > 0;
        const c = b.querySelector('.c');
        if (c) c.textContent = g.blessCd > 0 ? `Recarga ${Math.ceil(g.blessCd)}s` : '30 Inti · cura en área';
      }
    });

    // progreso de la cola
    const b = g.trainingBuilding;
    const qi = document.getElementById('queue-info');
    if (b && qi) {
      if (b.queue.length) {
        const job = b.queue[0];
        const pct = (1 - job.left / job.total) * 100;
        qi.classList.remove('hidden');
        qi.innerHTML = `<span>Entrenando <b>${UNIT_DEFS[job.type].name}</b> · ${job.left.toFixed(1)}s</span>
          <i style="width:${pct}%"></i>`;
      } else qi.classList.add('hidden');
    }

    // hp del elemento seleccionado
    const s = g.selection[0];
    if (s) {
      const ratio = Math.max(0, s.hp / s.maxHp);
      this.el.hpFill.style.width = `${ratio * 100}%`;
      this.el.hp.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    }
    if (g.selection.length > 1) {
      const total = g.selection.reduce((a, e) => a + e.hp, 0);
      const max = g.selection.reduce((a, e) => a + e.maxHp, 0);
      this.el.hpFill.style.width = `${(total / max) * 100}%`;
      this.el.hp.textContent = `${Math.ceil(total)} / ${max}`;
    }
  }

  onSelectionChanged(sel) {
    const g = this.game;
    const panel = this.el.panel;

    if (!sel.length) {
      panel.classList.add('hidden');
      this._lastSelKey = '';
      return;
    }
    panel.classList.remove('hidden');

    const first = sel[0];
    const key = sel.length > 1 ? `multi-${sel.length}-${sel.map((e) => e.id).join(',')}` : `${first.kind}-${first.type}-${first.id}`;
    if (key === this._lastSelKey) { this.refresh(); return; }
    this._lastSelKey = key;

    if (sel.length > 1) {
      const names = {};
      sel.forEach((e) => { names[e.def.name] = (names[e.def.name] || 0) + 1; });
      this.el.name.textContent = `${sel.length} unidades`;
      this.el.kind.textContent = Object.entries(names).map(([n, c]) => `${c}× ${n}`).join(' · ');
      this.el.portrait.innerHTML = ICONS.shield;
      this.el.actions.innerHTML = '';
      this.refresh();
      return;
    }

    this.el.name.textContent = first.def.name;
    this.el.kind.textContent = first.def.role || '';
    this.el.portrait.innerHTML = ICONS[first.def.icon || 'temple'] || ICONS.temple;

    const acts = [];
    if (first.kind === 'structure' && first.def.trains && first.faction === 'inca') {
      first.def.trains.forEach((t, i) => {
        const d = UNIT_DEFS[t];
        const cost = [d.cost.oro ? `${d.cost.oro} oro` : '', d.cost.inti ? `${d.cost.inti} inti` : ''].filter(Boolean).join(' + ');
        acts.push(`<button class="act" data-act="train" data-type="${t}" title="${d.lore || ''}">
          <kbd>${i + 1}</kbd><span class="n">${d.name}</span><span class="c">${cost}</span></button>`);
      });
      acts.push(`<button class="act" data-act="build" data-type="terraza" title="Genera +2,6 oro/s">
        <kbd>Q</kbd><span class="n">Terraza</span><span class="c">90 oro</span></button>`);
      acts.push(`<button class="act" data-act="build" data-type="muro" title="Bloquea el paso de las oleadas">
        <kbd>W</kbd><span class="n">Muro</span><span class="c">70 oro</span></button>`);
    } else if (first.kind === 'unit' && first.type === 'willaq') {
      acts.push(`<button class="act" data-act="bless">
        <kbd>B</kbd><span class="n">Bendición del Sol</span><span class="c">30 Inti · cura en área</span></button>`);
    } else if (first.kind === 'structure' && first.type === 'terraza') {
      acts.push(`<button class="act" disabled><span class="n">+2,6 oro/s</span><span class="c">Edificio económico</span></button>`);
    } else if (first.kind === 'structure' && first.type === 'sacsay') {
      acts.push(`<button class="act" disabled><span class="n">+8 hueste</span><span class="c">Fortaleza ceremonial</span></button>`);
    }

    this.el.actions.innerHTML = acts.join('') + `<div id="queue-info" class="hidden"></div>`;
    this.refresh();
  }

  /* ---------------- log / toast ---------------- */
  log(msg, cls = '') {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = msg;
    this.el.log.appendChild(li);
    while (this.el.log.children.length > 24) this.el.log.removeChild(this.el.log.firstChild);
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
    }, 2200);
  }

  /* ---------------- minimapa ---------------- */
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
    this.mmTimer += dt;
    if (this.mmTimer < 0.1) return;
    this.mmTimer = 0;

    const ctx = this.mmCtx;
    const T = this.game.terrain;
    const size = this.el.minimap.width;
    const k = size / (T.N * T.T);

    ctx.clearRect(0, 0, size, size);
    if (this.mmBase) ctx.drawImage(this.mmBase, 0, 0);

    const toX = (x) => (x + T.half) * k;
    const toY = (z) => (z + T.half) * k;

    for (const s of this.game.structures) {
      if (!s.alive) continue;
      ctx.fillStyle = s.faction === 'inca' ? '#7fd8ff' : '#e6eef8';
      const w = Math.max(3, s.radius * k * 1.1);
      ctx.fillRect(toX(s.pos.x) - w / 2, toY(s.pos.z) - w / 2, w, w);
      if (s.type === 'piramide' || s.type === 'coricancha') {
        ctx.strokeStyle = s.faction === 'inca' ? '#ffffff' : '#7fd8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(toX(s.pos.x) - w / 2 - 1, toY(s.pos.z) - w / 2 - 1, w + 2, w + 2);
      }
    }

    for (const u of this.game.units) {
      if (!u.alive) continue;
      ctx.fillStyle = u.faction === 'inca' ? '#9fe4ff' : '#ff9db0';
      ctx.fillRect(toX(u.pos.x) - 1.2, toY(u.pos.z) - 1.2, 2.4, 2.4);
    }

    // rectángulo de cámara aproximado
    const cam = this.game.camera;
    const target = this.game.camTarget;
    if (target) {
      const view = cam.position.distanceTo(target) * 0.42;
      ctx.strokeStyle = 'rgba(127,216,255,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(toX(target.x) - view * k, toY(target.z) - view * k, view * 2 * k, view * 2 * k);
    }
  }

  /* ---------------- modales ---------------- */
  openModal(kind) {
    this.el.modalBody.innerHTML = this._modalContent(kind);
    this.el.modal.classList.remove('hidden');
  }

  closeModal() { this.el.modal.classList.add('hidden'); }

  _modalContent(kind) {
    const support = `
      <div class="donate-card">
        <div>
          <h4 style="margin:0 0 4px;font-family:var(--font-title);letter-spacing:1.4px">Apoyar el desarrollo de este RTS</h4>
          <p>Sin anuncios, sin afiliados y sin rastreadores: el juego se paga con tiempo. Si te gusta el prototipo, puedes invitar un café al estudio.</p>
        </div>
        <a class="btn donate" href="${CFG.PAYPAL_URL}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.3-9.1C1.2 8.2 3.4 4.8 6.9 4.8c2 0 3.5 1.1 4.3 2.3.8-1.2 2.3-2.3 4.3-2.3 3.5 0 5.7 3.4 4.2 7.1C19.5 16.3 12 21 12 21z" fill="currentColor"/></svg>
          Donar con PayPal
        </a>
      </div>`;

    if (kind === 'lore') {
      return `
        <div class="kicker">Lore · Monuments of War</div>
        <h2>EL ALTIPLANO PARTIDO</h2>
        <p>Cuando la <em>piedra encajada</em> de los Andes todavía no tenía nombre, los ingenieros del Sol levantaron
        muros que se sostenían sin mortero y terrazas que robaban tierra a la montaña. Del otro lado del mundo conocido,
        los astrónomos del Mayab alineaban escalinatas con el paso de Venus y contaban los días en piedra.</p>
        <p>La guerra no empieza por un territorio, sino por una pregunta: <b>¿quién conserva la memoria de los muertos?</b>
        Dos imperios han enviado sus huestes al mismo valle. Tú mandas a los hijos del Sol.</p>

        <div class="cols">
          <div class="card">
            <h4>Sacsayhuamán</h4>
            <p>Tres terrazas de murallas en zigzag, talladas con bloques de hasta cien toneladas. En el juego es tu
            <b>fortaleza ceremonial</b>: eleva el límite de hueste en +8 y sirve de ancla defensiva.</p>
          </div>
          <div class="card">
            <h4>Coricancha</h4>
            <p>El recinto dorado del Sol. Aquí se entrenan las unidades y se acumula el <b>Inti</b>, la fe que
            alimenta a los sacerdotes. Si cae, la campaña termina.</p>
          </div>
          <div class="card">
            <h4>Willaq Umu</h4>
            <p>El que dice la palabra del Inca. No es un sanador pasivo: sostiene la línea, cura 9 puntos por
            latido en 5,6 unidades de radio y puede desatar la <b>Bendición del Sol</b>.</p>
          </div>
          <div class="card">
            <h4>Pirámide de Kukulcán</h4>
            <p>Nueve cuerpos de piedra caliza y 365 escalones. Es el corazón del Mayab en el valle: mientras siga en
            pie, las oleadas no se detendrán.</p>
          </div>
        </div>

        <h3>Mecánicas tácticas</h3>
        <p><b>Terrazas = economía.</b> Cada terraza suma +2,6 oro/s. La economía inca no crece sola: hay que plantar
        antes de la primera oleada.</p>
        <p><b>Muros como el de Sacsayhuamán.</b> Un muro bien puesto convierte un valle abierto en un embudo.
        Las unidades no atraviesan estructuras: usa el terreno y los pasos estrechos.</p>
        <p><b>Composición.</b> Chakana aguanta la línea; el hondero hace daño desde 8,6 unidades; el Willaq Umu
        multiplica el valor de cada guerrero. Una hueste sin sacerdote se desgasta; un sacerdote sin escudos muere.</p>
        <p><b>Ritmo.</b> Cada 34 segundos llega una oleada mayor. El objetivo no es resistir para siempre, sino
        acumular la fuerza suficiente para marchar sobre la pirámide.</p>
        ${support}`;
    }

    if (kind === 'help') {
      return `
        <div class="kicker">Manual de campaña</div>
        <h2>CÓMO JUGAR</h2>
        <p>Estás al mando de la facción <b>Inca</b> (azul). El objetivo es destruir la <b>Pirámide de Kukulcán</b>
        sin perder el <b>Coricancha</b>.</p>
        <table class="keys">
          <tr><td>Clic izquierdo</td><td>Seleccionar unidad o edificio</td></tr>
          <tr><td>Arrastrar</td><td>Selección por caja de varias unidades</td></tr>
          <tr><td>Clic derecho</td><td>Mover · atacar · fijar punto de reunión</td></tr>
          <tr><td>W A S D / flechas</td><td>Desplazar la cámara</td></tr>
          <tr><td>Rueda del ratón</td><td>Zoom</td></tr>
          <tr><td>Q / E</td><td>Rotar la cámara</td></tr>
          <tr><td>1 · 2 · 3</td><td>Entrenar Chakana · Hondero · Willaq Umu</td></tr>
          <tr><td>B</td><td>Bendición del Sol (con un Willaq Umu seleccionado)</td></tr>
          <tr><td>Esc</td><td>Cancelar construcción / cerrar ventana</td></tr>
        </table>
        <h3>Primeros tres minutos</h3>
        <p>1. Selecciona el <b>Coricancha</b> y entrena dos <b>Honderos</b>.<br>
           2. Construye una <b>Terraza</b> para subir el oro por segundo.<br>
           3. Recluta un <b>Willaq Umu</b> antes de la primera oleada (55 s).<br>
           4. Cuando tengas 8–10 unidades, agrupa con caja y marcha al este.</p>
        <p><b>Truco táctico:</b> un <b>Muro</b> en el paso entre montañas obliga a la IA a rodear, y tus honderos
        disparan desde detrás. El terreno es tu aliado más barato.</p>
        ${support}`;
    }

    return `
      <div class="kicker">Monetización directa</div>
      <h2>APOYO AL PROYECTO</h2>
      <p>Este prototipo no tiene anuncios, ni redes de afiliados, ni cookies de terceros. Todo el juego se ejecuta
      en tu navegador y no hay servidores que mantener.</p>
      ${support}`;
  }

  /* ---------------- fin de partida ---------------- */
  showEnd(victory) {
    const div = document.createElement('div');
    div.id = 'intro';
    div.style.zIndex = 80;
    document.getElementById('app').classList.add('intro-mode');
    div.innerHTML = `
      <div class="intro-inner">
        <div class="intro-kicker">${victory ? 'Campaña completada' : 'Campaña perdida'}</div>
        <h2 style="font-size:clamp(30px,6vw,54px)">${victory ? 'LA PIEDRA<span style="font-size:.5em;letter-spacing:10px">RECUERDA</span>' : 'EL SOL<span style="font-size:.5em;letter-spacing:10px">SE APAGÓ</span>'}</h2>
        <p class="intro-sub">${victory
          ? 'La Pirámide de Kukulcán ha caído. El valle queda para el Coricancha, y los cronistas ya escriben tu nombre.'
          : 'El Coricancha ha ardido. Sin templo no hay Inti, y sin Inti no hay palabra que sostenga a la hueste.'}</p>
        <button class="btn primary big" onclick="location.reload()">Volver a empezar</button>
      </div>`;
    document.getElementById('app').appendChild(div);
  }
}
