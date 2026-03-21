'use client';

import { useMemo } from 'react';

interface WatchtowerSceneProps {
  onDeployDefault?: () => void;
  onWriteDoctrine?: () => void;
  hideUI?: boolean;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface Firefly {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

interface Tree {
  id: number;
  x: number;
  width: number;
  height: number;
}

export default function WatchtowerScene({
  onDeployDefault,
  onWriteDoctrine,
  hideUI = false,
}: WatchtowerSceneProps) {
  const { stars, fireflies, trees } = useMemo(() => buildScene(20260321), []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #2d1b3d 0%, #5c3d5e 20%, #d4785c 45%, #e8a86b 60%, #3d2a4a 85%, #1a1520 100%)',
        }}
      />

      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white/70"
            style={{
              width: star.size,
              height: star.size,
              left: `${star.x}%`,
              top: `${star.y}%`,
              animation: `watchtowerTwinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <svg
        className="absolute bottom-0 left-0 right-0 h-[60%] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1000 400"
      >
        <polygon
          points="0,400 0,280 150,200 300,260 450,180 600,240 750,160 900,220 1000,180 1000,400"
          fill="#3d2a4a"
        />
      </svg>

      <svg
        className="absolute bottom-0 left-0 right-0 h-[50%] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1000 400"
      >
        <polygon
          points="0,400 0,300 100,250 250,290 400,220 550,280 700,200 850,260 1000,230 1000,400"
          fill="#2d1f35"
        />
      </svg>

      <svg
        className="absolute bottom-0 left-0 right-0 h-[40%] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1000 400"
      >
        <polygon
          points="0,400 0,320 200,280 350,310 500,260 650,300 800,250 1000,290 1000,400"
          fill="#231a2a"
        />
      </svg>

      <svg
        className="absolute bottom-0 left-0 right-0 h-[25%] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1000 200"
      >
        {trees.map((tree) => (
          <polygon
            key={tree.id}
            points={`${tree.x},200 ${tree.x - tree.width / 2},200 ${tree.x},${200 - tree.height} ${tree.x + tree.width / 2},200`}
            fill="#1a1520"
          />
        ))}
      </svg>

      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2">
        <svg width="120" height="200" viewBox="0 0 120 200">
          <polygon points="30,200 45,80 50,80 35,200" fill="#1a1520" />
          <polygon points="90,200 75,80 70,80 85,200" fill="#1a1520" />
          <line x1="38" y1="150" x2="82" y2="150" stroke="#1a1520" strokeWidth="3" />
          <line x1="40" y1="120" x2="80" y2="120" stroke="#1a1520" strokeWidth="3" />
          <rect x="35" y="50" width="50" height="35" fill="#1a1520" />
          <polygon points="30,50 60,25 90,50" fill="#1a1520" />
          <rect x="42" y="58" width="15" height="12" fill="#e8a86b" opacity="0.9" />
          <rect x="63" y="58" width="15" height="12" fill="#e8a86b" opacity="0.9" />
          <rect x="42" y="58" width="15" height="12" fill="#ffcc88" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
          </rect>
          <rect x="63" y="58" width="15" height="12" fill="#ffcc88" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
          </rect>
        </svg>
      </div>

      {fireflies.map((firefly) => (
        <div
          key={firefly.id}
          className="absolute h-1 w-1 rounded-full bg-amber-300/80"
          style={{
            left: `${firefly.x}%`,
            top: `${firefly.y}%`,
            boxShadow: '0 0 6px 2px rgba(251, 191, 36, 0.6)',
            animation: `watchtowerFloat ${firefly.duration}s ease-in-out infinite, watchtowerPulse ${firefly.duration / 2}s ease-in-out infinite`,
            animationDelay: `${firefly.delay}s`,
          }}
        />
      ))}

      {!hideUI && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="watchtower-fade-in flex flex-col items-center gap-12">
            <h1 className="text-5xl font-bold tracking-[0.3em] text-amber-100/90 drop-shadow-lg md:text-7xl">
              WATCHTOWER
            </h1>

            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={onDeployDefault}
                className="group relative border border-amber-100/30 px-8 py-3 text-sm font-medium uppercase tracking-widest text-amber-100/90 transition-all duration-300 hover:border-amber-200/50 hover:bg-amber-100/5 hover:text-amber-200"
              >
                Deploy Default Agent
                <span className="absolute inset-0 -z-10 bg-amber-100/5 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>

              <button
                type="button"
                onClick={onWriteDoctrine}
                className="group relative border border-amber-100/20 px-8 py-3 text-sm font-medium uppercase tracking-widest text-amber-100/60 transition-all duration-300 hover:border-amber-100/40 hover:bg-amber-100/5 hover:text-amber-100/90"
              >
                Write Your Doctrine
                <span className="absolute inset-0 -z-10 bg-amber-100/5 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(26, 21, 32, 0.7) 100%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }}
      />

      <style>{`
        @keyframes watchtowerTwinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes watchtowerFloat {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(10px, -15px); }
          50% { transform: translate(-5px, -25px); }
          75% { transform: translate(-15px, -10px); }
        }
        @keyframes watchtowerPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes watchtowerFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .watchtower-fade-in {
          animation: watchtowerFadeIn 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function buildScene(seed: number): { stars: Star[]; fireflies: Firefly[]; trees: Tree[] } {
  const random = createSeededRandom(seed);

  return {
    stars: Array.from({ length: 50 }, (_, index) => ({
      id: index,
      x: random() * 100,
      y: random() * 30,
      size: random() * 2 + 1,
      duration: 2 + random() * 3,
      delay: random() * 3,
    })),
    fireflies: Array.from({ length: 20 }, (_, index) => ({
      id: index,
      x: random() * 100,
      y: 40 + random() * 50,
      delay: random() * 5,
      duration: 3 + random() * 4,
    })),
    trees: Array.from({ length: 40 }, (_, index) => ({
      id: index,
      x: (index / 40) * 1000 + random() * 25 - 12,
      height: 60 + random() * 80,
      width: 15 + random() * 10,
    })),
  };
}

function createSeededRandom(seed: number): () => number {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
