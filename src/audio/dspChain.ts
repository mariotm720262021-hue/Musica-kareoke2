import { VocalDspConfig, AiEnhancerConfig } from '../types/audio';

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
  // Main Input
  const inputNode = ctx.createGain();

  // --- AI AUDIO CLEANER & RESTORER SECTION ---
  // 1. Noise Gate / Background Suppressor
  const noiseGateGain = ctx.createGain();
  const noiseGateFilter = ctx.createBiquadFilter();
  noiseGateFilter.type = 'highpass';
  noiseGateFilter.frequency.value = 40;

  // 2. Harmonic Exciter & Resynthesis
  const exciterSplit = ctx.createGain();
  const exciterHighpass = ctx.createBiquadFilter();
  exciterHighpass.type = 'highpass';
  exciterHighpass.frequency.value = 3200; // Exciter acts on high-mids and presence
  const exciterWaveShaper = ctx.createWaveShaper();
  exciterWaveShaper.curve = makeExciterCurve(initialAiEnhancer.harmonicExciter / 100);
  exciterWaveShaper.oversample = '2x';
  const exciterReturnGain = ctx.createGain();

  // 3. Transient Shaper / Punch
  const transientFilter = ctx.createBiquadFilter();
  transientFilter.type = 'peaking';
  transientFilter.frequency.value = 4500;
  transientFilter.Q.value = 1.4;

  const postAiSum = ctx.createGain();

  // --- VOCAL CHAIN DSP SECTION ---
  // 1. High-Pass Filter (Low-cut at 80Hz default)
  const highPassFilter = ctx.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = initialVocalDsp.highPassFreq || 80;
  highPassFilter.Q.value = 0.707;

  // 2. Dynamic Range Compressor
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

  // 5. Volume & Pan
  const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const trackFader = ctx.createGain();
  trackFader.gain.value = initialVolume;

  // 6. Sends to Reverb & Delay buses
  const reverbSendNode = ctx.createGain();
  reverbSendNode.gain.value = initialVocalDsp.reverbSend;

  const delaySendNode = ctx.createGain();
  delaySendNode.gain.value = initialVocalDsp.delaySend;

  // 7. Track Analyser for real-time VU Meter
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

  // Vocal Chain -> Panner & Fader
  if (panNode) {
    formantResonator.connect(panNode);
    panNode.connect(trackFader);
  } else {
    formantResonator.connect(trackFader);
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
    // High-Pass
    if (config.highPassEnabled) {
      highPassFilter.frequency.setValueAtTime(config.highPassFreq, ctx.currentTime);
      highPassFilter.type = 'highpass';
    } else {
      highPassFilter.frequency.setValueAtTime(10, ctx.currentTime);
    }

    // Compressor
    if (config.compressorEnabled) {
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
    reverbSendNode.gain.setValueAtTime(config.reverbSend, ctx.currentTime);
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

    // AI Noise Gate & Suppression
    // Threshold calculation
    const gateCutoff = Math.max(20, 20 + (config.noiseReduction / 100) * 80);
    noiseGateFilter.frequency.setValueAtTime(gateCutoff, ctx.currentTime);
    noiseGateGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // AI Harmonic Exciter: Non-linear overtones
    const exciterAmount = (config.harmonicExciter / 100) * 0.45;
    exciterWaveShaper.curve = makeExciterCurve(config.harmonicExciter / 100);
    exciterReturnGain.gain.setValueAtTime(exciterAmount, ctx.currentTime);

    // Transient Shaper & Clarity
    const transientGain = (config.transientPunch / 100) * 4.5;
    transientFilter.gain.setValueAtTime(transientGain, ctx.currentTime);
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
  reverbInput: GainNode;
  delayInput: GainNode;
  masterFader: GainNode;
  masterAnalyser: AnalyserNode;
  setMasterVolume: (val: number) => void;
  setDelayParams: (time: number, feedback: number) => void;
}

export function createMasterBus(ctx: AudioContext): MasterBusSystem {
  const masterInput = ctx.createGain();
  const masterFader = ctx.createGain();
  masterFader.gain.value = 0.9;

  // Master Limiter / Output Stage Compressor to prevent digital clipping
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -0.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.05;

  const masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 512;
  masterAnalyser.smoothingTimeConstant = 0.85;

  // --- REVERB BUS (Convolver) ---
  const reverbInput = ctx.createGain();
  const convolver = ctx.createConvolver();
  // Impulse response generated via createStudioImpulseResponse
  try {
    const impulse = createStudioImpulseResponse(ctx, 2.0, 2.2, 0.02);
    convolver.buffer = impulse;
  } catch {
    // fallback if context not ready
  }
  const reverbWetGain = ctx.createGain();
  reverbWetGain.gain.value = 0.8;

  reverbInput.connect(convolver);
  convolver.connect(reverbWetGain);
  reverbWetGain.connect(masterInput);

  // --- DELAY BUS (Feedback delay with damping) ---
  const delayInput = ctx.createGain();
  const delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.28; // ~quarter note around 100bpm
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.35;
  const delayDampFilter = ctx.createBiquadFilter();
  delayDampFilter.type = 'lowpass';
  delayDampFilter.frequency.value = 3500; // natural high damping

  delayInput.connect(delayNode);
  delayNode.connect(delayDampFilter);
  delayDampFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode);

  const delayWetGain = ctx.createGain();
  delayWetGain.gain.value = 0.65;
  delayDampFilter.connect(delayWetGain);
  delayWetGain.connect(masterInput);

  // Master route
  masterInput.connect(masterFader);
  masterFader.connect(limiter);
  limiter.connect(masterAnalyser);
  masterAnalyser.connect(ctx.destination);

  return {
    masterInput,
    reverbInput,
    delayInput,
    masterFader,
    masterAnalyser,
    setMasterVolume: (val: number) => {
      masterFader.gain.setValueAtTime(val, ctx.currentTime);
    },
    setDelayParams: (time: number, feedback: number) => {
      delayNode.delayTime.setValueAtTime(time, ctx.currentTime);
      delayFeedback.gain.setValueAtTime(feedback, ctx.currentTime);
    },
  };
}

// Helper to generate impulse response if needed
function createStudioImpulseResponse(
  ctx: AudioContext,
  duration = 2.0,
  decay = 2.0,
  preDelay = 0.02
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  const preDelaySamples = Math.floor(sampleRate * preDelay);

  for (let i = 0; i < length; i++) {
    if (i < preDelaySamples) {
      left[i] = 0;
      right[i] = 0;
      continue;
    }
    const t = (i - preDelaySamples) / (length - preDelaySamples);
    const envelope = Math.exp(-t * decay);
    left[i] = (Math.random() * 2 - 1) * envelope;
    right[i] = (Math.random() * 2 - 1) * envelope;
  }
  return impulse;
}
