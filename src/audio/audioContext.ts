// Web Audio Context manager and audio utilities

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new AudioContextClass({
      latencyHint: 'interactive',
      sampleRate: 44100,
    });
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

// Generate realistic studio impulse response for the reverb bus
export function createStudioImpulseResponse(
  ctx: AudioContext,
  duration = 2.2,
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
    // Exponential decay combined with subtle diffusion
    const envelope = Math.exp(-t * decay);
    // Early reflections + dense late tail
    const noiseL = (Math.random() * 2 - 1);
    const noiseR = (Math.random() * 2 - 1);
    left[i] = noiseL * envelope;
    right[i] = noiseR * envelope;
  }

  return impulse;
}

// Compute waveform peaks for visual timeline
export function calculatePeaks(buffer: AudioBuffer, targetBins = 1200): Float32Array {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  const step = Math.max(1, Math.floor(totalSamples / targetBins));
  const peaks = new Float32Array(targetBins);

  for (let i = 0; i < targetBins; i++) {
    const start = i * step;
    const end = Math.min(start + step, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks[i] = max;
  }

  return peaks;
}

// Decode audio file to AudioBuffer
export async function decodeAudioFile(file: File, ctx: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
}

// Convert AudioBuffer to 16-bit stereo WAV Blob for download
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * numChannels * bytesPerSample;
  const bufferSize = 44 + length;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write interleaved PCM samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clip sample to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Metronome click generator
export function playMetronomeClick(ctx: AudioContext, isAccent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);

  gain.gain.setValueAtTime(isAccent ? 0.35 : 0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}
