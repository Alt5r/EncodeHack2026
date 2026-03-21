'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const AUDIO_FADE_SECONDS = 0.3;
const AMBIENT_GAIN = 0.15;
const STATIC_GAIN = 0.02;

type AmbientNodes = {
  masterGain: GainNode;
  staticGain: GainNode;
  noiseSource: AudioBufferSourceNode;
  staticOscillator: OscillatorNode;
  lfo: OscillatorNode;
};

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
  const ambientNodesRef = useRef<AmbientNodes | null>(null);
  const suspendTimeoutRef = useRef<number | null>(null);

  const ensureAudioGraph = useCallback(async (): Promise<AmbientNodes> => {
    if (suspendTimeoutRef.current !== null) {
      window.clearTimeout(suspendTimeoutRef.current);
      suspendTimeoutRef.current = null;
    }

    let ctx = audioContextRef.current;
    if (!ctx) {
      const AudioContextCtor = window.AudioContext;
      ctx = new AudioContextCtor();
      audioContextRef.current = ctx;
    }

    if (!ambientNodesRef.current) {
      const currentContext = ctx;
      const masterGain = currentContext.createGain();
      masterGain.gain.value = 0;

      const ambientGain = currentContext.createGain();
      ambientGain.gain.value = AMBIENT_GAIN;

      const staticGain = currentContext.createGain();
      staticGain.gain.value = STATIC_GAIN;

      const outputGain = currentContext.createGain();
      outputGain.gain.value = 1;

      masterGain.connect(outputGain);
      outputGain.connect(currentContext.destination);

      // Create brown noise for forest ambience.
      const bufferSize = currentContext.sampleRate * 2;
      const noiseBuffer = currentContext.createBuffer(1, bufferSize, currentContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const noiseSource = currentContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const windFilter = currentContext.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 400;

      noiseSource.connect(windFilter);
      windFilter.connect(ambientGain);
      ambientGain.connect(masterGain);
      noiseSource.start();

      // Radio static bed.
      const staticOscillator = currentContext.createOscillator();
      staticOscillator.type = 'sawtooth';
      staticOscillator.frequency.value = 60;

      const staticFilter = currentContext.createBiquadFilter();
      staticFilter.type = 'bandpass';
      staticFilter.frequency.value = 2000;
      staticFilter.Q.value = 0.5;

      staticOscillator.connect(staticFilter);
      staticFilter.connect(staticGain);
      staticGain.connect(masterGain);
      staticOscillator.start();

      const lfo = currentContext.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = currentContext.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(staticGain.gain);
      lfo.start();

      ambientNodesRef.current = {
        masterGain,
        staticGain,
        noiseSource,
        staticOscillator,
        lfo,
      };
    }

    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    return ambientNodesRef.current;
  }, []);

  const setPlaybackState = useCallback(async (shouldPlay: boolean) => {
    const nodes = await ensureAudioGraph();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    nodes.masterGain.gain.cancelScheduledValues(now);
    nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, now);
    nodes.masterGain.gain.linearRampToValueAtTime(shouldPlay ? 1 : 0, now + AUDIO_FADE_SECONDS);

    if (!shouldPlay) {
      suspendTimeoutRef.current = window.setTimeout(() => {
        const currentContext = audioContextRef.current;
        if (currentContext && currentContext.state === 'running') {
          void currentContext.suspend();
        }
        suspendTimeoutRef.current = null;
      }, AUDIO_FADE_SECONDS * 1000 + 40);
    }
  }, [ensureAudioGraph]);

  const initAudio = useCallback(async () => {
    await setPlaybackState(true);
    setIsPlaying(true);
  }, [setPlaybackState]);

  const toggleAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      await initAudio();
      return;
    }

    const nextIsPlaying = !isPlaying;
    await setPlaybackState(nextIsPlaying);
    setIsPlaying(nextIsPlaying);
  }, [initAudio, isPlaying, setPlaybackState]);

  useEffect(() => {
    return () => {
      if (suspendTimeoutRef.current !== null) {
        window.clearTimeout(suspendTimeoutRef.current);
      }

      const nodes = ambientNodesRef.current;
      ambientNodesRef.current = null;
      if (nodes) {
        nodes.noiseSource.stop();
        nodes.staticOscillator.stop();
        nodes.lfo.stop();
      }

      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx) {
        void ctx.close();
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    void toggleAudio();
  }, [toggleAudio]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-amber-100/20 bg-black/30 text-amber-100/70 backdrop-blur-sm transition-all hover:border-amber-100/40 hover:text-amber-100"
      aria-label={isPlaying ? 'Mute audio' : 'Enable audio'}
    >
      {isPlaying ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
    </button>
  );
}
