"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface WatchtowerSceneProps {
  hideUI?: boolean
}

export function WatchtowerScene({ hideUI = false }: WatchtowerSceneProps) {
  const [mounted, setMounted] = useState(false)
  const [fireflies, setFireflies] = useState<Array<{ id: number; x: number; y: number; delay: number; duration: number }>>([])

  useEffect(() => {
    setMounted(true)
    const flies = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 40 + Math.random() * 50,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
    }))
    setFireflies(flies)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Sky gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, #2d1b3d 0%, #5c3d5e 20%, #d4785c 45%, #e8a86b 60%, #3d2a4a 85%, #1a1520 100%)"
        }}
      />

      {/* Stars */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/70"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 30}%`,
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Far mountains */}
      <svg className="absolute bottom-0 left-0 right-0 h-[60%] w-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
        <polygon points="0,400 0,280 150,200 300,260 450,180 600,240 750,160 900,220 1000,180 1000,400" fill="#3d2a4a" />
      </svg>

      {/* Mid mountains */}
      <svg className="absolute bottom-0 left-0 right-0 h-[50%] w-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
        <polygon points="0,400 0,300 100,250 250,290 400,220 550,280 700,200 850,260 1000,230 1000,400" fill="#2d1f35" />
      </svg>

      {/* Near mountains */}
      <svg className="absolute bottom-0 left-0 right-0 h-[40%] w-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
        <polygon points="0,400 0,320 200,280 350,310 500,260 650,300 800,250 1000,290 1000,400" fill="#231a2a" />
      </svg>

      {/* Tree line */}
      <svg className="absolute bottom-0 left-0 right-0 h-[25%] w-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
        {Array.from({ length: 40 }).map((_, i) => {
          const x = (i / 40) * 1000 + Math.random() * 25 - 12
          const height = 60 + Math.random() * 80
          const width = 15 + Math.random() * 10
          return (
            <polygon
              key={i}
              points={`${x},200 ${x - width / 2},200 ${x},${200 - height} ${x + width / 2},200`}
              fill="#1a1520"
            />
          )
        })}
      </svg>

      {/* Watchtower */}
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2">
        <svg width="120" height="200" viewBox="0 0 120 200">
          {/* Tower legs */}
          <polygon points="30,200 45,80 50,80 35,200" fill="#1a1520" />
          <polygon points="90,200 75,80 70,80 85,200" fill="#1a1520" />
          {/* Cross beams */}
          <line x1="38" y1="150" x2="82" y2="150" stroke="#1a1520" strokeWidth="3" />
          <line x1="40" y1="120" x2="80" y2="120" stroke="#1a1520" strokeWidth="3" />
          {/* Cabin */}
          <rect x="35" y="50" width="50" height="35" fill="#1a1520" />
          {/* Roof */}
          <polygon points="30,50 60,25 90,50" fill="#1a1520" />
          {/* Window glow */}
          <rect x="42" y="58" width="15" height="12" fill="#e8a86b" opacity="0.9" />
          <rect x="63" y="58" width="15" height="12" fill="#e8a86b" opacity="0.9" />
          {/* Window glow effect */}
          <rect x="42" y="58" width="15" height="12" fill="#ffcc88" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
          </rect>
          <rect x="63" y="58" width="15" height="12" fill="#ffcc88" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
          </rect>
        </svg>
      </div>

      {/* Fireflies */}
      {fireflies.map((fly) => (
        <div
          key={fly.id}
          className="absolute h-1 w-1 rounded-full bg-amber-300/80"
          style={{
            left: `${fly.x}%`,
            top: `${fly.y}%`,
            boxShadow: "0 0 6px 2px rgba(251, 191, 36, 0.6)",
            animation: `float ${fly.duration}s ease-in-out infinite, pulse ${fly.duration / 2}s ease-in-out infinite`,
            animationDelay: `${fly.delay}s`,
          }}
        />
      ))}

      {/* Content overlay - hidden when used as background */}
      {!hideUI && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-12 animate-fade-in">
            <h1 className="text-5xl font-bold tracking-[0.3em] text-amber-100/90 drop-shadow-lg md:text-7xl">
              WATCHTOWER
            </h1>

            <div className="flex flex-col items-center gap-4">
              <Link 
                href="/game"
                className="group relative px-8 py-3 text-sm font-medium tracking-widest text-amber-100/90 uppercase transition-all duration-300 hover:text-amber-200 border border-amber-100/30 hover:border-amber-200/50 hover:bg-amber-100/5"
              >
                Deploy Default Agent
                <span className="absolute inset-0 -z-10 bg-amber-100/5 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              <Link 
                href="/terminal"
                className="group relative px-8 py-3 text-sm font-medium tracking-widest text-amber-100/60 uppercase transition-all duration-300 hover:text-amber-100/90 border border-amber-100/20 hover:border-amber-100/40 hover:bg-amber-100/5"
              >
                Write Your Doctrine
                <span className="absolute inset-0 -z-10 bg-amber-100/5 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Vignette */}
      <div 
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(26, 21, 32, 0.7) 100%)"
        }}
      />

      {/* Noise overlay */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(10px, -15px); }
          50% { transform: translate(-5px, -25px); }
          75% { transform: translate(-15px, -10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
