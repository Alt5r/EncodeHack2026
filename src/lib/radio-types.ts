/** Voice key identifies which ElevenLabs voice spoke the line */
export type VoiceKey = 'command' | 'helicopter' | 'ground';

/** Backend `radio.message` event payload */
export interface RadioMessagePayload {
  message_id: string;
  speaker: string;
  voice_key: VoiceKey;
  text: string;
  tick: number;
}

/** Backend `radio.audio_ready` event payload */
export interface AudioReadyPayload {
  message_id: string;
  audio_url: string;
  speaker: string;
}

/** UI-facing message shape for the transcript list */
export interface TranscriptMessage {
  id: string;
  speaker: string;
  voiceKey: VoiceKey;
  text: string;
  time: string;
  hasAudio: boolean;
}

/** Wrapper envelope for all backend WebSocket broadcasts */
export interface BroadcastEnvelope {
  kind?: 'event' | 'snapshot';
  event?: {
    type: string;
    session_id?: string;
    tick?: number;
    payload: unknown;
  };
  snapshot?: Record<string, unknown>;
}
