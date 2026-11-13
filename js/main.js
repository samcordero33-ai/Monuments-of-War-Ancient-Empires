/* ============================================================
   Arranque: escena, cámara, entrada táctil/ratón y bucle
   ============================================================ */
import * as THREE from 'three';
import { CFG, COL } from './config.js';
import { Terrain } from './terrain.js';
import { Game } from './game.js';
import { UI } from './ui.js';

/* ---------------- Render ---------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CFG.MAX_DPR));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.bg);
scene.fog = new THREE.FogExp2(0x070c16, 0.0078);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 900);

/* ---------------- Luces ---------------- */
scene.add(new THREE.HemisphereLight(0x9dc4ff, 0x16202e, 0.95));
scene.add(new THREE.AmbientLight(0x22334d, 0.55));

const sun = new THREE.DirectionalLight(0xd6e6ff, 1.95);
sun.position.set(46, 78, 34);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 260;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.05;
scene.add(sun);
scene.add(sun.target);

const rim = new THREE.DirectionalLight(0x3f7bd8, 0.5);
rim.position.set(-60, 30, -50);
scene.add(rim);

/* ---------------- Mundo ---------------- */
const terrain = new Terrain(scene);

/* ---------------- Cámara ---------------- */
const rig = { target: new THREE.Vector3(0, 0, 0), dist: 72, yaw: Math.PI * 0.28, pitch: 0.92 };

function applyCamera() {
  const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
  camera.position.set(
    rig.target.x + Math.sin(rig.yaw) * cp * rig.dist,
    rig.target.y + sp * rig.dist,
    rig.target.z + Math.cos(rig.yaw) * cp * rig.dist
  );
  camera.lookAt(rig.target);
}

function clampTarget() {
  const lim = terrain.half - 6;
  rig.target.x = Math.max(-lim, Math.min(lim, rig.target.x));
  rig.target.z = Math.max(-lim, Math.min(lim, rig.target.z));
  rig.target.y = Math.max(0, terrain.heightAtWorld(rig.target.x, rig.target.z));
}

rig.target.set(0, terrain.heightAtWorld(0, 0), 0);
applyCamera();

/* ---------------- UI y partida ---------------- */
const ui = new UI();
let game = null;

function startGame() {
  if (game) return;
  game = new Game({ scene, terrain, camera, renderer, playerFaction: ui.chosenFaction });
  game.ui = ui;
  game.onLog = (msg, cls) => ui.log(msg, cls);
  game.onFocus = (x, z) => {
    rig.target.set(x, terrain.heightAtWorld(x, z), z);
    clampTarget();
  };
  game.camTarget = rig.target;

  ui.attach(game);
  ui.hideFactionScreen();

  // cámara sobre el centro urbano del jugador
  const b = game.playerBase.pos;
  rig.target.set(b.x + 3, b.y, b.z + 3);
  rig.dist = CFG.CAM_START;
  applyCamera();

  game.started = true;
  ui.log(`Campaña iniciada como ${ui.chosenFaction === 'inca' ? 'Imperio Inca' : 'Civilización Maya'}`, 'good');
  ui.toast('Toca el centro urbano para entrenar aldeanos');
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-help-2').addEventListener('click', () => ui.openModal('help'));
document.getElementById('btn-donate-2').href = CFG.PAYPAL_URL;

/* ---------------- Caja de selección ---------------- */
const boxEl = document.createElement('div');
boxEl.style.cssText = 'position:absolute;border:1px solid #7fd8ff;background:rgba(127,216,255,0.12);' +
  'pointer-events:none;z-index:25;display:none;border-radius:2px;box-shadow:0 0 18px rgba(127,216,255,0.35)';
document.getElementById('viewport').appendChild(boxEl);

/* ---------------- Entrada ---------------- */
const ndc = new THREE.Vector2();
function toNDC(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
  return ndc;
}

const _v3 = new THREE.Vector3();

/** Selección con tolerancia: si el toque no acierta, busca la unidad propia más cercana en pantalla. */
function pickFriendly(clientX, clientY) {
  const pt = toNDC(clientX, clientY);
  const ent = game.pick(pt);
  if (ent) return { ent, pt };

  const r = canvas.getBoundingClientRect();
  let best = null, bd = 46;
  for (const u of game.units) {
    if (!u.alive || u.faction !== game.playerFaction) continue;
    _v3.copy(u.pos); _v3.y += 1.2; _v3.project(camera);
    const sx = (_v3.x * 0.5 + 0.5) * r.width + r.left;
    const sy = (-_v3.y * 0.5 + 0.5) * r.height + r.top;
    const d = Math.hypot(sx - clientX, sy - clientY);
    if (d < bd) { bd = d; best = u; }
  }
  return { ent: best, pt };
}

const pointers = new Map();
let pinchStart = 0;
let dragBox = null;   // { x1, y1 } en coordenadas de canvas
let lastTap = 0;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* puntero no capturable */ }
  pointers.set(e.pointerId, {
    x: e.clientX, y: e.clientY,
    sx: e.clientX, sy: e.clientY,
    moved: 0, type: e.pointerType, t: performance.now(),
  });

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    dragBox = null;
    boxEl.style.display = 'none';
  }

  if (!game || !game.started || game.over) return;

  if (e.pointerType === 'mouse' && e.button === 2) {
    if (game.placing) { game.cancelPlace(); return; }
    game.orderAt(toNDC(e.clientX, e.clientY));
  }
  if (e.pointerType === 'mouse' && e.button === 0 && !game.placing) {
    dragBox = { x1: e.clientX, y1: e.clientY };
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p) {
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.moved += Math.hypot(dx, dy);
    p.x = e.clientX;
    p.y = e.clientY;

    // un dedo: mover la cámara (el contenido sigue al dedo)
    if (game && game.started && pointers.size === 1 && p.type === 'touch' && p.moved > 8) {
      panCamera(dx, dy);
    }
  }

  if (!game || !game.started) return;

  if (game.placing) game.updateGhost(toNDC(e.clientX, e.clientY));

  // dos dedos: zoom por pellizco
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart > 0 && d > 0) {
      rig.dist = Math.max(CFG.CAM_MIN, Math.min(CFG.CAM_MAX, rig.dist * (pinchStart / d)));
      pinchStart = d;
    }
  }
});

function panCamera(dx, dy) {
  const k = rig.dist * 0.0016;
  const cos = Math.cos(rig.yaw), sin = Math.sin(rig.yaw);
  rig.target.x += (-dx * cos + dy * sin) * k;
  rig.target.z += (dx * sin - dy * cos) * k;
  clampTarget();
}

canvas.addEventListener('pointerup', (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = 0;

  if (!game || !game.started || game.over) { dragBox = null; boxEl.style.display = 'none'; return; }

  const wasTap = p && p.moved < 14;

  // caja de selección (ratón)
  if (dragBox && e.pointerType === 'mouse') {
    const w = Math.abs(e.clientX - dragBox.x1);
    const h = Math.abs(e.clientY - dragBox.y1);
    if (w > 8 && h > 8) {
      const r = canvas.getBoundingClientRect();
      game.boxSelect({
        x1: Math.min(dragBox.x1, e.clientX) - r.left,
        x2: Math.max(dragBox.x1, e.clientX) - r.left,
        y1: Math.min(dragBox.y1, e.clientY) - r.top,
        y2: Math.max(dragBox.y1, e.clientY) - r.top,
      }, e.shiftKey);
      dragBox = null;
      boxEl.style.display = 'none';
      return;
    }
    dragBox = null;
    boxEl.style.display = 'none';
  }

  if (!wasTap) return;
  if (pointers.size > 0) return;

  // doble toque: seleccionar todas del mismo tipo
  const now = performance.now();
  const isDouble = now - lastTap < 320;
  lastTap = now;

  const picked = pickFriendly(e.clientX, e.clientY);
  const pt = picked.pt;

  if (game.placing) {
    game.updateGhost(pt);
    game.confirmPlace();
    return;
  }

  const ent = picked.ent;
  const hasUnits = game.selection.some((x) => x.kind === 'unit');
  // con tropas seleccionadas, tocar un edificio propio es una orden de movimiento
  const selectable = ent && ent.faction === game.playerFaction && !(hasUnits && ent.kind === 'structure');

  if (selectable) {
    if (isDouble && ent.kind === 'unit') {
      const same = game.units.filter((u) => u.alive && u.faction === game.playerFaction && u.type === ent.type);
      game.setSelection(same);
    } else {
      game.selectEntity(ent, e.shiftKey);
    }
    return;
  }

  if (game.selection.length) game.orderAt(pt);
  else game.selectEntity(null);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.dist = Math.max(CFG.CAM_MIN, Math.min(CFG.CAM_MAX, rig.dist + e.deltaY * 0.06));
}, { passive: false });

// caja de selección visual
canvas.addEventListener('pointermove', (e) => {
  if (!dragBox || e.pointerType !== 'mouse' || !pointers.get(e.pointerId)) return;
  const p = pointers.get(e.pointerId);
  if (!p || p.moved < 8) return;
  const r = canvas.getBoundingClientRect();
  boxEl.style.display = 'block';
  boxEl.style.left = `${Math.min(dragBox.x1, e.clientX) - r.left}px`;
  boxEl.style.top = `${Math.min(dragBox.y1, e.clientY) - r.top}px`;
  boxEl.style.width = `${Math.abs(e.clientX - dragBox.x1)}px`;
  boxEl.style.height = `${Math.abs(e.clientY - dragBox.y1)}px`;
});

/* ---------------- Teclado ---------------- */
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (!game || !game.started) return;
  if (e.key === 'Escape') game.cancelPlace();
  if (e.key === '1') game.train(game.playerFaction === 'inca' ? 'chakana' : 'jaguar');
  if (e.key === '2') game.train(game.playerFaction === 'inca' ? 'hondero' : 'arquero');
  if (e.key === '3') game.train(game.playerFaction === 'inca' ? 'willaq' : 'chaman');
  if (e.key.toLowerCase() === 'b') game.castBlessing();
  if (e.key === 'q') rig.yaw -= 0.12;
  if (e.key === 'e') rig.yaw += 0.12;
  if (e.key.toLowerCase() === 'f') ui.toggleFullscreen();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

/* ---------------- Bucle ---------------- */
const clock = new THREE.Clock();
let hudAccum = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // paneo con teclado
  const speed = CFG.CAM_PAN * dt * (rig.dist / CFG.CAM_START);
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (mx || mz) {
    const sin = Math.sin(rig.yaw), cos = Math.cos(rig.yaw);
    rig.target.x += (mx * cos - mz * sin) * speed;
    rig.target.z += (-mx * sin - mz * cos) * speed;
    clampTarget();
  }

  // órbita lenta mientras se elige facción
  if (!game) {
    rig.yaw += dt * 0.035;
    rig.target.y = terrain.heightAtWorld(rig.target.x, rig.target.z);
  }

  applyCamera();
  terrain.update(t);

  if (game) {
    game.update(dt, camera);
    hudAccum += dt;
    if (hudAccum > 0.12) { hudAccum = 0; ui.refresh(); }
    ui.drawMinimap(dt);
  }

  sun.position.set(rig.target.x + 46, 78, rig.target.z + 34);
  sun.target.position.copy(rig.target);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

animate();

// Depuración
window.__MOW = { get game() { return game; }, terrain, scene, camera, rig, renderer, ui, startGame };
