/* ============================================================
   Monumentos y estructuras low-poly (Inca / Maya)
   Cada fábrica devuelve un THREE.Group con userData.radius
   ============================================================ */
import * as THREE from 'three';
import { COL } from './config.js';

const rnd = (a, b) => a + Math.random() * (b - a);

function M(color, opt = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: opt.rough ?? 0.92,
    metalness: opt.metal ?? 0.04,
    emissive: opt.emissive ?? 0x000000,
    emissiveIntensity: opt.ei ?? 1,
    transparent: opt.transparent ?? false,
    opacity: opt.opacity ?? 1,
  });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const stone = () => M(COL.stone, { rough: 0.95 });
const stoneMid = () => M(COL.stoneMid, { rough: 0.95 });
const stoneDark = () => M(COL.stoneDark, { rough: 0.95 });
const lime = () => M(0xd8e2ee, { rough: 0.9 });

/* ------------------------------------------------------------
   SACSAYHUAMÁN — fortaleza inca de muros en zigzag
   ------------------------------------------------------------ */
export function createSacsayhuaman() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid(), dMat = stoneDark();

  // base de la explanada
  g.add(box(13.4, 0.7, 9.4, dMat, 0, 0.35, -0.6));
  g.add(box(12.6, 0.36, 8.6, mMat, 0, 0.82, -0.6));

  // TRES muros paralelos en zigzag: la firma de Sacsayhuamán
  for (let wall = 0; wall < 3; wall++) {
    const zBase = 2.4 - wall * 1.75;
    const width = 12.4 - wall * 0.5;
    const segs = 6;
    const segLen = width / segs;
    const y0 = 1.0;
    let x = -width / 2, z = zBase;

    for (let k = 0; k < segs; k++) {
      const ang = (k % 2 === 0 ? 1 : -1) * 0.85;
      const cx = x + (Math.cos(ang) * segLen) / 2;
      const cz = z + (Math.sin(ang) * segLen) / 2;

      // tres hiladas de megalitos solapados (muro macizo)
      g.add(box(segLen * 1.2, 0.56, 0.7, sMat, cx, y0 + 0.28, cz, -ang));
      g.add(box(segLen * 1.16, 0.54, 0.66, mMat, cx, y0 + 0.82, cz, -ang));
      g.add(box(segLen * 1.1, 0.5, 0.62, dMat, cx, y0 + 1.34, cz, -ang));

      x += Math.cos(ang) * segLen;
      z += Math.sin(ang) * segLen;
    }

    // relleno de las esquinas del zigzag
    let vx = -width / 2, vz = zBase;
    for (let k = 0; k <= segs; k++) {
      g.add(box(0.52, 1.6, 0.78, mMat, vx, y0 + 0.8, vz));
      const ang = (k % 2 === 0 ? 1 : -1) * 0.85;
      vx += Math.cos(ang) * segLen;
      vz += Math.sin(ang) * segLen;
    }
  }

  // torreón ceremonial al fondo
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.75, 4.4, 8), sMat);
  tower.position.set(0, 3.4, -3.2);
  tower.castShadow = true; tower.receiveShadow = true;
  g.add(tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.4, 8), dMat);
  roof.position.set(0, 6.3, -3.2);
  roof.castShadow = true;
  g.add(roof);

  // escalinata entre muros
  for (let st = 0; st < 3; st++) {
    g.add(box(1.6, 0.3, 0.7, mMat, 5.2, 1.0 + st * 0.28, 1.6 - st * 0.6));
  }

  g.userData.radius = 6.8;
  return g;
}

/* ------------------------------------------------------------
   CORICANCHA — templo del sol (base de los Incas)
   ------------------------------------------------------------ */
export function createCoricancha() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid(), dMat = stoneDark();
  const glow = M(COL.celeste, { emissive: COL.celeste, ei: 1.6, rough: 0.4, metal: 0.2 });

  // plataforma y escalinata
  g.add(box(11, 0.8, 9, dMat, 0, 0.4, 0));
  g.add(box(10, 0.6, 8, sMat, 0, 1.1, 0));
  for (let s = 0; s < 3; s++) {
    g.add(box(4.2 - s * 0.4, 0.34, 1.0, mMat, 0, 0.2 + s * 0.34, 4.6 - s * 0.9));
  }

  // muro curvo trasero (el "templo redondo")
  const curve = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.6, 2.8, 14, 1, true, Math.PI * 0.05, Math.PI * 0.9),
    sMat
  );
  curve.position.set(0, 2.7, -1.6);
  curve.castShadow = true; curve.receiveShadow = true;
  g.add(curve);

  // muros rectos laterales
  g.add(box(0.55, 2.8, 4.6, sMat, -3.45, 2.7, -0.4));
  g.add(box(0.55, 2.8, 4.6, sMat, 3.45, 2.7, -0.4));

  // columnas frontales
  for (let i = 0; i < 5; i++) {
    g.add(box(0.5, 2.5, 0.5, mMat, -2.6 + i * 1.3, 2.5, 2.2));
  }
  // dintel
  g.add(box(6.4, 0.5, 0.7, sMat, 0, 3.9, 2.2));

  // techo a dos aguas
  // techo a dos aguas, más estrecho que la cella para que se vean los muros
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.9, 4), dMat);
  roof.position.set(0, 4.75, -0.9);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.1, 1, 0.95);
  roof.castShadow = true;
  g.add(roof);
  // remate del techo
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, 0.22), sMat);
  ridge.position.set(0, 5.75, -0.9);
  ridge.rotation.y = Math.PI / 4;
  g.add(ridge);
  // pretil delantero
  g.add(box(6.6, 0.35, 0.4, mMat, 0, 4.1, 2.2));

  // disco solar (Inti) en el muro curvo
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 16), glow);
  sun.rotation.x = Math.PI / 2;
  sun.position.set(0, 3.0, -3.35);
  g.add(sun);

  // anillo de luz en el suelo
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.2, 5.5, 32),
    new THREE.MeshBasicMaterial({ color: COL.celeste, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.44;
  g.add(ring);

  g.userData.radius = 6.4;
  return g;
}

/* ------------------------------------------------------------
   TERRAZAS AGRÍCOLAS — generan oro
   ------------------------------------------------------------ */
export function createTerraces() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid();
  const crop = M(0x4f7a52, { rough: 1 });
  const crop2 = M(0x63875c, { rough: 1 });

  const steps = 4;
  for (let s = 0; s < steps; s++) {
    const w = 7 - s * 0.9;
    const d = 5.4 - s * 0.7;
    const y = 0.35 + s * 0.62;
    g.add(box(w, 0.62, d, s % 2 ? mMat : sMat, 0, y, -s * 0.35));
    // hileras de cultivo
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const cz = -s * 0.35 - d / 2 + 0.75 + r * ((d - 1.3) / (rows - 1 || 1));
      const row = box(w - 1.1, 0.2, 0.42, r % 2 ? crop : crop2, 0, y + 0.42, cz);
      g.add(row);
    }
    // canal de agua
    g.add(box(w - 0.8, 0.08, 0.18, M(COL.celeste, { emissive: COL.celeste, ei: 0.5, rough: 0.3, metal: 0.4 }), 0, y + 0.34, -s * 0.35 + d / 2 - 0.35));
  }

  g.userData.radius = 4.2;
  return g;
}

/* ------------------------------------------------------------
   MURO DE CONTENCIÓN — bloquea el paso
   ------------------------------------------------------------ */
export function createWall() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid();
  g.add(box(4.4, 0.5, 2.2, mMat, 0, 0.25, 0));
  for (let i = 0; i < 4; i++) {
    for (let r = 0; r < 2; r++) {
      const b = box(1.02, 0.55, 1.9, r ? sMat : mMat, -1.65 + i * 1.1 + rnd(-0.03, 0.03), 0.78 + r * 0.56, rnd(-0.05, 0.05));
      b.rotation.y = rnd(-0.04, 0.04);
      g.add(b);
    }
  }
  g.userData.radius = 2.3;
  return g;
}

/* ------------------------------------------------------------
   PIRÁMIDE DE KUKULCÁN (El Castillo) — base maya
   ------------------------------------------------------------ */
export function createMayaPyramid() {
  const g = new THREE.Group();
  const aMat = lime(), bMat = M(0xbfcbd9, { rough: 0.92 }), dMat = stoneDark();
  const glow = M(COL.celeste, { emissive: COL.celeste, ei: 1.1, rough: 0.5 });

  const tiers = 9;
  const baseW = 15;
  const stepH = 0.62;

  for (let t = 0; t < tiers; t++) {
    const w = baseW - t * 1.32;
    const h = stepH;
    const y = stepH / 2 + t * stepH;
    g.add(box(w, h, w, t % 2 === 0 ? aMat : bMat, 0, y, 0));
    // borde saliente
    g.add(box(w + 0.18, 0.1, w + 0.18, dMat, 0, y + h / 2, 0));
  }

  // escalinatas en las cuatro caras
  const stairSteps = 12;
  const sides = [
    { x: 0, z: 1, ry: 0 },
    { x: 0, z: -1, ry: Math.PI },
    { x: 1, z: 0, ry: Math.PI / 2 },
    { x: -1, z: 0, ry: -Math.PI / 2 },
  ];
  sides.forEach((sd) => {
    const grp = new THREE.Group();
    grp.rotation.y = sd.ry;
    for (let s = 0; s < stairSteps; s++) {
      const y = 0.12 + s * stepH;
      const zz = baseW / 2 - 0.4 - s * 0.58;
      grp.add(box(2.0, stepH, 0.62, s % 2 ? aMat : bMat, 0, y, zz));
    }
    // alfarda (barandillas)
    grp.add(box(0.3, 1.0, 7.6, dMat, -1.15, 1.6, baseW / 2 - 3.6));
    grp.add(box(0.3, 1.0, 7.6, dMat, 1.15, 1.6, baseW / 2 - 3.6));
    g.add(grp);
  });

  // cabezas de serpiente en la escalinata principal
  [-1, 1].forEach((sx) => {
    const head = box(0.7, 0.6, 1.1, dMat, sx * 1.15, 0.35, baseW / 2 + 0.35);
    g.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), glow);
    eye.position.set(sx * 1.15, 0.5, baseW / 2 + 0.85);
    g.add(eye);
  });

  // templo superior
  const topY = tiers * stepH;
  g.add(box(4.6, 0.4, 4.6, dMat, 0, topY + 0.2, 0));
  g.add(box(4.0, 2.0, 3.6, aMat, 0, topY + 1.4, 0));
  // vano oscuro
  g.add(box(1.4, 1.5, 0.2, M(0x05070d, { rough: 1 }), 0, topY + 1.2, 1.85));
  // crestería
  g.add(box(4.4, 1.3, 0.45, bMat, 0, topY + 3.05, -1.5));
  g.add(box(3.0, 0.9, 0.35, aMat, 0, topY + 2.7, -1.5));
  // remate celeste
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 4), glow);
  cap.position.set(0, topY + 4.1, -1.5);
  g.add(cap);

  g.userData.radius = 8.6;
  return g;
}

/* ------------------------------------------------------------
   JUEGO DE PELOTA MAYA — decorativo
   ------------------------------------------------------------ */
export function createBallCourt() {
  const g = new THREE.Group();
  const aMat = lime(), dMat = stoneDark();
  g.add(box(11, 0.3, 5.6, aMat, 0, 0.15, 0));
  [-1, 1].forEach((s) => {
    const w = box(11, 1.5, 0.7, aMat, 0, 1.0, s * 2.6);
    w.rotation.x = s * 0.16;
    g.add(w);
    g.add(box(11.4, 0.2, 0.9, dMat, 0, 1.8, s * 2.75));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.12, 6, 12),
      M(COL.stoneMid, { rough: 0.8 })
    );
    ring.position.set(0, 1.5, s * 2.55);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  });
  g.userData.radius = 6.2;
  return g;
}

/* ------------------------------------------------------------
   CHULLPA (torre funeraria inca) y ESTELA maya — decoración
   ------------------------------------------------------------ */
export function createChullpa() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.45, 3.6, 8), stone());
  body.position.y = 1.8;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.1, 8), stoneDark());
  roof.position.y = 4.1;
  roof.castShadow = true;
  g.add(roof);
  g.userData.radius = 1.8;
  return g;
}

export function createStela() {
  const g = new THREE.Group();
  g.add(box(1.5, 0.4, 1.2, stoneDark(), 0, 0.2, 0));
  const s = box(0.8, 2.8, 0.5, lime(), 0, 1.8, 0);
  g.add(s);
  g.add(box(0.55, 0.9, 0.06, M(0x2c3a44, { rough: 1 }), 0, 2.0, 0.27));
  g.userData.radius = 1.2;
  return g;
}

/* ------------------------------------------------------------
   MARCADOR DE OBJETIVO / efecto de anillo
   ------------------------------------------------------------ */
export function createRallyMarker(color = COL.celeste) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.85, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  return g;
}

/* ------------------------------------------------------------
   TEMPLO DEL SOL — edificio especial inca (más pequeño)
   ------------------------------------------------------------ */
export function createSunTemple() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid(), dMat = stoneDark();
  const glow = M(COL.celeste, { emissive: COL.celeste, ei: 1.5, rough: 0.4, metal: 0.2 });

  g.add(box(8, 0.7, 7, dMat, 0, 0.35, 0));
  g.add(box(7, 0.5, 6, sMat, 0, 0.95, 0));

  // cella con columnas
  for (let i = 0; i < 4; i++) {
    g.add(box(0.42, 2.4, 0.42, mMat, -2.1 + i * 1.4, 2.4, 1.9));
  }
  g.add(box(5.4, 0.4, 0.6, sMat, 0, 3.75, 1.9));
  g.add(box(5.6, 2.6, 3.6, sMat, 0, 2.5, -0.9));

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 1.5, 4), dMat);
  roof.position.set(0, 4.6, -0.6);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 1);
  roof.castShadow = true;
  g.add(roof);

  // disco solar y halo
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 14), glow);
  sun.rotation.x = Math.PI / 2;
  sun.position.set(0, 2.9, 1.35);
  g.add(sun);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.3, 20),
    new THREE.MeshBasicMaterial({ color: COL.celeste, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  );
  halo.position.set(0, 2.9, 1.5);
  g.add(halo);

  g.userData.radius = 4.8;
  return g;
}

/* ------------------------------------------------------------
   TORRE DE VIGILANCIA INCA
   ------------------------------------------------------------ */
export function createWatchtowerInca() {
  const g = new THREE.Group();
  const sMat = stone(), mMat = stoneMid(), dMat = stoneDark();

  g.add(box(4.4, 0.6, 4.4, dMat, 0, 0.3, 0));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 4.6, 8), sMat);
  body.position.y = 2.9;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // plataforma superior
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.4, 8), mMat);
  top.position.y = 5.35;
  top.castShadow = true;
  g.add(top);

  // almenas
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.5, 0.55, 0.32, sMat, Math.cos(a) * 1.72, 5.8, Math.sin(a) * 1.72, -a));
  }
  // techo cónico
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 8), dMat);
  roof.position.y = 6.9;
  roof.castShadow = true;
  g.add(roof);

  g.userData.radius = 2.6;
  return g;
}

/* ------------------------------------------------------------
   EL CARACOL — observatorio maya (torre circular)
   ------------------------------------------------------------ */
export function createObservatory() {
  const g = new THREE.Group();
  const aMat = lime(), bMat = M(0xbfcbd9, { rough: 0.92 }), dMat = stoneDark();

  g.add(box(6.4, 0.7, 6.4, dMat, 0, 0.35, 0));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 4.2, 14), aMat);
  drum.position.y = 2.8;
  drum.castShadow = true; drum.receiveShadow = true;
  g.add(drum);

  // escalera en espiral (aprox.)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 1.9;
    const y = 0.9 + i * 0.34;
    const r = 2.55;
    g.add(box(1.1, 0.16, 0.7, bMat, Math.cos(a) * r, y, Math.sin(a) * r, -a));
  }

  // cúpula superior
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), bMat);
  dome.position.y = 4.9;
  dome.castShadow = true;
  g.add(dome);

  // ventanas de observación
  [-0.9, 0.4, 1.7].forEach((a, i) => {
    const w = box(0.55, 0.8, 0.3, M(0x05070d, { rough: 1 }), Math.cos(a) * 2.3, 4.0 + i * 0.1, Math.sin(a) * 2.3, -a);
    g.add(w);
  });

  // remate celeste
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6), M(COL.celeste, { emissive: COL.celeste, ei: 1.3 }));
  cap.position.y = 7.3;
  g.add(cap);

  g.userData.radius = 4.2;
  return g;
}

/* ------------------------------------------------------------
   ATALAYA DE PIEDRA MAYA
   ------------------------------------------------------------ */
export function createAtalaya() {
  const g = new THREE.Group();
  const aMat = lime(), bMat = M(0xbfcbd9, { rough: 0.92 }), dMat = stoneDark();

  g.add(box(4.6, 0.5, 4.6, dMat, 0, 0.25, 0));
  g.add(box(3.8, 1.5, 3.8, aMat, 0, 1.25, 0));
  g.add(box(3.0, 1.5, 3.0, bMat, 0, 2.75, 0));
  g.add(box(2.4, 1.5, 2.4, aMat, 0, 4.25, 0));
  g.add(box(3.0, 0.35, 3.0, dMat, 0, 5.15, 0));

  // almenas
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(box(0.55, 0.6, 0.4, bMat, Math.cos(a) * 1.2, 5.6, Math.sin(a) * 1.2, -a));
  }
  // escalinata
  for (let s = 0; s < 6; s++) {
    g.add(box(1.1, 0.32, 0.5, bMat, 0, 0.5 + s * 0.5, 2.1 - s * 0.28));
  }

  g.userData.radius = 2.8;
  return g;
}

/* ------------------------------------------------------------
   NODOS DE RECURSOS
   ------------------------------------------------------------ */
export function createGoldNode() {
  const g = new THREE.Group();
  const rock = M(0x5c6a7c, { rough: 1 });
  const gold = M(0xd9a93a, { rough: 0.35, metal: 0.55, emissive: 0x6b4a0a, ei: 0.5 });

  const base = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 0), rock);
  base.position.y = 0.7;
  base.scale.set(1, 0.62, 1);
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = 0.5 + Math.random() * 0.9;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32 + Math.random() * 0.22, 0), gold);
    c.position.set(Math.cos(a) * r, 1.0 + Math.random() * 0.5, Math.sin(a) * r);
    c.rotation.set(Math.random(), Math.random(), Math.random());
    c.castShadow = true;
    g.add(c);
  }
  g.userData.radius = 2.2;
  return g;
}

export function createStoneNode() {
  const g = new THREE.Group();
  const a = M(0x7d8a9c, { rough: 1 });
  const b = M(0x66707f, { rough: 1 });

  for (let i = 0; i < 9; i++) {
    const s = 0.5 + Math.random() * 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), i % 2 ? a : b);
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.4;
    m.position.set(Math.cos(ang) * r, 0.3 + Math.random() * 0.7, Math.sin(ang) * r);
    m.rotation.set(Math.random() * 0.4, Math.random() * 3, Math.random() * 0.4);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.userData.radius = 2.2;
  return g;
}
