'use client';

import type { CellTerrain } from '@/lib/cell-info';
import type { Cell, Unit } from '@/lib/types';

interface CellInfoPanelProps {
  row?: number;
  col?: number;
  terrain?: CellTerrain | null;
  cell?: Cell;
  unit?: Unit;
}

// ── Tiny bar component ──
function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      width: '100%', height: 8, borderRadius: 3,
      background: 'rgba(0,0,0,0.12)', overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.round(value * 100)}%`, height: '100%',
        background: color, borderRadius: 3,
      }} />
    </div>
  );
}

// ── Cell state display colours ──
const STATE_COLORS: Record<string, string> = {
  normal: '#6b8f4a',
  fire: '#dc3c14',
  burned: '#28191a',
  suppressed: '#508cc8',
  firebreak: '#8c6432',
  village: '#b4905a',
  water: '#4682b4',
};

const STATE_LABELS: Record<string, string> = {
  normal: 'Normal',
  fire: 'On Fire',
  burned: 'Burned',
  suppressed: 'Suppressed',
  firebreak: 'Firebreak',
  village: 'Village',
  water: 'Water',
};

const UNIT_LABELS: Record<string, string> = {
  helicopter: 'Helicopter',
  ground_crew: 'Ground Crew',
};

export default function CellInfoPanel({ row, col, terrain, cell, unit }: CellInfoPanelProps) {
  const hasSelection = terrain != null && row != null && col != null;
  const cellState = cell?.state ?? (terrain?.waterType !== 'none' && terrain?.waterType ? 'water' : 'normal');

  return (
    <div style={{
      height: '45vh',
      boxSizing: 'border-box',
      overflowY: 'auto',
      background: 'rgba(212, 197, 160, 0.95)',
      border: '2px solid rgba(120, 90, 60, 0.4)',
      padding: '14px 18px',
      fontFamily: 'Georgia, serif',
      fontSize: 12,
      color: '#1a1a1a',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#4a3728',
        letterSpacing: '0.15em', marginBottom: 10,
      }}>
        CELL INFO
      </div>

      {!hasSelection ? (
        <div style={{
          color: '#9a8a6a', fontSize: 12, fontStyle: 'italic',
          padding: '12px 0',
        }}>
          No cell selected
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block', width: 8, height: 8,
                borderRadius: '50%', background: STATE_COLORS[cellState],
              }}
            />
            {STATE_LABELS[cellState]} ({row}, {col})
          </div>

          {/* ── Terrain ── */}
          <SectionLabel>TERRAIN</SectionLabel>

          <Row label="Elevation">
            <span>{terrain.elevationMeters}m</span>
            <div style={{ marginTop: 2 }}>
              <Bar value={terrain.elevation} color="#8b7355" />
            </div>
          </Row>

          <Row label="Slope">
            <span>{terrain.slopeLabel}</span>
          </Row>

          <Row label="Vegetation">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block', width: 10, height: 10,
                  borderRadius: 2, background: terrain.vegetationColor,
                  border: '1px solid rgba(0,0,0,0.2)',
                }}
              />
              {terrain.vegetationType}
            </span>
          </Row>

          {terrain.waterType !== 'none' && (
            <Row label="Water">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-block', width: 10, height: 10,
                    borderRadius: 2, background: terrain.waterType === 'lake' ? '#4a8ab0' : '#6aadcf',
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                />
                {terrain.waterType === 'lake' ? 'Lake' : 'River'}
              </span>
            </Row>
          )}

          {/* ── Fire Resistance ── */}
          {terrain.fireResistance > 0 && (
            <>
              <SectionLabel>FIRE RESISTANCE</SectionLabel>
              <Row label="Water barrier">
                <Bar value={terrain.fireResistance} color="#508cc8" />
              </Row>
            </>
          )}

          {/* ── Traversal ── */}
          <SectionLabel>TRAVERSAL</SectionLabel>

          <Row label={terrain.traversalDifficulty}>
            <Bar value={terrain.traversalScore} color={
              terrain.traversalScore < 0.3 ? '#6b8f4a' :
              terrain.traversalScore < 0.5 ? '#b8a040' :
              terrain.traversalScore < 0.7 ? '#c07830' : '#a03020'
            } />
          </Row>

          {/* ── Game State ── */}
          <SectionLabel>STATUS</SectionLabel>

          <Row label="State">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: STATE_COLORS[cellState],
                }}
              />
              {STATE_LABELS[cellState]}
            </span>
          </Row>

          <Row label="Fuel">
            <Bar value={cell?.fuel ?? (terrain.waterType !== 'none' ? 0.0 : 1.0)} color="#8b6432" />
          </Row>

          <Row label="Moisture">
            <Bar value={cell?.moisture ?? (terrain.waterType !== 'none' ? 1.0 : 0.5)} color="#508cc8" />
          </Row>

          {/* ── Unit (if present) ── */}
          {unit && (
            <>
              <SectionLabel>UNIT</SectionLabel>
              <Row label={UNIT_LABELS[unit.type] ?? unit.type}>
                <span style={{ fontWeight: 'bold' }}>{unit.label}</span>
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Tiny layout helpers ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5,
      color: '#6b5a42', borderBottom: '1px solid rgba(0,0,0,0.15)',
      paddingBottom: 3, marginTop: 10, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 }}>
      <span style={{ color: '#5a4a38', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, textAlign: 'right' }}>{children}</div>
    </div>
  );
}
