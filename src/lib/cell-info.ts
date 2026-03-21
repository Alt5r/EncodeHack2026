import { createNoise2D } from 'simplex-noise';
import { mulberry32, generateWaterFeatures, type TerrainParams, type RiverPath, type LakeRegion } from './terrain';

// Derived from heightmap length — no hardcoded resolution
function getGridDims(heightmap: Float32Array): { GRID_W: number; GRID_H: number } {
  const side = Math.round(Math.sqrt(heightmap.length));
  return { GRID_W: side, GRID_H: side };
}

export type WaterType = 'none' | 'water';

export interface CellTerrain {
  elevation: number;         // 0–1 raw
  elevationMeters: number;   // scaled to meters
  slope: number;             // gradient magnitude
  slopeLabel: string;        // Flat / Gentle / Moderate / Steep
  vegetationType: string;    // Clearing / Meadow / Woodland / Forest
  vegetationColor: string;   // hex colour matching the rendered tone
  waterType: WaterType;      // river / lake / none
  fireResistance: number;    // 0–1 (1 = fully resistant, water cells are 1.0)
  traversalDifficulty: string; // Easy / Moderate / Difficult / Impassable
  traversalScore: number;    // 0–1
}

/**
 * Build a lookup map from water features → game grid cells.
 * Maps "row,col" → WaterType. Cached per grid size.
 */
let _waterCache: { gridSize: number; seed: number; map: Map<string, WaterType> } | null = null;

export function getWaterMap(
  heightmap: Float32Array,
  gridSize: number,
  params: TerrainParams,
): Map<string, WaterType> {
  // Return cached if same params
  if (_waterCache && _waterCache.gridSize === gridSize && _waterCache.seed === params.seed) {
    return _waterCache.map;
  }

  const { GRID_W, GRID_H } = getGridDims(heightmap);
  const { rivers, lakes } = generateWaterFeatures(heightmap, GRID_W, GRID_H, params);
  const map = new Map<string, WaterType>();

  // Map water feature coordinates (in heightmap space) → game grid cells
  // Only mark cells where water actually occupies the cell — no buffer
  for (const lake of lakes) {
    for (const pt of lake.cells) {
      const col = Math.floor((pt.x / GRID_W) * gridSize);
      const row = Math.floor((pt.y / GRID_H) * gridSize);
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        map.set(`${row},${col}`, 'water');
      }
    }
  }

  for (const river of rivers) {
    // Map pre-computed curve points (dense bezier samples) to game grid cells.
    // No bezier math here — sampleBezierCurve() already did it in terrain.ts.
    for (const pt of river.curvePoints) {
      const col = Math.floor((pt.x / GRID_W) * gridSize);
      const row = Math.floor((pt.y / GRID_H) * gridSize);
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        const key = `${row},${col}`;
        if (!map.has(key)) map.set(key, 'water');
      }
    }
  }

  _waterCache = { gridSize, seed: params.seed, map };
  return map;
}

/**
 * Query terrain properties for a cell in the game grid.
 * Elevation & slope come from the 300×300 heightmap.
 * Vegetation type is recomputed using the same noise + blend formula
 * as generateVegetationImage in terrain.ts.
 *
 * @param mapW  Current CSS width of the map area (needed to reproduce vegetation noise)
 * @param mapH  Current CSS height of the map area
 */
export function getCellTerrain(
  row: number,
  col: number,
  gridSize: number,
  heightmap: Float32Array,
  mapW: number,
  mapH: number,
  params: TerrainParams,
): CellTerrain {
  const { GRID_W, GRID_H } = getGridDims(heightmap);

  // ── Cell centre in normalised [0,1] coordinates ──
  const normX = (col + 0.5) / gridSize;
  const normY = (row + 0.5) / gridSize;

  // ── Elevation ──
  const gx = Math.min(GRID_W - 1, Math.max(0, Math.round(normX * (GRID_W - 1))));
  const gy = Math.min(GRID_H - 1, Math.max(0, Math.round(normY * (GRID_H - 1))));
  const elevation = heightmap[gy * GRID_W + gx];

  const MAX_ELEVATION_M = 2400;
  const elevationMeters = Math.round(elevation * MAX_ELEVATION_M);

  // ── Slope (central differences on heightmap) ──
  const gxL = Math.max(0, gx - 1);
  const gxR = Math.min(GRID_W - 1, gx + 1);
  const gyT = Math.max(0, gy - 1);
  const gyB = Math.min(GRID_H - 1, gy + 1);

  const dx = (heightmap[gy * GRID_W + gxR] - heightmap[gy * GRID_W + gxL]) / (gxR - gxL || 1);
  const dy = (heightmap[gyB * GRID_W + gx] - heightmap[gyT * GRID_W + gx]) / (gyB - gyT || 1);
  const slope = Math.sqrt(dx * dx + dy * dy);

  let slopeLabel: string;
  if (slope < 0.02) slopeLabel = 'Flat';
  else if (slope < 0.05) slopeLabel = 'Gentle';
  else if (slope < 0.1) slopeLabel = 'Moderate';
  else slopeLabel = 'Steep';

  // ── Vegetation (same noise + blend as generateVegetationImage) ──
  const vegRng = mulberry32(params.seed + 1337);
  const warpRng = mulberry32(params.seed + 7919);
  const vegNoise = createNoise2D(vegRng);
  const warpNoise = createNoise2D(warpRng);

  // CSS position of cell centre within the map area
  const fullX = normX * mapW;
  const fullY = normY * mapH;

  const vegFreq = 0.003;
  const warpFreq = 0.0015;
  const warpAmp = 60;

  const warpX = warpNoise(fullX * warpFreq, fullY * warpFreq) * warpAmp;
  const warpY = warpNoise(fullX * warpFreq + 100, fullY * warpFreq + 100) * warpAmp;

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
  veg = (veg / totalAmp + 1) / 2; // normalise to [0,1]

  const blended = (1 - elevation) * 0.55 + veg * 0.45;

  // Classify using the same smoothstep edge thresholds as the renderer
  let vegetationType: string;
  let vegetationColor: string;
  if (blended >= 0.59) {
    vegetationType = 'Forest';
    vegetationColor = '#687748';
  } else if (blended >= 0.46) {
    vegetationType = 'Woodland';
    vegetationColor = '#8b9468';
  } else if (blended >= 0.33) {
    vegetationType = 'Meadow';
    vegetationColor = '#abad82';
  } else {
    vegetationType = 'Clearing';
    vegetationColor = '#ddd4b8';
  }

  // ── Water ──
  const waterMap = getWaterMap(heightmap, gridSize, params);
  const waterType: WaterType = waterMap.get(`${row},${col}`) ?? 'none';

  // Water cells are natural fire barriers
  const fireResistance = waterType !== 'none' ? 1.0 : 0;

  // ── Traversal difficulty (slope + vegetation density) ──
  const slopeScore = Math.min(1, slope / 0.12);
  const vegScore = Math.min(1, blended);
  let traversalScore = slopeScore * 0.5 + vegScore * 0.5;

  let traversalDifficulty: string;
  if (waterType !== 'none') {
    // Water cells are impassable for ground units
    traversalScore = 1.0;
    traversalDifficulty = 'Impassable (Water)';
  } else if (traversalScore < 0.3) traversalDifficulty = 'Easy';
  else if (traversalScore < 0.5) traversalDifficulty = 'Moderate';
  else if (traversalScore < 0.7) traversalDifficulty = 'Difficult';
  else traversalDifficulty = 'Impassable';

  return {
    elevation,
    elevationMeters,
    slope,
    slopeLabel,
    vegetationType,
    vegetationColor,
    waterType,
    fireResistance,
    traversalDifficulty,
    traversalScore,
  };
}
