'use client';

import { GAME_PALETTE } from '@/lib/game-palette';

interface ScoreHUDProps {
  tick: number;
  burnedCells: number;
  suppressedCells: number;
  firebreakCells: number;
  villageDamage: number;
}

export default function ScoreHUD({
  tick,
  burnedCells,
  villageDamage,
}: ScoreHUDProps) {
  const formatTime = (t: number): string => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const rows: Array<{ label: string; value: string; color: string }> = [
    { label: 'TIME', value: formatTime(tick), color: GAME_PALETTE.accentStrong },
    { label: 'BURNED', value: String(burnedCells), color: burnedCells > 0 ? GAME_PALETTE.danger : GAME_PALETTE.textPrimary },
    {
      label: 'VILLAGE',
      value: villageDamage > 0 ? `DMG ${villageDamage}` : 'INTACT',
      color: villageDamage > 0 ? GAME_PALETTE.danger : GAME_PALETTE.success,
    },
  ];

  return (
    <div
      style={{
        background: GAME_PALETTE.panelBg,
        borderBottom: `1px solid ${GAME_PALETTE.panelDivider}`,
        padding: '14px 18px',
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        color: GAME_PALETTE.textPrimary,
        flexShrink: 0,
      }}
    >
      {/* Section header — matches CellInfoPanel section labels */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 'bold',
          letterSpacing: 1.5,
          color: GAME_PALETTE.accent,
          borderBottom: `1px solid ${GAME_PALETTE.panelDivider}`,
          paddingBottom: 3,
          marginBottom: 8,
        }}
      >
        SITUATION REPORT
      </div>

      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span style={{ color: GAME_PALETTE.textSecondary, flexShrink: 0 }}>
            {row.label}
          </span>
          <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
