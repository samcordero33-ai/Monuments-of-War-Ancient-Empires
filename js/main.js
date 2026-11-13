/* ============================================================
   Arranque: escena, cámara, entrada y bucle de render
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
const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x16202e, 0.95);
scene.add(new THREE.AmbientLight(0x22334d, 0.55));
scene.add(hemi);

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

/* ---------------- Cámara orbital ---------------- */
const rig = {
  target: new THREE.Vector3(0, 0, 0),
  dist: CFG.CAM_START,
  yaw: Math.PI * 0.28,
  pitch: 0.92,
};

function applyCamera() {
  const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
  camera.position.set(
    rig.target.x + Math.sin(rig.yaw) * cp * rig.dist,
    rig.target.y + sp * rig.dist,
    rig.target.z + Math.cos(rig.yaw) * cp * rig.dist
  );
  camera.lookAt(rig.target);
}

/* ---------------- Juego + UI ---------------- */
const game = new Game({ scene, terrain, camera, renderer });
const ui = new UI(game);
game.ui = ui;
game.onLog = (msg, cls) => ui.log(msg, cls);
game.onFocus = (x, z) => {
  rig.target.set(x, terrain.heightAtWorld(x, z), z);
  clampTarget();
};
game.camTarget = rig.target;

function clampTarget() {
  const lim = terrain.half - 6;
  rig.target.x = Math.max(-lim, Math.min(lim, rig.target.x));
  rig.target.z = Math.max(-lim, Math.min(lim, rig.target.z));
  rig.target.y = Math.max(0, terrain.heightAtWorld(rig.target.x, rig.target.z));
}

// Centrar en la base del jugador
const pb = terrain.cellCenter(terrain.playerBaseCell.i, terrain.playerBaseCell.j);
rig.target.set(pb.x + 4, pb.y, pb.z + 2);
applyCamera();

/* ---------------- Caja de selección ---------------- */
const boxEl = document.createElement('div');
boxEl.style.cssText = `position:absolute;border:1px solid ${'#7fd8ff'};background:rgba(127,216,255,0.12);
  pointer-events:none;z-index:25;display:none;border-radius:2px;box-shadow:0 0 18px rgba(127,216,255,0.35)`;
document.getElementById('viewport').appendChild(boxEl);

/* ---------------- Entrada ---------------- */
const ndc = new THREE.Vector2();
const pointer = { down: false, dragging: false, startX: 0, startY: 0, x: 0, y: 0 };

function toNDC(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
  return ndc;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  if (!game.started || game.over) return;
  canvas.setPointerCapture?.(e.pointerId);
  pointer.down = true;
  pointer.dragging = false;
  pointer.startX = e.clientX;
  pointer.startY = e.clientY;
  pointer.x = e.clientX;
  pointer.y = e.clientY;

  if (e.button === 2) {
    if (game.placing) { game.cancelPlace(); return; }
    game.orderAt(toNDC(e.clientX, e.clientY));
    pointer.down = false;
  }
});

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (!game.started) return;

  if (game.placing) game.updateGhost(toNDC(e.clientX, e.clientY));

  if (!pointer.down) return;
  const dx = e.clientX - pointer.startX;
  const dy = e.clientY - pointer.startY;
  if (!pointer.dragging && Math.hypot(dx, dy) > 7) {
    pointer.dragging = true;
    boxEl.style.display = 'block';
  }
  if (pointer.dragging) {
    const x1 = Math.min(pointer.startX, e.clientX);
    const y1 = Math.min(pointer.startY, e.clientY);
    const w = Math.abs(dx), h = Math.abs(dy);
    const r = canvas.getBoundingClientRect();
    boxEl.style.left = `${x1 - r.left}px`;
    boxEl.style.top = `${y1 - r.top}px`;
    boxEl.style.width = `${w}px`;
    boxEl.style.height = `${h}px`;
  }
});

window.addEventListener('pointerup', (e) => {
  if (!game.started) { pointer.down = false; return; }
  const wasDown = pointer.down;
  pointer.down = false;
  boxEl.style.display = 'none';

  if (!wasDown) return;

  // Construcción
  if (game.placing && !pointer.dragging) {
    game.updateGhost(toNDC(e.clientX, e.clientY));
    game.confirmPlace();
    return;
  }

  if (pointer.dragging) {
    const r = canvas.getBoundingClientRect();
    const rect = {
      x1: Math.min(pointer.startX, e.clientX) - r.left,
      x2: Math.max(pointer.startX, e.clientX) - r.left,
      y1: Math.min(pointer.startY, e.clientY) - r.top,
      y2: Math.max(pointer.startY, e.clientY) - r.top,
    };
    if (rect.x2 - rect.x1 > 8 && rect.y2 - rect.y1 > 8) {
      game.boxSelect(rect, e.shiftKey);
      pointer.dragging = false;
      return;
    }
  }

  pointer.dragging = false;
  const entity = game.pick(toNDC(e.clientX, e.clientY));
  if (entity) {
    if (entity.faction === 'maya' && game.selection.length && game.selection.every((s) => s.kind === 'unit')) {
      game.orderAt(toNDC(e.clientX, e.clientY));
    } else {
      game.selectEntity(entity, e.shiftKey);
    }
  } else if (!e.shiftKey) {
    game.setSelection([]);
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  rig.dist = Math.max(CFG.CAM_MIN, Math.min(CFG.CAM_MAX, rig.dist + e.deltaY * 0.06));
}, { passive: false });

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') game.cancelPlace();
  if (e.key === '1') game.train('chakana');
  if (e.key === '2') game.train('hondero');
  if (e.key === '3') game.train('willaq');
  if (e.key.toLowerCase() === 'b') game.castBlessing();
  if (e.key === 'q') rig.yaw -= 0.12;
  if (e.key === 'e') rig.yaw += 0.12;
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

/* ---------------- Inicio ---------------- */
document.getElementById('btn-start').addEventListener('click', () => {
  document.getElementById('intro').classList.add('gone');
  document.getElementById('app').classList.remove('intro-mode');
  game.started = true;
  ui.log('El valle despierta. Los mayas observan desde el este.', 'warn');
  ui.log('Selecciona el Coricancha para entrenar tu hueste.', '');
  ui.toast('Selecciona el Coricancha y entrena unidades');
  setTimeout(() => ui.openModal('help'), 900);
});

/* ---------------- Bucle ---------------- */
const clock = new THREE.Clock();
let hudAccum = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // paneo de cámara
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

  applyCamera();
  terrain.update(t);
  game.update(dt, camera);

  hudAccum += dt;
  if (hudAccum > 0.12) {
    hudAccum = 0;
    ui.refresh();
  }
  ui.drawMinimap(dt);

  // la luz sigue a la cámara para mantener sombras nítidas
  sun.position.set(rig.target.x + 46, 78, rig.target.z + 34);
  sun.target.position.copy(rig.target);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

applyCamera();
animate();

// Exponer para depuración
window.__MOW = { game, terrain, scene, camera, rig, renderer };
