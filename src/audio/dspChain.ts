import { VocalDspConfig, AiEnhancerConfig } from '../types/audio';
import { calculateAutoTuneShift } from './autoTuneEngine';

export interface TrackDspNodes {
  inputNode: GainNode;
  outputNode: GainNode;
  reverbSendNode: GainNode;
  delaySendNode: GainNode;
  analyserNode: AnalyserNode;
  updateVocalDsp: (config: VocalDspConfig) => void;
  updateAiEnhancer: (config: AiEnhancerConfig) => void;
  updateVolumeAndPan: (volume: number, pan: number, muted: boolean) => void;
  disconnect: () => void;
}

// Generate smooth tape / tube soft-saturation transfer curve for warmth
function makeWarmthCurve(amount = 0.3): Float32Array {
  const k = amount * 15;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      // Soft hyperbolic saturation
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
  }
  return curve;
}

// Generate non-linear transfer curve for the Harmonic Exciter (rebuilding rich 2nd and 3rd harmonics)
function makeExciterCurve(amount = 0.5): Float32Array {
  const k = amount * 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Asymmetrical polynomial curve creating subtle 2nd harmonic (warmth) + 3rd harmonic (sparkle)
    if (k === 0) {
      curve[i] = x;
    } else {
      const odd = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      const even = 0.15 * (x * x - 0.5);
      curve[i] = Math.max(-1, Math.min(1, (odd * 0.85 + even * 0.15) * 0.7));
    }
  }
  return curve;
}

export function createTrackDsp(
  ctx: AudioContext,
  initialVocalDsp: VocalDspConfig,
  initialAiEnhancer: AiEnhancerConfig,
  initialVolume: number,
  initialPan: number,
  reverbBus: AudioNode,
  delayBus: AudioNode,
  masterMixBus: AudioNode
): TrackDspNodes {
  // Input gain node for the track
  const inputNode = ctx.createGain();

  // --- AI ENHANCEMENT SECTION (Optional pre-DSP restoration) ---
  const noiseGateFilter = ctx.createBiquadFilter();
  noiseGateFilter.type = 'highpass';
  noiseGateFilter.frequency.value = 20;

  const noiseGateGain = ctx.createGain();
  noiseGateGain.gain.value = 1.0;

  // Harmonic Exciter parallel chain
  const exciterSplit = ctx.createGain();
  const exciterHighpass = ctx.createBiquadFilter();
  exciterHighpass.type = 'highpass';
  exciterHighpass.frequency.value = 3200;
  const exciterWaveShaper = ctx.createWaveShaper();
  exciterWaveShaper.curve = makeExciterCurve(0.3);
  exciterWaveShaper.oversample = '2x';
  const exciterReturnGain = ctx.createGain();
  exciterReturnGain.gain.value = 0.0;

  // Transient Punch filter
  const transientFilter = ctx.createBiquadFilter();
  transientFilter.type = 'peaking';
  transientFilter.frequency.value = 4500;
  transientFilter.Q.value = 1.4;

  const postAiSum = ctx.createGain();

  // --- VOCAL CHAIN DSP SECTION ---
  // 1. High-Pass Filter (Low-cut at 80Hz default to eliminate mic handling rumble)
  const highPassFilter = ctx.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = initialVocalDsp.highPassFreq || 80;
  highPassFilter.Q.value = 0.707;

  // 2. Standard Peak Compressor (smooths vocal cracks / volume spikes / "gallitos")
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = initialVocalDsp.threshold;
  compressor.knee.value = 8;
  compressor.ratio.value = initialVocalDsp.ratio;
  compressor.attack.value = initialVocalDsp.attack;
  compressor.release.value = initialVocalDsp.release;

  // 3. 3-Band Parametric EQ
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = initialVocalDsp.lowFreq || 120;
  lowShelf.gain.value = initialVocalDsp.lowGain;

  const midPeak = ctx.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.value = initialVocalDsp.midFreq || 1500;
  midPeak.Q.value = initialVocalDsp.midQ || 1.2;
  midPeak.gain.value = initialVocalDsp.midGain;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = initialVocalDsp.highFreq || 9000;
  highShelf.gain.value = initialVocalDsp.highGain;

  // 4. Natural Formant Timbre Resonator (F1 + F2 filters)
  const formantResonator = ctx.createBiquadFilter();
  formantResonator.type = 'peaking';
  formantResonator.frequency.value = 1250;
  formantResonator.Q.value = 1.8;
  formantResonator.gain.value = 0;

  // 5. Warmth & Saturation WaveShaper
  const warmthWaveShaper = ctx.createWaveShaper();
  warmthWaveShaper.curve = makeWarmthCurve((initialVocalDsp.warmth || 20) / 100);
  warmthWaveShaper.oversample = '2x';

  // 6. Volume & Pan
  const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const trackFader = ctx.createGain();
  trackFader.gain.value = initialVolume;

  // 7. Sends to Reverb & Delay buses
  const reverbSendNode = ctx.createGain();
  reverbSendNode.gain.value = initialVocalDsp.reverbWet ?? initialVocalDsp.reverbSend;

  const delaySendNode = ctx.createGain();
  delaySendNode.gain.value = initialVocalDsp.delaySend;

  // 8. Track Analyser for real-time VU Meter
  const analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;

  // Final Track Output
  const outputNode = ctx.createGain();

  // --- WIRING THE GRAPH ---
  // Input -> AI Section
  inputNode.connect(noiseGateFilter);
  noiseGateFilter.connect(noiseGateGain);

  // Direct path + Exciter path
  noiseGateGain.connect(transientFilter);
  transientFilter.connect(postAiSum);

  noiseGateGain.connect(exciterSplit);
  exciterSplit.connect(exciterHighpass);
  exciterHighpass.connect(exciterWaveShaper);
  exciterWaveShaper.connect(exciterReturnGain);
  exciterReturnGain.connect(postAiSum);

  // AI Section -> Vocal Chain DSP
  postAiSum.connect(highPassFilter);
  highPassFilter.connect(compressor);
  compressor.connect(lowShelf);
  lowShelf.connect(midPeak);
  midPeak.connect(highShelf);
  highShelf.connect(formantResonator);
  formantResonator.connect(warmthWaveShaper);

  // Vocal Chain -> Panner & Fader
  if (panNode) {
    warmthWaveShaper.connect(panNode);
    panNode.connect(trackFader);
  } else {
    warmthWaveShaper.connect(trackFader);
  }

  // Fader -> Analyser & Sends & Master
  trackFader.connect(analyserNode);
  trackFader.connect(outputNode);

  outputNode.connect(masterMixBus);
  trackFader.connect(reverbSendNode);
  reverbSendNode.connect(reverbBus);

  trackFader.connect(delaySendNode);
  delaySendNode.connect(delayBus);

  // --- UPDATERS ---
  const updateVocalDsp = (config: VocalDspConfig) => {
    // Low-Cut / High-Pass Filter (80Hz default)
    const cutoff = config.lowCutFreq || config.highPassFreq || 80;
    if (config.highPassEnabled !== false) {
      highPassFilter.frequency.setValueAtTime(cutoff, ctx.currentTime);
      highPassFilter.type = 'highpass';
    } else {
      highPassFilter.frequency.setValueAtTime(10, ctx.currentTime);
    }

    // Warmth / Saturation
    if (config.warmth !== undefined) {
      warmthWaveShaper.curve = makeWarmthCurve(config.warmth / 100);
    }

    // Peak Compressor (levels volume spikes and vocal cracks)
    if (config.compressorEnabled !== false) {
      compressor.threshold.setValueAtTime(config.threshold, ctx.currentTime);
      compressor.ratio.setValueAtTime(config.ratio, ctx.currentTime);
      compressor.attack.setValueAtTime(config.attack, ctx.currentTime);
      compressor.release.setValueAtTime(config.release, ctx.currentTime);
    } else {
      compressor.threshold.setValueAtTime(0, ctx.currentTime);
      compressor.ratio.setValueAtTime(1, ctx.currentTime);
    }

    // EQ
    if (config.eqEnabled) {
      lowShelf.gain.setValueAtTime(config.lowGain, ctx.currentTime);
      lowShelf.frequency.setValueAtTime(config.lowFreq, ctx.currentTime);
      midPeak.gain.setValueAtTime(config.midGain, ctx.currentTime);
      midPeak.frequency.setValueAtTime(config.midFreq, ctx.currentTime);
      midPeak.Q.setValueAtTime(config.midQ, ctx.currentTime);
      highShelf.gain.setValueAtTime(config.highGain, ctx.currentTime);
      highShelf.frequency.setValueAtTime(config.highFreq, ctx.currentTime);
    } else {
      lowShelf.gain.setValueAtTime(0, ctx.currentTime);
      midPeak.gain.setValueAtTime(0, ctx.currentTime);
      highShelf.gain.setValueAtTime(0, ctx.currentTime);
    }

    // Formant Shift simulation (morphs resonant cavity center & warmth)
    const baseFormant = 1250;
    const shiftedFormant = baseFormant * Math.pow(2, (config.formantShift * 12) / 100 / 12);
    formantResonator.frequency.setValueAtTime(shiftedFormant, ctx.currentTime);
    formantResonator.gain.setValueAtTime(config.formantWarmth * 4.5, ctx.currentTime);

    // Sends
    const wet = config.reverbWet !== undefined ? config.reverbWet : config.reverbSend;
    reverbSendNode.gain.setValueAtTime(wet, ctx.currentTime);
    delaySendNode.gain.setValueAtTime(config.delaySend, ctx.currentTime);
  };

  const updateAiEnhancer = (config: AiEnhancerConfig) => {
    if (!config.enabled || config.abTestMode === 'original') {
      // Bypass AI enhancement (dry transparency)
      noiseGateFilter.frequency.setValueAtTime(20, ctx.currentTime);
      noiseGateGain.gain.setValueAtTime(1.0, ctx.currentTime);
      exciterReturnGain.gain.setValueAtTime(0.0, ctx.currentTime);
      transientFilter.gain.setValueAtTime(0.0, ctx.currentTime);
      return;
    }

    // Noise gate threshold
    const gateGain = config.noiseReduction > 0 ? 1.0 - (config.noiseReduction / 100) * 0.6 : 1.0;
    noiseGateGain.gain.setValueAtTime(gateGain, ctx.currentTime);
    noiseGateFilter.frequency.setValueAtTime(50 + (config.spectralClarity / 100) * 80, ctx.currentTime);

    // Harmonic Exciter drive
    const exciterAmount = (config.harmonicExciter / 100) * 0.35;
    exciterReturnGain.gain.setValueAtTime(exciterAmount, ctx.currentTime);
    exciterWaveShaper.curve = makeExciterCurve(config.harmonicExciter / 100);

    // Transient Punch boost
    const punchGain = (config.transientPunch / 100) * 4.5;
    transientFilter.gain.setValueAtTime(punchGain, ctx.currentTime);
  };

  const updateVolumeAndPan = (volume: number, pan: number, muted: boolean) => {
    trackFader.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
    if (panNode) {
      panNode.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    }
  };

  const disconnect = () => {
    try {
      inputNode.disconnect();
      outputNode.disconnect();
      reverbSendNode.disconnect();
      delaySendNode.disconnect();
      analyserNode.disconnect();
    } catch {
      // already disconnected
    }
  };

  // Run initial state
  updateVocalDsp(initialVocalDsp);
  updateAiEnhancer(initialAiEnhancer);
  updateVolumeAndPan(initialVolume, initialPan, false);

  return {
    inputNode,
    outputNode,
    reverbSendNode,
    delaySendNode,
    analyserNode,
    updateVocalDsp,
    updateAiEnhancer,
    updateVolumeAndPan,
    disconnect,
  };
}

// Master bus containing Master Limiter, Stereo Reverb Convolver, Stereo Delay
export interface MasterBusSystem {
  masterInput: GainNode;
  masterLimiter: DynamicsCompressorNode;
  masterAnalyser: AnalyserNode;
  reverbInput: GainNode;
  delayInput: GainNode;
  setMasterVolume: (vol: number) => void;
  setReverbDecay: (seconds: number) => void;
  setDelayFeedback: (feedback: number) => void;
  setDelayTime: (seconds: number) => void;
}

export function createMasterBus(ctx: AudioContext): MasterBusSystem {
  const masterInput = ctx.createGain();
  masterInput.gain.value = 0.9;

  // Master Brickwall Limiter (transparent peak protection)
  const masterLimiter = ctx.createDynamicsCompressor();
  masterLimiter.threshold.value = -0.5;
  masterLimiter.knee.value = 0;
  masterLimiter.ratio.value = 20;
  masterLimiter.attack.value = 0.001;
  masterLimiter.release.value = 0.05;

  const masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 256;
  masterAnalyser.smoothingTimeConstant = 0.8;

  // Connect Master: masterInput -> masterLimiter -> masterAnalyser -> destination
  masterInput.connect(masterLimiter);
  masterLimiter.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);

  // --- STUDIO STEREO CONVOLVER REVERB BUS ---
  const reverbInput = ctx.createGain();
  reverbInput.gain.value = 1.0;

  const convolver = ctx.createConvolver();
  // Generate studio reverb impulse response
  const generateImpulse = (duration = 2.0, decay = 2.5) => {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const channel = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const n = i / length;
        channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
      }
    }
    return impulse;
  };
  convolver.buffer = generateImpulse(2.2, 2.8);

  const reverbDamping = ctx.createBiquadFilter();
  reverbDamping.type = 'lowpass';
  reverbDamping.frequency.value = 6500;

  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.85;

  reverbInput.connect(convolver);
  convolver.connect(reverbDamping);
  reverbDamping.connect(reverbReturn);
  reverbReturn.connect(masterInput);

  // --- STEREO TAPE DELAY BUS ---
  const delayInput = ctx.createGain();
  delayInput.gain.value = 1.0;

  const delayNode = ctx.createDelay(3.0);
  delayNode.delayTime.value = 0.28; // ~eighth-note delay

  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.35;

  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 3500; // Warm analog tape roll-off

  const delayReturn = ctx.createGain();
  delayReturn.gain.value = 0.75;

  delayInput.connect(delayNode);
  delayNode.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayFilter.connect(delayReturn);
  delayReturn.connect(masterInput);

  return {
    masterInput,
    masterLimiter,
    masterAnalyser,
    reverbInput,
    delayInput,
    setMasterVolume: (vol: number) => {
      masterInput.gain.setValueAtTime(Math.max(0, Math.min(1.5, vol)), ctx.currentTime);
    },
    setReverbDecay: (seconds: number) => {
      convolver.buffer = generateImpulse(seconds, 2.5);
    },
    setDelayFeedback: (feedback: number) => {
      delayFeedback.gain.setValueAtTime(Math.max(0, Math.min(0.9, feedback)), ctx.currentTime);
    },
    setDelayTime: (seconds: number) => {
      delayNode.delayTime.setValueAtTime(Math.max(0.01, Math.min(2.0, seconds)), ctx.currentTime);
    },
  };
}
