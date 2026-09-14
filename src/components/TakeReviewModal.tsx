import React, { useState, useEffect, useRef } from 'react';
import { RecordedTake, AudioTrack } from '../types/audio';
import { calculatePeaks } from '../audio/audioContext';
import {
  Play,
  Square,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Headphones,
  Sliders,
  Volume2,
} from 'lucide-react';

interface TakeReviewModalProps {
  take: RecordedTake;
  tracks: AudioTrack[];
  audioCtx: AudioContext;
  onCommitTake: (targetTrackId: string, latencyOffsetMs: number, asNewTrack?: boolean) => void;
  onReRecord: (targetTrackId: string) => void;
  onDiscard: () => void;
}

export const TakeReviewModal: React.FC<TakeReviewModalProps> = ({
  take,
  tracks,
  audioCtx,
  onCommitTake,
  onReRecord,
  onDiscard,
}) => {
  const [targetMode, setTargetMode] = useState<'new_track' | 'existing'>('new_track');
  const [selectedTrackId, setSelectedTrackId] = useState(take.trackId);
  const [latencyOffset, setLatencyOffset] = useState(take.latencyOffsetMs || 0);
  const [isPlayingSolo, setIsPlayingSolo] = useState(false);
  const [isPlayingMix, setIsPlayingMix] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const peaksRef = useRef<Float32Array | null>(null);

  // Compute peaks for the preview waveform
  useEffect(() => {
    if (take.audioBuffer) {
      peaksRef.current = calculatePeaks(take.audioBuffer, 300);
      drawWaveform();
    }
  }, [take.audioBuffer]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !peaksRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#262626';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const peaks = peaksRef.current;
    const numPeaks = peaks.length;
    ctx.fillStyle = '#f43f5e'; // rose-500

    for (let i = 0; i < numPeaks; i++) {
      const x = (i / numPeaks) * width;
      const barH = Math.max(2, peaks[i] * (height - 12));
      const y = (height - barH) / 2;
      ctx.fillRect(x, y, Math.max(1, width / numPeaks - 0.5), barH);
    }
  };

  const stopAllAuditions = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current = [];
    setIsPlayingSolo(false);
    setIsPlayingMix(false);
  };

  useEffect(() => {
    return () => {
      stopAllAuditions();
    };
  }, []);

  // Solo audition (take alone)
  const handleAuditionSolo = () => {
    stopAllAuditions();
    if (isPlayingSolo) return;

    const src = audioCtx.createBufferSource();
    src.buffer = take.audioBuffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.9;
    src.connect(gain);
    gain.connect(audioCtx.destination);

    src.onended = () => {
      setIsPlayingSolo(false);
    };

    src.start();
    activeSourcesRef.current = [src];
    setIsPlayingSolo(true);
  };

  // Mix audition (take alongside backing tracks)
  const handleAuditionMix = () => {
    stopAllAuditions();
    if (isPlayingMix) return;

    const sources: AudioBufferSourceNode[] = [];

    // Play backing tracks that have audio
    tracks.forEach((track) => {
      if (track.audioBuffer && !track.muted) {
        const src = audioCtx.createBufferSource();
        src.buffer = track.audioBuffer;
        const gain = audioCtx.createGain();
        gain.gain.value = track.volume * 0.7;
        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(0, Math.max(0, take.startTime - (track.startTime || 0)));
        sources.push(src);
      }
    });

    // Play take
    const takeSrc = audioCtx.createBufferSource();
    takeSrc.buffer = take.audioBuffer;
    const takeGain = audioCtx.createGain();
    takeGain.gain.value = 1.0;
    takeSrc.connect(takeGain);
    takeGain.connect(audioCtx.destination);

    takeSrc.onended = () => {
      stopAllAuditions();
    };

    takeSrc.start();
    sources.push(takeSrc);

    activeSourcesRef.current = sources;
    setIsPlayingMix(true);
  };

  const targetTrack = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-neutral-950 px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Audition Recorded Take
                <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800/60 font-semibold">
                  Temporary Buffer Memory
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Don't save until OK: Audition your take in isolation or in the mix before committing to the project session.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-neutral-300">
          {/* Waveform Preview Display */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1 text-[11px] text-neutral-400">
              <span className="font-semibold text-white">Recorded Waveform</span>
              <span className="font-mono text-cyan-400">
                Duration: {take.duration.toFixed(2)}s • Offset: @{take.startTime.toFixed(2)}s
              </span>
            </div>
            <div className="h-20 w-full rounded overflow-hidden border border-neutral-800">
              <canvas
                ref={canvasRef}
                width={560}
                height={80}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Audition Playback Bar */}
          <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-cyan-400" /> Audition Controls:
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAuditionSolo}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isPlayingSolo
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                }`}
              >
                {isPlayingSolo ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Solo Audition</span>
              </button>

              <button
                onClick={handleAuditionMix}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isPlayingMix
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                }`}
              >
                {isPlayingMix ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>In-Mix Audition</span>
              </button>

              {(isPlayingSolo || isPlayingMix) && (
                <button
                  onClick={stopAllAuditions}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Target Track & Timing Calibration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Destination Mode Selector */}
            <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">
                Destination (Keep Mode)
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setTargetMode('new_track')}
                  className={`px-2 py-1.5 rounded text-[11px] font-medium border text-center transition-all ${
                    targetMode === 'new_track'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  + New Track Lane
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`px-2 py-1.5 rounded text-[11px] font-medium border text-center transition-all ${
                    targetMode === 'existing'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  Replace in Track
                </button>
              </div>

              {targetMode === 'existing' ? (
                <div>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    Will replace audio in {targetTrack?.name || 'track'}.
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-400/90 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                  Appends this take as a brand new vocal track lane below without overwriting previous vocals.
                </div>
              )}
            </div>

            {/* Latency Alignment / Nudge Offset */}
            <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span>Latency Compensation Offset</span>
                <span className="text-cyan-400 font-mono">
                  {latencyOffset > 0 ? `+${latencyOffset}` : latencyOffset} ms
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={5}
                value={latencyOffset}
                onChange={(e) => setLatencyOffset(Number(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 bg-neutral-800 rounded cursor-pointer mt-2"
              />
              <div className="flex justify-between text-[9px] text-neutral-500 mt-1">
                <span>-100ms (Earlier)</span>
                <button
                  onClick={() => setLatencyOffset(0)}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Reset (0ms)
                </button>
                <span>+100ms (Later)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons: Keep or Discard */}
        <div className="bg-neutral-950 px-5 py-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          {/* Discard & Re-record */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopAllAuditions();
                onDiscard();
              }}
              className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-rose-950/40 border border-neutral-700 hover:border-rose-700 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard Take</span>
            </button>

            <button
              onClick={() => {
                stopAllAuditions();
                onReRecord(selectedTrackId);
              }}
              className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-Record</span>
            </button>
          </div>

          {/* Keep Take (Commit) */}
          <button
            onClick={() => {
              stopAllAuditions();
              onCommitTake(selectedTrackId, latencyOffset, targetMode === 'new_track');
            }}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Keep Take (Save to Track)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
