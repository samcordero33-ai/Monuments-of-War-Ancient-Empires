/* ============================================================
   Terreno low-poly procedural (heightmap + agua + decoración)
   ============================================================ */
import * as THREE from 'three';
import { CFG, COL } from './config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, seed, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * noise2(x * f, y * f, seed + i * 131);
    f *= 2.03; amp *= 0.5;
  }
  return s;
}

export class Terrain {
  constructor(scene) {
    this.N = CFG.GRID;
    this.T = CFG.TILE;
    this.half = (this.N * this.T) / 2;
    this.seed = CFG.SEED;

    // Bases (coordenadas de celda)
    this.playerBaseCell = { i: 16, j: 32 };
    this.enemyBaseCell = { i: 32, j: 16 };

    this.hC = new Float32Array((this.N + 1) * (this.N + 1)); // alturas en esquinas
    this.walk = new Uint8Array(this.N * this.N);             // transitabilidad por celda

    this._buildHeights();
    this._buildMesh(scene);
    this._buildWater(scene);
    this._scatter(scene);
  }

  /* ---------- alturas ---------- */
  _buildHeights() {
    const N = this.N, S = this.seed;
    const c = N / 2;

    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const dx = (i - c) / c, dz = (j - c) / c;
        const d = Math.sqrt(dx * dx + dz * dz);

        // llanura central suave
        let h = 1.9 * fbm(i * 0.052, j * 0.052, S, 4) - 0.7;

        // cordillera perimetral (altiplano)
        const ridge = Math.pow(fbm(i * 0.021 + 7.3, j * 0.021 - 3.1, S + 99, 3), 1.35);
        h += smoothstep(0.68, 1.08, d) * (7.0 + 32 * ridge);
        h += smoothstep(0.94, 1.30, d) * 26;

        // lago al noroeste, fuera del eje de avance
        const lx = i - 17, lz = j - 17;
        const ld = Math.sqrt(lx * lx + lz * lz);
        if (ld < 8.5) h -= 4.6 * Math.pow(1 - ld / 8.5, 1.7);

        this.hC[j * (N + 1) + i] = h;
      }
    }

    // Aplanar mesetas de las bases
    this._flatten(this.playerBaseCell.i, this.playerBaseCell.j, 7.2);
    this._flatten(this.enemyBaseCell.i, this.enemyBaseCell.j, 7.2);

    // Calcular transitabilidad por celda
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = this.hC[j * (N + 1) + i];
        const b = this.hC[j * (N + 1) + i + 1];
        const c2 = this.hC[(j + 1) * (N + 1) + i];
        const d2 = this.hC[(j + 1) * (N + 1) + i + 1];
        const avg = (a + b + c2 + d2) / 4;
        const slope = Math.max(
          Math.abs(a - d2), Math.abs(b - c2),
          Math.abs(a - b), Math.abs(c2 - d2)
        ) / this.T;
        this.walk[j * N + i] = avg > CFG.WATER + 0.22 && slope < 1.05 ? 1 : 0;
      }
    }
  }

  _flatten(ci, cj, radius) {
    const N = this.N;
    const idx = cj * (N + 1) + ci;
    let sum = 0, n = 0;
    for (let j = cj - 2; j <= cj + 2; j++) {
      for (let i = ci - 2; i <= ci + 2; i++) {
        if (i < 0 || j < 0 || i > N || j > N) continue;
        sum += this.hC[j * (N + 1) + i]; n++;
      }
    }
    const target = Math.max(sum / Math.max(n, 1), CFG.WATER + 1.4);

    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const d = Math.hypot(i - ci, j - cj);
        if (d > radius) continue;
        const k = smoothstep(radius, radius * 0.45, d);
        const p = j * (N + 1) + i;
        this.hC[p] = this.hC[p] * (1 - k) + target * k;
      }
    }
  }

  /* ---------- malla ---------- */
  _buildMesh(scene) {
    const N = this.N, T = this.T, half = this.half;
    const tris = N * N * 2;
    const pos = new Float32Array(tris * 9);
    const col = new Float32Array(tris * 9);
    const cTmp = new THREE.Color();
    let p = 0;

    const corner = (i, j) => {
      const x = i * T - half;
      const z = j * T - half;
      const y = this.hC[j * (N + 1) + i];
      return [x, y, z];
    };

    const pushTri = (A, B, C) => {
      const avg = (A[1] + B[1] + C[1]) / 3;
      const slope = (Math.max(A[1], B[1], C[1]) - Math.min(A[1], B[1], C[1])) / T;
      this._faceColor(avg, slope, cTmp);
      const arr = [A, B, C];
      for (let k = 0; k < 3; k++) {
        pos[p] = arr[k][0]; pos[p + 1] = arr[k][1]; pos[p + 2] = arr[k][2];
        col[p] = cTmp.r; col[p + 1] = cTmp.g; col[p + 2] = cTmp.b;
        p += 3;
      }
    };

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = corner(i, j), b = corner(i + 1, j), c = corner(i + 1, j + 1), d = corner(i, j + 1);
        // diagonal alterna para evitar patrón repetitivo
        // winding antihorario visto desde arriba (normales hacia +Y)
        if ((i + j) % 2 === 0) { pushTri(a, c, b); pushTri(a, d, c); }
        else { pushTri(a, d, b); pushTri(b, d, c); }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.97,
      metalness: 0.02,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    scene.add(this.mesh);
  }

  _faceColor(h, slope, out) {
    const w = CFG.WATER;
    if (h < w + 0.35) out.setHex(0x22343d);
    else if (h < 1.1) out.setHex(0x2d4d43);
    else if (h < 3.2) out.setHex(0x37574a);
    else if (h < 6.0) out.setHex(0x46585a);
    else if (h < 10.0) out.setHex(0x536172);
    else if (h < 15.0) out.setHex(0x6f7d90);
    else out.setHex(0x9fb0c4);

    if (slope > 0.85) out.lerp(new THREE.Color(0x6a7686), 0.55);

    // jitter por cara: da el aspecto facetado del low-poly
    const j = (Math.random() - 0.5) * 0.055;
    out.offsetHSL(0, 0, j);
  }

  /* ---------- agua ---------- */
  _buildWater(scene) {
    const size = this.N * this.T * 1.04;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x123a55,
      roughness: 0.28,
      metalness: 0.25,
      emissive: 0x061726,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.9,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = CFG.WATER;
    this.water.receiveShadow = false;
    scene.add(this.water);
  }

  /* ---------- decoración instanciada ---------- */
  _scatter(scene) {
    const N = this.N, T = this.T, half = this.half;
    const dummy = new THREE.Object3D();

    const place = (count, filter, build) => {
      let done = 0, guard = 0;
      while (done < count && guard < count * 40) {
        guard++;
        const i = 1 + Math.floor(Math.random() * (N - 2));
        const j = 1 + Math.floor(Math.random() * (N - 2));
        const h = this.heightAtCell(i, j);
        if (!filter(h, i, j)) continue;
        build(dummy, i * T - half, h, j * T - half, done);
        done++;
      }
      return done;
    };

    // Rocas
    const rockGeo = new THREE.IcosahedronGeometry(0.62, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x66707f, flatShading: true, roughness: 0.95 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 300);
    rocks.castShadow = true; rocks.receiveShadow = true;
    place(300, (h) => h > CFG.WATER + 0.5, (d, x, y, z, k) => {
      d.position.set(x + (Math.random() - 0.5) * T, y + 0.12, z + (Math.random() - 0.5) * T);
      d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const s = 0.5 + Math.random() * 1.5;
      d.scale.set(s, s * (0.5 + Math.random() * 0.7), s);
      d.updateMatrix();
      rocks.setMatrixAt(k, d.matrix);
    });
    rocks.count = 300;
    scene.add(rocks);

    // Agujas de roca en las alturas
    const spireGeo = new THREE.ConeGeometry(0.62, 2.4, 5);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x8d9aab, flatShading: true, roughness: 0.9 });
    const spires = new THREE.InstancedMesh(spireGeo, spireMat, 110);
    spires.castShadow = true;
    place(110, (h) => h > 6.5, (d, x, y, z, k) => {
      d.position.set(x + (Math.random() - 0.5) * T, y + 0.9, z + (Math.random() - 0.5) * T);
      d.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * 3, (Math.random() - 0.5) * 0.2);
      const s = 0.5 + Math.random() * 0.8;
      d.scale.set(s, s * (0.9 + Math.random() * 0.7), s);
      d.updateMatrix();
      spires.setMatrixAt(k, d.matrix);
    });
    spires.count = 110;
    scene.add(spires);

    // Matas de ichu
    const tuftGeo = new THREE.ConeGeometry(0.18, 0.72, 4);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4a6b58, flatShading: true, roughness: 1 });
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 700);
    place(700, (h) => h > CFG.WATER + 0.6 && h < 6.5, (d, x, y, z, k) => {
      d.position.set(x + (Math.random() - 0.5) * T, y + 0.3, z + (Math.random() - 0.5) * T);
      d.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 3, (Math.random() - 0.5) * 0.3);
      const s = 0.7 + Math.random() * 0.9;
      d.scale.set(s, s, s);
      d.updateMatrix();
      tufts.setMatrixAt(k, d.matrix);
    });
    tufts.count = 700;
    scene.add(tufts);
  }

  /* ---------- consultas ---------- */
  heightAtCell(i, j) {
    const N = this.N;
    i = clamp(i, 0, N); j = clamp(j, 0, N);
    return this.hC[j * (N + 1) + i];
  }

  heightAtWorld(x, z) {
    const N = this.N, T = this.T;
    const gx = (x + this.half) / T;
    const gz = (z + this.half) / T;
    const i = clamp(Math.floor(gx), 0, N - 1);
    const j = clamp(Math.floor(gz), 0, N - 1);
    const fx = clamp(gx - i, 0, 1), fz = clamp(gz - j, 0, 1);
    const h00 = this.heightAtCell(i, j), h10 = this.heightAtCell(i + 1, j);
    const h01 = this.heightAtCell(i, j + 1), h11 = this.heightAtCell(i + 1, j + 1);
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  cellOf(x, z) {
    return {
      i: clamp(Math.floor((x + this.half) / this.T), 0, this.N - 1),
      j: clamp(Math.floor((z + this.half) / this.T), 0, this.N - 1),
    };
  }

  cellCenter(i, j) {
    return new THREE.Vector3(
      (i + 0.5) * this.T - this.half,
      this.heightAtCell(i, j),
      (j + 0.5) * this.T - this.half
    );
  }

  isWalkableCell(i, j) {
    if (i < 0 || j < 0 || i >= this.N || j >= this.N) return false;
    return this.walk[j * this.N + i] === 1;
  }

  isWalkableWorld(x, z) {
    const { i, j } = this.cellOf(x, z);
    return this.isWalkableCell(i, j);
  }

  clampToMap(v) {
    const lim = this.half - this.T * 0.6;
    return clamp(v, -lim, lim);
  }

  update(t) {
    if (this.water) this.water.position.y = CFG.WATER + Math.sin(t * 0.6) * 0.035;
  }
}
