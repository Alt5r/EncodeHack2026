'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M4 10h4l5-4v12l-5-4H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.2a4 4 0 0 1 0 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.8 6.6a7.5 7.5 0 0 1 0 10.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M4 10h4l5-4v12l-5-4H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 8.5l4 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20.5 8.5l-4 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AmbientAudioToggle() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback(async () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsPlaying(true);
      return;
    }

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;

    noiseSource.connect(windFilter);
    windFilter.connect(masterGain);
    masterGain.connect(ctx.destination);
    noiseSource.start();

    const staticOscillator = ctx.createOscillator();
    staticOscillator.type = 'sawtooth';
    staticOscillator.frequency.value = 60;

    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.02;

    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 2000;
    staticFilter.Q.value = 0.5;

    staticOscillator.connect(staticFilter);
    staticFilter.connect(staticGain);
    staticGain.connect(ctx.destination);
    staticOscillator.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(staticGain.gain);
    lfo.start();

    setIsPlaying(true);
  }, []);

  const toggleAudio = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      await initAudio();
      return;
    }

    if (ctx.state === 'running') {
      await ctx.suspend();
      setIsPlaying(false);
      return;
    }

    await ctx.resume();
    setIsPlaying(true);
  }, [initAudio]);

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx) {
        void ctx.close();
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        void toggleAudio();
      }}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-amber-100/20 bg-black/30 text-amber-100/70 backdrop-blur-sm transition-all hover:border-amber-100/40 hover:text-amber-100"
      aria-label={isPlaying ? 'Mute audio' : 'Enable audio'}
    >
      {isPlaying ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
    </button>
  );
}

