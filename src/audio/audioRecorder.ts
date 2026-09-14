import { RecordedTake } from '../types/audio';

export interface RecorderCallbacks {
  onLevelUpdate?: (peak: number) => void;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private isRecording = false;
  private audioCtx: AudioContext;
  private animFrameId: number | null = null;

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

      // 4096 buffer size at 44.1kHz is ~92ms chunk
      this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.recordedChunks = [];
      this.isRecording = true;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Clone samples into memory buffer
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        this.recordedChunks.push(copy);
      };

      this.sourceNode.connect(this.analyserNode);
      this.sourceNode.connect(this.processorNode);
      // Connect to dummy destination to keep processor flowing
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
