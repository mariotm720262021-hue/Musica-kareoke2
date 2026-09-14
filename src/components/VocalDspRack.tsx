import React from 'react';
import { VocalDspConfig } from '../types/audio';
import {
  Sliders,
  Activity,
  Mic,
  Sparkles,
  Volume2,
  Music2,
  ShieldAlert,
  Zap,
  Check,
} from 'lucide-react';
import {
  KEYS,
  SCALES,
  AUTO_TUNE_PRESETS,
  COMPRESSOR_PRESETS,
  getScaleNoteNames,
} from '../audio/autoTuneEngine';

interface VocalDspRackProps {
  trackName: string;
  config: VocalDspConfig;
  onChange: (updates: Partial<VocalDspConfig>) => void;
  onClose: () => void;
}

const SCALE_OPTIONS: { id: VocalDspConfig['pitchCorrectionScale']; label: string }[] = [
  { id: 'chromatic', label: 'Cromática (Chromatic)' },
  { id: 'major', label: 'Mayor (Major Natural)' },
  { id: 'minor', label: 'Menor (Minor Aeolian)' },
  { id: 'pentatonic', label: 'Pentatónica (Pentatonic)' },
];

export const VocalDspRack: React.FC<VocalDspRackProps> = ({
  trackName,
  config,
  onChange,
  onClose,
}) => {
  const activeNotes = getScaleNoteNames(
    config.pitchCorrectionKey || 'C',
    config.pitchCorrectionScale || 'major'
  );

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 p-4 text-neutral-200 select-none overflow-y-auto max-h-96 shadow-2xl">
      {/* Rack Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-rose-600/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              Vocal Studio Rack &amp; DSP Strip
              <span className="text-neutral-400 font-normal lowercase">({trackName})</span>
            </h3>
            <p className="text-[10px] text-neutral-400">
              Auto-Tune Pitch Engine • Compresor Anti-Gallitos (Vocal Cracks) • Filtro 80Hz • Reverb de Estudio &amp; Delay
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 bg-neutral-800 rounded hover:bg-neutral-700 cursor-pointer"
        >
          Cerrar Rack
        </button>
      </div>

      {/* FX Grid - 4 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
        {/* Module 1: Pitch Correction / Auto-Tune */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" /> Auto-Tune (Pitch Correction)
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700/50 font-mono font-bold">
                {config.pitchCorrection || 0}%
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Afinación tonal a escala musical y corrección armónica en tiempo real.
            </p>

            {/* Quick Auto-Tune Presets */}
            <div className="grid grid-cols-2 gap-1 mb-2.5">
              {AUTO_TUNE_PRESETS.map((preset) => {
                const isActive = (config.pitchCorrection || 0) === preset.intensity;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        pitchCorrection: preset.intensity,
                        pitchCorrectionScale: preset.scale,
                      })
                    }
                    className={`px-1.5 py-1 rounded text-[9px] font-medium border text-left truncate transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                    title={preset.description}
                  >
                    {preset.name.split(' ')[0]} {preset.name.split(' ')[1] || ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Intensity Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                <span>Intensidad de Auto-Tune</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {config.pitchCorrection || 0}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={config.pitchCorrection || 0}
                onChange={(e) => onChange({ pitchCorrection: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>0% (Natural)</span>
                <span>50% (Pop)</span>
                <span>100% (Hard Tune)</span>
              </div>
            </div>

            {/* Key & Scale Selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-neutral-400 mb-1">Tono (Key)</label>
                <select
                  value={config.pitchCorrectionKey || 'C'}
                  onChange={(e) => onChange({ pitchCorrectionKey: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500"
                >
                  {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-neutral-400 mb-1">Escala (Scale)</label>
                <select
                  value={config.pitchCorrectionScale || 'major'}
                  onChange={(e) =>
                    onChange({
                      pitchCorrectionScale: e.target.value as VocalDspConfig['pitchCorrectionScale'],
                    })
                  }
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500"
                >
                  {SCALE_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Scale Notes preview */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded p-1.5">
              <span className="text-[8px] text-neutral-400 block mb-1">Notas Permitidas:</span>
              <div className="flex flex-wrap gap-1">
                {activeNotes.map((note) => (
                  <span
                    key={note}
                    className="text-[8px] bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>

            {/* Pitch Transpose Semitones */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Transposición (Pitch Shift)</span>
                <span className="text-emerald-400 font-mono">
                  {config.pitchShift > 0 ? `+${config.pitchShift}` : config.pitchShift} st
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={config.pitchShift || 0}
                onChange={(e) => onChange({ pitchShift: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Module 2: Anti-Gallitos & Peak Vocal Compressor */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5" /> Compresor Anti-Gallitos
              </span>
              <button
                type="button"
                onClick={() => onChange({ compressorEnabled: !config.compressorEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  config.compressorEnabled !== false
                    ? 'bg-amber-600 text-black'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.compressorEnabled !== false ? 'COMP ON' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Nivelador de dinámica: aplana picos repentinos y quiebres de voz involuntarios.
            </p>

            {/* Compressor Presets */}
            <div className="grid grid-cols-2 gap-1 mb-2.5">
              {COMPRESSOR_PRESETS.map((p) => {
                const isActive =
                  config.threshold === p.threshold && config.ratio === p.ratio;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        compressorEnabled: true,
                        threshold: p.threshold,
                        ratio: p.ratio,
                        attack: p.attack,
                        release: p.release,
                      })
                    }
                    className={`px-1.5 py-1 rounded text-[9px] font-medium border text-left truncate transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-950 border-amber-500 text-amber-300'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                    title={p.description}
                  >
                    {p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Threshold Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Umbral (Threshold)</span>
                <span className="text-amber-400 font-mono font-bold">
                  {config.threshold || -22} dB
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={-6}
                step={1}
                value={config.threshold || -22}
                onChange={(e) => onChange({ threshold: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>-50 dB (Fuerte)</span>
                <span>-24 dB (Anti-Gallitos)</span>
                <span>-6 dB (Leve)</span>
              </div>
            </div>

            {/* Ratio Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Proporción (Ratio)</span>
                <span className="text-amber-400 font-mono font-bold">
                  {(config.ratio || 3.5).toFixed(1)}:1
                </span>
              </div>
              <input
                type="range"
                min={1.5}
                max={12}
                step={0.5}
                value={config.ratio || 3.5}
                onChange={(e) => onChange({ ratio: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* Attack & Release */}
            <div className="grid grid-cols-2 gap-2 text-[9px] text-neutral-400">
              <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                <span className="block text-[8px]">Ataque Rápido</span>
                <span className="text-amber-300 font-mono font-bold">
                  {Math.round((config.attack || 0.015) * 1000)} ms
                </span>
              </div>
              <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                <span className="block text-[8px]">Recuperación</span>
                <span className="text-amber-300 font-mono font-bold">
                  {Math.round((config.release || 0.2) * 1000)} ms
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: 80Hz Low-Cut Filter & Warmth Saturation */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5 text-[11px]">
                <Activity className="w-3.5 h-3.5" /> Filtro 80Hz &amp; Saturation
              </span>
              <button
                type="button"
                onClick={() => onChange({ highPassEnabled: !config.highPassEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                  config.highPassEnabled !== false
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.highPassEnabled !== false ? 'LOW-CUT ON' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Elimina retumbe del micrófono, ruido de aire y añade calidez valvular.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Low-Cut Filter Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Corte de Graves (Low-Cut)</span>
                <span className="text-rose-400 font-mono font-bold">
                  {config.lowCutFreq || config.highPassFreq || 80} Hz
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={300}
                step={5}
                value={config.lowCutFreq || config.highPassFreq || 80}
                onChange={(e) =>
                  onChange({
                    lowCutFreq: Number(e.target.value),
                    highPassFreq: Number(e.target.value),
                  })
                }
                className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>20 Hz</span>
                <span>80 Hz (Estándar Vocal)</span>
                <span>300 Hz</span>
              </div>
            </div>

            {/* Warmth Tube Saturation */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Calidez Analógica (Warmth)</span>
                <span className="text-amber-400 font-mono font-bold">
                  {config.warmth || 0}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={config.warmth || 0}
                onChange={(e) => onChange({ warmth: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* 3-Band Parametric EQ */}
            <div className="pt-1 grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-neutral-900 p-1 rounded border border-neutral-800">
                <span className="text-[8px] text-neutral-400 block">Low 120Hz</span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {config.lowGain > 0 ? `+${config.lowGain}` : config.lowGain}dB
                </span>
              </div>
              <div className="bg-neutral-900 p-1 rounded border border-neutral-800">
                <span className="text-[8px] text-neutral-400 block">Mid Pres.</span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {config.midGain > 0 ? `+${config.midGain}` : config.midGain}dB
                </span>
              </div>
              <div className="bg-neutral-900 p-1 rounded border border-neutral-800">
                <span className="text-[8px] text-neutral-400 block">Air 9kHz</span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {config.highGain > 0 ? `+${config.highGain}` : config.highGain}dB
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 4: Studio Reverb & Stereo Delay */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5 text-[11px]">
                <Volume2 className="w-3.5 h-3.5" /> Reverb de Estudio &amp; Eco
              </span>
              <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 font-mono font-bold">
                {Math.round((config.reverbWet !== undefined ? config.reverbWet : config.reverbSend) * 100)}% REV
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Cámara acústica convolver estéreo y repeticiones espaciales.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Reverb Mix */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Mezcla Reverb (Wet/Dry)</span>
                <span className="text-indigo-400 font-mono font-bold">
                  {Math.round((config.reverbWet !== undefined ? config.reverbWet : config.reverbSend) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={config.reverbWet !== undefined ? config.reverbWet : config.reverbSend}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChange({ reverbWet: val, reverbSend: val });
                }}
                className="w-full accent-indigo-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* Delay Send */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Envío de Delay / Eco</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {Math.round((config.delaySend || 0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={config.delaySend || 0}
                onChange={(e) => onChange({ delaySend: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* Delay Time */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Tiempo de Eco (Tempo)</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {Math.round((config.delayTime || 0.28) * 1000)} ms
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1.0}
                step={0.01}
                value={config.delayTime || 0.28}
                onChange={(e) => onChange({ delayTime: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
