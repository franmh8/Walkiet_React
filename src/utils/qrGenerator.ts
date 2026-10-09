// Generador de matriz estándar QR (ISO/IEC 18004) en TypeScript puro sin dependencias
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

let val = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = val;
  EXP[i + 255] = val;
  LOG[val] = i;
  val <<= 1;
  if (val & 256) val ^= 0x11d;
}

function gmult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenPoly(n: number): number[] {
  let g: number[] = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    const root = EXP[i];
    for (let j = 0; j < g.length; j++) {
      next[j] ^= gmult(g[j], root);
      next[j + 1] ^= g[j];
    }
    g = next;
  }
  return g;
}

function rsCompute(data: Uint8Array, nEC: number): Uint8Array {
  const gen = rsGenPoly(nEC);
  const res = new Uint8Array(data.length + nEC);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gmult(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

interface VersionConfig {
  v: number;
  size: number;
  totalCW: number;
  dataCW: number;
  ecCW: number;
  align: number[];
}

const VERSIONS_L: VersionConfig[] = [
  { v: 1, size: 21, totalCW: 26, dataCW: 19, ecCW: 7, align: [] },
  { v: 2, size: 25, totalCW: 44, dataCW: 34, ecCW: 10, align: [6, 18] },
  { v: 3, size: 29, totalCW: 70, dataCW: 55, ecCW: 15, align: [6, 22] },
  { v: 4, size: 33, totalCW: 100, dataCW: 80, ecCW: 20, align: [6, 26] },
];

export function generateQrMatrix(text: string): boolean[][] {
  // Convertir a bytes UTF-8
  const utf8: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      utf8.push(code);
    } else if (code < 0x800) {
      utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  let ver = 0;
  while (ver < VERSIONS_L.length - 1 && utf8.length + 2 > VERSIONS_L[ver].dataCW) {
    ver++;
  }
  const cfg = VERSIONS_L[ver];
  const size = cfg.size;

  // Bits
  const bits: number[] = [];
  function pushBits(v: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((v >>> i) & 1);
    }
  }

  // Byte mode indicator: 0100
  pushBits(4, 4);
  // Contador de caracteres (8 bits para versiones 1-9 en modo byte)
  pushBits(utf8.length, 8);
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }
  // Terminador
  const maxBits = cfg.dataCW * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);
  // Alineación a byte
  while (bits.length % 8 !== 0) bits.push(0);
  // Bytes de relleno: 0xEC (236) y 0x11 (17)
  const pad = [236, 17];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(pad[padIdx % 2], 8);
    padIdx++;
  }

  // Codewords de datos
  const dataCW = new Uint8Array(cfg.dataCW);
  for (let i = 0; i < cfg.dataCW; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataCW[i] = b;
  }

  // Error Correction
  const ecCW = rsCompute(dataCW, cfg.ecCW);

  // Unir codewords
  const allCW = new Uint8Array(cfg.totalCW);
  allCW.set(dataCW);
  allCW.set(ecCW, dataCW.length);

  // Inicializar matriz
  const mat: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  // Colocar buscadores (Finder patterns 7x7)
  function placeFinder(r0: number, c0: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = r0 + r;
        const col = c0 + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBlack =
              r === 0 ||
              r === 6 ||
              c === 0 ||
              c === 6 ||
              (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            mat[row][col] = isBlack;
          } else {
            mat[row][col] = false;
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Patrones de alineación
  if (cfg.align.length > 0) {
    const coords = cfg.align;
    for (const r of coords) {
      for (const c of coords) {
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === coords[coords.length - 1]) ||
          (r === coords[coords.length - 1] && c === 6)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack =
              Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            mat[r + dr][c + dc] = isBlack;
          }
        }
      }
    }
  }

  // Patrones de sincronización (Timing)
  for (let i = 8; i < size - 8; i++) {
    if (mat[6][i] === null) mat[6][i] = i % 2 === 0;
    if (mat[i][6] === null) mat[i][6] = i % 2 === 0;
  }

  // Dark module
  mat[size - 8][8] = true;

  // Reservar bits de formato
  for (let i = 0; i < 9; i++) {
    if (mat[8][i] === null) mat[8][i] = false;
    if (mat[i][8] === null) mat[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    const colIdx = size - 1 - i;
    const rowIdx = size - 1 - i;
    if (mat[8][colIdx] === null) mat[8][colIdx] = false;
    if (mat[rowIdx][8] === null) mat[rowIdx][8] = false;
  }

  // Colocar datos en zig-zag
  const allBits: number[] = [];
  for (const b of allCW) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((b >>> i) & 1);
    }
  }

  let bitIdx = 0;
  let dir = -1; // hacia arriba
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // saltar columna de timing
    const rStart = dir === -1 ? size - 1 : 0;
    const rEnd = dir === -1 ? -1 : size;
    for (let row = rStart; row !== rEnd; row += dir) {
      for (let c = 0; c < 2; c++) {
        const currCol = col - c;
        if (mat[row][currCol] === null) {
          const bitVal = bitIdx < allBits.length ? allBits[bitIdx] : 0;
          bitIdx++;
          // Máscara 0: (row + currCol) % 2 === 0
          const mask = (row + currCol) % 2 === 0;
          mat[row][currCol] = Boolean(bitVal ^ (mask ? 1 : 0));
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // Bits de formato para Nivel L, Máscara 0 (BCH precalculado para estándar QR)
  const fmtBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];

  for (let i = 0; i < 6; i++) mat[8][i] = Boolean(fmtBits[i]);
  mat[8][7] = Boolean(fmtBits[6]);
  mat[8][8] = Boolean(fmtBits[7]);
  mat[7][8] = Boolean(fmtBits[8]);
  for (let i = 9; i < 15; i++) mat[14 - i][8] = Boolean(fmtBits[i]);

  for (let i = 0; i < 8; i++) mat[size - 1 - i][8] = Boolean(fmtBits[i]);
  for (let i = 8; i < 15; i++) mat[8][size - 15 + i] = Boolean(fmtBits[i]);

  return mat as boolean[][];
}
