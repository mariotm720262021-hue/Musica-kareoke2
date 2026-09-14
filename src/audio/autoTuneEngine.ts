// Tone.js musical Auto-Tune Pitch Engine & Scale Calculation
import * as Tone from 'tone';

// Musical Note intervals for Pitch Quantization
export const SCALE_INTERVALS: { [key: string]: number[] } = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  pentatonic: [0, 2, 4, 7, 9],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const KEYS = NOTE_NAMES;
export const SCALES = ['chromatic', 'major', 'minor', 'pentatonic'] as const;

export interface AutoTunePreset {
  id: string;
  name: string;
  description: string;
  intensity: number;
  scale: 'major' | 'minor' | 'chromatic' | 'pentatonic';
}

export const AUTO_TUNE_PRESETS: AutoTunePreset[] = [
  {
    id: 'hard_tune',
    name: 'Hard Auto-Tune (Trap / T-Pain)',
    description: 'Afinación 100% robótica y agresiva que encaja exactamente en la escala musical.',
    intensity: 100,
    scale: 'minor',
  },
  {
    id: 'modern_pop',
    name: 'Pop Moderno (Pulido)',
    description: 'Afinación natural de estudio al 75% que preserva la emoción y corrige desvíos.',
    intensity: 75,
    scale: 'major',
  },
  {
    id: 'subtle_assist',
    name: 'Sutil / Pitch Assist',
    description: 'Corrección transparente al 40% para afinación acústica indetectable.',
    intensity: 40,
    scale: 'chromatic',
  },
  {
    id: 'bypass',
    name: 'Desactivado (Natural)',
    description: 'Voz cruda sin corrección de afinación.',
    intensity: 0,
    scale: 'chromatic',
  },
];

export interface CompressorPreset {
  id: string;
  name: string;
  description: string;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

export const COMPRESSOR_PRESETS: CompressorPreset[] = [
  {
    id: 'anti_gallitos',
    name: 'Anti-Gallitos (Vocal Cracks Smoothing)',
    description: 'Aplana picos repentinos, quiebres de voz y cambios bruscos de volumen.',
    threshold: -24,
    ratio: 6.0,
    attack: 0.005,
    release: 0.12,
  },
  {
    id: 'lead_punchy',
    name: 'Voz Principal Punchy',
    description: 'Compresión moderna de radio que resalta la voz sobre la pista instrumental.',
    threshold: -18,
    ratio: 4.0,
    attack: 0.015,
    release: 0.2,
  },
  {
    id: 'gentle_leveler',
    name: 'Nivelación Suave',
    description: 'Control de dinámica transparente para baladas y grabaciones íntimas.',
    threshold: -14,
    ratio: 2.5,
    attack: 0.025,
    release: 0.3,
  },
  {
    id: 'brickwall_limiter',
    name: 'Limitador de Picos Extremo',
    description: 'Detiene cualquier saturación o distorsión sin importar la fuerza del grito.',
    threshold: -28,
    ratio: 10.0,
    attack: 0.002,
    release: 0.08,
  },
];

/**
 * Given a key (e.g. 'C') and scale mode ('major', 'minor', etc.), returns all allowed MIDI pitches
 */
export function getAllowedPitchClasses(rootKey: string, scale: string): Set<number> {
  const rootIndex = NOTE_NAMES.indexOf(rootKey);
  const rootMidi = rootIndex >= 0 ? rootIndex : 0;
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.chromatic;
  const allowed = new Set<number>();

  for (const interval of intervals) {
    allowed.add((rootMidi + interval) % 12);
  }

  return allowed;
}

/**
 * Returns array of note names in a given key and scale (e.g. ['C', 'D', 'E', 'F', 'G', 'A', 'B'])
 */
export function getScaleNoteNames(rootKey: string, scale: string): string[] {
  const rootIndex = NOTE_NAMES.indexOf(rootKey);
  const base = rootIndex >= 0 ? rootIndex : 0;
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.chromatic;
  return intervals.map((interval) => NOTE_NAMES[(base + interval) % 12]);
}

/**
 * Calculates the nearest in-tune pitch shift in semitones for a given target scale.
 * When intensity is 100%, it aggressively snaps to the scale.
 * At lower intensity, it gently pulls towards the nearest target pitch.
 */
export function calculateAutoTuneShift(
  currentSemitoneOffset: number,
  rootKey: string,
  scale: string,
  intensity: number // 0 to 100
): number {
  if (intensity <= 0) return 0;

  const rootIndex = NOTE_NAMES.indexOf(rootKey);
  const baseMidi = 60 + (rootIndex >= 0 ? rootIndex : 0); // Middle C reference
  const allowed = getAllowedPitchClasses(rootKey, scale);

  // If already in allowed scale class
  const noteClass = ((Math.round(baseMidi + currentSemitoneOffset) % 12) + 12) % 12;
  if (allowed.has(noteClass)) {
    return 0;
  }

  // Find nearest allowed pitch class
  let minDiff = 99;
  let bestTargetOffset = 0;

  for (let diff = -6; diff <= 6; diff++) {
    const candidateClass = ((noteClass + diff) % 12 + 12) % 12;
    if (allowed.has(candidateClass)) {
      if (Math.abs(diff) < Math.abs(minDiff)) {
        minDiff = diff;
        bestTargetOffset = diff;
      }
    }
  }

  // Apply intensity weighting (0.0 to 1.0)
  const weight = Math.max(0, Math.min(1, intensity / 100));
  return bestTargetOffset * weight;
}

/**
 * Creates a dedicated Tone.js PitchShift node connected to Tone's audio graph.
 * Uses Phase-Vocoder frequency scaling to preserve natural vocal timbre while shifting pitch.
 */
export class ToneAutoTuneEngine {
  public pitchShiftNode: Tone.PitchShift;
  private currentShift = 0;

  constructor(audioCtx?: AudioContext) {
    if (audioCtx && Tone.getContext().rawContext !== audioCtx) {
      Tone.setContext(audioCtx);
    }

    this.pitchShiftNode = new Tone.PitchShift({
      pitch: 0,
      windowSize: 0.08, // crisp response for vocals without transient smearing
      delayTime: 0,
      feedback: 0,
    });
  }

  public setPitch(semitones: number) {
    this.currentShift = semitones;
    this.pitchShiftNode.pitch = semitones;
  }

  public getPitch(): number {
    return this.currentShift;
  }

  public connectSource(source: AudioNode) {
    try {
      Tone.connect(source, this.pitchShiftNode);
    } catch {
      source.connect((this.pitchShiftNode as any).input || (this.pitchShiftNode as any));
    }
  }

  public connectDestination(dest: AudioNode) {
    try {
      Tone.connect(this.pitchShiftNode, dest);
    } catch {
      (this.pitchShiftNode as any).connect(dest);
    }
  }

  public disconnect() {
    try {
      this.pitchShiftNode.disconnect();
    } catch {
      // safe ignore
    }
  }

  public dispose() {
    try {
      this.pitchShiftNode.dispose();
    } catch {
      // safe ignore
    }
  }
}
