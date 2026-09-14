import React from 'react';
import {
  Mic,
  Sparkles,
  ShieldCheck,
  Sliders,
  Download,
  Wand2,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import { AudioTrack } from '../types/audio';
import { KEYS, SCALES, AUTO_TUNE_PRESETS, COMPRESSOR_PRESETS } from '../audio/autoTuneEngine';

interface StudioQuickBarProps {
  selectedTrack: AudioTrack | null;
  onUpdateTrackDsp: (trackId: string, updates: Partial<AudioTrack['vocalDsp']>) => void;
  onTuneTrackNow: (trackId: string) => void;
  onOpenDspInspector: () => void;
  onOpenExport: () => void;
  isTuning: boolean;
}

export const StudioQuickBar: React.FC<StudioQuickBarProps> = ({
  selectedTrack,
  onUpdateTrackDsp,
  onTuneTrackNow,
  onOpenDspInspector,
  onOpenExport,
  isTuning,
}) => {
  const dsp = selectedTrack?.vocalDsp;
  const currentKey = dsp?.pitchCorrectionKey || 'C';
  const currentScale = dsp?.pitchCorrectionScale || 'major';
  const currentIntensity = dsp?.pitchCorrection ?? 75;
  const isAntiGallitosActive = dsp?.compressorEnabled !== false && dsp?.ratio >= 5;

  const handleSetAutoTunePreset = (intensity: number, scale: any) => {
    if (!selectedTrack) return;
    onUpdateTrackDsp(selectedTrack.id, {
      pitchCorrection: intensity,
      pitchCorrectionScale: scale,
    });
  };

  const handleToggleAntiGallitos = () => {
    if (!selectedTrack) return;
    if (isAntiGallitosActive) {
      // Gentle compression
      onUpdateTrackDsp(selectedTrack.id, {
        compressorEnabled: true,
        threshold: -14,
        ratio: 2.5,
        attack: 0.02,
        release: 0.25,
      });
    } else {
      // Anti-gallitos high-ratio fast clamp
      onUpdateTrackDsp(selectedTrack.id, {
        compressorEnabled: true,
        threshold: -24,
        ratio: 8.0,
        attack: 0.003,
        release: 0.12,
      });
    }
  };

  return (
    <div className="bg-neutral-900/95 border-b border-neutral-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-neutral-200 text-xs shadow-sm">
      {/* 1. Mic Clean & Anti-Feedback Status */}
      <div className="flex items-center gap-2 border-r border-neutral-800 pr-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/80 border border-emerald-600/50 text-emerald-300">
          <Mic className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-[11px]">Mic V1 Limpio</span>
        </div>
        <div className="hidden lg:flex flex-col text-[10px] text-neutral-400 leading-tight">
          <span className="text-emerald-400 font-medium">80Hz Cut • Gate Anti-Ruido</span>
          <span className="text-neutral-500">Cero Feedback en Altavoces</span>
        </div>
      </div>

      {/* 2. Auto-Tune Controls (Real pitch quantization) */}
      <div className="flex items-center gap-2 border-r border-neutral-800 pr-3">
        <div className="flex items-center gap-1 text-cyan-400 font-bold text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Auto-Tune:</span>
        </div>

        {/* Root Key */}
        <select
          value={currentKey}
          onChange={(e) => {
            if (selectedTrack) {
              onUpdateTrackDsp(selectedTrack.id, { pitchCorrectionKey: e.target.value });
            }
          }}
          className="bg-neutral-950 border border-neutral-700 rounded px-1.5 py-1 text-xs text-white font-mono font-bold focus:border-cyan-500"
          title="Tonalidad musical raíz"
        >
          {KEYS.map((k) => (
            <option key={k} value={k}>
              Tono {k}
            </option>
          ))}
        </select>

        {/* Scale */}
        <select
          value={currentScale}
          onChange={(e) => {
            if (selectedTrack) {
              onUpdateTrackDsp(selectedTrack.id, { pitchCorrectionScale: e.target.value as any });
            }
          }}
          className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-white capitalize focus:border-cyan-500"
          title="Escala musical"
        >
          {SCALES.map((s) => (
            <option key={s} value={s}>
              {s === 'major'
                ? 'Mayor'
                : s === 'minor'
                ? 'Menor'
                : s === 'pentatonic'
                ? 'Pentatónica (Trap)'
                : 'Cromática'}
            </option>
          ))}
        </select>

        {/* Quick Style Presets */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSetAutoTunePreset(100, 'minor')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              currentIntensity === 100
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Afinación 100% robótica estilo Trap / T-Pain"
          >
            Trap 100%
          </button>
          <button
            type="button"
            onClick={() => handleSetAutoTunePreset(75, 'major')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              currentIntensity === 75
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Afinación moderna pulida 75%"
          >
            Pop 75%
          </button>
          <button
            type="button"
            onClick={() => handleSetAutoTunePreset(40, 'chromatic')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              currentIntensity === 40
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                : 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Corrección sutil 40%"
          >
            Sutil 40%
          </button>
        </div>

        {/* Real pitch quantization trigger button */}
        {selectedTrack && selectedTrack.audioBuffer && (
          <button
            type="button"
            onClick={() => onTuneTrackNow(selectedTrack.id)}
            disabled={isTuning}
            title={`Afinar ${selectedTrack.name} inmediatamente con el motor musical Auto-Tune`}
            className="px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Wand2 className={`w-3 h-3 ${isTuning ? 'animate-spin' : ''}`} />
            <span>{isTuning ? 'Afinando...' : '✨ Afinar Pista'}</span>
          </button>
        )}
      </div>

      {/* 3. Anti-Gallitos Compressor Toggle */}
      <div className="flex items-center gap-2 border-r border-neutral-800 pr-3">
        <button
          type="button"
          onClick={handleToggleAntiGallitos}
          title="Activa el compresor nivelador para aplanar quiebres de voz y picos excesivos"
          className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-bold border transition-all cursor-pointer ${
            isAntiGallitosActive
              ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-sm'
              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
          <span>Anti-Gallitos: {isAntiGallitosActive ? 'ACTIVADO (8:1)' : 'SUAVE'}</span>
        </button>
      </div>

      {/* 4. Multi-track Recording Notice & Export Trigger */}
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
          <span>Cada toma graba en nueva pista</span>
        </div>

        <button
          type="button"
          onClick={onOpenDspInspector}
          title="Abrir Rack Completo de Efectos (EQ, Reverb, Delay, Compresor)"
          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] flex items-center gap-1 border border-neutral-700 transition-all cursor-pointer"
        >
          <Sliders className="w-3 h-3 text-neutral-400" />
          <span>Rack FX</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          title="Exportar canción final en MP3 o WAV con Foto de Portada"
          className="px-2.5 py-1 rounded bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span>Exportar MP3 / WAV</span>
        </button>
      </div>
    </div>
  );
};
