import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioTrack,
  TransportState,
  RecordedTake,
  VocalDspConfig,
  AiEnhancerConfig,
} from './types/audio';
import {
  getAudioContext,
  calculatePeaks,
  decodeAudioFile,
  playMetronomeClick,
} from './audio/audioContext';
import {
  createMasterBus,
  createTrackDsp,
  MasterBusSystem,
  TrackDspNodes,
} from './audio/dspChain';
import { AudioRecorder } from './audio/audioRecorder';
import { calculateAutoTuneShift, ToneAutoTuneEngine, tuneVocalAudioBuffer } from './audio/autoTuneEngine';
import { generateDemoStems } from './audio/synthesizerDemo';
import { TransportBar } from './components/TransportBar';
import { StudioQuickBar } from './components/StudioQuickBar';
import { TrackHeader } from './components/TrackHeader';
import { TimelineView } from './components/TimelineView';
import { VocalDspRack } from './components/VocalDspRack';
import { AiAudioCleanerRack } from './components/AiAudioCleanerRack';
import { TakeReviewModal } from './components/TakeReviewModal';
import { ExportModal } from './components/ExportModal';

const DEFAULT_VOCAL_DSP: VocalDspConfig = {
  highPassEnabled: true,
  highPassFreq: 80, // Low-cut at 80Hz
  lowCutFreq: 80,
  pitchCorrection: 40,
  pitchCorrectionKey: 'C',
  pitchCorrectionScale: 'major',
  warmth: 25,
  reverbWet: 0.28,
  compressorEnabled: true,
  threshold: -22,
  ratio: 3.5,
  attack: 0.015,
  release: 0.22,
  eqEnabled: true,
  lowGain: 1.5,
  lowFreq: 120,
  midGain: 2.0,
  midFreq: 1800,
  midQ: 1.2,
  highGain: 3.5,
  highFreq: 9500,
  pitchShift: 0,
  formantShift: 0,
  formantWarmth: 0.45,
  reverbSend: 0.28,
  delaySend: 0.18,
  delayTime: 0.28,
  delayFeedback: 0.35,
};

const DEFAULT_AI_ENHANCER: AiEnhancerConfig = {
  enabled: true,
  noiseGateThreshold: -42,
  noiseReduction: 60,
  harmonicExciter: 45,
  transientPunch: 40,
  spectralClarity: 50,
  abTestMode: 'processed',
};

export default function App() {
  // Audio Engine Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterBusRef = useRef<MasterBusSystem | null>(null);
  const trackDspMapRef = useRef<{ [trackId: string]: TrackDspNodes }>({});
  const activeSourcesRef = useRef<{ [trackId: string]: AudioBufferSourceNode }>({});
  const activePitchShiftersRef = useRef<{ [trackId: string]: ToneAutoTuneEngine }>({});
  const recorderRef = useRef<AudioRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playback Timing Sync Refs
  const playStartTimeRef = useRef<number>(0);
  const playStartTimelineOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const nextMetronomeBeatRef = useRef<number>(0);

  // Studio Tracks State
  const [tracks, setTracks] = useState<AudioTrack[]>([
    {
      id: 'track_drums_bass',
      name: 'Drums & 808 Bass Stem',
      type: 'backing',
      color: '#06b6d4', // cyan-500
      volume: 0.9,
      pan: 0,
      muted: false,
      solo: false,
      isArmed: false,
      audioBuffer: null,
      peaks: null,
      startTime: 0,
      duration: 19.2,
      vocalDsp: { ...DEFAULT_VOCAL_DSP, highPassEnabled: false, compressorEnabled: false, reverbSend: 0.05, delaySend: 0 },
      aiEnhancer: { ...DEFAULT_AI_ENHANCER, harmonicExciter: 60, transientPunch: 65 },
    },
    {
      id: 'track_keys_lead',
      name: 'Rhodes Chords & Synth Stem',
      type: 'backing',
      color: '#6366f1', // indigo-500
      volume: 0.85,
      pan: 0,
      muted: false,
      solo: false,
      isArmed: false,
      audioBuffer: null,
      peaks: null,
      startTime: 0,
      duration: 19.2,
      vocalDsp: { ...DEFAULT_VOCAL_DSP, highPassEnabled: false, compressorEnabled: false, reverbSend: 0.25, delaySend: 0.15 },
      aiEnhancer: { ...DEFAULT_AI_ENHANCER, harmonicExciter: 50, spectralClarity: 65 },
    },
    {
      id: 'track_lead_vocal',
      name: 'Lead Vocals',
      type: 'vocal',
      color: '#f43f5e', // rose-500
      volume: 1.0,
      pan: 0,
      muted: false,
      solo: false,
      isArmed: true, // Armed ready for overdub
      audioBuffer: null,
      peaks: null,
      startTime: 0,
      duration: 0,
      vocalDsp: { ...DEFAULT_VOCAL_DSP },
      aiEnhancer: { ...DEFAULT_AI_ENHANCER },
    },
    {
      id: 'track_backing_vocal',
      name: 'Chorus Harmonies',
      type: 'vocal',
      color: '#f59e0b', // amber-500
      volume: 0.8,
      pan: 0.25,
      muted: false,
      solo: false,
      isArmed: false,
      audioBuffer: null,
      peaks: null,
      startTime: 0,
      duration: 0,
      vocalDsp: { ...DEFAULT_VOCAL_DSP, reverbSend: 0.45, delaySend: 0.3 },
      aiEnhancer: { ...DEFAULT_AI_ENHANCER },
    },
  ]);

  // Transport State
  const [transport, setTransport] = useState<TransportState>({
    isPlaying: false,
    isRecording: false,
    isPaused: false,
    currentTime: 0,
    duration: 30,
    loop: true,
    loopStart: 0,
    loopEnd: 19.2, // matches 8-bar demo at 100bpm
    bpm: 100,
    metronome: false,
    masterVolume: 0.9,
  });

  // UI Selection & Modal State
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_lead_vocal');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'vocal' | 'ai' | null>('vocal');
  const [recordedTakeForReview, setRecordedTakeForReview] = useState<RecordedTake | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTuning, setIsTuning] = useState(false);

  // Metering State
  const [masterPeakL, setMasterPeakL] = useState(0);
  const [masterPeakR, setMasterPeakR] = useState(0);
  const [trackPeaks, setTrackPeaks] = useState<{ [id: string]: number }>({});
  const [liveRecordingPeak, setLiveRecordingPeak] = useState(0);

  // Initialize Master Bus and Audio Context
  const ensureAudioEngine = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = getAudioContext();
      audioCtxRef.current = ctx;
      const master = createMasterBus(ctx);
      masterBusRef.current = master;
      recorderRef.current = new AudioRecorder(ctx);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, master: masterBusRef.current! };
  }, []);

  // Synchronize Track DSP Nodes with State
  useEffect(() => {
    const { ctx, master } = ensureAudioEngine();

    tracks.forEach((track) => {
      let dsp = trackDspMapRef.current[track.id];
      if (!dsp) {
        dsp = createTrackDsp(
          ctx,
          track.vocalDsp,
          track.aiEnhancer,
          track.volume,
          track.pan,
          master.reverbInput,
          master.delayInput,
          master.masterInput
        );
        trackDspMapRef.current[track.id] = dsp;
      } else {
        dsp.updateVocalDsp(track.vocalDsp);
        dsp.updateAiEnhancer(track.aiEnhancer);
        dsp.updateVolumeAndPan(track.volume, track.pan, track.muted);
      }
    });

    // Cleanup deleted tracks
    Object.keys(trackDspMapRef.current).forEach((id) => {
      if (!tracks.find((t) => t.id === id)) {
        trackDspMapRef.current[id].disconnect();
        delete trackDspMapRef.current[id];
      }
    });
  }, [tracks, ensureAudioEngine]);

  // Load Pro Demo Stems automatically on first load so the user can hit Play or Record immediately
  const handleLoadDemoStems = useCallback(async () => {
    try {
      const { drumsBass, keysSynth } = await generateDemoStems(transport.bpm, 8);
      const drumsPeaks = calculatePeaks(drumsBass, 600);
      const keysPeaks = calculatePeaks(keysSynth, 600);

      setTracks((prev) =>
        prev.map((t) => {
          if (t.id === 'track_drums_bass') {
            return {
              ...t,
              audioBuffer: drumsBass,
              peaks: drumsPeaks,
              startTime: 0,
              duration: drumsBass.duration,
            };
          }
          if (t.id === 'track_keys_lead') {
            return {
              ...t,
              audioBuffer: keysSynth,
              peaks: keysPeaks,
              startTime: 0,
              duration: keysSynth.duration,
            };
          }
          return t;
        })
      );
    } catch (err) {
      console.error('Error generating demo stems:', err);
    }
  }, [transport.bpm]);

  // Auto-generate demo stems on mount
  useEffect(() => {
    handleLoadDemoStems();
  }, [handleLoadDemoStems]);

  // Update Master Volume
  const handleMasterVolumeChange = (vol: number) => {
    setTransport((prev) => ({ ...prev, masterVolume: vol }));
    if (masterBusRef.current) {
      masterBusRef.current.setMasterVolume(vol);
    }
  };

  // Stop all active track playback sources
  const stopAllTrackSources = useCallback(() => {
    (Object.values(activeSourcesRef.current) as AudioBufferSourceNode[]).forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current = {};

    (Object.values(activePitchShiftersRef.current) as ToneAutoTuneEngine[]).forEach((shifter) => {
      try {
        shifter.disconnect();
        shifter.dispose();
      } catch {
        // already disposed
      }
    });
    activePitchShiftersRef.current = {};
  }, []);

  // Launch audio playback for all audible tracks aligned with timeline currentTime
  const startTrackSourcesAtTime = useCallback(
    (timelineTime: number) => {
      const { ctx } = ensureAudioEngine();
      stopAllTrackSources();

      const anySolo = tracks.some((t) => t.solo);

      tracks.forEach((track) => {
        if (!track.audioBuffer) return;
        if (track.muted) return;
        if (anySolo && !track.solo) return;

        const trackStartTime = track.startTime || 0;
        const trackEndTime = trackStartTime + (track.duration || track.audioBuffer.duration);

        // Check if playhead intersects track
        if (timelineTime >= trackEndTime) return;

        const dsp = trackDspMapRef.current[track.id];
        if (!dsp) return;

        const src = ctx.createBufferSource();
        src.buffer = track.audioBuffer;

        // Auto-Tune & Pitch Shift: apply musical scale quantization and transpose
        let totalSemitones = track.vocalDsp.pitchShift || 0;
        if (track.vocalDsp.pitchCorrection > 0) {
          const autoTuneOffset = calculateAutoTuneShift(
            track.vocalDsp.pitchShift || 0,
            track.vocalDsp.pitchCorrectionKey || 'C',
            track.vocalDsp.pitchCorrectionScale || 'major',
            track.vocalDsp.pitchCorrection
          );
          totalSemitones += autoTuneOffset;
        }

        if (totalSemitones !== 0) {
          try {
            const pitchEngine = new ToneAutoTuneEngine(ctx);
            pitchEngine.setPitch(totalSemitones);
            pitchEngine.connectSource(src);
            pitchEngine.connectDestination(dsp.inputNode);
            activePitchShiftersRef.current[track.id] = pitchEngine;
          } catch {
            src.playbackRate.value = Math.pow(2, totalSemitones / 12);
            src.connect(dsp.inputNode);
          }
        } else {
          src.connect(dsp.inputNode);
        }

        // Calculate offset into the audio buffer
        let bufferOffset = 0;
        let scheduleTime = ctx.currentTime;

        if (timelineTime >= trackStartTime) {
          bufferOffset = timelineTime - trackStartTime;
        } else {
          // Track starts in the future
          scheduleTime = ctx.currentTime + (trackStartTime - timelineTime);
        }

        src.start(scheduleTime, bufferOffset);
        activeSourcesRef.current[track.id] = src;
      });
    },
    [ensureAudioEngine, stopAllTrackSources, tracks]
  );

  // Main Playback Animation Frame Loop
  useEffect(() => {
    if (!transport.isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setMasterPeakL(0);
      setMasterPeakR(0);
      return;
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const dataArray = new Uint8Array(128);

    const tick = () => {
      if (!transport.isPlaying) return;

      const elapsed = ctx.currentTime - playStartTimeRef.current;
      let newTimelineTime = playStartTimelineOffsetRef.current + elapsed;

      // Check Loop Boundary
      if (transport.loop && newTimelineTime >= transport.loopEnd) {
        newTimelineTime = transport.loopStart;
        playStartTimeRef.current = ctx.currentTime;
        playStartTimelineOffsetRef.current = transport.loopStart;
        startTrackSourcesAtTime(transport.loopStart);
      }

      setTransport((prev) => ({ ...prev, currentTime: newTimelineTime }));

      // Metronome Click Scheduling
      if (transport.metronome) {
        const secondsPerBeat = 60 / transport.bpm;
        if (newTimelineTime >= nextMetronomeBeatRef.current) {
          const beatIndex = Math.floor(newTimelineTime / secondsPerBeat);
          const isAccent = beatIndex % 4 === 0;
          playMetronomeClick(ctx, isAccent);
          nextMetronomeBeatRef.current = (beatIndex + 1) * secondsPerBeat;
        }
      }

      // Master VU meter calculation
      if (masterBusRef.current) {
        masterBusRef.current.masterAnalyser.getByteTimeDomainData(dataArray);
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs((dataArray[i] - 128) / 128);
          if (val > max) max = val;
        }
        setMasterPeakL(max * 1.15);
        setMasterPeakR(max * 1.12);
      }

      // Track VU meters
      const peaks: { [id: string]: number } = {};
      tracks.forEach((track) => {
        const dsp = trackDspMapRef.current[track.id];
        if (dsp) {
          dsp.analyserNode.getByteTimeDomainData(dataArray);
          let max = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = Math.abs((dataArray[i] - 128) / 128);
            if (val > max) max = val;
          }
          peaks[track.id] = max;
        }
      });
      setTrackPeaks(peaks);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    transport.isPlaying,
    transport.loop,
    transport.loopStart,
    transport.loopEnd,
    transport.bpm,
    transport.metronome,
    startTrackSourcesAtTime,
    tracks,
  ]);

  // Transport Action: PLAY
  const handlePlay = () => {
    const { ctx } = ensureAudioEngine();
    playStartTimeRef.current = ctx.currentTime;
    playStartTimelineOffsetRef.current = transport.currentTime;
    nextMetronomeBeatRef.current = transport.currentTime;

    startTrackSourcesAtTime(transport.currentTime);
    setTransport((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
  };

  // Transport Action: PAUSE
  const handlePause = () => {
    stopAllTrackSources();
    setTransport((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
  };

  // Transport Action: STOP
  const handleStop = () => {
    const wasRecording = transport.isRecording;
    stopAllTrackSources();

    if (wasRecording && recorderRef.current) {
      const armedTrack = tracks.find((t) => t.isArmed) || tracks[0];
      const take = recorderRef.current.stop(armedTrack.id, playStartTimelineOffsetRef.current, 0);
      setTransport((prev) => ({ ...prev, isPlaying: false, isRecording: false, isPaused: false }));
      if (take) {
        // Pop up the Take Review Modal ("Don't save until OK")!
        setRecordedTakeForReview(take);
      }
      return;
    }

    setTransport((prev) => ({
      ...prev,
      isPlaying: false,
      isRecording: false,
      isPaused: false,
      currentTime: 0,
    }));
  };

  // Transport Action: RECORD (Stems & Overdubs)
  const handleRecord = async () => {
    const { ctx } = ensureAudioEngine();

    if (transport.isRecording) {
      // Stop recording and trigger Take Review Modal
      handleStop();
      return;
    }

    // Identify which track is armed
    let armedTrack = tracks.find((t) => t.isArmed);
    if (!armedTrack) {
      // Auto-arm the selected track or first vocal track
      const candidate = tracks.find((t) => t.id === selectedTrackId) || tracks.find((t) => t.type === 'vocal') || tracks[0];
      setTracks((prev) => prev.map((t) => ({ ...t, isArmed: t.id === candidate.id })));
      armedTrack = candidate;
    }

    if (!recorderRef.current) {
      recorderRef.current = new AudioRecorder(ctx);
    }

    const success = await recorderRef.current.start(armedTrack.id, transport.currentTime, {
      onLevelUpdate: (peak) => setLiveRecordingPeak(peak),
    });

    if (!success) {
      alert('Microphone access denied or audio input unavailable. Please check your browser permissions.');
      return;
    }

    // Start backing tracks playback simultaneously so the singer hears the beat!
    playStartTimeRef.current = ctx.currentTime;
    playStartTimelineOffsetRef.current = transport.currentTime;
    nextMetronomeBeatRef.current = transport.currentTime;
    startTrackSourcesAtTime(transport.currentTime);

    setTransport((prev) => ({ ...prev, isPlaying: true, isRecording: true, isPaused: false }));
  };

  // Seek timeline to time position
  const handleSeek = (newTime: number) => {
    const { ctx } = ensureAudioEngine();
    const clampedTime = Math.max(0, newTime);

    if (transport.isPlaying) {
      playStartTimeRef.current = ctx.currentTime;
      playStartTimelineOffsetRef.current = clampedTime;
      nextMetronomeBeatRef.current = clampedTime;
      startTrackSourcesAtTime(clampedTime);
    }

    setTransport((prev) => ({ ...prev, currentTime: clampedTime }));
  };

  // Nudge / update audio clip start time on timeline
  const handleUpdateTrackStartTime = (trackId: string, newStartTime: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, startTime: Math.max(0, newStartTime) } : t))
    );
  };

  // Handle Track File Import (WAV, MP3, OGG, FLAC)
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { ctx } = ensureAudioEngine();
      const decoded = await decodeAudioFile(file, ctx);
      const peaks = calculatePeaks(decoded, 600);

      // Place into selected track or create a new track
      setTracks((prev) => {
        const hasSelected = prev.some((t) => t.id === selectedTrackId);
        if (hasSelected) {
          return prev.map((t) =>
            t.id === selectedTrackId
              ? {
                  ...t,
                  name: file.name.replace(/\.[^/.]+$/, ''),
                  audioBuffer: decoded,
                  peaks,
                  startTime: transport.currentTime,
                  duration: decoded.duration,
                }
              : t
          );
        } else {
          const newTrack: AudioTrack = {
            id: 'track_' + Date.now(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            type: 'stem',
            color: '#10b981',
            volume: 0.9,
            pan: 0,
            muted: false,
            solo: false,
            isArmed: false,
            audioBuffer: decoded,
            peaks,
            startTime: transport.currentTime,
            duration: decoded.duration,
            vocalDsp: { ...DEFAULT_VOCAL_DSP },
            aiEnhancer: { ...DEFAULT_AI_ENHANCER },
          };
          return [...prev, newTrack];
        }
      });
    } catch (err) {
      console.error('Audio import failed:', err);
      alert('Unable to decode this audio file. Please try another standard WAV, MP3, or OGG file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Add a new track
  const handleAddTrack = () => {
    const trackColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
    const newId = 'track_' + Date.now();
    const newTrack: AudioTrack = {
      id: newId,
      name: `Vocal Overdub ${tracks.length + 1}`,
      type: 'vocal',
      color: trackColors[tracks.length % trackColors.length],
      volume: 0.9,
      pan: 0,
      muted: false,
      solo: false,
      isArmed: false,
      audioBuffer: null,
      peaks: null,
      startTime: 0,
      duration: 0,
      vocalDsp: { ...DEFAULT_VOCAL_DSP },
      aiEnhancer: { ...DEFAULT_AI_ENHANCER },
    };
    setTracks((prev) => [...prev, newTrack]);
    setSelectedTrackId(newId);
  };

  // Toggle Track Record Arm
  const handleToggleArm = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        isArmed: t.id === trackId ? !t.isArmed : false, // Arm exclusively for clear stem tracking
      }))
    );
  };

  // Update specific track properties
  const handleUpdateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const updatedTrack = { ...t, ...updates };
          const dspNodes = trackDspMapRef.current[trackId];
          if (dspNodes) {
            if (updates.vocalDsp) {
              dspNodes.updateVocalDsp(updatedTrack.vocalDsp);
            }
            if (updates.aiEnhancer) {
              dspNodes.updateAiEnhancer(updatedTrack.aiEnhancer);
            }
            if (updates.volume !== undefined) {
              dspNodes.faderGain.gain.setValueAtTime(
                updates.volume,
                audioCtxRef.current?.currentTime || 0
              );
            }
          }
          return updatedTrack;
        }
        return t;
      })
    );
  };

  // Tune track with genuine musical Auto-Tune algorithm
  const handleTuneTrack = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || !track.audioBuffer) {
      setToastMessage('⚠️ Esta pista no tiene audio grabado aún. Graba una toma primero.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      setIsTuning(true);
      const { ctx } = ensureAudioEngine();
      const intensity = track.vocalDsp.pitchCorrection > 0 ? track.vocalDsp.pitchCorrection : 80;
      const key = track.vocalDsp.pitchCorrectionKey || 'C';
      const scale = track.vocalDsp.pitchCorrectionScale || 'major';

      const tunedBuffer = tuneVocalAudioBuffer(
        track.audioBuffer,
        ctx,
        key,
        scale,
        intensity
      );
      const newPeaks = calculatePeaks(tunedBuffer, 600);

      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                audioBuffer: tunedBuffer,
                peaks: newPeaks,
                vocalDsp: {
                  ...t.vocalDsp,
                  pitchCorrection: intensity,
                },
              }
            : t
        )
      );

      // Reset live pitch shifter for this track since the buffer is already quantized
      const pitchShifter = activePitchShiftersRef.current[trackId];
      if (pitchShifter) {
        pitchShifter.setPitch(0);
      }

      setToastMessage(`✨ Pista "${track.name}" afinada con éxito en Tono ${key} (${scale}, ${intensity}% corrección)!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error auto-tuning track:', err);
      setToastMessage('Error al afinar la pista.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsTuning(false);
    }
  };

  // Delete a track
  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) {
      alert('Must maintain at least 1 track in session.');
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (selectedTrackId === trackId) {
      setSelectedTrackId(tracks.find((t) => t.id !== trackId)?.id || '');
    }
  };

  // "Keep or Discard": Commit take from review modal
  const handleCommitTake = (
    targetTrackId: string,
    latencyOffsetMs: number,
    asNewTrack = true
  ) => {
    if (!recordedTakeForReview) return;

    const takeBuffer = recordedTakeForReview.audioBuffer;
    const peaks = calculatePeaks(takeBuffer, 600);
    const finalStartTime = Math.max(0, recordedTakeForReview.startTime + latencyOffsetMs / 1000);

    if (asNewTrack) {
      // Append as brand new audio track lane below existing tracks (never overwriting)
      const trackColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
      const newId = 'track_' + Date.now();
      const vocalCount = tracks.filter((t) => t.type === 'vocal').length + 1;
      const newTrack: AudioTrack = {
        id: newId,
        name: `Vocal Toma ${vocalCount}`,
        type: 'vocal',
        color: trackColors[tracks.length % trackColors.length],
        volume: 0.95,
        pan: 0,
        muted: false,
        solo: false,
        isArmed: false,
        audioBuffer: takeBuffer,
        peaks,
        startTime: finalStartTime,
        duration: takeBuffer.duration,
        vocalDsp: { ...DEFAULT_VOCAL_DSP },
        aiEnhancer: { ...DEFAULT_AI_ENHANCER },
      };
      setTracks((prev) => [...prev, newTrack]);
      setSelectedTrackId(newId);
      setToastMessage(`🎙️ ¡Toma guardada en nueva pista "${newTrack.name}"!`);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setTracks((prev) =>
        prev.map((t) => {
          if (t.id === targetTrackId) {
            return {
              ...t,
              audioBuffer: takeBuffer,
              peaks,
              startTime: finalStartTime,
              duration: takeBuffer.duration,
            };
          }
          return t;
        })
      );
      setToastMessage(`🎙️ Audio guardado en la pista.`);
      setTimeout(() => setToastMessage(null), 3000);
    }

    setRecordedTakeForReview(null);
  };

  // Re-record take
  const handleReRecord = (targetTrackId: string) => {
    setRecordedTakeForReview(null);
    setTracks((prev) => prev.map((t) => ({ ...t, isArmed: t.id === targetTrackId })));
    setTimeout(() => {
      handleRecord();
    }, 150);
  };

  // Discard take
  const handleDiscardTake = () => {
    setRecordedTakeForReview(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (transport.isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRecord();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setTransport((prev) => ({ ...prev, loop: !prev.loop }));
      } else if (e.code === 'Escape') {
        setActiveInspectorTab(null);
        setRecordedTakeForReview(null);
        setShowExportModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-cyan-500/80 text-white text-xs px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 backdrop-blur animate-fade-in">
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Audio Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Top Transport & Master Bar */}
      <TransportBar
        transport={transport}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecord={handleRecord}
        onToggleLoop={() => setTransport((p) => ({ ...p, loop: !p.loop }))}
        onToggleMetronome={() => setTransport((p) => ({ ...p, metronome: !p.metronome }))}
        onChangeBpm={(bpm) => setTransport((p) => ({ ...p, bpm }))}
        onChangeMasterVolume={handleMasterVolumeChange}
        onImportAudio={() => fileInputRef.current?.click()}
        onLoadDemoTrack={handleLoadDemoStems}
        onAddTrack={handleAddTrack}
        onExport={() => setShowExportModal(true)}
        masterPeakL={masterPeakL}
        masterPeakR={masterPeakR}
        hasArmedTrack={tracks.some((t) => t.isArmed)}
      />

      {/* Studio Quick Bar: Mic V1 Limpio • Auto-Tune Rápido • Compresor Anti-Gallitos • Exportar */}
      <StudioQuickBar
        selectedTrack={selectedTrack}
        onUpdateTrackDsp={(trackId, updates) =>
          handleUpdateTrack(trackId, {
            vocalDsp: { ...(tracks.find((t) => t.id === trackId)?.vocalDsp || DEFAULT_VOCAL_DSP), ...updates },
          })
        }
        onTuneTrackNow={handleTuneTrack}
        onOpenDspInspector={() => setActiveInspectorTab('vocal')}
        onOpenExport={() => setShowExportModal(true)}
        isTuning={isTuning}
      />

      {/* Main Workspace (Track Headers on Left, Canvas Timeline on Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers Column */}
        <div className="w-64 sm:w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 overflow-y-auto">
          {/* Header Bar */}
          <div className="h-8 bg-neutral-950 border-b border-neutral-800 px-3 flex items-center justify-between text-[11px] font-semibold text-neutral-400">
            <span>TRACK CHANNELS</span>
            <div className="flex items-center gap-1.5 text-[9px] text-neutral-500">
              <span>REC</span>
              <span>•</span>
              <span>MUTE</span>
              <span>•</span>
              <span>SOLO</span>
            </div>
          </div>

          {/* Track Channel Cards */}
          <div className="flex-1">
            {tracks.map((track) => (
              <TrackHeader
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
                onSelect={() => setSelectedTrackId(track.id)}
                onUpdateTrack={(updates) => handleUpdateTrack(track.id, updates)}
                onDeleteTrack={() => handleDeleteTrack(track.id)}
                onToggleArm={() => handleToggleArm(track.id)}
                onOpenInspector={(tab) => {
                  setSelectedTrackId(track.id);
                  setActiveInspectorTab(tab);
                }}
                peakLevel={trackPeaks[track.id] || 0}
                onTuneTrack={() => handleTuneTrack(track.id)}
              />
            ))}
          </div>
        </div>

        {/* Multi-Track Canvas Timeline View */}
        <TimelineView
          tracks={tracks}
          transport={transport}
          selectedTrackId={selectedTrackId}
          onSelectTrack={(id) => setSelectedTrackId(id)}
          onSeek={handleSeek}
          onUpdateLoop={(loopStart, loopEnd) =>
            setTransport((p) => ({ ...p, loopStart, loopEnd }))
          }
          onUpdateTrackStartTime={handleUpdateTrackStartTime}
          isLiveRecording={transport.isRecording}
          liveRecordingTrackId={tracks.find((t) => t.isArmed)?.id || null}
          livePeakLevel={liveRecordingPeak}
        />
      </div>

      {/* Bottom Collapsible DSP Inspector Racks */}
      {activeInspectorTab === 'vocal' && selectedTrack && (
        <VocalDspRack
          trackName={selectedTrack.name}
          config={selectedTrack.vocalDsp}
          onChange={(updates) =>
            handleUpdateTrack(selectedTrack.id, {
              vocalDsp: { ...selectedTrack.vocalDsp, ...updates },
            })
          }
          onClose={() => setActiveInspectorTab(null)}
        />
      )}

      {activeInspectorTab === 'ai' && selectedTrack && (
        <AiAudioCleanerRack
          trackName={selectedTrack.name}
          config={selectedTrack.aiEnhancer}
          onChange={(updates) =>
            handleUpdateTrack(selectedTrack.id, {
              aiEnhancer: { ...selectedTrack.aiEnhancer, ...updates },
            })
          }
          onClose={() => setActiveInspectorTab(null)}
        />
      )}

      {/* Review Take Popup Modal ("Don't save until OK") */}
      {recordedTakeForReview && (
        <TakeReviewModal
          take={recordedTakeForReview}
          tracks={tracks}
          audioCtx={audioCtxRef.current || getAudioContext()}
          onCommitTake={handleCommitTake}
          onReRecord={handleReRecord}
          onDiscard={handleDiscardTake}
        />
      )}

      {/* WAV Export Modal */}
      {showExportModal && (
        <ExportModal
          tracks={tracks}
          masterVolume={transport.masterVolume}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
