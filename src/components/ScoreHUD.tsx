'use client';

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
  suppressedCells,
  firebreakCells,
  villageDamage,
}: ScoreHUDProps) {
  const formatTime = (t: number): string => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const rows: Array<{ label: string; value: string; color: string }> = [
    { label: 'TIME', value: formatTime(tick), color: '#4a3728' },
    { label: 'BURNED', value: String(burnedCells), color: burnedCells > 0 ? '#c03020' : '#4a3728' },
    {
      label: 'VILLAGE',
      value: villageDamage > 0 ? `DMG ${villageDamage}` : 'INTACT',
      color: villageDamage > 0 ? '#c03020' : '#5a8a4a',
    },
  ];

  return (
    <div
      style={{
        background: 'rgba(212, 197, 160, 0.95)',
        borderBottom: '1px solid rgba(0,0,0,0.15)',
        padding: '14px 18px',
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        color: '#1a1a1a',
        flexShrink: 0,
      }}
    >
      {/* Section header — matches CellInfoPanel section labels */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 'bold',
          letterSpacing: 1.5,
          color: '#6b5a42',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
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
          <span style={{ color: '#5a4a38', flexShrink: 0 }}>
            {row.label}
          </span>
          <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
