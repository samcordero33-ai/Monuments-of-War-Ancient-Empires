/* ============================================================
   Configuración global del prototipo
   ============================================================ */

export const CFG = {
  // --- Mapa ---
  GRID: 48,          // celdas por lado
  TILE: 2.2,         // unidades de mundo por celda
  SEED: 91731,       // semilla del terreno (determinista)
  WATER: -0.65,      // altura del agua

  // --- Cámara ---
  CAM_MIN: 26,
  CAM_MAX: 115,
  CAM_START: 62,
  CAM_PAN: 34,       // velocidad de paneo

  // --- Partida ---
  POP_CAP: 20,
  START_ORO: 320,
  START_INTI: 120,
  WAVE_FIRST: 55,    // segundos hasta la primera oleada
  WAVE_EVERY: 34,    // segundos entre oleadas
  ENEMY_MAX: 22,     // tope de unidades enemigas simultáneas
  MAX_DPR: 1.75,

  // --- Monetización directa (EDITA ESTO con tu enlace real) ---
  PAYPAL_URL: 'https://www.paypal.com/paypalme/TU_USUARIO',
  PAYPAL_LABEL: 'Apoyar el desarrollo de este RTS',
};

export const COL = {
  bg: 0x05070d,
  azul: 0x1f5fe0,
  azulDeep: 0x0b2a63,
  celeste: 0x7fd8ff,
  plata: 0xc9d6e6,
  blanco: 0xf2f7ff,
  stone: 0xb9c6d6,
  stoneMid: 0x8b9bad,
  stoneDark: 0x5c6a7c,
  jade: 0x3fbfa0,
  gold: 0xd9a93a,
  earth: 0x3c4a44,
  enemy: 0x9fe8d8,
};

/* Colores por facción (acento de tela / detalles) */
export const FACTION = {
  inca: { accent: 0x4ea8ff, cloth: 0x1e4585, trim: 0x7fd8ff, ring: 0x7fd8ff },
  maya: { accent: 0x9fe8d8, cloth: 0x2e3d48, trim: 0xdfe9f5, ring: 0xbfeede },
};
