import React from 'react';
import {
  Play,
  Pause,
  Square,
  Circle,
  Repeat,
  Volume2,
  FolderOpen,
  Sparkles,
  Plus,
  Download,
  Activity,
} from 'lucide-react';
import { TransportState } from '../types/audio';

interface TransportBarProps {
  transport: TransportState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onChangeBpm: (bpm: number) => void;
  onChangeMasterVolume: (vol: number) => void;
  onImportAudio: () => void;
  onLoadDemoTrack: () => void;
  onAddTrack: () => void;
  onExport: () => void;
  masterPeakL: number;
  masterPeakR: number;
  hasArmedTrack: boolean;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  transport,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onToggleLoop,
  onToggleMetronome,
  onChangeBpm,
  onChangeMasterVolume,
  onImportAudio,
  onLoadDemoTrack,
  onAddTrack,
  onExport,
  masterPeakL,
  masterPeakR,
  hasArmedTrack,
}) => {
  // Format seconds to mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Format to Bar.Beat.Tick
  const formatBarsBeats = (seconds: number, bpm: number) => {
    const beatsTotal = (seconds * bpm) / 60;
    const bar = Math.floor(beatsTotal / 4) + 1;
    const beat = Math.floor(beatsTotal % 4) + 1;
    const sub = Math.floor((beatsTotal % 1) * 4) + 1;
    return `${bar}.${beat}.${sub}`;
  };

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none text-neutral-200">
      {/* DAW Title & Project Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-500 flex items-center justify-center shadow-md shadow-cyan-950/40">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-white">STUDIO ONE</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-cyan-300">
                DAW DSP
              </span>
            </div>
            <div className="text-[11px] text-neutral-400">44.1 kHz • 24-bit Float • DSP Online</div>
          </div>
        </div>
      </div>

      {/* Main Transport Center Controls */}
      <div className="flex items-center gap-3 bg-neutral-950/90 border border-neutral-800 px-3 py-1.5 rounded-xl shadow-inner">
        {/* Play/Pause */}
        {transport.isPlaying ? (
          <button
            id="transport-pause-btn"
            onClick={onPause}
            title="Pause (Space)"
            className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 flex items-center justify-center transition-all shadow-sm active:scale-95"
          >
            <Pause className="w-5 h-5 fill-current" />
          </button>
        ) : (
          <button
            id="transport-play-btn"
            onClick={onPlay}
            title="Play (Space)"
            className="w-10 h-10 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center transition-all shadow-md shadow-cyan-900/30 active:scale-95"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        )}

        {/* Stop */}
        <button
          id="transport-stop-btn"
          onClick={onStop}
          title="Stop & Reset"
          className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-all active:scale-95"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Record (Stems & Overdubs) */}
        <button
          id="transport-record-btn"
          onClick={onRecord}
          title={hasArmedTrack ? 'Record Take on Armed Track' : 'Arm a track to record'}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
            transport.isRecording
              ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50'
              : hasArmedTrack
              ? 'bg-red-950/80 border border-red-700 text-red-400 hover:bg-red-900/50'
              : 'bg-neutral-800/60 text-neutral-500 hover:text-neutral-400 cursor-pointer'
          }`}
        >
          <Circle className={`w-4 h-4 fill-current ${transport.isRecording ? 'animate-ping' : ''}`} />
        </button>

        {/* Loop Toggle */}
        <button
          id="transport-loop-btn"
          onClick={onToggleLoop}
          title="Toggle Region Loop"
          className={`px-2.5 h-10 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
            transport.loop
              ? 'bg-indigo-950 border border-indigo-500/70 text-indigo-300 shadow-sm'
              : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Loop</span>
        </button>

        {/* Time / LCD Display */}
        <div className="flex items-center gap-3 bg-black/80 px-3 py-1 rounded-lg border border-neutral-800 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-sans font-bold">
              Time
            </div>
            <div className="text-sm font-bold text-cyan-400 tabular-nums">
              {formatTime(transport.currentTime)}
            </div>
          </div>
          <div className="w-px h-6 bg-neutral-800" />
          <div className="text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-sans font-bold">
              Bar.Beat
            </div>
            <div className="text-sm font-bold text-emerald-400 tabular-nums">
              {formatBarsBeats(transport.currentTime, transport.bpm)}
            </div>
          </div>
        </div>

        {/* BPM Tempo & Metronome */}
        <div className="flex items-center gap-2 pl-1">
          <div className="flex flex-col">
            <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">BPM</span>
            <input
              id="tempo-bpm-input"
              type="number"
              min={60}
              max={220}
              value={transport.bpm}
              onChange={(e) => onChangeBpm(Math.max(40, Math.min(240, Number(e.target.value))))}
              className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-center font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            id="metronome-toggle-btn"
            onClick={onToggleMetronome}
            title="Metronome Click"
            className={`px-2 py-1.5 h-8 rounded text-[11px] font-medium border flex items-center transition-all ${
              transport.metronome
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
            }`}
          >
            CLICK
          </button>
        </div>
      </div>

      {/* Master Volume & Peak Meters & Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Master VU Peak Meter */}
        <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded-lg">
          <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
          <div className="flex flex-col gap-0.5 w-16">
            {/* L channel */}
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  masterPeakL > 0.95
                    ? 'bg-red-500'
                    : masterPeakL > 0.75
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, masterPeakL * 100)}%` }}
              />
            </div>
            {/* R channel */}
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  masterPeakR > 0.95
                    ? 'bg-red-500'
                    : masterPeakR > 0.75
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, masterPeakR * 100)}%` }}
              />
            </div>
          </div>

          {/* Master Volume Fader */}
          <input
            id="master-volume-fader"
            type="range"
            min={0}
            max={1.2}
            step={0.01}
            value={transport.masterVolume}
            onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
            title={`Master Volume: ${Math.round(transport.masterVolume * 100)}%`}
            className="w-18 accent-cyan-500 h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="load-demo-track-btn"
            onClick={onLoadDemoTrack}
            title="Synthesize 8-Bar Neo-Soul Drum & Chords Backing Stems"
            className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 border border-indigo-700/60 hover:bg-indigo-900 text-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Pro Demo Stems</span>
          </button>

          <button
            id="import-audio-btn"
            onClick={onImportAudio}
            title="Import Instrumental / Stems Audio File"
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Import Stem</span>
          </button>

          <button
            id="add-vocal-track-btn"
            onClick={onAddTrack}
            title="Add Vocal / Audio Track"
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Track</span>
          </button>

          <button
            id="export-mix-btn"
            onClick={onExport}
            title="Export Final Mixdown or Stems"
            className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export WAV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
