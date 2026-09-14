import React, { useState } from 'react';
import {
  Mic,
  Music,
  Sliders,
  Sparkles,
  VolumeX,
  Headphones,
  Trash2,
  Circle,
  MoreVertical,
} from 'lucide-react';
import { AudioTrack } from '../types/audio';

interface TrackHeaderProps {
  track: AudioTrack;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTrack: (updates: Partial<AudioTrack>) => void;
  onDeleteTrack: () => void;
  onToggleArm: () => void;
  onOpenInspector: (tab: 'vocal' | 'ai') => void;
  peakLevel: number;
  onTuneTrack?: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  isSelected,
  onSelect,
  onUpdateTrack,
  onDeleteTrack,
  onToggleArm,
  onOpenInspector,
  peakLevel,
  onTuneTrack,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(track.name);
  const [showMenu, setShowMenu] = useState(false);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (nameVal.trim()) {
      onUpdateTrack({ name: nameVal.trim() });
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative h-28 border-b border-r border-neutral-800 p-2 flex flex-col justify-between select-none cursor-pointer transition-colors ${
        isSelected ? 'bg-neutral-850 bg-neutral-800/80' : 'bg-neutral-900/90 hover:bg-neutral-850'
      }`}
    >
      {/* Track Color Left Border Ribbon */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: track.color }}
      />

      {/* Row 1: Track Name, Type Icon, Options */}
      <div className="flex items-center justify-between gap-1 pl-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {track.type === 'vocal' ? (
            <Mic className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          ) : (
            <Music className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
          )}

          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="text-xs bg-neutral-950 border border-cyan-500 rounded px-1 py-0.5 text-white font-medium focus:outline-none w-28"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              title="Double click to rename"
              className="text-xs font-semibold text-neutral-100 truncate cursor-text"
            >
              {track.name}
            </span>
          )}
        </div>

        {/* Action button menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-6 w-32 bg-neutral-950 border border-neutral-700 rounded-md shadow-xl py-1 z-30 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditingName(true);
                }}
                className="w-full text-left px-2.5 py-1 text-neutral-300 hover:bg-neutral-800"
              >
                Rename Track
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteTrack();
                }}
                className="w-full text-left px-2.5 py-1 text-rose-400 hover:bg-neutral-800 flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete Track
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Channel Strip Controls (REC, MUTE, SOLO, FX, AI CLEAN) */}
      <div className="flex items-center gap-1 pl-1.5">
        {/* REC Arm button */}
        <button
          id={`track-arm-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleArm();
          }}
          title={track.isArmed ? 'Armed for recording' : 'Arm this track for recording'}
          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
            track.isArmed
              ? 'bg-red-600 text-white shadow-md shadow-red-900/60 ring-1 ring-red-400'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
          }`}
        >
          <Circle className="w-2.5 h-2.5 fill-current" />
        </button>

        {/* Mute (M) */}
        <button
          id={`track-mute-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateTrack({ muted: !track.muted });
          }}
          title="Mute Track"
          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
            track.muted
              ? 'bg-amber-600 text-black font-black ring-1 ring-amber-300'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
        >
          {track.muted ? <VolumeX className="w-3 h-3" /> : 'M'}
        </button>

        {/* Solo (S) */}
        <button
          id={`track-solo-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateTrack({ solo: !track.solo });
          }}
          title="Solo Track"
          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
            track.solo
              ? 'bg-cyan-500 text-black font-black ring-1 ring-cyan-300'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          }`}
        >
          {track.solo ? <Headphones className="w-3 h-3" /> : 'S'}
        </button>

        {/* Vocal DSP & Auto-Tune Chain toggle / badge */}
        <button
          id={`track-vocal-dsp-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenInspector('vocal');
          }}
          title="Abrir Rack de Auto-Tune & Compresor Anti-Gallitos"
          className={`px-2 h-6 rounded flex items-center gap-1 text-[10px] font-semibold transition-all cursor-pointer ${
            track.vocalDsp.pitchCorrection > 0
              ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 shadow-sm'
              : track.vocalDsp.compressorEnabled || track.vocalDsp.reverbSend > 0.05
              ? 'bg-rose-950/80 border border-rose-700/80 text-rose-300'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          {track.vocalDsp.pitchCorrection > 0 ? (
            <>
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              <span>Tune {track.vocalDsp.pitchCorrection}%</span>
            </>
          ) : (
            <>
              <Sliders className="w-2.5 h-2.5" />
              <span>Auto-Tune / FX</span>
            </>
          )}
        </button>

        {/* Instant Auto-Tune Processing Trigger */}
        {track.audioBuffer && onTuneTrack && (
          <button
            id={`track-tune-now-${track.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onTuneTrack();
            }}
            title="Afinar inmediatamente el audio de esta pista con Auto-Tune"
            className="px-1.5 h-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-0.5 text-[10px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Afinar</span>
          </button>
        )}

        {/* Anti-Gallitos Badge */}
        {track.vocalDsp.compressorEnabled && track.vocalDsp.ratio >= 5 && (
          <span
            title="Compresor Anti-Gallitos activado: aplana quiebres de voz y picos"
            className="px-1.5 h-6 rounded bg-rose-950/90 border border-rose-600/70 text-rose-300 flex items-center gap-0.5 text-[9px] font-bold"
          >
            🛡️ Anti-Gallitos
          </span>
        )}

        {/* AI Audio Cleaner & Restorer badge */}
        <button
          id={`track-ai-cleaner-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenInspector('ai');
          }}
          title="Open AI Audio Cleaner & Restorer (Noise Removal, Harmonic Resynthesis)"
          className={`px-1.5 h-6 rounded flex items-center gap-1 text-[10px] font-medium transition-all ${
            track.aiEnhancer.enabled
              ? 'bg-indigo-950 border border-indigo-500 text-indigo-300 shadow-sm'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
          <span>AI Clean</span>
        </button>
      </div>

      {/* Row 3: Pan, Fader, Peak Meter */}
      <div className="flex items-center gap-2 pl-1.5 text-[10px] text-neutral-400">
        {/* Pan Control */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] text-neutral-500">
            {track.pan === 0
              ? 'C'
              : track.pan < 0
              ? `L${Math.round(Math.abs(track.pan) * 100)}`
              : `R${Math.round(track.pan * 100)}`}
          </span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={track.pan}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onUpdateTrack({ pan: 0 });
            }}
            onChange={(e) => onUpdateTrack({ pan: parseFloat(e.target.value) })}
            title="Pan (-1 Left to +1 Right, Double click to Center)"
            className="w-12 h-1 bg-neutral-700 rounded accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Volume Fader */}
        <div className="flex items-center gap-1 flex-1">
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.02}
            value={track.volume}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onUpdateTrack({ volume: 1.0 });
            }}
            onChange={(e) => onUpdateTrack({ volume: parseFloat(e.target.value) })}
            title={`Volume: ${Math.round(track.volume * 100)}% (Double click for unity)`}
            className="w-full h-1 bg-neutral-700 rounded accent-cyan-500 cursor-pointer"
          />
          <span className="font-mono text-[9px] text-neutral-400 w-7 text-right">
            {track.volume === 0 ? '-inf' : `${Math.round((track.volume - 1) * 6)}dB`}
          </span>
        </div>

        {/* Mini Peak Meter */}
        <div className="w-1.5 h-7 bg-neutral-950 rounded-sm overflow-hidden flex flex-col-reverse p-0.5">
          <div
            className={`w-full transition-all duration-75 ${
              peakLevel > 0.95
                ? 'bg-red-500'
                : peakLevel > 0.7
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ height: `${Math.min(100, peakLevel * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
