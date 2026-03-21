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
export function mulberry32(seed: number): () => number {
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
  params: TerrainParams
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

  // Colour palette (Firewatch-inspired, saturated)
  const PARCHMENT = { r: 235, g: 222, b: 182 }; // #ebdeb6 — warm golden cream
  const MEADOW    = { r: 158, g: 182, b: 108 }; // #9eb66c — bright sage green
  const WOODLAND  = { r: 112, g: 152, b:  76 }; // #70984c — rich mid green
  const FOREST    = { r:  68, g: 112, b:  52 }; // #447034 — deep vibrant green

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
      const blended = (1 - elevation) * 0.55 + veg * 0.45;

      // Map blended value to colour via smoothstep transitions (4 tones)
      let r: number, g: number, b: number;

      const tMeadow   = smoothstep(0.25, 0.28, blended);
      const tWoodland = smoothstep(0.36, 0.39, blended);
      const tForest   = smoothstep(0.48, 0.51, blended);

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

// --- Water features (rivers & lakes) ---

export interface WaterPoint {
  x: number;
  y: number;
}

export interface RiverPath {
  /** Sparse control points used by the renderer for bezier drawing. */
  points: WaterPoint[];
  /** Dense samples along the actual bezier curves. Use for cell detection. */
  curvePoints: WaterPoint[];
}

export interface LakeRegion {
  cells: WaterPoint[];
}

/**
 * Trace a river path downhill from a starting point using steepest descent.
 */
function traceDownhill(
  heightmap: Float32Array,
  gridW: number,
  gridH: number,
  startX: number,
  startY: number,
): WaterPoint[] {
  const path: WaterPoint[] = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;
  const visited = new Set<number>();
  visited.add(cy * gridW + cx);
  let stuckCount = 0; // how many steps we've been unable to go downhill

  for (let step = 0; step < 600; step++) {
    const curH = heightmap[cy * gridW + cx];
    let lowestH = curH;
    let bestX = cx;
    let bestY = cy;
    // Also track best flat neighbor (same height) as fallback
    let flatX = -1;
    let flatY = -1;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const key = ny * gridW + nx;
        if (visited.has(key)) continue;
        const h = heightmap[key];
        if (h < lowestH) {
          lowestH = h;
          bestX = nx;
          bestY = ny;
        } else if (h <= curH + 0.01 && flatX === -1) {
          // Nearly flat — viable overflow path
          flatX = nx;
          flatY = ny;
        }
      }
    }

    // Found a downhill neighbor — take it
    if (bestX !== cx || bestY !== cy) {
      cx = bestX;
      cy = bestY;
      stuckCount = 0;
    } else if (flatX !== -1) {
      // No downhill, but flat neighbor available — overflow across flat terrain
      cx = flatX;
      cy = flatY;
      stuckCount++;
    } else {
      // Truly stuck — no unvisited downhill or flat neighbors
      // Extend in momentum direction toward the nearest edge
      break;
    }

    visited.add(cy * gridW + cx);
    path.push({ x: cx, y: cy });
    if (cx <= 0 || cx >= gridW - 1 || cy <= 0 || cy >= gridH - 1) break;
    // Don't let flat-traversal run forever
    if (stuckCount > 40) break;
  }

  // If the river ended mid-map, extend it toward the nearest edge
  const atEdge = cx <= 0 || cx >= gridW - 1 || cy <= 0 || cy >= gridH - 1;
  if (!atEdge && path.length >= 2) {
    // Compute momentum from last few points
    const lookback = Math.min(8, path.length - 1);
    const tail = path[path.length - 1];
    const ref = path[path.length - 1 - lookback];
    let mdx = tail.x - ref.x;
    let mdy = tail.y - ref.y;
    const mag = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mag > 0) {
      mdx /= mag;
      mdy /= mag;
    } else {
      // Fallback: head toward nearest edge
      const distL = cx, distR = gridW - 1 - cx;
      const distT = cy, distB = gridH - 1 - cy;
      const minDist = Math.min(distL, distR, distT, distB);
      if (minDist === distL) { mdx = -1; mdy = 0; }
      else if (minDist === distR) { mdx = 1; mdy = 0; }
      else if (minDist === distT) { mdx = 0; mdy = -1; }
      else { mdx = 0; mdy = 1; }
    }

    // Walk in that direction until we hit the edge, with sinusoidal meandering
    let ex = cx, ey = cy;
    // Perpendicular vector for lateral wobble
    const px = -mdy, py = mdx;
    const wobbleFreq = 0.08 + Math.random() * 0.06; // how tight the curves are
    const wobbleAmp = 2.5 + Math.random() * 2;      // how far it sways
    for (let i = 0; i < 200; i++) {
      const wobble = Math.sin(i * wobbleFreq) * wobbleAmp;
      ex += mdx + px * wobble * 0.15;
      ey += mdy + py * wobble * 0.15;
      const rx = Math.round(ex);
      const ry = Math.round(ey);
      if (rx < 0 || rx >= gridW || ry < 0 || ry >= gridH) break;
      path.push({ x: rx, y: ry });
    }
  }

  return path;
}

/**
 * Flood-fill from a low point up to a height threshold to form a lake.
 */
function floodFillLake(
  heightmap: Float32Array,
  gridW: number,
  gridH: number,
  startX: number,
  startY: number,
  maxH: number,
  maxCells: number = 800,
): WaterPoint[] {
  const cells: WaterPoint[] = [];
  const visited = new Set<number>();
  const queue: WaterPoint[] = [{ x: startX, y: startY }];
  visited.add(startY * gridW + startX);

  while (queue.length > 0 && cells.length < maxCells) {
    const { x, y } = queue.shift()!;
    if (heightmap[y * gridW + x] > maxH) continue;
    cells.push({ x, y });

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      const key = ny * gridW + nx;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return cells;
}

/**
 * Sample dense points along the quadratic bezier curves that the renderer
 * draws through the given sparse control points. Mirrors the traceBand()
 * logic in MapCanvas: moveTo(pts[0]), quadraticCurveTo(pts[i], mid(pts[i], pts[i+1])), lineTo(last).
 */
function sampleBezierCurve(pts: WaterPoint[]): WaterPoint[] {
  if (pts.length < 2) return [...pts];

  const out: WaterPoint[] = [{ x: pts[0].x, y: pts[0].y }];

  let curX = pts[0].x;
  let curY = pts[0].y;

  for (let i = 1; i < pts.length - 1; i++) {
    const cpX = pts[i].x;
    const cpY = pts[i].y;
    const endX = (pts[i].x + pts[i + 1].x) / 2;
    const endY = (pts[i].y + pts[i + 1].y) / 2;

    const dist = Math.sqrt((endX - curX) ** 2 + (endY - curY) ** 2);
    const samples = Math.max(4, Math.ceil(dist / 2));
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const u = 1 - t;
      out.push({
        x: u * u * curX + 2 * u * t * cpX + t * t * endX,
        y: u * u * curY + 2 * u * t * cpY + t * t * endY,
      });
    }

    curX = endX;
    curY = endY;
  }

  // Final straight segment to last point
  const last = pts[pts.length - 1];
  const dist = Math.sqrt((last.x - curX) ** 2 + (last.y - curY) ** 2);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    out.push({
      x: curX + (last.x - curX) * t,
      y: curY + (last.y - curY) * t,
    });
  }

  return out;
}

/**
 * Generate topology-driven water features.
 * Rivers: trace steepest descent from high-elevation sources.
 * Lakes: flood-fill depressions in low-elevation areas.
 * Features are deliberately large/prominent for the Firewatch map style.
 */
export function generateWaterFeatures(
  heightmap: Float32Array,
  gridW: number,
  gridH: number,
  params: TerrainParams,
): { rivers: RiverPath[]; lakes: LakeRegion[] } {
  const margin = 10;

  // ── Rivers ──
  // Source rivers from map edges so they flow in from off-screen
  // Scan all four edges for medium-to-high elevation entry points
  const candidates: { x: number; y: number; h: number }[] = [];
  const step = 4;
  // Top & bottom edges
  for (let x = margin; x < gridW - margin; x += step) {
    const hTop = heightmap[0 * gridW + x];
    if (hTop > 0.3) candidates.push({ x, y: 0, h: hTop });
    const hBot = heightmap[(gridH - 1) * gridW + x];
    if (hBot > 0.3) candidates.push({ x, y: gridH - 1, h: hBot });
  }
  // Left & right edges
  for (let y = margin; y < gridH - margin; y += step) {
    const hLeft = heightmap[y * gridW + 0];
    if (hLeft > 0.3) candidates.push({ x: 0, y, h: hLeft });
    const hRight = heightmap[y * gridW + (gridW - 1)];
    if (hRight > 0.3) candidates.push({ x: gridW - 1, y, h: hRight });
  }
  // Prefer higher entry points — they'll trace longer paths downhill
  candidates.sort((a, b) => b.h - a.h);

  const rivers: RiverPath[] = [];
  const usedStarts: WaterPoint[] = [];

  for (const cand of candidates) {
    if (rivers.length >= 4) break;
    // Space out river sources along the edges
    if (usedStarts.some(s => Math.hypot(s.x - cand.x, s.y - cand.y) < 60)) continue;

    const rawPath = traceDownhill(heightmap, gridW, gridH, cand.x, cand.y);
    if (rawPath.length < 30) continue;

    // Subsample for smooth curves (every 5th point)
    const smooth: WaterPoint[] = [rawPath[0]];
    for (let i = 5; i < rawPath.length - 1; i += 5) {
      smooth.push(rawPath[i]);
    }
    smooth.push(rawPath[rawPath.length - 1]);

    const curvePoints = sampleBezierCurve(smooth);
    rivers.push({ points: smooth, curvePoints });
    usedStarts.push(cand);
  }

  // ── Lakes ──
  // Find depressions: low-elevation areas that aren't near map edges
  const lakeSeeds: { x: number; y: number; h: number }[] = [];
  for (let y = margin; y < gridH - margin; y += 6) {
    for (let x = margin; x < gridW - margin; x += 6) {
      const h = heightmap[y * gridW + x];
      if (h < 0.25) lakeSeeds.push({ x, y, h });
    }
  }
  lakeSeeds.sort((a, b) => a.h - b.h);

  const lakes: LakeRegion[] = [];
  const usedLakes: WaterPoint[] = [];

  for (const seed of lakeSeeds) {
    if (lakes.length >= 3) break;
    if (usedLakes.some(l => Math.hypot(l.x - seed.x, l.y - seed.y) < 40)) continue;

    // Generous threshold for large lakes
    const threshold = seed.h + 0.08;
    const cells = floodFillLake(heightmap, gridW, gridH, seed.x, seed.y, threshold);

    if (cells.length >= 20) {
      lakes.push({ cells });
      usedLakes.push(seed);
    }
  }

  return { rivers, lakes };
}

// --- Map decorations (trees, rocks, grass, peak markers) ---

/**
 * Draw cartographic decorations onto the terrain canvas.
 * Uses seeded placement so decorations are deterministic across renders.
 * Should be called after vegetation fill and before contour lines.
 */
export function drawMapDecorations(
  ctx: CanvasRenderingContext2D,
  heightmap: Float32Array,
  gridW: number,
  gridH: number,
  mapX: number,
  mapY: number,
  mapW: number,
  mapH: number,
  params: TerrainParams,
) {
  const rng = mulberry32(params.seed + 5555);

  // Vegetation noise — same seeds as generateVegetationImage for matching zones
  const vegNoise = createNoise2D(mulberry32(params.seed + 1337));
  const warpNoise = createNoise2D(mulberry32(params.seed + 7919));
  const vegFreq = 0.003;
  const warpFreq = 0.0015;
  const warpAmp = 60;

  // Build water cell set for exclusion (with padding so decorations don't touch water)
  const { rivers, lakes } = generateWaterFeatures(heightmap, gridW, gridH, params);
  const waterCells = new Set<number>();
  const lakeBuffer = 2;
  for (const lake of lakes) {
    for (const cell of lake.cells) {
      for (let dy = -lakeBuffer; dy <= lakeBuffer; dy++) {
        for (let dx = -lakeBuffer; dx <= lakeBuffer; dx++) {
          const lx = cell.x + dx;
          const ly = cell.y + dy;
          if (lx >= 0 && lx < gridW && ly >= 0 && ly < gridH) {
            waterCells.add(ly * gridW + lx);
          }
        }
      }
    }
  }
  // River exclusion: wide buffer (±4 cells) to cover bezier curves + subsampled gaps
  const riverBuffer = 4;
  for (const river of rivers) {
    for (const pt of river.points) {
      for (let dy = -riverBuffer; dy <= riverBuffer; dy++) {
        for (let dx = -riverBuffer; dx <= riverBuffer; dx++) {
          const rx = pt.x + dx;
          const ry = pt.y + dy;
          if (rx >= 0 && rx < gridW && ry >= 0 && ry < gridH) {
            waterCells.add(ry * gridW + rx);
          }
        }
      }
    }
  }

  /** Compute vegetation blend at a CSS-space coordinate (relative to map origin) */
  function getBlend(cx: number, cy: number): { blend: number; elevation: number } {
    const wX = warpNoise(cx * warpFreq, cy * warpFreq) * warpAmp;
    const wY = warpNoise(cx * warpFreq + 100, cy * warpFreq + 100) * warpAmp;

    let veg = 0;
    let amp = 1;
    let freq = vegFreq;
    let totalAmp = 0;
    for (let o = 0; o < 3; o++) {
      veg += vegNoise((cx + wX) * freq, (cy + wY) * freq) * amp;
      totalAmp += amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    veg = (veg / totalAmp + 1) / 2;

    const gx = Math.min(gridW - 1, Math.max(0, Math.round((cx / mapW) * (gridW - 1))));
    const gy = Math.min(gridH - 1, Math.max(0, Math.round((cy / mapH) * (gridH - 1))));
    const elevation = heightmap[gy * gridW + gx];

    return { blend: (1 - elevation) * 0.55 + veg * 0.45, elevation };
  }

  /** Check if a CSS-space coordinate falls on a water cell */
  function isWater(cx: number, cy: number): boolean {
    const gx = Math.min(gridW - 1, Math.max(0, Math.round((cx / mapW) * (gridW - 1))));
    const gy = Math.min(gridH - 1, Math.max(0, Math.round((cy / mapH) * (gridH - 1))));
    return waterCells.has(gy * gridW + gx);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapW, mapH);
  ctx.clip();

  // ── 1. Trees (forest + woodland zones) ──
  const treeSpacing = 12;
  ctx.fillStyle = 'rgba(45, 80, 32, 0.55)';
  for (let py = 0; py < mapH; py += treeSpacing) {
    for (let px = 0; px < mapW; px += treeSpacing) {
      const jx = px + (rng() - 0.5) * treeSpacing * 0.8;
      const jy = py + (rng() - 0.5) * treeSpacing * 0.8;
      if (jx < 0 || jx >= mapW || jy < 0 || jy >= mapH) continue;
      if (isWater(jx, jy)) continue;

      const { blend } = getBlend(jx, jy);
      if (blend < 0.36) continue; // below woodland threshold
      if (blend < 0.48 && rng() > 0.5) continue; // sparser in woodland

      const sx = mapX + jx;
      const sy = mapY + jy;
      const h = 8 + rng() * 3; // 8–11px tall
      const halfW = h * 0.4;

      ctx.beginPath();
      ctx.moveTo(sx, sy - h);
      ctx.lineTo(sx - halfW, sy);
      ctx.lineTo(sx + halfW, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ── 2. Rocks (high elevation ridges) ──
  const rockSpacing = 20;
  ctx.fillStyle = 'rgba(120, 100, 80, 0.4)';
  for (let py = 0; py < mapH; py += rockSpacing) {
    for (let px = 0; px < mapW; px += rockSpacing) {
      const jx = px + (rng() - 0.5) * rockSpacing * 0.7;
      const jy = py + (rng() - 0.5) * rockSpacing * 0.7;
      if (jx < 0 || jx >= mapW || jy < 0 || jy >= mapH) continue;
      if (isWater(jx, jy)) continue;

      const { elevation } = getBlend(jx, jy);
      if (elevation <= 0.7) continue;

      const sx = mapX + jx;
      const sy = mapY + jy;
      const baseR = 3 + rng() * 1.5; // 3–4.5px
      const verts = 4 + Math.floor(rng() * 3); // 4–6 vertices

      ctx.beginPath();
      for (let v = 0; v < verts; v++) {
        const angle = (v / verts) * Math.PI * 2;
        const r = baseR * (0.55 + rng() * 0.45); // jagged 55–100% of base
        const vx = sx + Math.cos(angle) * r;
        const vy = sy + Math.sin(angle) * r;
        if (v === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // ── 3. Grass tufts (meadow band) ──
  const grassSpacing = 18;
  ctx.strokeStyle = 'rgba(115, 148, 72, 0.4)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (let py = 0; py < mapH; py += grassSpacing) {
    for (let px = 0; px < mapW; px += grassSpacing) {
      const jx = px + (rng() - 0.5) * grassSpacing * 0.7;
      const jy = py + (rng() - 0.5) * grassSpacing * 0.7;
      if (jx < 0 || jx >= mapW || jy < 0 || jy >= mapH) continue;
      if (isWater(jx, jy)) continue;

      const { blend } = getBlend(jx, jy);
      if (blend < 0.25 || blend > 0.36) continue;

      const sx = mapX + jx;
      const sy = mapY + jy;
      const count = 2 + (rng() > 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const ox = (i - (count - 1) / 2) * 2.5;
        ctx.beginPath();
        ctx.moveTo(sx + ox, sy);
        ctx.lineTo(sx + ox + (rng() - 0.5) * 2, sy - 4 - rng() * 1.5);
        ctx.stroke();
      }
    }
  }

  // ── 4. Mountain peak markers (× at local maxima) ──
  const hmScaleX = mapW / (gridW - 1);
  const hmScaleY = mapH / (gridH - 1);
  ctx.strokeStyle = 'rgba(80, 60, 40, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'butt';
  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const elev = heightmap[gy * gridW + gx];
      if (elev <= 0.75) continue;
      if (waterCells.has(gy * gridW + gx)) continue;

      // Check all 8 neighbours are strictly lower
      let isPeak = true;
      for (let dy = -1; dy <= 1 && isPeak; dy++) {
        for (let dx = -1; dx <= 1 && isPeak; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (heightmap[(gy + dy) * gridW + (gx + dx)] >= elev) isPeak = false;
        }
      }
      if (!isPeak) continue;

      const sx = mapX + gx * hmScaleX;
      const sy = mapY + gy * hmScaleY;
      const sz = 4;

      ctx.beginPath();
      ctx.moveTo(sx - sz, sy - sz);
      ctx.lineTo(sx + sz, sy + sz);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + sz, sy - sz);
      ctx.lineTo(sx - sz, sy + sz);
      ctx.stroke();
    }
  }

  ctx.restore();
}
