'use client';

import { useRef, useEffect, useCallback } from 'react';
import { generateHeightmap, extractContours, generateVegetationImage, generateWaterMask, type TerrainParams, DEFAULT_PARAMS } from '@/lib/terrain';

interface MapCanvasProps {
  params: TerrainParams;
}

// Heightmap grid resolution
const GRID_W = 300;
const GRID_H = 300;

export default function MapCanvas({ params }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas resolution to display size
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // 1. Base parchment fill
    ctx.fillStyle = '#d4c5a0';
    ctx.fillRect(0, 0, w, h);

    // 2. Noise grain — subtle random brightness variation
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 25;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // 3. Edge vignette
    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.sqrt(cx * cx + cy * cy);
    const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius);
    gradient.addColorStop(0, 'rgba(60, 40, 20, 0)');
    gradient.addColorStop(0.7, 'rgba(60, 40, 20, 0.08)');
    gradient.addColorStop(1, 'rgba(40, 25, 10, 0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 4. Map border
    const inset = 40;
    const borderWidth = w * 0.7 - inset * 2;
    const borderHeight = h - inset * 2;

    // 5. Map fill — parchment-coloured base for the map area
    const fillPadding = 2;
    const mapX = inset + fillPadding;
    const mapY = inset + fillPadding;
    const mapW = borderWidth - fillPadding * 2;
    const mapH = borderHeight - fillPadding * 2;

    // 6. Generate terrain + water masks
    const heightmap = generateHeightmap(GRID_W, GRID_H, params);
    const contours = extractContours(heightmap, GRID_W, GRID_H, params.contourInterval);
    const { rivers, lakes, flowDir } = generateWaterMask(heightmap, GRID_W, GRID_H);

    // 6a. Vegetation fill (water-aware) — full physical resolution, no upscaling
    const vegImageData = generateVegetationImage(
      Math.round(mapW * dpr), Math.round(mapH * dpr),
      mapW, mapH,
      heightmap, GRID_W, GRID_H, params,
      rivers, lakes
    );
    ctx.putImageData(vegImageData, Math.round(mapX * dpr), Math.round(mapY * dpr));

    // 6b. Paper grain overlay on vegetation for texture
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();
    const grainData = ctx.getImageData(mapX * dpr, mapY * dpr, mapW * dpr, mapH * dpr);
    const gd = grainData.data;
    for (let i = 0; i < gd.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      gd[i] += noise;
      gd[i + 1] += noise;
      gd[i + 2] += noise;
    }
    ctx.putImageData(grainData, mapX * dpr, mapY * dpr);
    ctx.restore();

    // Scale from grid coords to map pixel coords
    const scaleX = mapW / (GRID_W - 1);
    const scaleY = mapH / (GRID_H - 1);

    // Clip drawing to map area
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    // --- D8 direction offsets (must match terrain.ts) ---
    const D8_DX = [0, 1, 1, 1, 0, -1, -1, -1];
    const D8_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

    // --- Draw rivers ---
    // Trace downstream using the pre-computed flow direction.
    // Only start traces from "headwater" cells: cells above threshold
    // whose upstream neighbour is below threshold (avoids redundant traces).
    const RIVER_THRESHOLD = 500;
    ctx.strokeStyle = '#7a9a9a';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const riverDrawn = new Uint8Array(GRID_W * GRID_H);

    // Find headwater cells: above threshold, but not all neighbours above threshold flow into them
    const headwaters: number[] = [];
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      if (rivers[i] < RIVER_THRESHOLD || lakes[i]) continue;
      // Check if any upstream neighbour is also above threshold and flows into this cell
      const x = i % GRID_W;
      const y = (i - x) / GRID_W;
      let hasUpstreamRiver = false;
      for (let d = 0; d < 8; d++) {
        const nx = x + D8_DX[d];
        const ny = y + D8_DY[d];
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const nIdx = ny * GRID_W + nx;
        // Does this neighbour flow INTO our cell?
        const nDir = flowDir[nIdx];
        if (nDir < 0) continue;
        const nFlowX = nx + D8_DX[nDir];
        const nFlowY = ny + D8_DY[nDir];
        if (nFlowX === x && nFlowY === y && rivers[nIdx] >= RIVER_THRESHOLD) {
          hasUpstreamRiver = true;
          break;
        }
      }
      if (!hasUpstreamRiver) {
        headwaters.push(i);
      }
    }

    for (const startIdx of headwaters) {
      if (riverDrawn[startIdx]) continue;

      // Trace downstream using flowDir
      const points: { x: number; y: number; flow: number }[] = [];
      let cur = startIdx;

      while (cur >= 0 && cur < GRID_W * GRID_H) {
        const cx = cur % GRID_W;
        const cy = (cur - cx) / GRID_W;

        if (riverDrawn[cur] && points.length > 0) {
          // Join to existing river path
          points.push({ x: cx, y: cy, flow: rivers[cur] });
          break;
        }

        riverDrawn[cur] = 1;
        points.push({ x: cx, y: cy, flow: rivers[cur] });

        // Stop at lakes or grid edge
        if (lakes[cur] && points.length > 1) break;

        // Follow flow direction
        const dir = flowDir[cur];
        if (dir < 0) break;
        const nx = cx + D8_DX[dir];
        const ny = cy + D8_DY[dir];
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) break;
        cur = ny * GRID_W + nx;
      }

      if (points.length < 3) continue;

      // Draw as a single connected polyline per width band
      // Use average flow to set width for the whole segment (smoother appearance)
      const avgFlow = points.reduce((s, p) => s + p.flow, 0) / points.length;
      const lineW = Math.min(3, 0.5 + Math.log2(avgFlow / RIVER_THRESHOLD) * 0.5);
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(mapX + points[0].x * scaleX, mapY + points[0].y * scaleY);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(mapX + points[i].x * scaleX, mapY + points[i].y * scaleY);
      }
      ctx.stroke();
    }

    // --- Draw lake outlines using marching-squares-style edge tracing ---
    // Draw edges between lake and non-lake cells as line segments
    ctx.strokeStyle = '#7a9a9a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let y = 0; y < GRID_H - 1; y++) {
      for (let x = 0; x < GRID_W - 1; x++) {
        const tl = lakes[y * GRID_W + x];
        const tr = lakes[y * GRID_W + x + 1];
        const bl = lakes[(y + 1) * GRID_W + x];
        const br = lakes[(y + 1) * GRID_W + x + 1];
        // Draw edges where lake/land boundary crosses
        // Right edge of this cell: between (x+1,y) and (x+1,y+1)
        if (tr !== br) {
          ctx.moveTo(mapX + (x + 1) * scaleX, mapY + y * scaleY);
          ctx.lineTo(mapX + (x + 1) * scaleX, mapY + (y + 1) * scaleY);
        }
        // Bottom edge of this cell: between (x,y+1) and (x+1,y+1)
        if (bl !== br) {
          ctx.moveTo(mapX + x * scaleX, mapY + (y + 1) * scaleY);
          ctx.lineTo(mapX + (x + 1) * scaleX, mapY + (y + 1) * scaleY);
        }
        // Left edge (only for x=0)
        if (x === 0 && tl !== bl) {
          ctx.moveTo(mapX + x * scaleX, mapY + y * scaleY);
          ctx.lineTo(mapX + x * scaleX, mapY + (y + 1) * scaleY);
        }
        // Top edge (only for y=0)
        if (y === 0 && tl !== tr) {
          ctx.moveTo(mapX + x * scaleX, mapY + y * scaleY);
          ctx.lineTo(mapX + (x + 1) * scaleX, mapY + y * scaleY);
        }
      }
    }
    ctx.stroke();

    // --- Helper: check if a grid coord is inside a lake ---
    const isInLake = (gx: number, gy: number): boolean => {
      const ix = Math.round(Math.max(0, Math.min(GRID_W - 1, gx)));
      const iy = Math.round(Math.max(0, Math.min(GRID_H - 1, gy)));
      return lakes[iy * GRID_W + ix] === 1;
    };

    // Draw contour lines (suppress over lakes)
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 0.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const contour of contours) {
      ctx.beginPath();
      for (const seg of contour.segments) {
        // Skip segments whose midpoint is inside a lake
        const midGx = (seg.x1 + seg.x2) / 2;
        const midGy = (seg.y1 + seg.y2) / 2;
        if (isInLake(midGx, midGy)) continue;

        const x1 = mapX + seg.x1 * scaleX;
        const y1 = mapY + seg.y1 * scaleY;
        const x2 = mapX + seg.x2 * scaleX;
        const y2 = mapY + seg.y2 * scaleY;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    // Draw thicker index contours every 5th line (suppress over lakes)
    const indexInterval = params.contourInterval * 5;
    ctx.strokeStyle = '#6b5a42';
    ctx.lineWidth = 0.9;

    for (const contour of contours) {
      const remainder = contour.level % indexInterval;
      if (remainder > 0.001 && remainder < indexInterval - 0.001) continue;

      ctx.beginPath();
      for (const seg of contour.segments) {
        const midGx = (seg.x1 + seg.x2) / 2;
        const midGy = (seg.y1 + seg.y2) / 2;
        if (isInLake(midGx, midGy)) continue;

        const x1 = mapX + seg.x1 * scaleX;
        const y1 = mapY + seg.y1 * scaleY;
        const x2 = mapX + seg.x2 * scaleX;
        const y2 = mapY + seg.y2 * scaleY;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    ctx.restore();

    // 7. Map border stroke (on top)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(inset, inset, borderWidth, borderHeight);

    // 8. Scale bar — below the map border, bottom-left
    // 300 grid cells = 6km → 1km = 50 grid cells
    const kmInPixels = 50 * scaleX; // pixels per 1km
    const barSegments = 3;
    const barHeight = 5;
    const barX = inset;
    const barY = inset + borderHeight + 12;

    for (let i = 0; i < barSegments; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#ffffff';
      ctx.fillRect(barX + i * kmInPixels, barY, kmInPixels, barHeight);
    }
    // Outline around the whole bar
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(barX, barY, barSegments * kmInPixels, barHeight);

    // Labels
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= barSegments; i++) {
      ctx.fillText(`${i}`, barX + i * kmInPixels, barY + barHeight + 3);
    }
    ctx.textAlign = 'left';
    ctx.fillText('km', barX + barSegments * kmInPixels + 6, barY + barHeight + 3);
  }, [params]);

  useEffect(() => {
    draw();

    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
