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

  constructor() {
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

  public connect(dest: Tone.InputNode | AudioNode) {
    if ('input' in (dest as any) || 'context' in (dest as any)) {
      this.pitchShiftNode.connect(dest as any);
    } else {
      Tone.connect(this.pitchShiftNode, dest as any);
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
