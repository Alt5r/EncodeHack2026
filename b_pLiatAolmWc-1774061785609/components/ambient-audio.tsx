"use client"

import { useState, useCallback, useRef } from "react"
import { Volume2, VolumeX } from "lucide-react"

export function AmbientAudio() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{ gain: GainNode; static: OscillatorNode } | null>(null)

  const initAudio = useCallback(() => {
    if (isInitialized) return

    const ctx = new AudioContext()
    audioContextRef.current = ctx

    // Create brown noise for forest ambience
    const bufferSize = 2 * ctx.sampleRate
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      output[i] = (lastOut + 0.02 * white) / 1.02
      lastOut = output[i]
      output[i] *= 3.5
    }

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer
    noiseSource.loop = true

    // Filter for wind-like sound
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 400

    // Master gain
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.15

    noiseSource.connect(filter)
    filter.connect(masterGain)
    masterGain.connect(ctx.destination)
    noiseSource.start()

    // Radio static
    const staticOsc = ctx.createOscillator()
    staticOsc.type = "sawtooth"
    staticOsc.frequency.value = 60

    const staticGain = ctx.createGain()
    staticGain.gain.value = 0.02

    const staticFilter = ctx.createBiquadFilter()
    staticFilter.type = "bandpass"
    staticFilter.frequency.value = 2000
    staticFilter.Q.value = 0.5

    staticOsc.connect(staticFilter)
    staticFilter.connect(staticGain)
    staticGain.connect(ctx.destination)
    staticOsc.start()

    // Modulate static
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.1
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.015
    lfo.connect(lfoGain)
    lfoGain.connect(staticGain.gain)
    lfo.start()

    nodesRef.current = { gain: masterGain, static: staticOsc }
    setIsInitialized(true)
  }, [isInitialized])

  const toggleAudio = useCallback(() => {
    if (!isInitialized) {
      initAudio()
      setIsPlaying(true)
      return
    }

    const ctx = audioContextRef.current
    if (!ctx) return

    if (isPlaying) {
      ctx.suspend()
    } else {
      ctx.resume()
    }
    setIsPlaying(!isPlaying)
  }, [isInitialized, isPlaying, initAudio])

  return (
    <button
      onClick={toggleAudio}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-amber-100/20 bg-black/30 text-amber-100/70 backdrop-blur-sm transition-all hover:border-amber-100/40 hover:text-amber-100"
      aria-label={isPlaying ? "Mute audio" : "Enable audio"}
    >
      {isPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  )
}
