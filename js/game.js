/* ============================================================
   Núcleo de simulación RTS
   Incas vs Mayas · facción elegible · aldeanos · contraataques
   ============================================================ */
import * as THREE from 'three';
import { CFG, COL, FACTION, OTHER } from './config.js';
import {
  UNIT_DEFS, STRUCT_DEFS, BUILD_MENU, WORKER_OF,
  createUnitMesh, createStructureMesh, attachBar, attachRing, counterMult,
} from './units.js';
import { createGoldNode, createStoneNode } from './monuments.js';

let NEXT_ID = 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Game {
  constructor({ scene, terrain, camera, renderer, playerFaction = 'inca', ui }) {
    this.scene = scene;
    this.terrain = terrain;
    this.camera = camera;
    this.renderer = renderer;
    this.ui = ui;

    this.playerFaction = playerFaction;
    this.enemyFaction = OTHER[playerFaction];

    this.units = [];
    this.structures = [];
    this.nodes = [];
    this.projectiles = [];
    this.effects = [];

    this.res = { oro: CFG.START.oro, piedra: CFG.START.piedra, inti: CFG.START.inti };
    this.aiRes = { oro: CFG.START.oro, piedra: CFG.START.piedra, inti: CFG.START.inti };

    this.pop = 0;
    this.popCap = CFG.POP_CAP;

    this.selection = [];
    this.wave = 0;
    this.waveTimer = CFG.WAVE_FIRST;
    this.aiTrainTimer = 12;
    this.aiBuildTimer = 40;
    this.time = 0;
    this.over = false;
    this.started = false;

    this.placing = null;
    this.ghost = null;
    this.blessCd = 0;
    this.income = { oro: 0, piedra: 0, inti: 0 };

    this.raycaster = new THREE.Raycaster();
    this.onLog = () => {};
    this.onFocus = () => {};
    this.camTarget = null;

    this._initWorld();
  }

  /* =========================================================
     MUNDO INICIAL
     ========================================================= */
  _initWorld() {
    const T = this.terrain;
    const pCell = T.playerBaseCell;
    const eCell = T.enemyBaseCell;
    const pPos = T.cellCenter(pCell.i, pCell.j);
    const ePos = T.cellCenter(eCell.i, eCell.j);

    const P = this.playerFaction;
    const E = this.enemyFaction;

    const baseOf = { inca: 'coricancha', maya: 'piramide' };
    const workerOf = WORKER_OF;
    const meleeOf = { inca: 'chakana', maya: 'jaguar' };
    const rangedOf = { inca: 'hondero', maya: 'arquero' };

    this.playerBase = this.addStructure(baseOf[P], P, pPos, true);
    this.enemyBase = this.addStructure(baseOf[E], E, ePos, true);

    // tropas y aldeanos iniciales
    const spawnAround = (center, faction, list) => {
      list.forEach(([type, dx, dz]) => {
        const p = T.cellCenter(center.i + dx, center.j + dz);
        this.addUnit(type, faction, p);
      });
    };

    spawnAround(pCell, P, [
      [workerOf[P], -2, 3], [workerOf[P], 0, 4], [workerOf[P], 2, 4], [workerOf[P], 4, 3],
      [meleeOf[P], -4, 1], [meleeOf[P], -1, 1], [meleeOf[P], 2, 1], [rangedOf[P], 5, 1],
    ]);
    spawnAround(eCell, E, [
      [workerOf[E], -2, -3], [workerOf[E], 0, -4], [workerOf[E], 2, -3],
      [meleeOf[E], -4, -1], [meleeOf[E], 0, -2], [rangedOf[E], 3, -1],
    ]);

    // yacimientos: dos vetas de oro y una cantera por zona, más el centro
    const node = (kind, i, j) => this.addNode(kind, T.cellCenter(i, j));
    node('oro', pCell.i - 7, pCell.j - 6);
    node('oro', pCell.i + 9, pCell.j - 7);
    node('piedra', pCell.i - 9, pCell.j + 4);
    node('piedra', pCell.i + 6, pCell.j + 8);

    node('oro', eCell.i + 7, eCell.j + 6);
    node('oro', eCell.i - 9, eCell.j + 7);
    node('piedra', eCell.i + 9, eCell.j - 4);
    node('piedra', eCell.i - 6, eCell.j - 8);

    node('oro', 24, 24);
    node('oro', 20, 30);
    node('piedra', 30, 20);
  }

  /* =========================================================
     FÁBRICAS
     ========================================================= */
  addUnit(type, faction, pos) {
    const def = UNIT_DEFS[type];
    if (!def) return null;

    const mesh = createUnitMesh(type);
    const y = this.terrain.heightAtWorld(pos.x, pos.z);
    mesh.position.set(pos.x, y, pos.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);

    const u = {
      id: NEXT_ID++, kind: 'unit', type, def, faction,
      mesh, pos: new THREE.Vector3(pos.x, y, pos.z),
      hp: def.hp, maxHp: def.hp,
      moveTo: null, attackTarget: null, cd: Math.random() * 0.4,
      healCd: 1 + Math.random(), alive: true, radius: 0.45,
      bar: attachBar(mesh, faction === this.playerFaction ? COL.celeste : COL.enemy),
      ring: attachRing(mesh, FACTION[faction].ring, 0.6),
      bob: Math.random() * 6.28,
      // recolección
      carry: 0, carryType: null, node: null, gatherT: 0, manualNode: null,
    };
    u.bar.group.position.y = 1.7;
    this.units.push(u);
    if (faction === this.playerFaction) this.pop++;
    return u;
  }

  addStructure(type, faction, pos, instant = false) {
    const def = STRUCT_DEFS[type];
    if (!def) return null;

    const mesh = createStructureMesh(type);
    const y = this.terrain.heightAtWorld(pos.x, pos.z) - 0.18;
    mesh.position.set(pos.x, y, pos.z);
    this.scene.add(mesh);

    const s = {
      id: NEXT_ID++, kind: 'structure', type, def, faction,
      mesh, pos: new THREE.Vector3(pos.x, y, pos.z),
      hp: instant ? def.hp : Math.max(60, def.hp * 0.25),
      maxHp: def.hp,
      radius: def.radius,
      queue: [], rally: null, alive: true,
      buildLeft: instant ? 0 : (def.build || 8),
      towerCd: 0,
      bar: attachBar(mesh, faction === this.playerFaction ? COL.celeste : COL.enemy),
      ring: attachRing(mesh, FACTION[faction].ring, def.radius * 0.85),
    };
    s.bar.group.position.y = def.radius * 1.6 + 1.4;
    if (!instant) mesh.scale.setScalar(0.45);

    this.structures.push(s);
    return s;
  }

  addNode(kind, pos) {
    const mesh = kind === 'oro' ? createGoldNode() : createStoneNode();
    const y = this.terrain.heightAtWorld(pos.x, pos.z);
    mesh.position.set(pos.x, y, pos.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);

    const n = {
      id: NEXT_ID++, kind: 'node', type: kind, faction: 'neutral',
      mesh, pos: new THREE.Vector3(pos.x, y, pos.z),
      amount: CFG.NODE_AMOUNT, maxAmount: CFG.NODE_AMOUNT,
      radius: 2.2, alive: true,
    };
    this.nodes.push(n);
    return n;
  }

  /* =========================================================
     RECURSOS
     ========================================================= */
  canPay(cost = {}) {
    return (this.res.oro >= (cost.oro || 0))
      && (this.res.piedra >= (cost.piedra || 0))
      && (this.res.inti >= (cost.inti || 0));
  }

  pay(cost = {}) {
    this.res.oro -= cost.oro || 0;
    this.res.piedra -= cost.piedra || 0;
    this.res.inti -= cost.inti || 0;
  }

  refund(cost = {}) {
    this.res.oro += cost.oro || 0;
    this.res.piedra += cost.piedra || 0;
    this.res.inti += cost.inti || 0;
  }

  _poolOf(faction) {
    return faction === this.playerFaction ? this.res : this.aiRes;
  }

  /* =========================================================
     SELECCIÓN
     ========================================================= */
  pick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      if (h.object.userData.noPick) continue;
      let o = h.object;
      while (o) {
        if (o.userData.entity) return o.userData.entity;
        o = o.parent;
      }
      if (h.object === this.terrain.mesh || h.object === this.terrain.water) return null;
    }
    return null;
  }

  groundPoint(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.terrain.mesh, false)[0];
    if (hit) return hit.point.clone();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  setSelection(list) {
    this.selection.forEach((e) => { if (e.ring) e.ring.visible = false; });
    this.selection = list.filter(Boolean);
    this.selection.forEach((e) => { if (e.ring) e.ring.visible = true; });
    this.ui?.onSelectionChanged(this.selection);
  }

  selectEntity(e, additive = false) {
    if (!e) { if (!additive) this.setSelection([]); return; }
    if (additive) {
      const i = this.selection.indexOf(e);
      if (i >= 0) this.setSelection(this.selection.filter((x) => x !== e));
      else this.setSelection([...this.selection, e]);
    } else this.setSelection([e]);
  }

  boxSelect(rect, additive = false) {
    const cam = this.camera;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const found = [];
    const v = new THREE.Vector3();

    for (const u of this.units) {
      if (!u.alive || u.faction !== this.playerFaction) continue;
      v.copy(u.pos); v.y += 0.9;
      v.project(cam);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2) found.push(u);
    }
    if (!found.length) {
      for (const s of this.structures) {
        if (!s.alive || s.faction !== this.playerFaction) continue;
        v.copy(s.pos); v.y += 2;
        v.project(cam);
        const sx = (v.x * 0.5 + 0.5) * w;
        const sy = (-v.y * 0.5 + 0.5) * h;
        if (sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2) found.push(s);
      }
    }
    if (additive) {
      const merged = [...this.selection];
      found.forEach((f) => { if (!merged.includes(f)) merged.push(f); });
      this.setSelection(merged);
    } else this.setSelection(found);
    return found.length;
  }

  get selectedUnits() { return this.selection.filter((e) => e.kind === 'unit'); }
  get selectedStructures() { return this.selection.filter((e) => e.kind === 'structure'); }

  /** Edificio que entrena con la selección actual. */
  get trainingBuilding() {
    return this.selection.find(
      (e) => e.kind === 'structure' && e.def.trains && e.faction === this.playerFaction
    ) || null;
  }

  /* =========================================================
     ÓRDENES
     ========================================================= */
  orderAt(ndc) {
    const target = this.pick(ndc);
    const units = this.selectedUnits;
    const buildings = this.selectedStructures;

    // recolectar
    if (target && target.kind === 'node' && units.length) {
      const workers = units.filter((u) => u.def.cls === 'worker');
      if (workers.length) {
        workers.forEach((u) => {
          u.node = target; u.manualNode = target; u.attackTarget = null;
          u.carry = 0; u.moveTo = { x: target.pos.x, z: target.pos.z };
        });
        this._ping(target.pos, COL.gold);
        this.ui?.toast(`Recolectando ${target.type === 'oro' ? 'oro' : 'piedra'}`);
        return true;
      }
    }

    // atacar
    if (target && target.faction === this.enemyFaction && target.alive) {
      units.forEach((u) => { u.attackTarget = target; u.moveTo = null; u.node = null; });
      if (units.length) this._ping(target.pos, 0xff5c7a);
      return true;
    }

    const p = this.groundPoint(ndc);
    if (!p) return false;

    if (units.length) {
      const n = units.length;
      const cols = Math.ceil(Math.sqrt(n));
      const gap = 1.6;
      units.forEach((u, i) => {
        const cx = (i % cols) - (cols - 1) / 2;
        const cz = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
        u.moveTo = {
          x: clamp(p.x + cx * gap, -this.terrain.half + 3, this.terrain.half - 3),
          z: clamp(p.z + cz * gap, -this.terrain.half + 3, this.terrain.half - 3),
        };
        u.attackTarget = null;
        u.node = null; u.manualNode = null;
      });
      this._ping(p, COL.celeste);
      return true;
    }

    if (buildings.length) {
      buildings.forEach((s) => { s.rally = { x: p.x, z: p.z }; });
      this._ping(p, COL.gold);
      return true;
    }
    return false;
  }

  /* =========================================================
     ENTRENAMIENTO
     ========================================================= */
  train(type) {
    const b = this.trainingBuilding;
    if (!b) return this.ui?.toast('Selecciona un centro urbano o cuartel');
    if (!b.def.trains.includes(type)) return;
    const def = UNIT_DEFS[type];
    if (b.queue.length >= 5) return this.ui?.toast('Cola llena');
    if (this.pop >= this.popCap) return this.ui?.toast('Límite de hueste alcanzado');
    if (!this.canPay(def.cost)) return this.ui?.toast('Recursos insuficientes');

    this.pay(def.cost);
    b.queue.push({ type, left: def.time, total: def.time });
    this.ui?.refresh();
  }

  cancelQueue(index) {
    const b = this.trainingBuilding;
    if (!b || !b.queue[index]) return;
    this.refund(UNIT_DEFS[b.queue[index].type].cost);
    b.queue.splice(index, 1);
    this.ui?.refresh();
  }

  upgradePop() {
    if (this.popCap >= CFG.POP_MAX) return this.ui?.toast('Población máxima alcanzada');
    if (!this.canPay(CFG.POP_UP_COST)) return this.ui?.toast('Recursos insuficientes');
    this.pay(CFG.POP_UP_COST);
    this.popCap += CFG.POP_STEP;
    this._ring(this.playerBase.pos, COL.celeste, 6);
    this.onLog(`Hueste ampliada a ${this.popCap}`, 'good');
    this.ui?.refresh();
  }

  /* =========================================================
     CONSTRUCCIÓN
     ========================================================= */
  beginPlace(type) {
    const def = STRUCT_DEFS[type];
    if (!def || !def.cost) return;
    if (!this.canPay(def.cost)) return this.ui?.toast('Recursos insuficientes');
    this.cancelPlace();

    const geo = new THREE.CylinderGeometry(def.radius * 0.85, def.radius * 0.85, 1.2, 12);
    const material = new THREE.MeshBasicMaterial({
      color: COL.celeste, transparent: true, opacity: 0.28, depthWrite: false,
    });
    this.ghost = new THREE.Mesh(geo, material);
    this.ghost.userData.noPick = true;
    this.scene.add(this.ghost);
    this.placing = { type, def, valid: false };
    this.ui?.toast('Toca una celda libre cerca de tus edificios');
  }

  updateGhost(ndc) {
    if (!this.placing || !this.ghost) return;
    const p = this.groundPoint(ndc);
    if (!p) return;
    const cell = this.terrain.cellOf(p.x, p.z);
    const c = this.terrain.cellCenter(cell.i, cell.j);
    this.ghost.position.set(c.x, c.y + 0.6, c.z);
    this.placing.cell = cell;
    this.placing.valid = this._canPlaceAt(cell, this.placing.def);
    this.ghost.material.color.setHex(this.placing.valid ? COL.celeste : 0xff5c7a);
    this.ghost.material.opacity = this.placing.valid ? 0.32 : 0.24;
  }

  _canPlaceAt(cell, def) {
    if (!this.terrain.isWalkableCell(cell.i, cell.j)) return false;
    const c = this.terrain.cellCenter(cell.i, cell.j);
    for (const s of this.structures) {
      if (!s.alive) continue;
      if (dist2(c, s.pos) < s.radius + def.radius * 0.55) return false;
    }
    for (const n of this.nodes) {
      if (!n.alive) continue;
      if (dist2(c, n.pos) < n.radius + def.radius * 0.6) return false;
    }
    for (const s of this.structures) {
      if (s.alive && s.faction === this.playerFaction && dist2(c, s.pos) < 24) return true;
    }
    return false;
  }

  confirmPlace() {
    if (!this.placing) return false;
    if (!this.placing.valid) { this.ui?.toast('No se puede construir ahí'); return false; }
    const { type, def, cell } = this.placing;
    if (!this.canPay(def.cost)) { this.ui?.toast('Recursos insuficientes'); return false; }
    this.pay(def.cost);
    const c = this.terrain.cellCenter(cell.i, cell.j);
    const s = this.addStructure(type, this.playerFaction, c, false);
    this.cancelPlace();
    this.setSelection([s]);
    this.onLog(`${def.name} en construcción`, 'good');
    return true;
  }

  cancelPlace() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.geometry.dispose();
      this.ghost.material.dispose();
      this.ghost = null;
    }
    this.placing = null;
    this.ui?.refresh();
  }

  /* =========================================================
     HABILIDAD ESPECIAL
     ========================================================= */
  castBlessing() {
    const priestCls = 'special';
    const priests = this.selectedUnits.filter((u) => u.def.cls === priestCls && u.alive);
    if (!priests.length) return this.ui?.toast('Selecciona un sacerdote');
    if (this.blessCd > 0) return this.ui?.toast(`Recarga en ${Math.ceil(this.blessCd)}s`);
    if (this.res.inti < 30) return this.ui?.toast('Necesitas 30 de Inti');

    this.res.inti -= 30;
    this.blessCd = 18;
    const center = priests[0].pos;
    let healed = 0;
    for (const u of this.units) {
      if (!u.alive || u.faction !== this.playerFaction) continue;
      if (dist2(u.pos, center) <= 8.5) { u.hp = Math.min(u.maxHp, u.hp + 65); healed++; }
    }
    this._ring(center, COL.celeste, 8.5);
    this.onLog(`Liturgia solar: ${healed} guerreros restaurados`, 'good');
    this.ui?.refresh();
  }

  /* =========================================================
     EFECTOS
     ========================================================= */
  _ping(pos, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.75, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, this.terrain.heightAtWorld(pos.x, pos.z) + 0.12, pos.z);
    this.scene.add(ring);
    this.effects.push({ mesh: ring, life: 0.6, total: 0.6, grow: 2.6 });
  }

  _ring(pos, color, radius) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.2, radius * 0.3, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, this.terrain.heightAtWorld(pos.x, pos.z) + 0.15, pos.z);
    this.scene.add(ring);
    this.effects.push({ mesh: ring, life: 1.0, total: 1.0, grow: radius * 3.2 });
  }

  _hitSpark(pos, color = COL.celeste) {
    const s = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    s.position.copy(pos);
    s.position.y += 1.1;
    this.scene.add(s);
    this.effects.push({ mesh: s, life: 0.28, total: 0.28, grow: 1.6, spark: true });
  }

  /* =========================================================
     COMBATE
     ========================================================= */
  /** Daño con bonus de clase y mitigación por defensa. */
  damageOf(attacker, target) {
    const atk = attacker.def.atk;
    const def = target.def.def || 0;
    let mult = 1;
    if (target.kind === 'structure') mult = attacker.def.cls === 'special' ? 1.5 : 1;
    else mult = counterMult(attacker.def.cls, target.def.cls);
    return Math.max(2, Math.round(atk * mult - def * 0.5));
  }

  _dealDamage(attacker, target) {
    const dmg = this.damageOf(attacker, target);
    const ranged = attacker.def.range > 3;
    if (ranged) {
      const origin = attacker.pos.clone();
      origin.y += 1.35;
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.13, 0),
        new THREE.MeshBasicMaterial({ color: attacker.faction === this.playerFaction ? COL.celeste : COL.enemy })
      );
      m.position.copy(origin);
      this.scene.add(m);
      this.projectiles.push({ mesh: m, target, dmg, speed: 24, faction: attacker.faction, pos: origin.clone() });
    } else {
      this._applyDamage(target, dmg);
      this._hitSpark(target.pos, attacker.faction === this.playerFaction ? COL.celeste : 0xff9db0);
    }
  }

  _applyDamage(target, dmg) {
    if (!target.alive) return;
    target.hp -= dmg;
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.kind === 'unit') this._killUnit(target);
      else this._killStructure(target);
    }
  }

  _killUnit(u) {
    u.alive = false;
    this.scene.remove(u.mesh);
    this._disposeTree(u.mesh);
    if (u.faction === this.playerFaction) this.pop = Math.max(0, this.pop - 1);
    this.selection = this.selection.filter((e) => e !== u);
    this._hitSpark(u.pos, 0x9fb4c9);
  }

  _killStructure(s) {
    s.alive = false;
    this.scene.remove(s.mesh);
    this._disposeTree(s.mesh);
    this.selection = this.selection.filter((e) => e !== s);
    this._ring(s.pos, 0xff5c7a, s.radius);

    if (s === this.enemyBase || s.type === 'piramide' || s.type === 'coricancha') {
      const isEnemyBase = s.faction === this.enemyFaction;
      if (isEnemyBase) { this.onLog('El centro urbano enemigo ha caído.', 'good'); this._end(true); }
      else { this.onLog('Tu centro urbano ha caído.', 'bad'); this._end(false); }
    } else if (s.faction === this.playerFaction) {
      this.onLog(`${s.def.name} destruido`, 'bad');
    }
  }

  _disposeTree(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }

  _end(victory) {
    if (this.over) return;
    this.over = true;
    this.victory = victory;
    this.ui?.showEnd(victory);
  }

  /* =========================================================
     RECOLECCIÓN
     ========================================================= */
  _nearestNode(pos, kind = null, from = null) {
    let best = null, bd = 1e9;
    for (const n of this.nodes) {
      if (!n.alive || n.amount <= 0) continue;
      if (kind && n.type !== kind) continue;
      const d = dist2(pos, n.pos);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  _nearestDepot(pos, faction) {
    let best = null, bd = 1e9;
    for (const s of this.structures) {
      if (!s.alive || s.faction !== faction || !s.def.depot) continue;
      const d = dist2(pos, s.pos);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  _updateWorker(u, dt) {
    // llevar carga al centro urbano
    if (u.carry >= CFG.CARRY_CAP) {
      const depot = this._nearestDepot(u.pos, u.faction);
      if (!depot) return;
      if (dist2(u.pos, depot.pos) > depot.radius + 1.2) {
        u.moveTo = { x: depot.pos.x, z: depot.pos.z };
        this._move(u, dt);
        return;
      }
      u.moveTo = null;
      const pool = this._poolOf(u.faction);
      pool[u.carryType] += u.carry;
      if (u.faction === this.playerFaction) {
        this.ui?.floatRes(u.carryType, u.carry);
      }
      u.carry = 0;
      return;
    }

    // elegir yacimiento
    if (!u.node || !u.node.alive || u.node.amount <= 0) {
      u.node = u.manualNode && u.manualNode.alive ? u.manualNode : this._nearestNode(u.pos);
      u.manualNode = u.node;
      if (!u.node) return;
    }

    const d = dist2(u.pos, u.node.pos);
    if (d > u.node.radius + 1.5) {
      u.moveTo = { x: u.node.pos.x, z: u.node.pos.z };
      this._move(u, dt);
      return;
    }

    u.moveTo = null;
    u.carryType = u.node.type;
    const got = Math.min(CFG.GATHER_RATE * dt, u.node.amount, CFG.CARRY_CAP - u.carry);
    u.carry += got;
    u.node.amount -= got;

    // el yacimiento se agota
    const ratio = u.node.amount / u.node.maxAmount;
    u.node.mesh.scale.setScalar(0.35 + 0.65 * ratio);
    if (u.node.amount <= 0) {
      u.node.alive = false;
      this.scene.remove(u.node.mesh);
      this._disposeTree(u.node.mesh);
      if (u.faction === this.playerFaction) this.onLog('Un yacimiento se ha agotado', 'warn');
      u.node = null;
      u.manualNode = null;
    }
  }

  /* =========================================================
     IA
     ========================================================= */
  _updateAI(dt) {
    const E = this.enemyFaction;
    if (!this.enemyBase || !this.enemyBase.alive) return;

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = CFG.WAVE_EVERY;
      this.wave++;
      this._spawnWave();
    }

    this.aiTrainTimer -= dt;
    if (this.aiTrainTimer <= 0) {
      this.aiTrainTimer = 13;
      this._aiTrain();
    }

    this.aiBuildTimer -= dt;
    if (this.aiBuildTimer <= 0) {
      this.aiBuildTimer = 55;
      this._aiBuild();
    }
  }

  _aiStructures() {
    return this.structures.filter((s) => s.alive && s.faction === this.enemyFaction);
  }

  _aiTrain() {
    const E = this.enemyFaction;
    const pool = this.aiRes;
    const alive = this.units.filter((u) => u.alive && u.faction === E);
    if (alive.length >= CFG.ENEMY_MAX) return;

    const workers = alive.filter((u) => u.def.cls === 'worker').length;
    const base = this.enemyBase;
    const barracks = this._aiStructures().find((s) => s.def.trains && s.def.trains.length && s.def.trains[0] !== WORKER_OF[E]);
    const temple = this._aiStructures().find((s) => s.def.id === 'templo_inca' || s.def.id === 'observatorio');

    const afford = (c) => pool.oro >= (c.oro || 0) && pool.piedra >= (c.piedra || 0) && pool.inti >= (c.inti || 0);
    const spend = (c) => { pool.oro -= c.oro || 0; pool.piedra -= c.piedra || 0; pool.inti -= c.inti || 0; };

    // mantener economía
    if (workers < 6 && base && afford(UNIT_DEFS[WORKER_OF[E]].cost)) {
      spend(UNIT_DEFS[WORKER_OF[E]].cost);
      this._spawnAt(base, WORKER_OF[E]);
      return;
    }
    if (barracks) {
      const poolTypes = barracks.def.trains;
      const pick = poolTypes[Math.floor(Math.random() * poolTypes.length)];
      const def = UNIT_DEFS[pick];
      if (afford(def.cost)) { spend(def.cost); this._spawnAt(barracks, pick); return; }
    }
    if (temple && Math.random() < 0.4) {
      const pick = temple.def.trains[0];
      const def = UNIT_DEFS[pick];
      if (afford(def.cost)) { spend(def.cost); this._spawnAt(temple, pick); return; }
    }
  }

  _aiBuild() {
    const E = this.enemyFaction;
    const pool = this.aiRes;
    const mine = this._aiStructures();
    const hasBarracks = mine.some((s) => s.def.id === 'cuartel_maya' || s.def.id === 'cuartel_inca');
    const hasTemple = mine.some((s) => s.def.id === 'observatorio' || s.def.id === 'templo_inca');

    const order = !hasBarracks
      ? (E === 'maya' ? 'cuartel_maya' : 'cuartel_inca')
      : !hasTemple
        ? (E === 'maya' ? 'observatorio' : 'templo_inca')
        : (E === 'maya' ? 'atalaya' : 'torre_inca');

    const def = STRUCT_DEFS[order];
    if (pool.oro < def.cost.oro || pool.piedra < def.cost.piedra) return;

    const base = this.enemyBase;
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 6;
      const x = this.terrain.clampToMap(base.pos.x + Math.cos(ang) * r);
      const z = this.terrain.clampToMap(base.pos.z + Math.sin(ang) * r);
      const cell = this.terrain.cellOf(x, z);
      if (!this.terrain.isWalkableCell(cell.i, cell.j)) continue;
      let free = true;
      for (const s of this.structures) {
        if (s.alive && dist2({ x, z }, s.pos) < s.radius + def.radius) { free = false; break; }
      }
      if (!free) continue;
      pool.oro -= def.cost.oro; pool.piedra -= def.cost.piedra;
      this.addStructure(order, E, { x, z }, true);
      return;
    }
  }

  _spawnAt(building, type) {
    const ang = Math.random() * Math.PI * 2;
    const r = building.radius + 1.5 + Math.random() * 2;
    const x = this.terrain.clampToMap(building.pos.x + Math.cos(ang) * r);
    const z = this.terrain.clampToMap(building.pos.z + Math.sin(ang) * r);
    const u = this.addUnit(type, building.faction, { x, z });
    if (u && u.def.cls !== 'worker') this._assignEnemyOrder(u);
    return u;
  }

  _spawnWave() {
    const E = this.enemyFaction;
    const alive = this.units.filter((u) => u.alive && u.faction === E && u.def.cls !== 'worker').length;
    const room = Math.max(0, CFG.ENEMY_MAX - alive);
    const count = Math.min(room, 2 + Math.floor(this.wave * 0.7));
    if (count <= 0) return;

    const barracks = this._aiStructures().find((s) => s.def.trains && s.def.trains[0] !== WORKER_OF[E]);
    const types = barracks ? barracks.def.trains.slice() : (E === 'maya' ? ['jaguar', 'arquero'] : ['chakana', 'hondero']);
    if (this.wave >= 3 && this._aiStructures().some((s) => s.def.id === 'observatorio' || s.def.id === 'templo_inca')) {
      types.push(E === 'maya' ? 'chaman' : 'willaq');
    }

    for (let i = 0; i < count; i++) {
      this._spawnAt(this.enemyBase, types[Math.floor(Math.random() * types.length)]);
    }
    this.onLog(`Oleada ${this.wave}: ${count} tropas ${FACTION[E].short} avanzan`, 'warn');
    this.ui?.toast(`¡Oleada ${this.wave}!`);
  }

  _assignEnemyOrder(u) {
    let best = null, bd = 1e9;
    for (const t of this.units) {
      if (!t.alive || t.faction !== this.playerFaction) continue;
      const d = dist2(u.pos, t.pos);
      if (d < bd) { bd = d; best = t; }
    }
    if (best && bd < 18) { u.attackTarget = best; return; }
    const target = this.playerBase.alive ? this.playerBase : this._nearestPlayerStructure(u.pos);
    if (target) {
      u.moveTo = {
        x: target.pos.x + (Math.random() - 0.5) * 8,
        z: target.pos.z + (Math.random() - 0.5) * 8,
      };
    }
  }

  _nearestPlayerStructure(pos) {
    let best = null, bd = 1e9;
    for (const s of this.structures) {
      if (!s.alive || s.faction !== this.playerFaction) continue;
      const d = dist2(pos, s.pos);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /* =========================================================
     BUCLE
     ========================================================= */
  update(dt, camera) {
    if (!this.started) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.blessCd > 0) this.blessCd = Math.max(0, this.blessCd - dt);

    // ingreso pasivo (templos)
    let intiRate = 0;
    for (const s of this.structures) {
      if (!s.alive || s.buildLeft > 0) continue;
      if (s.def.inti && s.faction === this.playerFaction) intiRate += s.def.inti;
    }
    this.res.inti += intiRate * dt;
    this.income = { oro: 0, piedra: 0, inti: intiRate };

    // estructuras
    for (const s of this.structures) {
      if (!s.alive) continue;

      if (s.buildLeft > 0) {
        s.buildLeft = Math.max(0, s.buildLeft - dt);
        const k = 1 - s.buildLeft / (s.def.build || 8);
        s.mesh.scale.setScalar(0.45 + 0.55 * k);
        s.hp = Math.min(s.maxHp, s.hp + (s.maxHp * 0.7) / (s.def.build || 8) * dt);
        if (s.buildLeft === 0) {
          s.mesh.scale.setScalar(1);
          if (s.faction === this.playerFaction) this.onLog(`${s.def.name} operativo`, 'good');
        }
      }

      // torres
      if (s.def.tower && s.buildLeft === 0) {
        s.towerCd -= dt;
        if (s.towerCd <= 0) {
          const t = this._towerTarget(s);
          if (t) {
            s.towerCd = s.def.tower.cd;
            this._applyDamage(t, s.def.tower.dmg);
            const origin = s.pos.clone(); origin.y += 5;
            const m = new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.14, 0),
              new THREE.MeshBasicMaterial({ color: s.faction === this.playerFaction ? COL.celeste : COL.enemy })
            );
            m.position.copy(origin);
            this.scene.add(m);
            this.projectiles.push({
              mesh: m, target: t, dmg: 0, speed: 30, faction: s.faction, pos: origin.clone(), visualOnly: true,
            });
          }
        }
      }

      // cola de entrenamiento
      if (s.queue.length) {
        const job = s.queue[0];
        job.left -= dt;
        if (job.left <= 0) {
          s.queue.shift();
          const rally = s.rally || { x: s.pos.x, z: s.pos.z + 5 };
          const p = this._freeSpotNear(rally);
          const u = this.addUnit(job.type, s.faction, p);
          if (u) {
            u.moveTo = { x: rally.x, z: rally.z };
            if (u.def.cls !== 'worker') this.onLog(`${u.def.name} listo`, 'good');
          }
          this.ui?.refresh();
        }
      }
    }

    if (!this.over) this._updateAI(dt);

    // unidades
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.def.cls === 'worker') this._updateWorker(u, dt);
      else this._updateUnit(u, dt);
    }

    // separación
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d > 0.0001 && d < min) {
          const push = (min - d) / 2;
          a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
          a.pos.y = this.terrain.heightAtWorld(a.pos.x, a.pos.z);
          b.pos.y = this.terrain.heightAtWorld(b.pos.x, b.pos.z);
        }
      }
    }

    // proyectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (!pr.target.alive) { this.scene.remove(pr.mesh); this.projectiles.splice(i, 1); continue; }
      const tPos = pr.target.pos.clone();
      tPos.y += pr.target.kind === 'unit' ? 1.1 : 2.2;
      const dir = tPos.clone().sub(pr.pos);
      const d = dir.length();
      const step = pr.speed * dt;
      if (d <= step) {
        if (!pr.visualOnly) {
          this._applyDamage(pr.target, pr.dmg);
          this._hitSpark(pr.target.pos, pr.faction === this.playerFaction ? COL.celeste : 0xff9db0);
        }
        this.scene.remove(pr.mesh);
        pr.mesh.geometry.dispose();
        pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      } else {
        dir.normalize();
        pr.pos.addScaledVector(dir, step);
        pr.mesh.position.copy(pr.pos);
      }
    }

    // efectos
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const k = 1 - e.life / e.total;
      e.mesh.scale.setScalar(1 + k * e.grow);
      e.mesh.material.opacity = Math.max(0, (e.spark ? 1 : 0.85) * (1 - k));
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }

    this.units = this.units.filter((u) => u.alive);
    this.structures = this.structures.filter((s) => s.alive);

    this._updateBars(camera);

    this.units.forEach((u) => { u.mesh.userData.entity = u; });
    this.structures.forEach((s) => { s.mesh.userData.entity = s; });
    this.nodes.forEach((n) => { if (n.alive) n.mesh.userData.entity = n; });
  }

  _towerTarget(s) {
    let best = null, bd = s.def.tower.range;
    for (const u of this.units) {
      if (!u.alive || u.faction === s.faction) continue;
      const d = dist2(u.pos, s.pos);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  _updateUnit(u, dt) {
    const t = u.attackTarget;
    if (t && !t.alive) u.attackTarget = null;

    if (!u.attackTarget) {
      const enemyFaction = u.faction === this.playerFaction ? this.enemyFaction : this.playerFaction;
      let best = null, bd = u.def.sight;
      for (const o of this.units) {
        if (!o.alive || o.faction !== enemyFaction) continue;
        const d = dist2(u.pos, o.pos);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best && u.faction !== this.playerFaction) {
        for (const s of this.structures) {
          if (!s.alive || s.faction !== enemyFaction) continue;
          const d = dist2(u.pos, s.pos) - s.radius;
          if (d < Math.min(bd, 6)) { best = s; bd = d; }
        }
      }
      if (best) u.attackTarget = best;
    }

    if (u.attackTarget) {
      const target = u.attackTarget;
      const reach = u.def.range + (target.kind === 'structure' ? Math.min(target.radius * 0.6, 4) : 0);
      const d = dist2(u.pos, target.pos);
      if (d > reach) {
        u.moveTo = { x: target.pos.x, z: target.pos.z };
        this._move(u, dt);
      } else {
        u.moveTo = null;
        u.mesh.rotation.y = Math.atan2(target.pos.x - u.pos.x, target.pos.z - u.pos.z);
        u.cd -= dt;
        if (u.cd <= 0) {
          u.cd = u.def.cd;
          this._dealDamage(u, target);
        }
      }
    } else if (u.moveTo) {
      this._move(u, dt);
    }

    // curación
    if (u.def.heal) {
      u.healCd -= dt;
      if (u.healCd <= 0) {
        let target = null, bd = u.def.healRadius;
        for (const o of this.units) {
          if (!o.alive || o.faction !== u.faction || o === u) continue;
          if (o.hp >= o.maxHp) continue;
          const d = dist2(u.pos, o.pos);
          if (d < bd) { bd = d; target = o; }
        }
        if (target) {
          target.hp = Math.min(target.maxHp, target.hp + u.def.heal);
          u.healCd = 1.6;
          this._hitSpark(target.pos, u.faction === this.playerFaction ? COL.celeste : COL.jade);
        } else u.healCd = 0.6;
      }
    }

    const gy = this.terrain.heightAtWorld(u.pos.x, u.pos.z);
    u.pos.y += (gy - u.pos.y) * Math.min(1, dt * 12);
    u.bob += dt * (u.moveTo ? 9 : 2.2);
    const bobY = u.moveTo ? Math.abs(Math.sin(u.bob)) * 0.06 : Math.sin(u.bob) * 0.02;
    u.mesh.position.set(u.pos.x, u.pos.y + bobY, u.pos.z);
  }

  _move(u, dt) {
    const dx = u.moveTo.x - u.pos.x;
    const dz = u.moveTo.z - u.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) { u.moveTo = null; return; }

    const sp = u.def.speed * dt;
    const nx0 = u.pos.x + (dx / d) * sp;
    const nz0 = u.pos.z + (dz / d) * sp;
    let nx = nx0, nz = nz0;

    if (!this.terrain.isWalkableWorld(nx, nz)) {
      if (this.terrain.isWalkableWorld(nx0, u.pos.z)) nz = u.pos.z;
      else if (this.terrain.isWalkableWorld(u.pos.x, nz0)) nx = u.pos.x;
      else {
        const perp = Math.atan2(dz, dx) + Math.PI / 2;
        const px = u.pos.x + Math.cos(perp) * sp;
        const pz = u.pos.z + Math.sin(perp) * sp;
        if (this.terrain.isWalkableWorld(px, pz)) { nx = px; nz = pz; }
        else { u.moveTo = null; return; }
      }
    }

    for (const s of this.structures) {
      if (!s.alive) continue;
      const dd = Math.hypot(nx - s.pos.x, nz - s.pos.z);
      const minD = s.radius * 0.72 + u.radius;
      if (dd < minD && dd > 0.001) {
        const k = minD - dd;
        nx += ((nx - s.pos.x) / dd) * k;
        nz += ((nz - s.pos.z) / dd) * k;
      }
    }

    nx = this.terrain.clampToMap(nx);
    nz = this.terrain.clampToMap(nz);
    u.pos.x = nx;
    u.pos.z = nz;
    u.mesh.rotation.y = Math.atan2(dx, dz);
  }

  _freeSpotNear(p) {
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 4.5;
      const x = this.terrain.clampToMap(p.x + Math.cos(ang) * r);
      const z = this.terrain.clampToMap(p.z + Math.sin(ang) * r);
      if (!this.terrain.isWalkableWorld(x, z)) continue;
      let blocked = false;
      for (const s of this.structures) {
        if (s.alive && Math.hypot(x - s.pos.x, z - s.pos.z) < s.radius * 0.8) { blocked = true; break; }
      }
      if (!blocked) return new THREE.Vector3(x, this.terrain.heightAtWorld(x, z), z);
    }
    return new THREE.Vector3(p.x, this.terrain.heightAtWorld(p.x, p.z), p.z);
  }

  _updateBars(camera) {
    const q = new THREE.Quaternion();
    const update = (e) => {
      if (!e.bar) return;
      const ratio = clamp(e.hp / e.maxHp, 0, 1);
      e.bar.fill.scale.x = Math.max(0.001, ratio);
      e.bar.fill.position.x = -((1 - ratio) * e.bar.width) / 2;
      e.bar.fill.material.color.setHex(
        ratio > 0.55 ? (e.faction === this.playerFaction ? COL.celeste : COL.enemy)
          : ratio > 0.25 ? 0xffd166 : 0xff5c7a
      );
      q.copy(e.mesh.quaternion).invert().multiply(camera.quaternion);
      e.bar.group.quaternion.copy(q);
      e.bar.group.visible = !(e.kind === 'structure' && e.hp >= e.maxHp);
    };
    this.units.forEach(update);
    this.structures.forEach(update);
  }
}
