import React from 'react';
import { VocalDspConfig } from '../types/audio';
import { Sliders, Activity, Mic, Sparkles, Volume2, Music2 } from 'lucide-react';

interface VocalDspRackProps {
  trackName: string;
  config: VocalDspConfig;
  onChange: (updates: Partial<VocalDspConfig>) => void;
  onClose: () => void;
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES: { id: VocalDspConfig['pitchCorrectionScale']; label: string }[] = [
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'major', label: 'Major (Natural)' },
  { id: 'minor', label: 'Minor (Aeolian)' },
  { id: 'pentatonic', label: 'Pentatonic' },
];

export const VocalDspRack: React.FC<VocalDspRackProps> = ({
  trackName,
  config,
  onChange,
  onClose,
}) => {
  return (
    <div className="bg-neutral-900 border-t border-neutral-800 p-4 text-neutral-200 select-none overflow-y-auto max-h-96">
      {/* Rack Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-rose-600/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              Vocal Effects Rack &amp; DSP Channel Strip
              <span className="text-neutral-400 font-normal lowercase">({trackName})</span>
            </h3>
            <p className="text-[10px] text-neutral-400">
              Auto-Tune &amp; Pitch Correction • Studio Convolver Reverb • Delay/Echo • Low-Cut EQ &amp; Saturation Warmth
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
        >
          Close Rack
        </button>
      </div>

      {/* FX Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Module 1: Pitch Correction / Auto-Tune */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" /> Pitch Correction / Auto-Tune
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700/50 font-mono">
                {config.pitchCorrection || 0}%
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2.5">
              Real-time scale quantization &amp; pitch centering.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Intensity Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                <span>Correction Intensity</span>
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
                <span>Natural (0%)</span>
                <span>Subtle</span>
                <span>Hard Tune (100%)</span>
              </div>
            </div>

            {/* Key & Scale Selectors */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[9px] text-neutral-400 mb-1">Musical Key</label>
                <select
                  value={config.pitchCorrectionKey || 'C'}
                  onChange={(e) => onChange({ pitchCorrectionKey: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500"
                >
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-neutral-400 mb-1">Target Scale</label>
                <select
                  value={config.pitchCorrectionScale || 'major'}
                  onChange={(e) =>
                    onChange({
                      pitchCorrectionScale: e.target.value as VocalDspConfig['pitchCorrectionScale'],
                    })
                  }
                  className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500"
                >
                  {SCALES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pitch Shift Semitones */}
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Pitch Transpose</span>
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

        {/* Module 2: EQ & Saturation (Low-Cut & Warmth) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5 text-[11px]">
                <Activity className="w-3.5 h-3.5" /> EQ &amp; Saturation
              </span>
              <button
                onClick={() => onChange({ highPassEnabled: !config.highPassEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  config.highPassEnabled !== false
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.highPassEnabled !== false ? 'FILTER ON' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Low-cut frequency filter and tube/tape warmth saturation.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Low-Cut Filter Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Low-Cut Filter</span>
                <span className="text-rose-400 font-mono font-bold">
                  {config.lowCutFreq || config.highPassFreq || 80} Hz
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={400}
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
                <span>80 Hz (Vocal standard)</span>
                <span>400 Hz</span>
              </div>
            </div>

            {/* Warmth Saturation Knob */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Warmth (Tape/Tube Saturation)</span>
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
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>Clean</span>
                <span>Harmonic Warmth</span>
                <span>Driven</span>
              </div>
            </div>

            {/* 3-Band EQ Quick Gains */}
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

        {/* Module 3: Studio Reverb (Convolver Node) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5 text-[11px]">
                <Volume2 className="w-3.5 h-3.5" /> Reverb (Convolver)
              </span>
              <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 font-mono">
                {Math.round((config.reverbWet !== undefined ? config.reverbWet : config.reverbSend) * 100)}% WET
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Stereo impulse response studio acoustic chamber.
            </p>
          </div>

          <div className="space-y-3">
            {/* Reverb Wet/Dry Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                <span>Reverb Wet / Dry Mix</span>
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
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>Dry (0%)</span>
                <span>Medium Room (30%)</span>
                <span>Full Wet (100%)</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded p-2 text-[9px] text-neutral-400 space-y-1">
              <div className="flex justify-between">
                <span>Impulse Response:</span>
                <span className="text-neutral-300">Studio Room 2.2s Decay</span>
              </div>
              <div className="flex justify-between">
                <span>Pre-Delay:</span>
                <span className="text-neutral-300">20 ms</span>
              </div>
              <div className="flex justify-between">
                <span>Space Routing:</span>
                <span className="text-indigo-400">Offline + Live Convolver</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 4: Delay / Echo */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-cyan-400 flex items-center gap-1.5 text-[11px]">
                <Sliders className="w-3.5 h-3.5" /> Delay / Echo
              </span>
              <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/50 font-mono">
                {Math.round((config.delaySend || 0) * 100)}% SEND
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Tempo-synced stereo echo with natural high-frequency damping.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Delay Time */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Delay Time</span>
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
              <div className="flex justify-between text-[8px] text-neutral-500 mt-0.5">
                <span>50ms (Slapback)</span>
                <span>280ms (1/4 Note)</span>
                <span>1000ms</span>
              </div>
            </div>

            {/* Delay Feedback */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Echo Feedback</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {Math.round((config.delayFeedback || 0.35) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.02}
                value={config.delayFeedback || 0.35}
                onChange={(e) => onChange({ delayFeedback: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* Delay Send */}
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>Echo Send Amount</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};
