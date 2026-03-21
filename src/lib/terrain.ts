import { createNoise2D } from 'simplex-noise';

// --- Heightmap generation ---

export interface TerrainParams {
  seed: number;
  frequency: number;    // base noise frequency (lower = larger features)
  octaves: number;      // layers of detail
  lacunarity: number;   // frequency multiplier per octave
  persistence: number;  // amplitude multiplier per octave
  contourInterval: number; // elevation step between contour lines
}

export const DEFAULT_PARAMS: TerrainParams = {
  seed: 42,
  frequency: 0.004,
  octaves: 5,
  lacunarity: 2.0,
  persistence: 0.5,
  contourInterval: 0.08,
};

/** Simple seeded PRNG (mulberry32) for deterministic noise */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a 2D heightmap using multi-octave simplex noise.
 * Returns values normalized to [0, 1].
 */
export function generateHeightmap(
  width: number,
  height: number,
  params: TerrainParams
): Float32Array {
  const rng = mulberry32(params.seed);
  const noise2D = createNoise2D(rng);

  const map = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let freq = params.frequency;
      let totalAmplitude = 0;

      for (let o = 0; o < params.octaves; o++) {
        value += noise2D(x * freq, y * freq) * amplitude;
        totalAmplitude += amplitude;
        freq *= params.lacunarity;
        amplitude *= params.persistence;
      }

      value /= totalAmplitude; // normalize to [-1, 1]
      const idx = y * width + x;
      map[idx] = value;

      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  // Normalize to [0, 1]
  const range = max - min || 1;
  for (let i = 0; i < map.length; i++) {
    map[i] = (map[i] - min) / range;
  }

  return map;
}

// --- Contour line extraction (marching squares) ---

interface Segment {
  x1: number; y1: number;
  x2: number; y2: number;
}

/** Linear interpolation for where the contour crosses an edge */
function lerp(v1: number, v2: number, threshold: number): number {
  if (Math.abs(v2 - v1) < 1e-10) return 0.5;
  return (threshold - v1) / (v2 - v1);
}

/**
 * Extract contour line segments at a given threshold using marching squares.
 * Returns an array of line segments in grid coordinates.
 */
function marchingSquares(
  heightmap: Float32Array,
  width: number,
  height: number,
  threshold: number
): Segment[] {
  const segments: Segment[] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      // Corner values: TL, TR, BR, BL
      const tl = heightmap[y * width + x];
      const tr = heightmap[y * width + x + 1];
      const br = heightmap[(y + 1) * width + x + 1];
      const bl = heightmap[(y + 1) * width + x];

      // Build 4-bit case index
      let caseIndex = 0;
      if (tl >= threshold) caseIndex |= 8;
      if (tr >= threshold) caseIndex |= 4;
      if (br >= threshold) caseIndex |= 2;
      if (bl >= threshold) caseIndex |= 1;

      // Skip empty/full cells
      if (caseIndex === 0 || caseIndex === 15) continue;

      // Interpolated edge crossing points
      const top = lerp(tl, tr, threshold);
      const right = lerp(tr, br, threshold);
      const bottom = lerp(bl, br, threshold);
      const left = lerp(tl, bl, threshold);

      // Edge midpoints in cell-local coords, then offset to grid
      const t = { x: x + top, y: y };
      const r = { x: x + 1, y: y + right };
      const b = { x: x + bottom, y: y + 1 };
      const l = { x: x, y: y + left };

      // Lookup: which edges to connect
      switch (caseIndex) {
        case 1:  segments.push({ x1: l.x, y1: l.y, x2: b.x, y2: b.y }); break;
        case 2:  segments.push({ x1: b.x, y1: b.y, x2: r.x, y2: r.y }); break;
        case 3:  segments.push({ x1: l.x, y1: l.y, x2: r.x, y2: r.y }); break;
        case 4:  segments.push({ x1: t.x, y1: t.y, x2: r.x, y2: r.y }); break;
        case 5:  // saddle
          segments.push({ x1: l.x, y1: l.y, x2: t.x, y2: t.y });
          segments.push({ x1: b.x, y1: b.y, x2: r.x, y2: r.y });
          break;
        case 6:  segments.push({ x1: t.x, y1: t.y, x2: b.x, y2: b.y }); break;
        case 7:  segments.push({ x1: l.x, y1: l.y, x2: t.x, y2: t.y }); break;
        case 8:  segments.push({ x1: t.x, y1: t.y, x2: l.x, y2: l.y }); break;
        case 9:  segments.push({ x1: t.x, y1: t.y, x2: b.x, y2: b.y }); break;
        case 10: // saddle
          segments.push({ x1: t.x, y1: t.y, x2: r.x, y2: r.y });
          segments.push({ x1: l.x, y1: l.y, x2: b.x, y2: b.y });
          break;
        case 11: segments.push({ x1: t.x, y1: t.y, x2: r.x, y2: r.y }); break;
        case 12: segments.push({ x1: l.x, y1: l.y, x2: r.x, y2: r.y }); break;
        case 13: segments.push({ x1: b.x, y1: b.y, x2: r.x, y2: r.y }); break;
        case 14: segments.push({ x1: l.x, y1: l.y, x2: b.x, y2: b.y }); break;
      }
    }
  }

  return segments;
}

// --- Vegetation generation ---

/** Smooth Hermite interpolation between 0 and 1 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Linearly interpolate between two RGB colours */
function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  return [
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  ];
}

/**
 * Generate a Firewatch-style vegetation image.
 * Uses a separate noise layer (different seed) with domain warping
 * to produce smooth organic zones of parchment / meadow / forest.
 * Returns ImageData at half the map resolution for performance.
 */
export function generateVegetationImage(
  pixelW: number,
  pixelH: number,
  cssW: number,
  cssH: number,
  heightmap: Float32Array,
  gridW: number,
  gridH: number,
  params: TerrainParams,
  rivers?: Int32Array,
  lakes?: Uint8Array
): ImageData {
  // Render at full physical pixel resolution, sample noise at CSS scale
  const vegW = pixelW;
  const vegH = pixelH;

  // Create separate noise layers with different seeds
  const vegRng = mulberry32(params.seed + 1337);
  const warpRng = mulberry32(params.seed + 7919);
  const vegNoise = createNoise2D(vegRng);
  const warpNoise = createNoise2D(warpRng);

  const imageData = new ImageData(vegW, vegH);
  const buf32 = new Uint32Array(imageData.data.buffer);

  // Colour palette (from Firewatch Campo Santo map)
  const PARCHMENT = { r: 221, g: 212, b: 184 }; // #ddd4b8 — warm cream clearings
  const MEADOW    = { r: 171, g: 173, b: 130 }; // #abad82 — light sage/olive
  const WOODLAND  = { r: 139, g: 148, b: 104 }; // #8b9468 — mid olive
  const FOREST    = { r: 104, g: 119, b:  72 }; // #687748 — deep olive

  // Water colour for lake cells
  const WATER = { r: 168, g: 196, b: 196 }; // #a8c4c4

  // Pre-compute "near water" grid for riparian vegetation boost
  const RIVER_THRESHOLD = 500;
  const RIPARIAN_RADIUS = 8;
  let nearWater: Uint8Array | null = null;
  if (rivers || lakes) {
    nearWater = new Uint8Array(gridW * gridH);
    // Mark water cells, then BFS outward to find cells within RIPARIAN_RADIUS
    const queue: [number, number][] = []; // [index, distance]
    const dist = new Float32Array(gridW * gridH).fill(Infinity);

    for (let i = 0; i < gridW * gridH; i++) {
      const isWater = (lakes && lakes[i]) || (rivers && rivers[i] >= RIVER_THRESHOLD);
      if (isWater) {
        dist[i] = 0;
        queue.push([i, 0]);
      }
    }

    let qi = 0;
    while (qi < queue.length) {
      const [idx, d] = queue[qi++];
      if (d >= RIPARIAN_RADIUS) continue;
      const x = idx % gridW;
      const y = (idx - x) / gridW;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
          const nIdx = ny * gridW + nx;
          const nd = d + 1;
          if (nd < dist[nIdx]) {
            dist[nIdx] = nd;
            nearWater[nIdx] = 1;
            queue.push([nIdx, nd]);
          }
        }
      }
    }
  }

  const vegFreq = 0.003;   // base frequency for vegetation noise (lower = larger blobs)
  const warpFreq = 0.0015; // frequency for domain warping
  const warpAmp = 60;      // how far domain warping displaces (in pixels)

  for (let py = 0; py < vegH; py++) {
    for (let px = 0; px < vegW; px++) {
      // Map physical pixel to CSS coordinate for noise sampling
      const fullX = (px / vegW) * cssW;
      const fullY = (py / vegH) * cssH;

      // Domain warping: offset the noise sample coordinates for organic edges
      const warpX = warpNoise(fullX * warpFreq, fullY * warpFreq) * warpAmp;
      const warpY = warpNoise(fullX * warpFreq + 100, fullY * warpFreq + 100) * warpAmp;

      // Multi-octave vegetation noise (2 octaves for smooth shapes)
      let veg = 0;
      let amp = 1;
      let freq = vegFreq;
      let totalAmp = 0;
      for (let o = 0; o < 3; o++) {
        veg += vegNoise((fullX + warpX) * freq, (fullY + warpY) * freq) * amp;
        totalAmp += amp;
        freq *= 2.0;
        amp *= 0.5;
      }
      veg = (veg / totalAmp + 1) / 2; // normalize to [0, 1]

      // Sample elevation at this position (nearest neighbour from heightmap grid)
      const gx = Math.min(gridW - 1, Math.max(0, Math.round((fullX / cssW) * (gridW - 1))));
      const gy = Math.min(gridH - 1, Math.max(0, Math.round((fullY / cssH) * (gridH - 1))));
      const elevation = heightmap[gy * gridW + gx];

      // Blend: low elevation biases toward denser vegetation
      let blended = (1 - elevation) * 0.55 + veg * 0.45;

      // Lake cells: render as water colour
      const gridIdx = gy * gridW + gx;
      if (lakes && lakes[gridIdx]) {
        buf32[py * vegW + px] =
          (255 << 24) |
          (WATER.b << 16) |
          (WATER.g << 8) |
          WATER.r;
        continue;
      }

      // Riparian boost: cells near water are slightly denser vegetation
      if (nearWater && nearWater[gridIdx]) {
        blended = Math.min(1, blended * 1.15);
      }

      // Map blended value to colour via smoothstep transitions (4 tones)
      let r: number, g: number, b: number;

      const tMeadow   = smoothstep(0.33, 0.36, blended);
      const tWoodland = smoothstep(0.46, 0.49, blended);
      const tForest   = smoothstep(0.59, 0.62, blended);

      if (tForest > 0) {
        [r, g, b] = lerpColor(
          WOODLAND.r, WOODLAND.g, WOODLAND.b,
          FOREST.r, FOREST.g, FOREST.b,
          tForest
        );
      } else if (tWoodland > 0) {
        [r, g, b] = lerpColor(
          MEADOW.r, MEADOW.g, MEADOW.b,
          WOODLAND.r, WOODLAND.g, WOODLAND.b,
          tWoodland
        );
      } else {
        [r, g, b] = lerpColor(
          PARCHMENT.r, PARCHMENT.g, PARCHMENT.b,
          MEADOW.r, MEADOW.g, MEADOW.b,
          tMeadow
        );
      }

      // Write pixel (ABGR for little-endian Uint32Array)
      buf32[py * vegW + px] =
        (255 << 24) |
        (Math.round(b) << 16) |
        (Math.round(g) << 8) |
        Math.round(r);
    }
  }

  return imageData;
}

// --- Hydrology: flow direction, accumulation, lakes ---

/** D8 direction offsets: index 0-7 → [dx, dy] clockwise from north */
const D8_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const D8_DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const D8_DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

/**
 * Compute D8 flow direction for each cell (steepest descent).
 * Returns direction index 0-7 or -1 for sink/flat cells.
 */
function computeFlowDirection(
  heightmap: Float32Array,
  w: number,
  h: number
): Int8Array {
  const flowDir = new Int8Array(w * h).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const elev = heightmap[idx];
      let steepest = 0;
      let bestDir = -1;

      for (let d = 0; d < 8; d++) {
        const nx = x + D8_DX[d];
        const ny = y + D8_DY[d];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const drop = (elev - heightmap[ny * w + nx]) / D8_DIST[d];
        if (drop > steepest) {
          steepest = drop;
          bestDir = d;
        }
      }

      flowDir[idx] = bestDir;
    }
  }

  return flowDir;
}

/**
 * Compute flow accumulation using topological sort (highest to lowest).
 * Each cell starts with 1, passes its accumulation downstream.
 */
function computeFlowAccumulation(
  heightmap: Float32Array,
  flowDir: Int8Array,
  w: number,
  h: number
): Int32Array {
  const n = w * h;
  const accum = new Int32Array(n).fill(1);

  // Sort cell indices by descending elevation
  const indices = new Uint32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  indices.sort((a, b) => heightmap[b] - heightmap[a]);

  // Process from highest to lowest: drain into downstream neighbour
  for (let i = 0; i < n; i++) {
    const idx = indices[i];
    const dir = flowDir[idx];
    if (dir < 0) continue;

    const x = idx % w;
    const y = (idx - x) / w;
    const nx = x + D8_DX[dir];
    const ny = y + D8_DY[dir];
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      accum[ny * w + nx] += accum[idx];
    }
  }

  return accum;
}

/**
 * Detect lakes by flood-filling from sink cells.
 * A sink is a cell with no downhill neighbour (flowDir = -1).
 * BFS from each sink, filling to the pour-point elevation.
 * Only keeps the largest few lakes to avoid noise artefacts.
 * Returns binary mask: 1 = lake, 0 = land.
 */
function detectLakes(
  heightmap: Float32Array,
  flowDir: Int8Array,
  w: number,
  h: number
): Uint8Array {
  const lake = new Uint8Array(w * h);
  const MIN_LAKE_SIZE = 25;   // ignore small puddles
  const MAX_LAKES = 5;        // only keep the N largest

  // Find all sink cells (not on the grid edge, to avoid edge-sink noise)
  const sinks: number[] = [];
  const processed = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (flowDir[y * w + x] === -1) {
        sinks.push(y * w + x);
      }
    }
  }

  // Collect all candidate basins
  const basins: number[][] = [];

  for (const sinkIdx of sinks) {
    if (processed[sinkIdx]) continue;

    const sinkElev = heightmap[sinkIdx];

    // Find pour-point: lowest rim elevation (neighbour higher than sink)
    let pourElev = Infinity;
    const sx = sinkIdx % w;
    const sy = (sinkIdx - sx) / w;

    for (let d = 0; d < 8; d++) {
      const nx = sx + D8_DX[d];
      const ny = sy + D8_DY[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nElev = heightmap[ny * w + nx];
      if (nElev > sinkElev && nElev < pourElev) {
        pourElev = nElev;
      }
    }

    if (pourElev === Infinity) continue;

    // Conservative fill level — only fill 35% of the way to pour point
    const fillLevel = sinkElev + (pourElev - sinkElev) * 0.35;

    // BFS flood fill
    const basinCells: number[] = [];
    const visited = new Set<number>();
    const queue: number[] = [sinkIdx];
    visited.add(sinkIdx);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (heightmap[cur] > fillLevel) continue;
      basinCells.push(cur);

      const cx = cur % w;
      const cy = (cur - cx) / w;
      for (let d = 0; d < 8; d++) {
        const nx = cx + D8_DX[d];
        const ny = cy + D8_DY[d];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (!visited.has(nIdx)) {
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }

    // Mark cells as processed so overlapping sinks don't re-flood
    for (const c of basinCells) processed[c] = 1;

    if (basinCells.length >= MIN_LAKE_SIZE) {
      basins.push(basinCells);
    }
  }

  // Only keep the largest N basins
  basins.sort((a, b) => b.length - a.length);
  const kept = basins.slice(0, MAX_LAKES);
  for (const basin of kept) {
    for (const c of basin) {
      lake[c] = 1;
    }
  }

  return lake;
}

/**
 * Generate water masks (rivers + lakes) from a heightmap.
 * Single entry point for the renderer.
 */
export function generateWaterMask(
  heightmap: Float32Array,
  w: number,
  h: number
): { rivers: Int32Array; lakes: Uint8Array; flowDir: Int8Array } {
  const flowDir = computeFlowDirection(heightmap, w, h);
  const rivers = computeFlowAccumulation(heightmap, flowDir, w, h);
  const lakes = detectLakes(heightmap, flowDir, w, h);
  return { rivers, lakes, flowDir };
}

/**
 * Extract all contour lines from a heightmap.
 * Returns segments grouped by contour level.
 */
export function extractContours(
  heightmap: Float32Array,
  width: number,
  height: number,
  interval: number
): { level: number; segments: Segment[] }[] {
  const contours: { level: number; segments: Segment[] }[] = [];

  for (let level = interval; level < 1.0; level += interval) {
    const segments = marchingSquares(heightmap, width, height, level);
    if (segments.length > 0) {
      contours.push({ level, segments });
    }
  }

  return contours;
}
