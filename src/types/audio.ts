export interface VocalDspConfig {
  highPassEnabled: boolean;
  highPassFreq: number; // default 80Hz
  lowCutFreq: number; // 20 to 500 Hz
  compressorEnabled: boolean;
  threshold: number; // dB, e.g. -22
  ratio: number; // e.g. 3.5
  attack: number; // s, e.g. 0.015
  release: number; // s, e.g. 0.2
  eqEnabled: boolean;
  lowGain: number; // dB (-12 to +12)
  lowFreq: number; // Hz, e.g. 100
  midGain: number; // dB (-12 to +12)
  midFreq: number; // Hz, e.g. 1500
  midQ: number; // 0.5 to 4.0
  highGain: number; // dB (-12 to +12)
  highFreq: number; // Hz, e.g. 9000
  pitchShift: number; // semitones (-12 to +12)
  pitchCorrection: number; // 0 to 100%
  pitchCorrectionKey: string; // 'C', 'C#', 'D', etc.
  pitchCorrectionScale: 'major' | 'minor' | 'chromatic' | 'pentatonic';
  warmth: number; // 0 to 100% saturation
  formantShift: number; // % (-50 to +50)
  formantWarmth: number; // 0 to 1
  reverbSend: number; // 0 to 1
  reverbWet: number; // 0 to 1
  delaySend: number; // 0 to 1
  delayTime: number; // seconds, e.g. 0.3
  delayFeedback: number; // 0 to 0.9
}

export interface AiEnhancerConfig {
  enabled: boolean;
  noiseGateThreshold: number; // dB (-60 to -10)
  noiseReduction: number; // 0 to 100%
  harmonicExciter: number; // 0 to 100%
  transientPunch: number; // 0 to 100%
  spectralClarity: number; // 0 to 100%
  abTestMode: 'processed' | 'original';
}

export interface AudioTrack {
  id: string;
  name: string;
  type: 'backing' | 'vocal' | 'stem';
  color: string;
  volume: number; // 0 to 1.5, default 1.0
  pan: number; // -1 (left) to 1 (right)
  muted: boolean;
  solo: boolean;
  isArmed: boolean;
  audioBuffer: AudioBuffer | null;
  peaks: Float32Array | null;
  startTime: number; // seconds
  duration: number; // seconds
  vocalDsp: VocalDspConfig;
  aiEnhancer: AiEnhancerConfig;
}

export interface RecordedTake {
  id: string;
  trackId: string;
  audioBuffer: AudioBuffer;
  recordedAt: number;
  startTime: number; // timeline position in seconds
  duration: number;
  latencyOffsetMs: number;
}

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  bpm: number;
  metronome: boolean;
  masterVolume: number;
}
