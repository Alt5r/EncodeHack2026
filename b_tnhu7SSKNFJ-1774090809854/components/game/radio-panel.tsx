"use client"

import { useGame } from "./game-context"
import { useEffect, useRef, useState } from "react"

export function RadioPanel() {
  const { messages } = useGame()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0.1))

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Animate waveform when new message arrives
  useEffect(() => {
    if (messages.length === 0) return

    const interval = setInterval(() => {
      setWaveformBars(bars => 
        bars.map(() => 0.1 + Math.random() * 0.9)
      )
    }, 100)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setWaveformBars(Array(20).fill(0.1))
    }, 3000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [messages.length])

  const getRoleColor = (role: string) => {
    switch (role) {
      case "command": return "text-amber-400"
      case "helicopter": return "text-sky-400"
      case "ground": return "text-orange-300"
      default: return "text-amber-100"
    }
  }

  return (
    <div className="w-80 h-full flex flex-col bg-[#1a1520] border-l border-amber-900/30">
      {/* Radio unit header */}
      <div className="p-4 border-b border-amber-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="text-amber-100/80 font-mono text-sm tracking-wider">RADIO</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400/80 text-xs font-mono">ACTIVE</span>
          </div>
        </div>

        {/* Frequency display */}
        <div className="bg-black/40 rounded px-3 py-2 mb-3">
          <div className="text-amber-500 font-mono text-lg tracking-widest">
            142.850 MHz
          </div>
        </div>

        {/* Waveform visualizer */}
        <div className="flex items-end justify-center gap-[2px] h-8 bg-black/30 rounded px-2">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className="w-1.5 bg-amber-500/80 rounded-sm transition-all duration-75"
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-amber-100/30 text-sm font-mono text-center py-8">
            Awaiting transmission...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold ${getRoleColor(msg.role)}`}>
                {msg.speaker.toUpperCase()}
              </span>
              <span className="text-amber-100/30 text-xs font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-amber-100/80 text-sm leading-relaxed font-mono">
              {msg.message}
            </p>
          </div>
        ))}
      </div>

      {/* Radio static overlay decoration */}
      <div className="h-px bg-gradient-to-r from-transparent via-amber-900/50 to-transparent" />

      {/* Bottom panel */}
      <div className="p-4 bg-black/20">
        <div className="flex items-center justify-between text-xs font-mono text-amber-100/40">
          <span>WATCHTOWER COMMAND v1.0</span>
          <span>ENCRYPTED</span>
        </div>
      </div>
    </div>
  )
}
