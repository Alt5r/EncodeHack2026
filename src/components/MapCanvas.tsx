'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  AIRCRAFT_SPRITES,
  getMissionProgressPerSecond,
  getMissionRenderState,
} from '@/lib/air-support';
import { generateHeightmap, extractContours, generateVegetationImage, generateWaterFeatures, drawMapDecorations, type TerrainParams } from '@/lib/terrain';
import { GAME_PALETTE } from '@/lib/game-palette';
import type { AirSupportMission, GridCoordinate, SessionState, TreatedCell, Unit, Village, Wind } from '@/lib/types';

interface MapCanvasProps {
  params: TerrainParams;
  gameState?: SessionState | null;
  showGrid?: boolean;
  selectedCell?: { row: number; col: number } | null;
  onCellSelect?: (cell: { row: number; col: number } | null) => void;
}

// Heightmap grid resolution (lower = zoomed-in terrain, bigger features)
const GRID_W = 210;
const GRID_H = 210;

// ── Map geometry (shared between terrain + overlay) ──
export function getMapGeometry(w: number, h: number) {
  const inset = 40;
  const borderWidth = w - inset * 2;
  const borderHeight = h - inset * 2;
  const fillPadding = 2;
  return {
    inset,
    borderWidth,
    borderHeight,
    mapX: inset + fillPadding,
    mapY: inset + fillPadding,
    mapW: borderWidth - fillPadding * 2,
    mapH: borderHeight - fillPadding * 2,
  };
}

// ── Wind direction → angle (radians, 0 = right, CCW) ──
const WIND_ANGLES: Record<string, number> = {
  E: 0, NE: -Math.PI / 4, N: -Math.PI / 2, NW: -3 * Math.PI / 4,
  W: Math.PI, SW: 3 * Math.PI / 4, S: Math.PI / 2, SE: Math.PI / 4,
};

interface MissionAnimationState {
  phase: AirSupportMission['phase'];
  progress: number;
  updatedAt: number;
}

interface UnitAnimationState {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  updatedAt: number;
  durationMs: number;
}

const UNIT_MOVE_DURATION_MS: Record<Unit['type'], number> = {
  helicopter: 1000,
  ground_crew: 1000,
};

function shouldSnapUnitToSnapshot(unit: Unit): boolean {
  return !unit.target || unit.status_text === 'ready' || unit.status_text === 'holding';
}

export default function MapCanvas({ params, gameState, showGrid, selectedCell, onCellSelect }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCacheRef = useRef<HTMLCanvasElement | null>(null);
  const cachedSizeRef = useRef<{ w: number; h: number } | null>(null);
  const cachedSignatureRef = useRef<string | null>(null);
  const hoveredCellRef = useRef<{ row: number; col: number } | null>(null);
  const missionAnimationRef = useRef<Map<string, MissionAnimationState>>(new Map());
  const unitAnimationRef = useRef<Map<string, UnitAnimationState>>(new Map());

  // Zoom & pan state (refs to avoid re-renders)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // ── Render terrain to offscreen canvas (expensive, cached) ──
  const renderTerrain = useCallback((w: number, h: number, dpr: number): HTMLCanvasElement => {
    const offscreen = document.createElement('canvas');
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
    const ctx = offscreen.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const { inset, borderWidth, borderHeight, mapX, mapY, mapW, mapH } = getMapGeometry(w, h);

    // 1. Dusk gradient outside the map boundary
    const backdrop = ctx.createLinearGradient(0, 0, 0, h);
    backdrop.addColorStop(0, GAME_PALETTE.canvasBackdropTop);
    backdrop.addColorStop(0.22, GAME_PALETTE.canvasBackdropUpper);
    backdrop.addColorStop(0.48, GAME_PALETTE.canvasBackdropMid);
    backdrop.addColorStop(0.72, GAME_PALETTE.canvasBackdropLower);
    backdrop.addColorStop(1, GAME_PALETTE.canvasBackdropBottom);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);

    // 2. Noise grain
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // 3. Edge vignette
    const cx = w / 2, cy = h / 2;
    const maxRadius = Math.sqrt(cx * cx + cy * cy);
    const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.68, 'rgba(10, 8, 18, 0.12)');
    gradient.addColorStop(1, 'rgba(8, 6, 12, 0.48)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = GAME_PALETTE.pageBase;
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.restore();

    // 4. Generate terrain
    const heightmap = generateHeightmap(GRID_W, GRID_H, params);
    const contours = extractContours(heightmap, GRID_W, GRID_H, params.contourInterval);

    // 5. Vegetation fill
    const vegImageData = generateVegetationImage(
      Math.round(mapW * dpr), Math.round(mapH * dpr),
      mapW, mapH, heightmap, GRID_W, GRID_H, params
    );
    ctx.putImageData(vegImageData, Math.round(mapX * dpr), Math.round(mapY * dpr));

    // 5b. Paper grain overlay on vegetation
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();
    const grainData = ctx.getImageData(mapX * dpr, mapY * dpr, mapW * dpr, mapH * dpr);
    const gd = grainData.data;
    for (let i = 0; i < gd.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      gd[i] += noise;
      gd[i + 1] += noise;
      gd[i + 2] += noise;
    }
    ctx.putImageData(grainData, mapX * dpr, mapY * dpr);
    ctx.restore();

    // 5c. Map decorations (trees, rocks, grass, peak markers)
    drawMapDecorations(ctx, heightmap, GRID_W, GRID_H, mapX, mapY, mapW, mapH, params);

    // 6. Contour lines
    const scaleX = mapW / (GRID_W - 1);
    const scaleY = mapH / (GRID_H - 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    ctx.strokeStyle = GAME_PALETTE.contourMinor;
    ctx.lineWidth = 0.55;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const contour of contours) {
      ctx.beginPath();
      for (const seg of contour.segments) {
        ctx.moveTo(mapX + seg.x1 * scaleX, mapY + seg.y1 * scaleY);
        ctx.lineTo(mapX + seg.x2 * scaleX, mapY + seg.y2 * scaleY);
      }
      ctx.stroke();
    }

    // Index contours (every 5th)
    const indexInterval = params.contourInterval * 5;
    ctx.strokeStyle = GAME_PALETTE.contourMajor;
    ctx.lineWidth = 0.95;
    for (const contour of contours) {
      const remainder = contour.level % indexInterval;
      if (remainder > 0.001 && remainder < indexInterval - 0.001) continue;
      ctx.beginPath();
      for (const seg of contour.segments) {
        ctx.moveTo(mapX + seg.x1 * scaleX, mapY + seg.y1 * scaleY);
        ctx.lineTo(mapX + seg.x2 * scaleX, mapY + seg.y2 * scaleY);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 6.5 Water features (drawn last over terrain, topology-driven)
    const { rivers, lakes } = generateWaterFeatures(heightmap, GRID_W, GRID_H, params);

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    const waterColor = 'rgba(42, 74, 90, 0.88)';
    const waterHighlight = 'rgba(136, 204, 255, 0.18)';

    // Lakes — translucent water directly over vegetation (matches river colour)
    for (const lake of lakes) {
      const cellPxW = mapW / (GRID_W - 1);
      const cellPxH = mapH / (GRID_H - 1);

      ctx.fillStyle = waterColor;
      ctx.beginPath();
      for (const cell of lake.cells) {
        const px = mapX + (cell.x / (GRID_W - 1)) * mapW;
        const py = mapY + (cell.y / (GRID_H - 1)) * mapH;
        ctx.rect(px - 0.5, py - 0.5, cellPxW + 1, cellPxH + 1);
      }
      ctx.fill();
    }

    // Build a set of all lake cells for fast overlap checks
    const allLakeCells = new Set<string>();
    for (const lake of lakes) {
      for (const cell of lake.cells) {
        allLakeCells.add(`${cell.x},${cell.y}`);
      }
    }

    // Rivers — smooth bezier curves, tapering wider downstream
    // Split into sub-paths at lake boundaries so no curve bridges across a lake
    for (const river of rivers) {
      // Split river into segments that don't cross lakes,
      // but extend each segment to touch the lake edge (no gap)
      const segments: { x: number; y: number }[][] = [];
      let current: { x: number; y: number }[] = [];
      let lastLakePoint: { x: number; y: number } | null = null;

      for (const p of river.points) {
        const gx = Math.round(p.x);
        const gy = Math.round(p.y);
        const inLake = allLakeCells.has(`${gx},${gy}`);

        if (inLake) {
          if (current.length > 0) {
            // Entering lake — add this lake-edge point to close the gap
            current.push(p);
            if (current.length >= 3) segments.push(current);
            current = [];
          }
          lastLakePoint = p;
        } else {
          if (current.length === 0 && lastLakePoint) {
            // Exiting lake — start from the last lake-edge point
            current.push(lastLakePoint);
            lastLakePoint = null;
          }
          current.push(p);
        }
      }
      if (current.length >= 3) segments.push(current);

      // Helper to build a bezier path for a point slice
      const traceBand = (slice: { x: number; y: number }[]) => {
        ctx.beginPath();
        ctx.moveTo(slice[0].x, slice[0].y);
        for (let i = 1; i < slice.length - 1; i++) {
          const midX = (slice[i].x + slice[i + 1].x) / 2;
          const midY = (slice[i].y + slice[i + 1].y) / 2;
          ctx.quadraticCurveTo(slice[i].x, slice[i].y, midX, midY);
        }
        ctx.lineTo(slice[slice.length - 1].x, slice[slice.length - 1].y);
      };

      // Draw each sub-path independently
      for (const seg of segments) {
        const pxPts = seg.map(p => ({
          x: mapX + (p.x / (GRID_W - 1)) * mapW,
          y: mapY + (p.y / (GRID_H - 1)) * mapH,
        }));

        // Compute this segment's position in the overall river for taper width
        const totalPts = river.points.length;
        const segStartIdx = river.points.indexOf(seg[0]);
        const segEndIdx = river.points.indexOf(seg[seg.length - 1]);

        // Width based on position along the full river (thin upstream, wide downstream)
        const startFrac = Math.max(0, segStartIdx) / totalPts;
        const endFrac = Math.max(0, segEndIdx) / totalPts;
        const avgFrac = (startFrac + endFrac) / 2;
        const width = 2.5 + avgFrac * 3.5; // 2.5 at source, 6 at mouth

        ctx.strokeStyle = waterColor;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        traceBand(pxPts);
        ctx.stroke();

        ctx.strokeStyle = waterHighlight;
        ctx.lineWidth = Math.max(1.1, width * 0.35);
        traceBand(pxPts);
        ctx.stroke();
      }
    }

    ctx.restore();

    // 7. Map border
    ctx.save();
    ctx.strokeStyle = GAME_PALETTE.mapBorder;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 22;
    ctx.strokeRect(inset, inset, borderWidth, borderHeight);
    ctx.restore();

    ctx.strokeStyle = GAME_PALETTE.mapBorderMuted;
    ctx.lineWidth = 1;
    ctx.strokeRect(inset + 6, inset + 6, borderWidth - 12, borderHeight - 12);

    return offscreen;
  }, [params]);

  // ── Draw game overlay (cheap, runs every tick) ──
  const drawOverlay = useCallback((
    ctx: CanvasRenderingContext2D, w: number, h: number,
    state: SessionState, gridVisible: boolean,
    selected: { row: number; col: number } | null,
    hovered: { row: number; col: number } | null,
    time: number = 0,
  ) => {
    const { mapX, mapY, mapW, mapH } = getMapGeometry(w, h);
    const gridSize = state.grid_size;
    const cellW = mapW / gridSize;
    const cellH = mapH / gridSize;

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    // ── Grid lines ──
    if (gridVisible) {
      ctx.strokeStyle = GAME_PALETTE.grid;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= gridSize; i++) {
        // Vertical lines
        const x = mapX + i * cellW;
        ctx.beginPath();
        ctx.moveTo(x, mapY);
        ctx.lineTo(x, mapY + mapH);
        ctx.stroke();
        // Horizontal lines
        const y = mapY + i * cellH;
        ctx.beginPath();
        ctx.moveTo(mapX, y);
        ctx.lineTo(mapX + mapW, y);
        ctx.stroke();
      }
    }

    // ── Cells ──
    for (const treatedCell of state.treatedCells) {
      drawTreatedCell(ctx, treatedCell, mapX, mapY, cellW, cellH);
    }

    // ── Cells ──
    for (const cell of state.cells) {
      const px = mapX + cell.col * cellW;
      const py = mapY + cell.row * cellH;

      switch (cell.state) {
        case 'fire': {
          // Pulsing fire — each cell has its own phase based on position
          const phase = (cell.row * 7 + cell.col * 13) % 17;
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.004 + phase);
          const glowAlpha = 0.2 + pulse * 0.25;
          const coreAlpha = 0.5 + pulse * 0.3;
          // Fire glow edge
          ctx.fillStyle = `rgba(255, 107, 53, ${glowAlpha.toFixed(2)})`;
          ctx.fillRect(px - 2, py - 2, cellW + 4, cellH + 4);
          // Fire core
          ctx.fillStyle = `rgba(204, 68, 34, ${coreAlpha.toFixed(2)})`;
          ctx.fillRect(px, py, cellW, cellH);
          break;
        }
        case 'burned': {
          ctx.fillStyle = 'rgba(42, 31, 31, 0.72)';
          ctx.fillRect(px, py, cellW, cellH);
          break;
        }
        case 'suppressed': {
          ctx.fillStyle = GAME_PALETTE.suppressed;
          ctx.fillRect(px, py, cellW, cellH);
          break;
        }
        case 'firebreak': {
          ctx.fillStyle = 'rgba(74, 63, 47, 0.72)';
          ctx.fillRect(px, py, cellW, cellH);
          // Dashed border
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(122, 107, 85, 0.82)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, cellW, cellH);
          ctx.restore();
          break;
        }
      }
    }

    // ── Village ──
    for (const village of state.villages) {
      drawVillage(ctx, village, mapX, mapY, cellW, cellH);
    }

    const renderedUnits = state.units.map((unit) => ({
      unit,
      position: getUnitRenderPosition(unit, time, unitAnimationRef.current.get(unit.id)),
    }));

    // ── Unit routes ──
    for (const { unit, position } of renderedUnits) {
      drawUnitRoute(ctx, unit, position, mapX, mapY, cellW, cellH);
    }

    // ── Units ──
    for (const { unit, position } of renderedUnits) {
      drawUnit(ctx, unit, position, mapX, mapY, cellW, cellH);
    }

    // ── Air support missions ──
    for (const mission of state.airSupportMissions) {
      const animationState = missionAnimationRef.current.get(mission.id);
      const displayProgress = animationState
        ? Math.min(
          1,
          mission.progress + ((time - animationState.updatedAt) / 1000) * getMissionProgressPerSecond(mission.phase),
        )
        : mission.progress;
      drawAirSupportMission(ctx, mission, mapX, mapY, cellW, cellH, time, displayProgress);
    }

    // ── Hovered cell outline (subtle) ──
    if (hovered && (!selected || hovered.row !== selected.row || hovered.col !== selected.col)) {
      const hx = mapX + hovered.col * cellW;
      const hy = mapY + hovered.row * cellH;
      ctx.strokeStyle = GAME_PALETTE.hover;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 0.5, hy + 0.5, cellW - 1, cellH - 1);
    }

    // ── Selected cell highlight ──
    if (selected) {
      const px = mapX + selected.col * cellW;
      const py = mapY + selected.row * cellH;
      ctx.strokeStyle = GAME_PALETTE.selected;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, cellW - 2, cellH - 2);
    }

    ctx.restore(); // un-clip

    // ── Wind indicator (top-right of map, outside clip) ──
    drawWindIndicator(ctx, state.wind, mapX + mapW, mapY);
  }, []);

  // ── Composite draw ──
  const draw = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Rebuild terrain cache if size changed
    const signature =
      `${w}x${h}:${params.seed}:${params.frequency}:${params.octaves}:${params.lacunarity}:${params.persistence}:${params.contourInterval}`;
    const cached = cachedSizeRef.current;
    if (!cached || cached.w !== w || cached.h !== h || cachedSignatureRef.current !== signature) {
      terrainCacheRef.current = renderTerrain(w, h, dpr);
      cachedSizeRef.current = { w, h };
      cachedSignatureRef.current = signature;
    }

    const zoom = zoomRef.current;
    const panX = panRef.current.x;
    const panY = panRef.current.y;

    // Apply zoom & pan transform
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Blit cached terrain
    const terrain = terrainCacheRef.current!;
    ctx.drawImage(terrain, 0, 0, terrain.width, terrain.height, 0, 0, w, h);

    // Draw game overlay on top
    if (gameState) {
      drawOverlay(ctx, w, h, gameState, !!showGrid, selectedCell ?? null, hoveredCellRef.current, time);
    }

    ctx.restore();

    // ── Scale bar (screen-space, fixed position, updates with zoom) ──
    const { mapW } = getMapGeometry(w, h);
    const scaleBarX = mapW / (GRID_W - 1);
    const kmInPixels = 25 * scaleBarX;
    const barSegments = 4;
    const baseSegmentWidth = 2 * kmInPixels; // fixed screen width per segment
    const kmPerSegment = 2 / zoom;
    const barHeight = 5;
    const barX = 12;
    const barY = h - 30;

    // Background for readability
    ctx.fillStyle = GAME_PALETTE.panelBgTertiary;
    ctx.fillRect(barX - 4, barY - 4, barSegments * baseSegmentWidth + 40, barHeight + 24);

    for (let i = 0; i < barSegments; i++) {
      ctx.fillStyle = i % 2 === 0 ? GAME_PALETTE.accent : GAME_PALETTE.pageBase;
      ctx.fillRect(barX + i * baseSegmentWidth, barY, baseSegmentWidth, barHeight);
    }
    ctx.strokeStyle = GAME_PALETTE.mapBorder;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(barX, barY, barSegments * baseSegmentWidth, barHeight);

    ctx.fillStyle = GAME_PALETTE.accentStrong;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= barSegments; i++) {
      const km = i * kmPerSegment;
      const label = km % 1 === 0 ? `${km}` : km.toFixed(1);
      ctx.fillText(label, barX + i * baseSegmentWidth, barY + barHeight + 3);
    }
    ctx.textAlign = 'left';
    ctx.fillText('km', barX + barSegments * baseSegmentWidth + 6, barY + barHeight + 3);
  }, [drawOverlay, gameState, params, renderTerrain, selectedCell, showGrid]);

  // ── Helper: clamp pan so no white space shows ──
  const clampPan = useCallback((pan: { x: number; y: number }, zoom: number, w: number, h: number) => {
    // The full canvas content is w×h, scaled by zoom. Clamp so edges don't
    // pull inward past the viewport. When zoomed content is larger than
    // viewport, pin edges; when smaller (zoom≈1), allow no offset.
    const scaledW = w * zoom;
    const scaledH = h * zoom;
    return {
      x: scaledW > w ? Math.max(w - scaledW, Math.min(0, pan.x)) : 0,
      y: scaledH > h ? Math.max(h - scaledH, Math.min(0, pan.y)) : 0,
    };
  }, []);

  // ── Helper: convert screen coords → map space (invert zoom/pan) ──
  const screenToMap = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - panRef.current.x) / zoomRef.current,
      y: (screenY - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // ── Click handler — convert canvas coords to grid cell ──
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ignore click if it was actually a drag
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    if (!onCellSelect || !gameState) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const { x, y } = screenToMap(e.clientX - rect.left, e.clientY - rect.top);

    const { mapX, mapY, mapW, mapH } = getMapGeometry(rect.width, rect.height);

    // Click outside map bounds → deselect
    if (x < mapX || x > mapX + mapW || y < mapY || y > mapY + mapH) {
      onCellSelect(null);
      return;
    }

    const gridSize = gameState.grid_size;
    const cellW = mapW / gridSize;
    const cellH = mapH / gridSize;

    const col = Math.floor((x - mapX) / cellW);
    const row = Math.floor((y - mapY) / cellH);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      onCellSelect({ row, col });
    }
  }, [onCellSelect, gameState, screenToMap]);

  useEffect(() => {
    if (!gameState) {
      missionAnimationRef.current.clear();
      unitAnimationRef.current.clear();
      return;
    }

    const now = performance.now();
    const activeMissionIds = new Set<string>();
    for (const mission of gameState.airSupportMissions) {
      activeMissionIds.add(mission.id);
      const existing = missionAnimationRef.current.get(mission.id);
      if (!existing || existing.phase !== mission.phase || existing.progress !== mission.progress) {
        missionAnimationRef.current.set(mission.id, {
          phase: mission.phase,
          progress: mission.progress,
          updatedAt: now,
        });
      }
    }
    for (const missionId of Array.from(missionAnimationRef.current.keys())) {
      if (!activeMissionIds.has(missionId)) {
        missionAnimationRef.current.delete(missionId);
      }
    }

    const activeUnitIds = new Set<string>();
    for (const unit of gameState.units) {
      activeUnitIds.add(unit.id);
      const existing = unitAnimationRef.current.get(unit.id);
      if (!existing) {
        unitAnimationRef.current.set(unit.id, {
          fromRow: unit.row,
          fromCol: unit.col,
          toRow: unit.row,
          toCol: unit.col,
          updatedAt: now,
          durationMs: UNIT_MOVE_DURATION_MS[unit.type],
        });
        continue;
      }

      if (existing.toRow !== unit.row || existing.toCol !== unit.col) {
        if (shouldSnapUnitToSnapshot(unit)) {
          unitAnimationRef.current.set(unit.id, {
            fromRow: unit.row,
            fromCol: unit.col,
            toRow: unit.row,
            toCol: unit.col,
            updatedAt: now,
            durationMs: 0,
          });
          continue;
        }
        const currentPosition = getAnimationCoordinate(existing, now);
        unitAnimationRef.current.set(unit.id, {
          fromRow: currentPosition.row,
          fromCol: currentPosition.col,
          toRow: unit.row,
          toCol: unit.col,
          updatedAt: now,
          durationMs: UNIT_MOVE_DURATION_MS[unit.type],
        });
      }
    }
    for (const unitId of Array.from(unitAnimationRef.current.keys())) {
      if (!activeUnitIds.has(unitId)) {
        unitAnimationRef.current.delete(unitId);
      }
    }
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hasAnimatedOverlay = !!gameState;
    let animId: number | null = null;

    const redraw = () => {
      if (hasAnimatedOverlay) return; // animation loop handles it
      draw(0);
    };

    // Animation loop for fire pulsing
    if (hasAnimatedOverlay) {
      const animate = (time: number) => {
        draw(time);
        animId = requestAnimationFrame(animate);
      };
      animId = requestAnimationFrame(animate);
    } else {
      draw(0);
    }

    const handleResize = () => {
      cachedSizeRef.current = null; // invalidate cache on resize
      cachedSignatureRef.current = null;
      redraw();
    };

    // ── Wheel → zoom centered on cursor ──
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(1, Math.min(8, oldZoom * factor));

      // Keep point under cursor fixed
      const scale = newZoom / oldZoom;
      panRef.current = clampPan({
        x: cursorX - (cursorX - panRef.current.x) * scale,
        y: cursorY - (cursorY - panRef.current.y) * scale,
      }, newZoom, rect.width, rect.height);

      // Reset pan when zooming back to 1
      if (newZoom === 1) {
        panRef.current = { x: 0, y: 0 };
      }

      zoomRef.current = newZoom;
      redraw();
    };

    // ── Mouse drag → pan ──
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = { ...panRef.current };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Handle drag
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          didDragRef.current = true;
        }

        const rect = canvas.getBoundingClientRect();
        panRef.current = clampPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        }, zoomRef.current, rect.width, rect.height);
        redraw();
        return;
      }

      // Handle hover
      if (!gameState) return;
      const rect = canvas.getBoundingClientRect();
      const { x, y } = screenToMap(e.clientX - rect.left, e.clientY - rect.top);
      const { mapX, mapY, mapW, mapH } = getMapGeometry(rect.width, rect.height);

      if (x < mapX || x > mapX + mapW || y < mapY || y > mapY + mapH) {
        if (hoveredCellRef.current !== null) {
          hoveredCellRef.current = null;
          redraw();
        }
        return;
      }

      const gridSize = gameState.grid_size;
      const col = Math.floor((x - mapX) / (mapW / gridSize));
      const row = Math.floor((y - mapY) / (mapH / gridSize));
      const prev = hoveredCellRef.current;

      if (!prev || prev.row !== row || prev.col !== col) {
        hoveredCellRef.current = { row, col };
        redraw();
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'crosshair';
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'crosshair';
      if (hoveredCellRef.current !== null) {
        hoveredCellRef.current = null;
        redraw();
      }
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [draw, gameState, clampPan, screenToMap]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
    />
  );
}

// ────────────────────────────────────────────────────────
// Drawing helpers
// ────────────────────────────────────────────────────────

// Deterministic pseudo-random for village layout (same village looks the same every render)
function villageRng(row: number, col: number, salt: number): number {
  let h = (row * 374761 + col * 668265 + salt * 982451) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Generate village cell positions as organic clusters.
 * Seeds cluster centres based on village size, then places houses near them
 * with falloff, skipping cells randomly to leave natural gaps.
 * Uses a salt derived from village grid position for unique layouts per village.
 */
function getVillageCells(size: number, villageRow: number, villageCol: number): Set<string> {
  const occupied = new Set<string>();
  const salt = villageRow * 137 + villageCol * 311;

  // Target: roughly `size` houses total, not size×size
  const clusterCount = size <= 6 ? 1 : size <= 10 ? 2 : 3;
  const centres: { r: number; c: number }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const cr = Math.floor(villageRng(i, salt, 99) * size);
    const cc = Math.floor(villageRng(i, salt + 1, 99) * size);
    centres.push({ r: cr, c: cc });
  }

  // Collect all cells with their probability, then pick the top `size` ones
  const candidates: { r: number; c: number; score: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let minDist = Infinity;
      for (const ctr of centres) {
        const d = Math.sqrt((r - ctr.r) ** 2 + (c - ctr.c) ** 2);
        if (d < minDist) minDist = d;
      }

      const maxRadius = size * 0.6;
      const proximity = Math.max(0, 1 - (minDist / maxRadius));
      // Score = proximity + randomness so it's clustered but not perfectly circular
      const noise = villageRng(r + salt, c, 42) * 0.4;
      candidates.push({ r, c, score: proximity + noise });
    }
  }

  // Sort by score descending, take the top `size` cells
  candidates.sort((a, b) => b.score - a.score);
  const count = size;
  for (let i = 0; i < count && i < candidates.length; i++) {
    occupied.add(`${candidates[i].r},${candidates[i].c}`);
  }

  return occupied;
}

function drawHouseCell(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  cellW: number, cellH: number,
  r: number, c: number,
) {
  const rng = villageRng(r, c, 42);
  const isLarge = rng > 0.6;

  if (isLarge) {
    // Larger house
    ctx.fillStyle = GAME_PALETTE.village;
    ctx.fillRect(px + cellW * 0.1, py + cellH * 0.38, cellW * 0.8, cellH * 0.58);
    ctx.fillStyle = GAME_PALETTE.villageRoof;
    ctx.beginPath();
    ctx.moveTo(px + cellW * 0.05, py + cellH * 0.42);
    ctx.lineTo(px + cellW * 0.5, py + cellH * 0.08);
    ctx.lineTo(px + cellW * 0.95, py + cellH * 0.42);
    ctx.closePath();
    ctx.fill();
    // Windows
    ctx.fillStyle = 'rgba(232, 168, 107, 0.78)';
    ctx.fillRect(px + cellW * 0.2, py + cellH * 0.55, cellW * 0.15, cellH * 0.15);
    ctx.fillRect(px + cellW * 0.65, py + cellH * 0.55, cellW * 0.15, cellH * 0.15);
    // Door
    ctx.fillStyle = 'rgba(26, 21, 32, 0.82)';
    ctx.fillRect(px + cellW * 0.42, py + cellH * 0.65, cellW * 0.16, cellH * 0.3);
  } else {
    // Small house
    ctx.fillStyle = GAME_PALETTE.village;
    ctx.fillRect(px + cellW * 0.2, py + cellH * 0.45, cellW * 0.6, cellH * 0.5);
    ctx.fillStyle = GAME_PALETTE.villageRoof;
    ctx.beginPath();
    ctx.moveTo(px + cellW * 0.12, py + cellH * 0.48);
    ctx.lineTo(px + cellW * 0.5, py + cellH * 0.15);
    ctx.lineTo(px + cellW * 0.88, py + cellH * 0.48);
    ctx.closePath();
    ctx.fill();
    // Door
    ctx.fillStyle = 'rgba(26, 21, 32, 0.82)';
    ctx.fillRect(px + cellW * 0.42, py + cellH * 0.7, cellW * 0.16, cellH * 0.25);
  }
}

function drawVillage(
  ctx: CanvasRenderingContext2D,
  village: Village,
  mapX: number, mapY: number,
  cellW: number, cellH: number,
) {
  const { row, col, size } = village;
  const houseCells = getVillageCells(size, row, col);

  ctx.save();

  // Track actual house positions to centre the label
  let sumC = 0, maxR = 0, count = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!houseCells.has(`${r},${c}`)) continue;
      const px = mapX + (col + c) * cellW;
      const py = mapY + (row + r) * cellH;
      drawHouseCell(ctx, px, py, cellW, cellH, r, c);
      sumC += c;
      if (r > maxR) maxR = r;
      count++;
    }
  }

  // Centre label horizontally on house centroid, place below lowest house
  const avgC = count > 0 ? sumC / count : size / 2;
  const labelX = mapX + (col + avgC + 0.5) * cellW;
  const labelY = mapY + (row + maxR + 1) * cellH + 4;
  ctx.fillStyle = GAME_PALETTE.accentStrong;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('VILLAGE', labelX, labelY);

  ctx.restore();
}

function drawTreatedCell(
  ctx: CanvasRenderingContext2D,
  treatedCell: TreatedCell,
  mapX: number,
  mapY: number,
  cellW: number,
  cellH: number,
) {
  const px = mapX + treatedCell.col * cellW;
  const py = mapY + treatedCell.row * cellH;
  const alpha = Math.max(0.12, Math.min(0.35, treatedCell.strength * 0.28));
  ctx.fillStyle = treatedCell.payloadType === 'retardant'
    ? GAME_PALETTE.treatedRetardant.replace(/0\.28\)/, `${alpha.toFixed(2)})`)
    : GAME_PALETTE.treatedWater.replace(/0\.22\)/, `${alpha.toFixed(2)})`);
  ctx.fillRect(px, py, cellW, cellH);
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  position: GridCoordinate,
  mapX: number, mapY: number,
  cellW: number, cellH: number,
) {
  const cx = mapX + (position.col + 0.5) * cellW;
  const cy = mapY + (position.row + 0.5) * cellH;
  const r = Math.min(cellW, cellH) * 0.35;
  const isInactive = !unit.is_active;

  ctx.save();
  if (isInactive) {
    ctx.globalAlpha = 0.45;
  }

  switch (unit.type) {
    case 'helicopter': {
      // Helicopter — circle body + rotor line
      ctx.fillStyle = GAME_PALETTE.helicopterBody;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // Rotor
      ctx.strokeStyle = GAME_PALETTE.helicopterHighlight;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.3);
      ctx.lineTo(cx + r, cy - r * 0.3);
      ctx.stroke();
      // Tail
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.6);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();
      break;
    }
    case 'ground_crew': {
      // Ground crew — small person shape
      ctx.fillStyle = GAME_PALETTE.groundBody;
      // Head
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.4, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.15);
      ctx.lineTo(cx, cy + r * 0.4);
      ctx.strokeStyle = GAME_PALETTE.groundHighlight;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Shovel (diagonal line)
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.6);
      ctx.strokeStyle = GAME_PALETTE.groundHighlight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
  }

  if (isInactive) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(220, 97, 76, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
    ctx.moveTo(cx + r * 0.7, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.7);
    ctx.stroke();
  }

  // Label underneath
  ctx.fillStyle = isInactive ? 'rgba(220, 97, 76, 0.9)' : GAME_PALETTE.accentStrong;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(unit.label, cx, cy + r + 2);

  ctx.restore();
}

function drawUnitRoute(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  position: GridCoordinate,
  mapX: number,
  mapY: number,
  cellW: number,
  cellH: number,
) {
  if (!unit.is_active) return;
  if (!unit.target) return;
  if (unit.target.row === unit.row && unit.target.col === unit.col) return;

  const start = toCanvasPoint(position, mapX, mapY, cellW, cellH);
  const end = toCanvasPoint(unit.target, mapX, mapY, cellW, cellH);
  const strokeStyle = unit.type === 'helicopter'
    ? 'rgba(136, 170, 204, 0.72)'
    : 'rgba(204, 170, 119, 0.76)';
  const dash = unit.type === 'helicopter' ? [6, 5] : [3, 4];
  const markerRadius = Math.max(2.5, Math.min(cellW, cellH) * 0.18);

  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = unit.type === 'helicopter' ? 1.5 : 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = strokeStyle;
  ctx.beginPath();
  ctx.arc(end.x, end.y, markerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GAME_PALETTE.pageBase;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function toCanvasPoint(
  coordinate: GridCoordinate,
  mapX: number,
  mapY: number,
  cellW: number,
  cellH: number,
) {
  return {
    x: mapX + (coordinate.col + 0.5) * cellW,
    y: mapY + (coordinate.row + 0.5) * cellH,
  };
}

function getAnimationCoordinate(animationState: UnitAnimationState, time: number): GridCoordinate {
  const progress = animationState.durationMs <= 0
    ? 1
    : Math.max(0, Math.min(1, (time - animationState.updatedAt) / animationState.durationMs));
  return {
    row: animationState.fromRow + (animationState.toRow - animationState.fromRow) * progress,
    col: animationState.fromCol + (animationState.toCol - animationState.fromCol) * progress,
  };
}

function getUnitRenderPosition(
  unit: Unit,
  time: number,
  animationState: UnitAnimationState | undefined,
): GridCoordinate {
  if (!animationState) {
    return { row: unit.row, col: unit.col };
  }
  return getAnimationCoordinate(animationState, time);
}

function drawAircraftSilhouette(
  ctx: CanvasRenderingContext2D,
  mission: AirSupportMission,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  heading: GridCoordinate,
) {
  const sprite = AIRCRAFT_SPRITES[mission.aircraftModel];
  const pixel = Math.max(2, Math.min(cellW, cellH) * 0.24);
  const maxX = Math.max(...sprite.map(([sx]) => sx), 0);
  const maxY = Math.max(...sprite.map(([, sy]) => sy), 0);
  const width = (maxX + 1) * pixel;
  const height = (maxY + 1) * pixel;
  const angle = Math.atan2(heading.row, heading.col || 0.0001) + Math.PI;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-width / 2, -height / 2);
  ctx.fillStyle = GAME_PALETTE.aircraftShadow;
  for (const [sx, sy] of sprite) {
    ctx.fillRect(sx * pixel + pixel * 0.45, sy * pixel + pixel * 0.45, pixel, pixel);
  }
  ctx.fillStyle = GAME_PALETTE.aircraftBody;
  for (const [sx, sy] of sprite) {
    ctx.fillRect(sx * pixel, sy * pixel, pixel, pixel);
  }
  ctx.restore();
}

function drawFlightPath(
  ctx: CanvasRenderingContext2D,
  points: GridCoordinate[],
  mapX: number,
  mapY: number,
  cellW: number,
  cellH: number,
  strokeStyle: string,
  lineWidth: number,
  dashed: boolean,
) {
  if (points.length < 2) return;
  ctx.save();
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const start = toCanvasPoint(points[0], mapX, mapY, cellW, cellH);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < points.length; i++) {
    const point = toCanvasPoint(points[i], mapX, mapY, cellW, cellH);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawAirSupportMission(
  ctx: CanvasRenderingContext2D,
  mission: AirSupportMission,
  mapX: number,
  mapY: number,
  cellW: number,
  cellH: number,
  time: number,
  displayProgress: number,
) {
  const renderState = getMissionRenderState(mission, displayProgress);
  const current = toCanvasPoint(renderState.position, mapX, mapY, cellW, cellH);
  const runStart = toCanvasPoint(mission.dropStart, mapX, mapY, cellW, cellH);

  drawFlightPath(
    ctx,
    mission.approachPoints,
    mapX,
    mapY,
    cellW,
    cellH,
    GAME_PALETTE.aircraftRoute,
    1.2,
    true,
  );

  if (mission.exitPoints.length > 0) {
    drawFlightPath(
      ctx,
      [mission.dropEnd, ...mission.exitPoints],
      mapX,
      mapY,
      cellW,
      cellH,
      GAME_PALETTE.aircraftRoute,
      1.2,
      true,
    );
  }

  drawFlightPath(
    ctx,
    [mission.dropStart, mission.dropEnd],
    mapX,
    mapY,
    cellW,
    cellH,
    GAME_PALETTE.aircraftRun,
    2,
    false,
  );

  if (mission.phase === 'drop') {
    const payloadColor = mission.payloadType === 'retardant'
      ? GAME_PALETTE.payloadRetardant
      : GAME_PALETTE.payloadWater;
    const pulse = 0.65 + 0.35 * Math.sin(time * 0.01);
    ctx.save();
    ctx.strokeStyle = payloadColor.replace(/0\.(7|72)\)/, `${(0.35 + pulse * 0.25).toFixed(2)})`);
    ctx.lineWidth = Math.max(3, Math.min(cellW, cellH) * 1.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(runStart.x, runStart.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    ctx.restore();
  }

  drawAircraftSilhouette(ctx, mission, current.x, current.y, cellW, cellH, renderState.heading);
}

function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  wind: Wind,
  rightEdgeX: number,
  topY: number,
) {
  const radius = 44;
  const x = rightEdgeX - radius - 20;
  const y = topY + radius + 14;
  const arrowLen = 28;
  const angle = WIND_ANGLES[wind.direction] ?? 0;

  ctx.save();

  // Background circle
  ctx.fillStyle = GAME_PALETTE.panelBgTertiary;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GAME_PALETTE.mapBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arrow
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = GAME_PALETTE.accent;
  ctx.strokeStyle = GAME_PALETTE.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-arrowLen, 0);
  ctx.lineTo(arrowLen, 0);
  ctx.stroke();
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(arrowLen, 0);
  ctx.lineTo(arrowLen - 9, -6);
  ctx.lineTo(arrowLen - 9, 6);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-angle);
  ctx.translate(-x, -y);

  // Label
  ctx.fillStyle = GAME_PALETTE.accentStrong;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${wind.direction} ${wind.speed_mph}mph`, x, y + radius + 6);

  ctx.restore();
}
