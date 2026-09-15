// Synthesizes high quality instrumental backing stems using OfflineAudioContext
// Provides immediate, zero-latency multi-track backing music to record vocals over

export async function generateDemoStems(
  bpm = 100,
  bars = 8
): Promise<{ drumsBass: AudioBuffer; keysSynth: AudioBuffer }> {
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const totalDuration = totalBeats * secondsPerBeat;
  const sampleRate = 44100;
  const numSamples = Math.ceil(totalDuration * sampleRate);

  // Render Drum & Bass Stem
  const drumsCtx = new OfflineAudioContext(2, numSamples, sampleRate);
  renderDrumsAndBass(drumsCtx, bpm, bars, secondsPerBeat);
  const drumsBass = await drumsCtx.startRendering();

  // Render Keys & Synth Stem
  const keysCtx = new OfflineAudioContext(2, numSamples, sampleRate);
  renderKeysAndSynth(keysCtx, bpm, bars, secondsPerBeat);
  const keysSynth = await keysCtx.startRendering();

  return { drumsBass, keysSynth };
}

function renderDrumsAndBass(
  ctx: OfflineAudioContext,
  bpm: number,
  bars: number,
  secondsPerBeat: number
) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(ctx.destination);

  for (let bar = 0; bar < bars; bar++) {
    const barTime = bar * 4 * secondsPerBeat;

    // Beats 1, 2, 3, 4
    for (let beat = 0; beat < 4; beat++) {
      const beatTime = barTime + beat * secondsPerBeat;

      // Kick drum on beats 1 and 3 (with syncopation on 3.5 in some bars)
      if (beat === 0 || beat === 2) {
        synthesizeKick(ctx, masterGain, beatTime);
      }
      if (bar % 2 === 1 && beat === 1) {
        synthesizeKick(ctx, masterGain, beatTime + secondsPerBeat * 0.75);
      }

      // Snare on beats 2 and 4
      if (beat === 1 || beat === 3) {
        synthesizeSnare(ctx, masterGain, beatTime);
      }

      // Studio Closed Hi-Hats (velvety metallic tone, completely free of cricket/insect artifacts)
      synthesizeHiHat(ctx, masterGain, beatTime, 0.045);
      synthesizeHiHat(ctx, masterGain, beatTime + secondsPerBeat * 0.5, 0.022);
    }

    // Bassline (smooth R&B/HipHop bass progression: F -> Eb -> Db -> C)
    const rootNotes = [43.65, 38.89, 34.65, 32.7]; // F1, Eb1, Db1, C1
    const noteFreq = rootNotes[bar % 4];
    synthesizeBass(ctx, masterGain, barTime, noteFreq, secondsPerBeat * 1.8);
    synthesizeBass(ctx, masterGain, barTime + secondsPerBeat * 2, noteFreq * 1.5, secondsPerBeat * 1.2);
  }
}

function synthesizeKick(ctx: OfflineAudioContext, dest: AudioNode, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

  gain.gain.setValueAtTime(1.0, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + 0.35);
}

function synthesizeSnare(ctx: OfflineAudioContext, dest: AudioNode, time: number) {
  // Snare tone
  const toneOsc = ctx.createOscillator();
  const toneGain = ctx.createGain();
  toneOsc.type = 'triangle';
  toneOsc.frequency.setValueAtTime(180, time);
  toneOsc.frequency.exponentialRampToValueAtTime(60, time + 0.09);
  toneGain.gain.setValueAtTime(0.6, time);
  toneGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
  toneOsc.connect(toneGain);
  toneGain.connect(dest);
  toneOsc.start(time);
  toneOsc.stop(time + 0.15);

  // Snare noise
  const bufferSize = Math.floor(ctx.sampleRate * 0.22);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 850;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.7, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

  whiteNoise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);

  whiteNoise.start(time);
  whiteNoise.stop(time + 0.22);
}

// Studio metallic closed hi-hat (modeled after analog TR-808/909 cymbal cluster)
// Completely removes the harsh highpass noise bursts that sound like crickets in the background
function synthesizeHiHat(ctx: OfflineAudioContext, dest: AudioNode, time: number, vol = 0.04) {
  // 6-oscillator inharmonic cluster for authentic bronze cymbal ring
  const frequencies = [263, 400, 421, 474, 587, 845];
  const clusterGain = ctx.createGain();
  clusterGain.gain.setValueAtTime(vol * 0.4, time);

  // Bandpass filter to isolate the metallic shimmer (centered around 9.5 kHz)
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(9500, time);
  bandpass.Q.setValueAtTime(1.8, time);

  // Lowpass filter to avoid any high-frequency insect stridulation / cricket frequencies
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(12000, time);

  // Quick exponential decay envelope
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(1.0, time);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);

  frequencies.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, time);
    osc.connect(clusterGain);
    osc.start(time);
    osc.stop(time + 0.04);
  });

  clusterGain.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(envelope);
  envelope.connect(dest);

  // Subtle smoothed pink-noise tap for gentle stick impact
  const bufferSize = Math.floor(ctx.sampleRate * 0.03);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * 0.15;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(8500, time);
  noiseFilter.Q.setValueAtTime(2.0, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.25, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);

  noise.start(time);
  noise.stop(time + 0.03);
}

function synthesizeBass(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  dur: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, time);
  filter.frequency.exponentialRampToValueAtTime(110, time + dur);
  filter.Q.value = 3.5;

  gain.gain.setValueAtTime(0.65, time);
  gain.gain.setValueAtTime(0.65, time + dur - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + dur);
}

function renderKeysAndSynth(
  ctx: OfflineAudioContext,
  bpm: number,
  bars: number,
  secondsPerBeat: number
) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.65;
  masterGain.connect(ctx.destination);

  // Chords: Fm9 -> EbMaj9 -> DbMaj7 -> C7alt
  const chordFrequencies = [
    [174.61, 207.65, 261.63, 311.13, 349.23], // Fm9 (F3, Ab3, C4, Eb4, F4)
    [155.56, 196.0, 233.08, 293.66, 349.23],  // EbMaj9 (Eb3, G3, Bb3, D4, F4)
    [138.59, 174.61, 207.65, 261.63, 329.63], // DbMaj7 (Db3, F3, Ab3, C4, E4)
    [130.81, 164.81, 196.0, 233.08, 311.13],  // C7alt (C3, E3, G3, Bb3, Eb4)
  ];

  for (let bar = 0; bar < bars; bar++) {
    const barTime = bar * 4 * secondsPerBeat;
    const chord = chordFrequencies[bar % 4];

    // Electric Piano Chord pulse on beat 1 and beat 2.5
    playElectricPianoChord(ctx, masterGain, barTime, chord, secondsPerBeat * 2.2);
    playElectricPianoChord(ctx, masterGain, barTime + secondsPerBeat * 2.5, chord, secondsPerBeat * 1.3);

    // Warm Lead Arpeggio / melody snippet
    if (bar >= 2) {
      const notes = [chord[2], chord[3], chord[4], chord[1]];
      notes.forEach((f, idx) => {
        playSynthLeadNote(ctx, masterGain, barTime + secondsPerBeat * (1 + idx * 0.5), f, 0.4);
      });
    }
  }
}

function playElectricPianoChord(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  time: number,
  freqs: number[],
  duration: number
) {
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const baseVol = 0.12 / freqs.length;
    gain.gain.setValueAtTime(baseVol, time);
    gain.gain.exponentialRampToValueAtTime(baseVol * 0.4, time + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + duration);
  });
}

function playSynthLeadNote(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  duration: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq * 1.5, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, time);
  filter.frequency.exponentialRampToValueAtTime(600, time + duration);

  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + duration);
}
