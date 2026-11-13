/* ============================================================
   Definiciones, clases de combate y mallas low-poly
   ============================================================ */
import * as THREE from 'three';
import { COL, FACTION } from './config.js';
import {
  createCoricancha, createSacsayhuaman, createSunTemple, createWatchtowerInca,
  createMayaPyramid, createBallCourt, createObservatory, createAtalaya,
} from './monuments.js';

/* ---------------- Clases y contraataques ---------------- */
export const CLS_LABEL = {
  worker: 'Recolector',
  melee: 'Infantería',
  ranged: 'Distancia',
  special: 'Especial',
};

/** Piedra-papel-tijera táctico: cada clase machaca a la siguiente. */
export const COUNTERS = { melee: 'ranged', ranged: 'special', special: 'melee' };

export function counterMult(attackerCls, targetCls) {
  return COUNTERS[attackerCls] === targetCls ? 1.5 : 1;
}

/* ---------------- Unidades ---------------- */
export const UNIT_DEFS = {
  /* --- Imperio Inca --- */
  aldeano_inca: {
    id: 'aldeano_inca', faction: 'inca', mesh: 'worker', name: 'Chasqui', cls: 'worker',
    role: 'Recolector · oro y piedra',
    hp: 60, atk: 5, def: 2, range: 1.6, cd: 1.2, speed: 3.7, sight: 7,
    cost: { oro: 50 }, time: 8, icon: 'worker', pop: 1,
    strong: 'Recursos', weak: 'Todas las tropas',
    lore: 'Corre con el quipu al hombro: abre la economía antes de que llegue la primera oleada.',
  },
  chakana: {
    id: 'chakana', faction: 'inca', mesh: 'chakana', name: 'Guerrero Chakana', cls: 'melee',
    role: 'Infantería · cuerpo a cuerpo',
    hp: 140, atk: 18, def: 12, range: 1.9, cd: 1.0, speed: 3.3, sight: 9,
    cost: { oro: 70, piedra: 20 }, time: 9, icon: 'shield', pop: 1,
    strong: 'Hondero / Arquero', weak: 'Willaq Umu / Élite',
    lore: 'Porta el escudo escalonado andino: aguanta la primera carga y abre la brecha.',
  },
  hondero: {
    id: 'hondero', faction: 'inca', mesh: 'hondero', name: 'Hondero Andino', cls: 'ranged',
    role: 'Distancia · hostigador',
    hp: 90, atk: 22, def: 5, range: 8.6, cd: 1.55, speed: 3.2, sight: 10,
    cost: { oro: 80, piedra: 15 }, time: 10, icon: 'sling', pop: 1,
    strong: 'Unidades especiales', weak: 'Infantería',
    lore: 'La honda de fibra de llama lanza piedras de río a sesenta pasos.',
  },
  willaq: {
    id: 'willaq', faction: 'inca', mesh: 'willaq', name: 'Willaq Umu', cls: 'special',
    role: 'Especial · sacerdote del Sol',
    hp: 110, atk: 28, def: 8, range: 6.4, cd: 1.9, speed: 2.9, sight: 9,
    cost: { oro: 90, inti: 40 }, time: 14, icon: 'sun', pop: 1,
    heal: 8, healRadius: 5.6,
    strong: 'Infantería pesada', weak: 'Arqueros / Honderos',
    lore: 'El que dice la palabra del Inca. Sana a los suyos y sostiene la línea con la liturgia del Sol.',
  },

  /* --- Civilización Maya --- */
  aldeano_maya: {
    id: 'aldeano_maya', faction: 'maya', mesh: 'worker', name: 'Aldeano Maya', cls: 'worker',
    role: 'Recolector · oro y piedra',
    hp: 60, atk: 5, def: 2, range: 1.6, cd: 1.2, speed: 3.6, sight: 7,
    cost: { oro: 50 }, time: 8, icon: 'worker', pop: 1,
    strong: 'Recursos', weak: 'Todas las tropas',
  },
  jaguar: {
    id: 'jaguar', faction: 'maya', mesh: 'jaguar', name: 'Guerrero Jaguar', cls: 'melee',
    role: 'Infantería rápida · asalto',
    hp: 130, atk: 21, def: 10, range: 1.9, cd: 0.95, speed: 3.5, sight: 9,
    cost: { oro: 70, piedra: 20 }, time: 9, icon: 'shield', pop: 1,
    strong: 'Hondero / Arquero', weak: 'Willaq Umu / Élite',
  },
  arquero: {
    id: 'arquero', faction: 'maya', mesh: 'arquero', name: 'Arquero de Obsidiana', cls: 'ranged',
    role: 'Distancia · arco de obsidiana',
    hp: 85, atk: 24, def: 4, range: 8.8, cd: 1.6, speed: 3.15, sight: 10,
    cost: { oro: 80, piedra: 15 }, time: 10, icon: 'sling', pop: 1,
    strong: 'Unidades especiales', weak: 'Infantería',
  },
  chaman: {
    id: 'chaman', faction: 'maya', mesh: 'chaman', name: 'Chamán de Chichén', cls: 'special',
    role: 'Especial · élite del Mayab',
    hp: 115, atk: 27, def: 9, range: 6.4, cd: 1.9, speed: 2.9, sight: 9,
    cost: { oro: 90, inti: 40 }, time: 14, icon: 'sun', pop: 1,
    heal: 7, healRadius: 5.2,
    strong: 'Infantería pesada', weak: 'Honderos / Arqueros',
  },
};

/* ---------------- Edificios ---------------- */
export const STRUCT_DEFS = {
  coricancha: {
    id: 'coricancha', faction: 'inca', name: 'Coricancha', role: 'Centro urbano',
    hp: 1600, radius: 6.4, inti: 1.2, depot: true,
    trains: ['aldeano_inca'], upgradePop: true,
  },
  cuartel_inca: {
    id: 'cuartel_inca', faction: 'inca', name: 'Cuartel de Sacsayhuamán', role: 'Edificio militar',
    hp: 950, radius: 6.6, trains: ['chakana', 'hondero'],
    cost: { oro: 150, piedra: 80 }, build: 12,
  },
  templo_inca: {
    id: 'templo_inca', faction: 'inca', name: 'Templo del Sol', role: 'Edificio especial · +Inti',
    hp: 820, radius: 4.8, trains: ['willaq'], inti: 0.8,
    cost: { oro: 180, piedra: 60 }, build: 14,
  },
  torre_inca: {
    id: 'torre_inca', faction: 'inca', name: 'Torre de Vigilancia', role: 'Defensa · dispara sola',
    hp: 700, radius: 2.6,
    cost: { oro: 80, piedra: 60 }, build: 8,
    tower: { dmg: 15, range: 11, cd: 1.3 },
  },

  piramide: {
    id: 'piramide', faction: 'maya', name: 'Pirámide de Kukulcán', role: 'Centro urbano',
    hp: 1600, radius: 8.6, inti: 1.2, depot: true,
    trains: ['aldeano_maya'], upgradePop: true,
  },
  cuartel_maya: {
    id: 'cuartel_maya', faction: 'maya', name: 'Campo de Pelota', role: 'Edificio militar',
    hp: 950, radius: 6.2, trains: ['jaguar', 'arquero'],
    cost: { oro: 150, piedra: 80 }, build: 12,
  },
  observatorio: {
    id: 'observatorio', faction: 'maya', name: 'Observatorio El Caracol', role: 'Edificio especial · +Inti',
    hp: 820, radius: 4.2, trains: ['chaman'], inti: 0.8,
    cost: { oro: 180, piedra: 60 }, build: 14,
  },
  atalaya: {
    id: 'atalaya', faction: 'maya', name: 'Atalaya de Piedra', role: 'Defensa · largo alcance',
    hp: 700, radius: 2.8,
    cost: { oro: 80, piedra: 60 }, build: 8,
    tower: { dmg: 15, range: 12, cd: 1.4 },
  },
};

/** Edificios construibles por facción (menú de obra). */
export const BUILD_MENU = {
  inca: ['cuartel_inca', 'templo_inca', 'torre_inca'],
  maya: ['cuartel_maya', 'observatorio', 'atalaya'],
};

/** Unidad recolectora de cada facción. */
export const WORKER_OF = { inca: 'aldeano_inca', maya: 'aldeano_maya' };

/* ---------------- Materiales auxiliares ---------------- */
const mat = (color, opt = {}) => new THREE.MeshStandardMaterial({
  color, flatShading: true,
  roughness: opt.rough ?? 0.9,
  metalness: opt.metal ?? 0.05,
  emissive: opt.emissive ?? 0x000000,
  emissiveIntensity: opt.ei ?? 1,
});

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/* ---------------- Cuerpo base ---------------- */
function humanoid(fac, { skin = 0xc9a17a, cloth, height = 1 } = {}) {
  const g = new THREE.Group();
  const f = FACTION[fac];
  const clothMat = mat(cloth ?? f.cloth);
  const skinMat = mat(skin);
  const accentMat = mat(f.accent, { emissive: f.accent, ei: 0.35 });

  g.add(mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), clothMat, -0.15, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), clothMat, 0.15, 0.28, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.78, 5), clothMat, 0, 0.93, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 5), accentMat, 0, 1.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.66, 0.16, 0.3), clothMat, 0, 1.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), skinMat, -0.38, 1.03, 0));
  g.add(mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), skinMat, 0.38, 1.03, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.22, 0), skinMat, 0, 1.55, 0));

  g.scale.setScalar(height);
  return { group: g, accentMat, skinMat, clothMat };
}

/* ---------------- Mallas de unidades ---------------- */
export function createUnitMesh(type) {
  const def = UNIT_DEFS[type];
  const fac = def.faction;
  const f = FACTION[fac];
  const g = new THREE.Group();
  const silver = mat(COL.stone, { rough: 0.5, metal: 0.35 });
  const dark = mat(COL.stoneDark, { rough: 0.8 });
  const glow = mat(COL.celeste, { emissive: COL.celeste, ei: 1.8, rough: 0.35 });
  const jadeGlow = mat(COL.jade, { emissive: COL.jade, ei: 1.2, rough: 0.4 });

  const kind = def.mesh;

  if (kind === 'worker') {
    const body = humanoid(fac, { height: 0.95, cloth: fac === 'inca' ? 0x2c4f6e : 0x4a4038 });
    g.add(body.group);
    g.add(mesh(new THREE.TorusGeometry(0.23, 0.04, 4, 8), mat(f.accent), 0, 1.6, 0));
    const sack = mesh(new THREE.IcosahedronGeometry(0.26, 0), mat(0x8a7a5c, { rough: 1 }), -0.42, 1.15, -0.12);
    sack.scale.set(1, 1.15, 0.9);
    g.add(sack);
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), dark, 0.42, 0.85, 0.04));
  } else if (kind === 'chakana') {
    const body = humanoid(fac, { height: 1.0 });
    g.add(body.group);
    g.add(mesh(new THREE.ConeGeometry(0.27, 0.3, 5), silver, 0, 1.78, 0));
    const shield = new THREE.Group();
    shield.add(mesh(new THREE.BoxGeometry(0.52, 0.62, 0.07), silver));
    shield.add(mesh(new THREE.BoxGeometry(0.1, 0.42, 0.03), glow, 0, 0, 0.05));
    shield.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.03), glow, 0, 0, 0.05));
    shield.position.set(-0.46, 1.02, 0.12);
    shield.rotation.y = 0.18;
    g.add(shield);
    const spear = mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4), dark, 0.46, 1.1, 0.05);
    spear.rotation.z = 0.16;
    g.add(spear);
    g.add(mesh(new THREE.ConeGeometry(0.07, 0.24, 4), silver, 0.62, 2.1, 0.05));
  } else if (kind === 'jaguar') {
    const body = humanoid(fac, { height: 1.0, cloth: 0x2e3d48 });
    g.add(body.group);
    g.add(mesh(new THREE.IcosahedronGeometry(0.27, 0), mat(0x39464f), 0, 1.72, 0));
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 4), jadeGlow, -0.16, 1.94, 0));
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 4), jadeGlow, 0.16, 1.94, 0));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), dark, 0.44, 1.12, 0.08));
    g.add(mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x2a333a, { rough: 0.6 }), 0.44, 1.55, 0.08));
  } else if (kind === 'hondero' || kind === 'arquero') {
    const body = humanoid(fac, { height: 0.95 });
    g.add(body.group);
    g.add(mesh(new THREE.TorusGeometry(0.23, 0.04, 4, 8), mat(f.accent), 0, 1.6, 0));
    if (kind === 'hondero') {
      const sling = new THREE.Group();
      sling.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 4, 8), dark));
      sling.position.set(0.42, 1.0, 0.12);
      sling.rotation.x = 0.9;
      g.add(sling);
      g.add(mesh(new THREE.IcosahedronGeometry(0.08, 0), silver, 0.42, 0.86, 0.22));
    } else {
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.035, 4, 10, Math.PI * 1.15),
        mat(0x2a333a, { rough: 0.6 })
      );
      bow.position.set(0.46, 1.1, 0.16);
      bow.rotation.set(0, Math.PI / 2, 0.4);
      g.add(bow);
      g.add(mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), mat(0xdfe9f5, { rough: 0.8 }), 0.46, 1.1, 0.1));
    }
  } else {
    // sacerdotes: Willaq Umu / Chamán de Chichén
    const body = humanoid(fac, { height: 1.02, cloth: fac === 'inca' ? 0x1a3a63 : 0x2b3742 });
    g.add(body.group);
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.62, 1.0, 6), body.clothMat, 0, 0.5, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.26;
      const fth = mesh(
        new THREE.BoxGeometry(0.07, 0.5, 0.03),
        fac === 'inca' ? glow : jadeGlow,
        Math.sin(a) * 0.22, 1.86 + Math.cos(a) * 0.12, -0.04
      );
      fth.rotation.z = -a;
      g.add(fth);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4), dark, 0.44, 1.0, 0.06));
    g.add(mesh(new THREE.IcosahedronGeometry(0.14, 0), fac === 'inca' ? glow : jadeGlow, 0.44, 1.95, 0.06));
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 20),
      new THREE.MeshBasicMaterial({ color: f.ring, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.06;
    g.add(aura);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  g.scale.setScalar(1.5);
  return g;
}

/* ---------------- Mallas de estructuras ---------------- */
export function createStructureMesh(type) {
  switch (type) {
    case 'coricancha': return createCoricancha();
    case 'cuartel_inca': return createSacsayhuaman();
    case 'templo_inca': return createSunTemple();
    case 'torre_inca': return createWatchtowerInca();
    case 'piramide': return createMayaPyramid();
    case 'cuartel_maya': return createBallCourt();
    case 'observatorio': return createObservatory();
    case 'atalaya': return createAtalaya();
    default: return new THREE.Group();
  }
}

/* ---------------- Barra de vida ---------------- */
export function attachBar(parent, color = COL.celeste) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x060a12, transparent: true, opacity: 0.82, depthTest: true })
  );
  bg.userData.noPick = true;
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.075),
    new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: true })
  );
  fill.userData.noPick = true;
  fill.position.z = 0.01;
  g.add(bg, fill);
  g.renderOrder = 900;
  parent.add(g);
  return { group: g, fill, width: 0.9 };
}

/* ---------------- Anillo de selección ---------------- */
export function attachRing(parent, color = COL.celeste, radius = 0.72) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.14, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  ring.userData.noPick = true;
  parent.add(ring);
  return ring;
}
