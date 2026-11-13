/* ============================================================
   Núcleo de simulación RTS
   ============================================================ */
import * as THREE from 'three';
import { CFG, COL, FACTION } from './config.js';
import {
  UNIT_DEFS, STRUCT_DEFS, createUnitMesh, createStructureMesh, attachBar, attachRing,
} from './units.js';

let NEXT_ID = 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Game {
  constructor({ scene, terrain, camera, renderer, ui }) {
    this.scene = scene;
    this.terrain = terrain;
    this.camera = camera;
    this.renderer = renderer;
    this.ui = ui;

    this.units = [];
    this.structures = [];
    this.projectiles = [];
    this.effects = [];

    this.res = { oro: CFG.START_ORO, inti: CFG.START_INTI };
    this.pop = 0;
    this.basePopCap = CFG.POP_CAP;

    this.selection = [];
    this.wave = 0;
    this.waveTimer = CFG.WAVE_FIRST;
    this.aiTrainTimer = 14;
    this.time = 0;
    this.over = false;
    this.started = false;

    this.placing = null;
    this.ghost = null;
    this.blessCd = 0;

    this.raycaster = new THREE.Raycaster();
    this.onLog = () => {};
    this.onFocus = () => {};

    this._initWorld();
  }

  /* =========================================================
     INICIALIZACIÓN DEL MUNDO
     ========================================================= */
  _initWorld() {
    const T = this.terrain;

    const pCell = T.playerBaseCell;
    const eCell = T.enemyBaseCell;
    const pPos = T.cellCenter(pCell.i, pCell.j);
    const ePos = T.cellCenter(eCell.i, eCell.j);

    this.playerBase = this.addStructure('coricancha', 'inca', pPos, true);
    this.enemyBase = this.addStructure('piramide', 'maya', ePos, true);

    // Fortaleza secundaria del jugador
    this.addStructure('sacsay', 'inca',
      T.cellCenter(pCell.i + 7, pCell.j - 5), true);

    // Terrazas iniciales
    this.addStructure('terraza', 'inca', T.cellCenter(pCell.i - 6, pCell.j - 2), true);
    this.addStructure('terraza', 'inca', T.cellCenter(pCell.i + 3, pCell.j + 6), true);

    // Juego de pelota maya (decorativo, destructible)
    this.addStructure('ballcourt', 'maya', T.cellCenter(eCell.i - 8, eCell.j + 7), true);

    // Unidades iniciales
    const start = [
      ['chakana', -2, 3], ['chakana', 0, 4], ['chakana', 2, 3],
      ['hondero', -4, 2], ['hondero', 4, 2], ['willaq', 0, 5],
    ];
    start.forEach(([type, dx, dz]) => {
      const p = T.cellCenter(pCell.i + dx, pCell.j + dz);
      this.addUnit(type, 'inca', p);
    });

    // Guarnición maya inicial
    [['jaguar', -3, -3], ['jaguar', 0, -4], ['atlatl', 3, -2]].forEach(([type, dx, dz]) => {
      const p = T.cellCenter(eCell.i + dx, eCell.j + dz);
      this.addUnit(type, 'maya', p);
    });

    this.popCap = this._computePopCap();
  }

  _computePopCap() {
    let cap = this.basePopCap;
    for (const s of this.structures) {
      if (s.alive && s.faction === 'inca' && s.def.popBonus) cap += s.def.popBonus;
    }
    return cap;
  }

  /* =========================================================
     FÁBRICAS DE ENTIDADES
     ========================================================= */
  addUnit(type, faction, pos) {
    const def = UNIT_DEFS[type];
    if (!def) return null;

    const mesh = createUnitMesh(type);
    const y = this.terrain.heightAtWorld(pos.x, pos.z);
    mesh.position.set(pos.x, y, pos.z);
    mesh.rotation.y = faction === 'inca' ? 0.4 : Math.PI + 0.4;
    this.scene.add(mesh);

    const u = {
      id: NEXT_ID++, kind: 'unit', type, def, faction,
      mesh, pos: new THREE.Vector3(pos.x, y, pos.z),
      hp: def.hp, maxHp: def.hp,
      moveTo: null, attackTarget: null, cd: Math.random() * 0.4,
      healCd: 1 + Math.random(), alive: true, radius: 0.45,
      bar: attachBar(mesh, faction === 'inca' ? COL.celeste : COL.enemy),
      ring: attachRing(mesh, FACTION[faction].ring, 0.6),
      bob: Math.random() * 6.28,
    };
    u.bar.group.position.y = 1.8;
    this.units.push(u);
    if (faction === 'inca') this.pop++;
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
      hp: instant ? def.hp : Math.max(60, def.hp * 0.3),
      maxHp: def.hp,
      radius: def.radius,
      queue: [], rally: null, alive: true,
      buildLeft: instant ? 0 : (def.build || 5),
      bar: attachBar(mesh, faction === 'inca' ? COL.celeste : COL.enemy),
      ring: attachRing(mesh, FACTION[faction].ring, def.radius * 0.85),
    };
    s.bar.group.position.y = (type === 'piramide' ? 12.5 : type === 'coricancha' ? 8.2 : type === 'sacsay' ? 9.5 : 5.4);
    if (!instant) mesh.scale.setScalar(0.45);

    this.structures.push(s);
    this.popCap = this._computePopCap();
    return s;
  }

  /* =========================================================
     RECURSOS
     ========================================================= */
  canPay(cost = {}) {
    return (this.res.oro >= (cost.oro || 0)) && (this.res.inti >= (cost.inti || 0));
  }

  pay(cost = {}) {
    this.res.oro -= cost.oro || 0;
    this.res.inti -= cost.inti || 0;
  }

  refund(cost = {}) {
    this.res.oro += cost.oro || 0;
    this.res.inti += cost.inti || 0;
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
      // si golpeamos terreno/agua, cortamos
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
      if (!u.alive || u.faction !== 'inca') continue;
      v.copy(u.pos); v.y += 0.9;
      v.project(cam);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx >= rect.x1 && sx <= rect.x2 && sy >= rect.y1 && sy <= rect.y2) found.push(u);
    }
    // estructuras propias si la caja es pequeña
    if (found.length === 0) {
      for (const s of this.structures) {
        if (!s.alive || s.faction !== 'inca') continue;
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

  selectAllOfType(type) {
    const list = this.units.filter((u) => u.alive && u.faction === 'inca' && u.type === type);
    if (list.length) this.setSelection(list);
  }

  /* =========================================================
     ÓRDENES
     ========================================================= */
  orderAt(ndc) {
    const target = this.pick(ndc);
    const selectedUnits = this.selection.filter((e) => e.kind === 'unit');
    const selectedBuildings = this.selection.filter((e) => e.kind === 'structure');

    // ¿clic sobre enemigo? -> atacar
    if (target && target.faction === 'maya' && target.alive) {
      selectedUnits.forEach((u) => { u.attackTarget = target; u.moveTo = null; });
      if (selectedUnits.length) this._ping(target.pos, 0xff5c7a);
      return true;
    }

    const p = this.groundPoint(ndc);
    if (!p) return false;

    if (selectedUnits.length) {
      // formación en rejilla alrededor del punto
      const n = selectedUnits.length;
      const cols = Math.ceil(Math.sqrt(n));
      const gap = 1.5;
      selectedUnits.forEach((u, i) => {
        const cx = (i % cols) - (cols - 1) / 2;
        const cz = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
        const tx = clamp(p.x + cx * gap, -this.terrain.half + 3, this.terrain.half - 3);
        const tz = clamp(p.z + cz * gap, -this.terrain.half + 3, this.terrain.half - 3);
        u.moveTo = { x: tx, z: tz };
        u.attackTarget = null;
      });
      this._ping(p, COL.celeste);
      return true;
    }

    if (selectedBuildings.length) {
      selectedBuildings.forEach((s) => { s.rally = { x: p.x, z: p.z }; });
      this._ping(p, COL.gold);
      return true;
    }
    return false;
  }

  /* =========================================================
     ENTRENAMIENTO / CONSTRUCCIÓN
     ========================================================= */
  get trainingBuilding() {
    const s = this.selection.find((e) => e.kind === 'structure' && e.def.trains && e.faction === 'inca');
    return s || null;
  }

  train(type) {
    const b = this.trainingBuilding;
    if (!b) return this.ui?.toast('Selecciona el Coricancha para entrenar');
    if (!b.def.trains.includes(type)) return;
    const def = UNIT_DEFS[type];
    if (b.queue.length >= 5) return this.ui?.toast('Cola de entrenamiento llena');
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
    this.ui?.toast('Elige una celda libre cerca de tus estructuras');
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
    // debe estar cerca de una estructura aliada
    let near = false;
    for (const s of this.structures) {
      if (s.alive && s.faction === 'inca' && dist2(c, s.pos) < 22) { near = true; break; }
    }
    return near;
  }

  confirmPlace() {
    if (!this.placing || !this.placing.valid) {
      this.ui?.toast('No se puede construir ahí');
      return false;
    }
    const { type, def, cell } = this.placing;
    if (!this.canPay(def.cost)) { this.ui?.toast('Recursos insuficientes'); return false; }
    this.pay(def.cost);
    const c = this.terrain.cellCenter(cell.i, cell.j);
    const s = this.addStructure(type, 'inca', c, false);
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
     HABILIDAD: BENDICIÓN DEL WILLAQ UMU
     ========================================================= */
  castBlessing() {
    const priests = this.selection.filter((e) => e.kind === 'unit' && e.type === 'willaq' && e.alive);
    if (!priests.length) return this.ui?.toast('Selecciona un Willaq Umu');
    if (this.blessCd > 0) return this.ui?.toast(`La liturgia se recupera en ${Math.ceil(this.blessCd)}s`);
    if (this.res.inti < 30) return this.ui?.toast('Necesitas 30 de Inti');

    this.res.inti -= 30;
    this.blessCd = 18;
    const center = priests[0].pos;
    let healed = 0;
    for (const u of this.units) {
      if (!u.alive || u.faction !== 'inca') continue;
      if (dist2(u.pos, center) <= 8.5) {
        u.hp = Math.min(u.maxHp, u.hp + 65);
        healed++;
      }
    }
    this._ring(center, COL.celeste, 8.5);
    this.onLog(`Bendición del Sol: ${healed} guerreros restaurados`, 'good');
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
  _dealDamage(attacker, target) {
    const dmg = attacker.def.dmg;
    if (attacker.def.range > 3) {
      const origin = attacker.pos.clone();
      origin.y += 1.35;
      const geo = new THREE.IcosahedronGeometry(0.13, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: attacker.faction === 'inca' ? COL.celeste : COL.enemy,
      }));
      m.position.copy(origin);
      this.scene.add(m);
      this.projectiles.push({
        mesh: m, target, dmg, speed: 22, faction: attacker.faction,
        pos: origin.clone(),
      });
    } else {
      this._applyDamage(target, dmg);
      this._hitSpark(target.pos, attacker.faction === 'inca' ? COL.celeste : 0xff9db0);
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
    if (u.faction === 'inca') this.pop = Math.max(0, this.pop - 1);
    this.selection = this.selection.filter((e) => e !== u);
    this._hitSpark(u.pos, 0x9fb4c9);
  }

  _killStructure(s) {
    s.alive = false;
    this.scene.remove(s.mesh);
    this._disposeTree(s.mesh);
    this.selection = this.selection.filter((e) => e !== s);
    this._ring(s.pos, 0xff5c7a, s.radius);
    this.popCap = this._computePopCap();

    if (s.type === 'piramide') {
      this.onLog('La Pirámide de Kukulcán ha caído.', 'good');
      this._end(true);
    } else if (s.type === 'coricancha') {
      this.onLog('El Coricancha arde. El Sol se apaga.', 'bad');
      this._end(false);
    } else if (s.faction === 'inca') {
      this.onLog(`${s.def.name} destruido`, 'bad');
    }
    if (s.faction === 'inca' && s.def.popBonus) {
      while (this.pop > this.popCap) {
        const victim = this.units.find((u) => u.alive && u.faction === 'inca');
        if (!victim) break;
        this._killUnit(victim);
      }
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
     IA
     ========================================================= */
  _updateAI(dt) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = CFG.WAVE_EVERY;
      this.wave++;
      this._spawnWave();
    }

    this.aiTrainTimer -= dt;
    if (this.aiTrainTimer <= 0) {
      this.aiTrainTimer = 16;
      const enemies = this.units.filter((u) => u.alive && u.faction === 'maya').length;
      if (enemies < CFG.ENEMY_MAX && this.enemyBase.alive) {
        const pool = this.wave < 2 ? ['jaguar', 'jaguar', 'atlatl'] : ['jaguar', 'atlatl', 'ahkin'];
        this._spawnEnemy(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
  }

  _spawnWave() {
    const alive = this.units.filter((u) => u.alive && u.faction === 'maya').length;
    const room = Math.max(0, CFG.ENEMY_MAX - alive);
    const count = Math.min(room, 2 + Math.floor(this.wave * 0.7));
    if (count <= 0) return;
    const pool = ['jaguar', 'jaguar', 'atlatl'];
    if (this.wave >= 2) pool.push('ahkin');
    if (this.wave >= 3) pool.push('jaguar');

    for (let i = 0; i < count; i++) {
      this._spawnEnemy(pool[Math.floor(Math.random() * pool.length)]);
    }
    this.onLog(`Oleada ${this.wave}: ${count} mayas avanzan desde el este`, 'warn');
    this.ui?.toast(`¡Oleada ${this.wave}! ${count} unidades mayas`);
  }

  _spawnEnemy(type) {
    if (!this.enemyBase.alive) return;
    const b = this.enemyBase.pos;
    const ang = Math.random() * Math.PI * 2;
    const r = 7 + Math.random() * 3;
    const p = new THREE.Vector3(b.x + Math.cos(ang) * r, 0, b.z + Math.sin(ang) * r);
    p.x = this.terrain.clampToMap(p.x);
    p.z = this.terrain.clampToMap(p.z);
    const u = this.addUnit(type, 'maya', p);
    if (u) this._assignEnemyOrder(u);
  }

  _assignEnemyOrder(u) {
    // objetivo: unidad aliada cercana o la base del jugador
    let best = null, bd = 1e9;
    for (const t of this.units) {
      if (!t.alive || t.faction !== 'inca') continue;
      const d = dist2(u.pos, t.pos);
      if (d < bd) { bd = d; best = t; }
    }
    if (best && bd < 18) u.attackTarget = best;
    else {
      const target = this.playerBase.alive ? this.playerBase : this._nearestPlayerStructure(u.pos);
      if (target) {
        u.moveTo = {
          x: target.pos.x + (Math.random() - 0.5) * 8,
          z: target.pos.z + (Math.random() - 0.5) * 8,
        };
      }
    }
  }

  _nearestPlayerStructure(pos) {
    let best = null, bd = 1e9;
    for (const s of this.structures) {
      if (!s.alive || s.faction !== 'inca') continue;
      const d = dist2(pos, s.pos);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /* =========================================================
     BUCLE PRINCIPAL
     ========================================================= */
  update(dt, camera) {
    if (!this.started) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.blessCd > 0) this.blessCd = Math.max(0, this.blessCd - dt);

    // economía
    let oroRate = 0, intiRate = 0;
    for (const s of this.structures) {
      if (!s.alive || s.buildLeft > 0) continue;
      if (s.def.oro) oroRate += s.def.oro;
      if (s.def.inti) intiRate += s.def.inti;
    }
    this.res.oro += oroRate * dt;
    this.res.inti += intiRate * dt;
    this.income = { oro: oroRate, inti: intiRate };

    // estructuras
    for (const s of this.structures) {
      if (!s.alive) continue;
      if (s.buildLeft > 0) {
        s.buildLeft = Math.max(0, s.buildLeft - dt);
        const k = 1 - s.buildLeft / (s.def.build || 5);
        s.mesh.scale.setScalar(0.45 + 0.55 * k);
        s.hp = Math.min(s.maxHp, s.hp + (s.maxHp * 0.7) / (s.def.build || 5) * dt);
        if (s.buildLeft === 0) {
          s.mesh.scale.setScalar(1);
          this.onLog(`${s.def.name} operativo`, 'good');
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
            this.onLog(`${u.def.name} listo`, 'good');
          }
          this.ui?.refresh();
        }
      }
    }

    // IA
    if (!this.over) this._updateAI(dt);

    // unidades
    for (const u of this.units) {
      if (!u.alive) continue;
      this._updateUnit(u, dt);
    }

    // separación simple
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
          const nx = (dx / d) * push, nz = (dz / d) * push;
          a.pos.x -= nx; a.pos.z -= nz;
          b.pos.x += nx; b.pos.z += nz;
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
        this._applyDamage(pr.target, pr.dmg);
        this._hitSpark(pr.target.pos, pr.faction === 'inca' ? COL.celeste : 0xff9db0);
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
      if (e.spark) {
        e.mesh.scale.setScalar(1 + k * e.grow);
        e.mesh.material.opacity = Math.max(0, 1 - k);
      } else {
        e.mesh.scale.setScalar(1 + k * e.grow);
        e.mesh.material.opacity = Math.max(0, 0.85 * (1 - k));
      }
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }

    // limpiar muertos
    this.units = this.units.filter((u) => u.alive);
    this.structures = this.structures.filter((s) => s.alive);

    // barras de vida / billboard
    this._updateBars(camera);

    // asignar entidad a los objetos 3D para el picking
    this.units.forEach((u) => { u.mesh.userData.entity = u; });
    this.structures.forEach((s) => { s.mesh.userData.entity = s; });
  }

  _updateUnit(u, dt) {
    const t = u.attackTarget;
    if (t && !t.alive) u.attackTarget = null;

    // adquirir objetivo automáticamente
    if (!u.attackTarget) {
      const enemyFaction = u.faction === 'inca' ? 'maya' : 'inca';
      let best = null, bd = u.def.sight;
      for (const o of this.units) {
        if (!o.alive || o.faction !== enemyFaction) continue;
        const d = dist2(u.pos, o.pos);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best && u.faction === 'maya') {
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

    // curación de los sacerdotes
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
          this._hitSpark(target.pos, u.faction === 'inca' ? COL.celeste : COL.jade);
        } else u.healCd = 0.6;
      }
    }

    // reposo: volver al suelo
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
      // deslizar por ejes
      if (this.terrain.isWalkableWorld(nx0, u.pos.z)) { nz = u.pos.z; }
      else if (this.terrain.isWalkableWorld(u.pos.x, nz0)) { nx = u.pos.x; }
      else {
        // pequeño rodeo lateral
        const perp = Math.atan2(dz, dx) + Math.PI / 2;
        const px = u.pos.x + Math.cos(perp) * sp;
        const pz = u.pos.z + Math.sin(perp) * sp;
        if (this.terrain.isWalkableWorld(px, pz)) { nx = px; nz = pz; }
        else { u.moveTo = null; return; }
      }
    }

    // colisión con estructuras
    for (const s of this.structures) {
      if (!s.alive) continue;
      const dd = Math.hypot(nx - s.pos.x, nz - s.pos.z);
      const minD = s.radius * 0.72 + u.radius;
      if (dd < minD && dd > 0.001) {
        const k = (minD - dd);
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
        ratio > 0.55 ? (e.faction === 'inca' ? COL.celeste : COL.enemy)
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
