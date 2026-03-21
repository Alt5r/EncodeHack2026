'use client';

import { useEffect, useRef } from 'react';
import type { SessionSnapshot, UnitState } from '../lib/types';

interface Props {
  snapshot: SessionSnapshot;
}

export default function GameMap({ snapshot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef(snapshot);
  const frameRef = useRef<number>(0);

  // Keep snapshot ref current
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // RAF loop — redraws every frame for animated fire
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;

    function loop() {
      if (!active || !canvas) return;
      drawMap(canvas, snapshotRef.current, performance.now());
      frameRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Resize observer — update canvas dimensions when container resizes
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function resize() {
      if (!container || !canvas) return;
      const size = Math.min(container.clientWidth, container.clientHeight) - 8;
      if (size > 0) { canvas.width = size; canvas.height = size; }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      style={{ padding: '4px' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          imageRendering: 'pixelated',
          border: '1px solid #1a2a1a',
          boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main draw function                                                   */
/* ------------------------------------------------------------------ */

function drawMap(canvas: HTMLCanvasElement, snap: SessionSnapshot, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { grid_size, fire_cells, burned_cells, suppressed_cells, firebreak_cells, village, units } = snap;
  const W = canvas.width;
  if (W === 0) return;
  const cs = W / grid_size;

  // ---- Build lookup sets ----
  const fireSet      = new Set(fire_cells.map(([r, c]) => k(r, c)));
  const burnedSet    = new Set(burned_cells.map(([r, c]) => k(r, c)));
  const suppressSet  = new Set(suppressed_cells.map(([r, c]) => k(r, c)));
  const breakSet     = new Set(firebreak_cells.map(([r, c]) => k(r, c)));

  const [vr, vc] = village.top_left;
  const villageSet = new Set<string>();
  for (let r = vr; r < vr + village.size; r++)
    for (let c = vc; c < vc + village.size; c++)
      villageSet.add(k(r, c));

  // ---- PASS 1: Base cell colors ----
  for (let row = 0; row < grid_size; row++) {
    for (let col = 0; col < grid_size; col++) {
      const key = k(row, col);
      const x = col * cs;
      const y = row * cs;
      const w = cs + 0.5;

      if (fireSet.has(key)) {
        ctx.fillStyle = fireBaseColor(row, col, time);
      } else if (burnedSet.has(key)) {
        ctx.fillStyle = burnedColor(row, col);
      } else if (suppressSet.has(key)) {
        ctx.fillStyle = suppressedColor(row, col);
      } else if (breakSet.has(key)) {
        ctx.fillStyle = firebreakColor(row, col);
      } else if (villageSet.has(key)) {
        ctx.fillStyle = village.is_intact ? '#a85e30' : '#6a2010';
      } else {
        ctx.fillStyle = forestFloor(row, col);
      }
      ctx.fillRect(x, y, w, w);
    }
  }

  // ---- PASS 2: Tree canopies (forest only, if cells are big enough) ----
  if (cs >= 5) {
    ctx.save();
    for (let row = 0; row < grid_size; row++) {
      for (let col = 0; col < grid_size; col++) {
        const key = k(row, col);
        if (fireSet.has(key) || burnedSet.has(key) || villageSet.has(key) || breakSet.has(key)) continue;

        const h = hash(row, col);
        const x = col * cs;
        const y = row * cs;
        const cx = x + cs * 0.5 + (((h >> 2) & 7) - 3) * cs * 0.08;
        const cy = y + cs * 0.48 + (((h >> 5) & 7) - 3) * cs * 0.08;
        const r = cs * (0.32 + (h & 7) * 0.02);

        const g = 52 + (h & 31) - 16;
        const b = 22 + ((h >> 3) & 15) - 7;
        ctx.fillStyle = suppressSet.has(key)
          ? `rgb(${15 + (h & 5)}, ${g - 8}, ${b + 8})`
          : `rgb(${10 + (h & 5)}, ${g}, ${b})`;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Second canopy for larger cells
        if (cs >= 10 && (h & 3) !== 0) {
          const cx2 = x + cs * 0.5 + (((h >> 8) & 7) - 3) * cs * 0.14;
          const cy2 = y + cs * 0.48 + (((h >> 11) & 7) - 3) * cs * 0.14;
          const r2 = r * 0.72;
          const g2 = g + 8;
          ctx.fillStyle = `rgb(${8 + (h & 3)}, ${g2}, ${b - 2})`;
          ctx.beginPath();
          ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- PASS 3: Village detail ----
  if (cs >= 8) {
    const vCx = (vc + village.size / 2) * cs;
    const vCy = (vr + village.size / 2) * cs;
    ctx.save();
    ctx.font = `${Math.max(cs * village.size * 0.38, 14)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = village.is_intact ? 'rgba(255,200,100,0.4)' : 'rgba(255,50,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText(village.is_intact ? '\u{1F3D8}' : '\u{1F525}', vCx, vCy);
    ctx.restore();
  }

  // ---- PASS 4: Fire glow ----
  if (fire_cells.length > 0 && cs >= 4) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + Math.sin(time / 200) * 0.06;
    for (const [row, col] of fire_cells) {
      const x = col * cs + cs * 0.5;
      const y = row * cs + cs * 0.5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, cs * 1.6);
      grad.addColorStop(0, '#ff8800');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(col * cs - cs, row * cs - cs, cs * 3, cs * 3);
    }
    ctx.restore();
  }

  // ---- PASS 5: Unit target lines ----
  ctx.save();
  ctx.setLineDash([Math.max(2, cs * 0.2), Math.max(3, cs * 0.3)]);
  ctx.lineWidth = Math.max(1, cs * 0.12);
  for (const unit of units) {
    if (!unit.target) continue;
    const [sr, sc] = unit.position;
    const [tr, tc] = unit.target;
    ctx.strokeStyle =
      unit.unit_type === 'helicopter' ? 'rgba(79,195,247,0.45)' :
      unit.unit_type === 'ground_crew' ? 'rgba(100,200,100,0.45)' :
      'rgba(255,179,71,0.35)';
    ctx.beginPath();
    ctx.moveTo((sc + 0.5) * cs, (sr + 0.5) * cs);
    ctx.lineTo((tc + 0.5) * cs, (tr + 0.5) * cs);
    ctx.stroke();
  }
  ctx.restore();

  // ---- PASS 6: Units ----
  for (const unit of units) {
    drawUnit(ctx, unit, cs, time);
  }
}

/* ------------------------------------------------------------------ */
/* Unit drawing                                                         */
/* ------------------------------------------------------------------ */

function drawUnit(ctx: CanvasRenderingContext2D, unit: UnitState, cs: number, time: number) {
  const [row, col] = unit.position;
  const cx = (col + 0.5) * cs;
  const cy = (row + 0.5) * cs;
  const r = Math.max(cs * 1.5, 8);

  ctx.save();

  if (unit.unit_type === 'orchestrator') {
    // Watchtower — amber pulsing diamond
    const pulse = 0.92 + Math.sin(time / 800) * 0.08;
    const rp = r * pulse;
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 10 + Math.sin(time / 600) * 4;
    ctx.fillStyle = '#c87820';
    ctx.beginPath();
    ctx.moveTo(cx, cy - rp);
    ctx.lineTo(cx + rp * 0.65, cy);
    ctx.lineTo(cx, cy + rp);
    ctx.lineTo(cx - rp * 0.65, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffdd88';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

  } else if (unit.unit_type === 'helicopter') {
    // Helicopter — blue circle, H label
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 8;
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, '#2a8ab8');
    grad.addColorStop(1, '#0d4060');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d0f0ff';
    ctx.font = `bold ${Math.max(r * 0.95, 8)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', cx, cy + 0.5);

  } else {
    // Ground crew — green circle, G label
    ctx.shadowColor = '#4caf50';
    ctx.shadowBlur = 8;
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, '#2a7a30');
    grad.addColorStop(1, '#0d3a10');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c0f0c0';
    ctx.font = `bold ${Math.max(r * 0.95, 8)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', cx, cy + 0.5);
  }

  // Label below (only if cells large enough)
  if (cs >= 12) {
    ctx.shadowBlur = 0;
    const label = unit.label.toUpperCase();
    ctx.font = `${Math.max(cs * 0.52, 7)}px 'Courier New', monospace`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(5,10,5,0.8)';
    ctx.fillRect(cx - tw / 2 - 3, cy + r + 2, tw + 6, cs * 0.6);
    ctx.fillStyle = '#a0c890';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx, cy + r + 3);
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Color helpers                                                        */
/* ------------------------------------------------------------------ */

function k(r: number, c: number) { return `${r},${c}`; }

function hash(r: number, c: number): number {
  return ((r * 2531011 + c * 214013) >>> 0) & 0xffff;
}

function forestFloor(row: number, col: number): string {
  const h = hash(row, col);
  const g = 28 + (h & 15) - 7;
  const b = 14 + ((h >> 4) & 7) - 3;
  return `rgb(${10 + (h & 5)}, ${g}, ${b})`;
}

function fireBaseColor(row: number, col: number, time: number): string {
  const h = hash(row, col);
  const t = time / 90;
  const phase = ((h & 0xff) + t) % 256;
  const flicker = Math.sin(phase * 0.08) * 0.5 + 0.5;
  const r = Math.floor(190 + flicker * 65);
  const g = Math.floor(15 + flicker * 75);
  return `rgb(${r}, ${g}, 0)`;
}

function burnedColor(row: number, col: number): string {
  const h = hash(row, col) & 0x1f;
  return `rgb(${12 + h}, ${6 + (h >> 1)}, ${4 + (h >> 2)})`;
}

function suppressedColor(row: number, col: number): string {
  const h = hash(row, col) & 0x1f;
  return `rgb(${10 + (h >> 2)}, ${28 + h}, ${20 + (h >> 1)})`;
}

function firebreakColor(row: number, col: number): string {
  const h = hash(row, col) & 0x1f;
  return `rgb(${38 + h}, ${22 + (h >> 1)}, ${8 + (h >> 2)})`;
}
