'use client';

import { useRef, useState, useCallback } from 'react';
import type { VoiceKey } from './radio-types';

interface QueueEntry {
  messageId: string;
  speaker: string;
  voiceKey: VoiceKey;
  audioUrl: string;
}

interface UseRadioAudioReturn {
  isPlaying: boolean;
  currentSpeaker: string | null;
  currentVoiceKey: VoiceKey | null;
  analyserNode: AnalyserNode | null;
  enqueueAudio: (entry: QueueEntry) => void;
  initAudio: () => void;
  stopAudio: () => void;
}

/**
 * Audio engine for radio playback. Manages an AudioContext, crackle synthesis,
 * and a sequential playback queue: crackle-in → voice mp3 → crackle-out → next.
 *
 * Call `initAudio()` on a user gesture to unlock the AudioContext.
 */
export function useRadioAudio(): UseRadioAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentVoiceKey, setCurrentVoiceKey] = useState<VoiceKey | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const processingRef = useRef(false);
  const queueGenerationRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const cancelCurrentPlaybackRef = useRef<(() => void) | null>(null);

  // ---------------------------------------------------------------------------
  // Lazy AudioContext init (must happen from a user gesture)
  // ---------------------------------------------------------------------------
  const ensureContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64; // gives 32 frequency bins — we use 24
    analyserRef.current = analyser;
    setAnalyserNode(analyser);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGainRef.current = masterGain;

    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    return ctx;
  }, []);

  const initAudio = useCallback(() => {
    const ctx = ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
  }, [ensureContext]);

  // ---------------------------------------------------------------------------
  // Crackle synthesis — white noise + sawtooth through bandpass filters
  // ---------------------------------------------------------------------------
  const playCrackle = useCallback((durationMs: number): Promise<void> => {
    const ctx = ctxRef.current;
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return Promise.resolve();

    return new Promise((resolve) => {
      const now = ctx.currentTime;
      const dur = durationMs / 1000;

      // Envelope gain node
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.35, now + 0.03); // 30ms attack
      envelope.gain.setValueAtTime(0.35, now + dur - 0.07);
      envelope.gain.linearRampToValueAtTime(0, now + dur); // 70ms release
      envelope.connect(masterGain);

      // White noise → bandpass @ 3000Hz
      const noiseLength = ctx.sampleRate * dur;
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const noiseBP = ctx.createBiquadFilter();
      noiseBP.type = 'bandpass';
      noiseBP.frequency.value = 3000;
      noiseBP.Q.value = 1.0;

      noiseSrc.connect(noiseBP);
      noiseBP.connect(envelope);
      noiseSrc.start(now);
      noiseSrc.stop(now + dur);

      // Sawtooth @ 55Hz → bandpass @ 1800Hz
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;

      const oscBP = ctx.createBiquadFilter();
      oscBP.type = 'bandpass';
      oscBP.frequency.value = 1800;
      oscBP.Q.value = 0.8;

      osc.connect(oscBP);
      oscBP.connect(envelope);
      osc.start(now);
      osc.stop(now + dur);

      // Clean up and resolve when done
      noiseSrc.onended = () => {
        noiseSrc.disconnect();
        noiseBP.disconnect();
        osc.disconnect();
        oscBP.disconnect();
        envelope.disconnect();
        resolve();
      };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Play a single voice mp3 through the audio graph
  // ---------------------------------------------------------------------------
  const playVoice = useCallback((audioUrl: string): Promise<void> => {
    const ctx = ctxRef.current;
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const audio = new Audio();
      let settled = false;
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl;
      currentAudioRef.current = audio;

      const source = ctx.createMediaElementSource(audio);
      source.connect(masterGain);

      const cleanup = () => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
        if (cancelCurrentPlaybackRef.current === cancelPlayback) {
          cancelCurrentPlaybackRef.current = null;
        }
        source.disconnect();
      };

      const cancelPlayback = () => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch {
          // Best-effort teardown only.
        }
        cleanup();
        resolve();
      };
      cancelCurrentPlaybackRef.current = cancelPlayback;

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load audio: ${audioUrl}`));
      };

      audio.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Sequential queue processor
  // ---------------------------------------------------------------------------
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const generation = queueGenerationRef.current;

    while (queueRef.current.length > 0) {
      if (generation !== queueGenerationRef.current) break;
      const entry = queueRef.current.shift()!;

      setIsPlaying(true);
      setCurrentSpeaker(entry.speaker);
      setCurrentVoiceKey(entry.voiceKey);

      try {
        await playCrackle(200);  // crackle-in
        if (generation !== queueGenerationRef.current) break;
        await playVoice(entry.audioUrl);
        if (generation !== queueGenerationRef.current) break;
        await playCrackle(150);  // crackle-out
      } catch {
        // If audio fails, skip this entry and continue
      }
    }

    setIsPlaying(false);
    setCurrentSpeaker(null);
    setCurrentVoiceKey(null);
    processingRef.current = false;
  }, [playCrackle, playVoice]);

  // ---------------------------------------------------------------------------
  // Public: add an audio entry to the queue
  // ---------------------------------------------------------------------------
  const enqueueAudio = useCallback((entry: QueueEntry) => {
    queueRef.current.push(entry);
    processQueue();
  }, [processQueue]);

  const stopAudio = useCallback(() => {
    queueGenerationRef.current += 1;
    queueRef.current = [];
    cancelCurrentPlaybackRef.current?.();
    cancelCurrentPlaybackRef.current = null;
    currentAudioRef.current = null;
    setIsPlaying(false);
    setCurrentSpeaker(null);
    setCurrentVoiceKey(null);
    processingRef.current = false;
  }, []);

  return {
    isPlaying,
    currentSpeaker,
    currentVoiceKey,
    analyserNode,
    enqueueAudio,
    initAudio,
    stopAudio,
  };
}
