import { RecordedTake } from '../types/audio';

export interface RecorderCallbacks {
  onLevelUpdate?: (peak: number) => void;
  onGateStatus?: (isOpen: boolean, currentLevel: number) => void;
}

/**
 * Version 1 Clean Audio Recorder Architecture:
 * - Direct clean getUserMedia microphone stream (with browser native echoCancellation & noiseSuppression if requested)
 * - Clean Web Audio GainNode + AnalyserNode (zero experimental pitch shifters or heavy multi-filter feedback on the live mic feed)
 * - Basic Noise Gate to silence room rumble, fan hiss, and background noise cleanly
 * - Direct Float32 audio chunks buffer recording for pristine reproduction
 */
export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private inputGainNode: GainNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording = false;
  private audioCtx: AudioContext;
  private animFrameId: number | null = null;

  // Clean noise gate threshold (~ -42dB)
  public silenceThreshold = 0.012;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  async start(
    trackId: string,
    startTime: number,
    callbacks?: RecorderCallbacks
  ): Promise<boolean> {
    try {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Safe clean mic setup
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Clean 80Hz High-Pass to cut microphone handling rumble
      this.highPassFilter = this.audioCtx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 80;
      this.highPassFilter.Q.value = 0.707;

      // Clean Input Gain
      this.inputGainNode = this.audioCtx.createGain();
      this.inputGainNode.gain.value = 1.0;

      // Analyser for UI VU meters
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;

      // Connect: mic -> 80Hz filter -> inputGain -> analyser
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.inputGainNode);
      this.inputGainNode.connect(this.analyserNode);

      // Simple, fast buffer recorder with clean basic noise gate
      this.processorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
      this.recordedChunks = [];
      this.isRecording = true;

      let gateEnvelope = 0.0;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const length = inputData.length;
        const cleanOutput = new Float32Array(length);

        // Calculate simple RMS
        let sumSquares = 0;
        for (let i = 0; i < length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / length);

        const isOpen = rms >= this.silenceThreshold;
        const targetGate = isOpen ? 1.0 : 0.0;

        // Smooth gate attack & release (no pop or click)
        const coeff = targetGate > gateEnvelope ? 0.8 : 0.05;
        gateEnvelope += (targetGate - gateEnvelope) * coeff;

        for (let i = 0; i < length; i++) {
          if (gateEnvelope < 0.01) {
            cleanOutput[i] = 0;
          } else {
            cleanOutput[i] = inputData[i] * gateEnvelope;
          }
        }

        this.recordedChunks.push(cleanOutput);
        callbacks?.onGateStatus?.(isOpen, rms);
      };

      this.inputGainNode.connect(this.processorNode);

      // Mute gain to destination so mic does NOT bleed/feedback through speakers/headphones
      const muteSink = this.audioCtx.createGain();
      muteSink.gain.value = 0;
      this.processorNode.connect(muteSink);
      muteSink.connect(this.audioCtx.destination);

      // Level meter loop
      if (callbacks?.onLevelUpdate && this.analyserNode) {
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        const updateLoop = () => {
          if (!this.isRecording) return;
          this.analyserNode?.getByteTimeDomainData(dataArray);
          let max = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = Math.abs((dataArray[i] - 128) / 128);
            if (v > max) max = v;
          }
          callbacks.onLevelUpdate?.(max);
          this.animFrameId = requestAnimationFrame(updateLoop);
        };
        updateLoop();
      }

      return true;
    } catch (err) {
      console.error('Microphone stream error:', err);
      return false;
    }
  }

  stop(trackId: string, timelineStartTime: number, latencyOffsetMs = 0): RecordedTake | null {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.inputGainNode) {
      this.inputGainNode.disconnect();
      this.inputGainNode = null;
    }

    if (this.highPassFilter) {
      this.highPassFilter.disconnect();
      this.highPassFilter = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.recordedChunks.length === 0) {
      return null;
    }

    // Merge recorded Float32 chunks into AudioBuffer
    const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalLength === 0) return null;

    const mergedBuffer = this.audioCtx.createBuffer(1, totalLength, this.audioCtx.sampleRate);
    const channelData = mergedBuffer.getChannelData(0);

    let offset = 0;
    for (const chunk of this.recordedChunks) {
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    const duration = mergedBuffer.duration;
    const compensatedStartTime = Math.max(0, timelineStartTime + latencyOffsetMs / 1000);

    const take: RecordedTake = {
      id: 'take_' + Date.now(),
      trackId,
      audioBuffer: mergedBuffer,
      recordedAt: Date.now(),
      startTime: compensatedStartTime,
      duration,
      latencyOffsetMs,
    };

    return take;
  }
}
