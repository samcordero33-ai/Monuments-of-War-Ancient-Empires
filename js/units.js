/* ============================================================
   Definiciones y mallas low-poly de unidades y estructuras
   ============================================================ */
import * as THREE from 'three';
import { COL, FACTION } from './config.js';
import {
  createCoricancha, createTerraces, createWall, createMayaPyramid,
  createSacsayhuaman, createBallCourt,
} from './monuments.js';

/* ---------------- Estadísticas ---------------- */
export const UNIT_DEFS = {
  chakana: {
    id: 'chakana', faction: 'inca', name: 'Guerrero Chakana', role: 'Infantería · cuerpo a cuerpo',
    hp: 125, dmg: 12, range: 1.9, cd: 0.95, speed: 3.4, sight: 9,
    cost: { oro: 45 }, time: 6, icon: 'shield',
    lore: 'Porta el escudo escalonado de la cruz andina: resiste la primera carga y abre la brecha.',
  },
  hondero: {
    id: 'hondero', faction: 'inca', name: 'Hondero Andino', role: 'A distancia · hostigador',
    hp: 78, dmg: 10, range: 8.6, cd: 1.45, speed: 3.2, sight: 10,
    cost: { oro: 60 }, time: 7, icon: 'sling',
    lore: 'La honda de fibra de llama lanza piedras de río a 60 pasos. Frágil, pero hostiga sin descanso.',
  },
  willaq: {
    id: 'willaq', faction: 'inca', name: 'Willaq Umu', role: 'Apoyo · sacerdote del Sol',
    hp: 98, dmg: 5, range: 6.2, cd: 1.8, speed: 2.9, sight: 9,
    cost: { oro: 70, inti: 45 }, time: 11, icon: 'sun',
    heal: 9, healRadius: 5.6,
    lore: 'El que dice la palabra del Inca. Sana a los suyos y sostiene la línea con la liturgia del Sol.',
  },
  jaguar: {
    id: 'jaguar', faction: 'maya', name: 'Guerrero Jaguar', role: 'Infantería · asalto',
    hp: 135, dmg: 13, range: 1.9, cd: 0.95, speed: 3.35, sight: 9,
    cost: { oro: 45 }, time: 6, icon: 'shield',
  },
  atlatl: {
    id: 'atlatl', faction: 'maya', name: 'Lancero Atlatl', role: 'A distancia · arrojadizo',
    hp: 82, dmg: 11, range: 8.8, cd: 1.5, speed: 3.15, sight: 10,
    cost: { oro: 60 }, time: 7, icon: 'sling',
  },
  ahkin: {
    id: 'ahkin', faction: 'maya', name: "Ah K'in", role: 'Apoyo · sacerdote solar',
    hp: 100, dmg: 5, range: 6.2, cd: 1.9, speed: 2.85, sight: 9,
    cost: { oro: 70 }, time: 11, icon: 'sun',
    heal: 8, healRadius: 5.2,
  },
};

export const STRUCT_DEFS = {
  coricancha: {
    id: 'coricancha', faction: 'inca', name: 'Coricancha', role: 'Templo del Sol · centro de mando',
    hp: 1500, radius: 6.4, inti: 1.5,
    trains: ['chakana', 'hondero', 'willaq'],
  },
  terraza: {
    id: 'terraza', faction: 'inca', name: 'Terraza Agrícola', role: 'Economía · +2,6 oro/s',
    hp: 450, radius: 4.2, oro: 2.6,
    cost: { oro: 90 }, build: 7,
  },
  muro: {
    id: 'muro', faction: 'inca', name: 'Muro de Contención', role: 'Defensa · bloquea el paso',
    hp: 950, radius: 2.4,
    cost: { oro: 70 }, build: 5, blocks: true,
  },
  sacsay: {
    id: 'sacsay', faction: 'inca', name: 'Sacsayhuamán', role: 'Fortaleza · +8 de hueste',
    hp: 1100, radius: 6.6, popBonus: 8,
  },
  piramide: {
    id: 'piramide', faction: 'maya', name: 'Pirámide de Kukulcán', role: 'Centro de mando maya',
    hp: 1900, radius: 8.6,
    trains: ['jaguar', 'atlatl', 'ahkin'],
  },
};

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
  m.receiveShadow = true;
  return m;
}

/* ---------------- Cuerpo base ---------------- */
function humanoid(fac, { skin = 0xc9a17a, cloth, height = 1 } = {}) {
  const g = new THREE.Group();
  const f = FACTION[fac];
  const clothMat = mat(cloth ?? f.cloth);
  const skinMat = mat(skin);
  const accentMat = mat(f.accent, { emissive: f.accent, ei: 0.35 });

  // piernas
  g.add(mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), clothMat, -0.15, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), clothMat, 0.15, 0.28, 0));
  // torso (túnica)
  const torso = mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.78, 5), clothMat, 0, 0.93, 0);
  g.add(torso);
  // faja
  g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 5), accentMat, 0, 1.2, 0));
  // hombros
  g.add(mesh(new THREE.BoxGeometry(0.66, 0.16, 0.3), clothMat, 0, 1.28, 0));
  // brazos
  g.add(mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), skinMat, -0.38, 1.03, 0));
  g.add(mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), skinMat, 0.38, 1.03, 0));
  // cabeza
  const head = mesh(new THREE.IcosahedronGeometry(0.22, 0), skinMat, 0, 1.55, 0);
  g.add(head);

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

  let body;
  if (type === 'chakana' || type === 'jaguar') {
    body = humanoid(fac, { height: 1.0 });
    g.add(body.group);

    if (type === 'chakana') {
      // casco de plata
      g.add(mesh(new THREE.ConeGeometry(0.27, 0.3, 5), silver, 0, 1.78, 0));
      // escudo chakana (cruz escalonada)
      const shield = new THREE.Group();
      shield.add(mesh(new THREE.BoxGeometry(0.52, 0.62, 0.07), silver));
      shield.add(mesh(new THREE.BoxGeometry(0.1, 0.42, 0.03), glow, 0, 0, 0.05));
      shield.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.03), glow, 0, 0, 0.05));
      shield.position.set(-0.46, 1.02, 0.12);
      shield.rotation.y = 0.18;
      g.add(shield);
      // lanza
      const spear = mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4), dark, 0.46, 1.1, 0.05);
      spear.rotation.z = 0.16;
      g.add(spear);
      g.add(mesh(new THREE.ConeGeometry(0.07, 0.24, 4), silver, 0.62, 2.1, 0.05));
    } else {
      // casco jaguar con orejas
      g.add(mesh(new THREE.IcosahedronGeometry(0.27, 0), mat(0x39464f), 0, 1.72, 0));
      g.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 4), jadeGlow, -0.16, 1.94, 0));
      g.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 4), jadeGlow, 0.16, 1.94, 0));
      // maza de obsidiana
      g.add(mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), dark, 0.44, 1.12, 0.08));
      g.add(mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x2a333a, { rough: 0.6 }), 0.44, 1.55, 0.08));
    }
  } else if (type === 'hondero' || type === 'atlatl') {
    body = humanoid(fac, { height: 0.95 });
    g.add(body.group);

    // cinta en la cabeza
    g.add(mesh(new THREE.TorusGeometry(0.23, 0.04, 4, 8), mat(f.accent), 0, 1.6, 0));
    if (type === 'hondero') {
      // honda
      const sling = new THREE.Group();
      sling.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 4, 8), dark));
      sling.position.set(0.42, 1.0, 0.12);
      sling.rotation.x = 0.9;
      g.add(sling);
      g.add(mesh(new THREE.IcosahedronGeometry(0.08, 0), silver, 0.42, 0.86, 0.22));
    } else {
      // átlatl (lanzadardos)
      const atl = mesh(new THREE.BoxGeometry(0.07, 0.9, 0.05), dark, 0.42, 1.15, 0.1);
      atl.rotation.z = -0.3;
      g.add(atl);
      const dart = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), mat(f.trim), 0.46, 1.42, 0.12);
      dart.rotation.z = -0.35;
      g.add(dart);
    }
  } else {
    // sacerdotes: Willaq Umu / Ah K'in
    body = humanoid(fac, { height: 1.02, cloth: type === 'willaq' ? 0x1a3a63 : 0x2b3742 });
    g.add(body.group);

    // túnica larga
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.62, 1.0, 6), body.clothMat, 0, 0.5, 0));
    // tocado de plumas
    const feathers = 5;
    for (let i = 0; i < feathers; i++) {
      const a = (i - (feathers - 1) / 2) * 0.26;
      const fth = mesh(new THREE.BoxGeometry(0.07, 0.5, 0.03), type === 'willaq' ? glow : jadeGlow, Math.sin(a) * 0.22, 1.86 + Math.cos(a) * 0.12, -0.04);
      fth.rotation.z = -a;
      g.add(fth);
    }
    // bastón con orbe
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4), dark, 0.44, 1.0, 0.06));
    const orb = mesh(new THREE.IcosahedronGeometry(0.14, 0), type === 'willaq' ? glow : jadeGlow, 0.44, 1.95, 0.06);
    orb.name = 'orb';
    g.add(orb);
    // aura suave
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 20),
      new THREE.MeshBasicMaterial({ color: f.ring, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.06;
    g.add(aura);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  g.scale.setScalar(1.3);
  return g;
}

/* ---------------- Mallas de estructuras ---------------- */
export function createStructureMesh(type) {
  switch (type) {
    case 'coricancha': return createCoricancha();
    case 'terraza': return createTerraces();
    case 'muro': return createWall();
    case 'sacsay': return createSacsayhuaman();
    case 'piramide': return createMayaPyramid();
    case 'ballcourt': return createBallCourt();
    default: return new THREE.Group();
  }
}

/* ---------------- Barra de vida ---------------- */
export function attachBar(parent, color = COL.celeste) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x060a12, transparent: true, opacity: 0.82, depthTest: false })
  );
  bg.userData.noPick = true;
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.075),
    new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false })
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
