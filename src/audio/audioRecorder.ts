import { RecordedTake } from '../types/audio';

export interface RecorderCallbacks {
  onLevelUpdate?: (peak: number) => void;
  onGateStatus?: (isOpen: boolean, currentLevel: number) => void;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private bandpassHighpassNode: BiquadFilterNode | null = null;
  private bandpassLowpassNode: BiquadFilterNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording = false;
  private audioCtx: AudioContext;
  private animFrameId: number | null = null;

  // Active Noise Gate parameters
  public silenceThreshold = 0.018; // ~ -35dB silence threshold for room/fan/hiss
  public gateAttack = 0.005; // 5ms attack
  public gateRelease = 0.05; // 50ms release
  public gateHold = 0.08; // 80ms hold

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

      // Request studio quality raw mic input without browser voice processing
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;

      // 1. Real-time Bandpass Filter (85Hz High-pass to cut rumble + 12kHz Low-pass to cut hiss)
      this.bandpassHighpassNode = this.audioCtx.createBiquadFilter();
      this.bandpassHighpassNode.type = 'highpass';
      this.bandpassHighpassNode.frequency.value = 85;
      this.bandpassHighpassNode.Q.value = 0.707;

      this.bandpassLowpassNode = this.audioCtx.createBiquadFilter();
      this.bandpassLowpassNode.type = 'lowpass';
      this.bandpassLowpassNode.frequency.value = 12000;
      this.bandpassLowpassNode.Q.value = 0.707;

      // Connect source -> Bandpass filter chain
      this.sourceNode.connect(this.bandpassHighpassNode);
      this.bandpassHighpassNode.connect(this.bandpassLowpassNode);
      this.bandpassLowpassNode.connect(this.analyserNode);

      // 4096 buffer size at 44.1kHz is ~92ms chunk
      this.processorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
      this.recordedChunks = [];
      this.isRecording = true;

      // Active Noise Gate state variables
      let gateEnvelope = 0.0;
      let lastAboveThresholdTime = 0;
      const sampleRate = this.audioCtx.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const length = inputData.length;
        const cleanOutput = new Float32Array(length);

        // Compute short-term RMS to detect signal vs background noise (room noise, mic hiss, fan noise)
        let sumSquares = 0;
        for (let i = 0; i < length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / length);
        const now = this.audioCtx.currentTime;

        const isSignalPresent = rms >= this.silenceThreshold;
        if (isSignalPresent) {
          lastAboveThresholdTime = now;
        }

        const isHolding = now - lastAboveThresholdTime < this.gateHold;
        const targetGate = (isSignalPresent || isHolding) ? 1.0 : 0.0;

        // Apply smooth envelope smoothing to avoid any clicks/pops
        const attackCoeff = Math.exp(-1.0 / (sampleRate * this.gateAttack));
        const releaseCoeff = Math.exp(-1.0 / (sampleRate * this.gateRelease));

        for (let i = 0; i < length; i++) {
          const coeff = targetGate > gateEnvelope ? attackCoeff : releaseCoeff;
          gateEnvelope = targetGate + coeff * (gateEnvelope - targetGate);

          // If gate is closed (room noise/hiss/fan), force sample to 0.0 completely
          if (gateEnvelope < 0.002) {
            cleanOutput[i] = 0.0;
          } else {
            cleanOutput[i] = inputData[i] * gateEnvelope;
          }
        }

        // Clean vocal-only audio pushed to recording buffer
        this.recordedChunks.push(cleanOutput);
        callbacks?.onGateStatus?.(targetGate > 0.1, rms);
      };

      this.bandpassLowpassNode.connect(this.processorNode);

      // Connect to dummy destination to keep processor flowing without feedback
      const muteGain = this.audioCtx.createGain();
      muteGain.gain.value = 0;
      this.processorNode.connect(muteGain);
      muteGain.connect(this.audioCtx.destination);

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
      console.error('Failed to start audio recording:', err);
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

    if (this.bandpassLowpassNode) {
      this.bandpassLowpassNode.disconnect();
      this.bandpassLowpassNode = null;
    }

    if (this.bandpassHighpassNode) {
      this.bandpassHighpassNode.disconnect();
      this.bandpassHighpassNode = null;
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

    // Merge Float32 chunks into a single AudioBuffer
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

    // Apply latency compensation to timeline start
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
