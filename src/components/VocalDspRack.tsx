import React from 'react';
import { VocalDspConfig } from '../types/audio';
import { Sliders, Activity, Mic, Sparkles, HelpCircle } from 'lucide-react';

interface VocalDspRackProps {
  trackName: string;
  config: VocalDspConfig;
  onChange: (updates: Partial<VocalDspConfig>) => void;
  onClose: () => void;
}

export const VocalDspRack: React.FC<VocalDspRackProps> = ({
  trackName,
  config,
  onChange,
  onClose,
}) => {
  return (
    <div className="bg-neutral-900 border-t border-neutral-800 p-4 text-neutral-200 select-none overflow-y-auto max-h-80">
      {/* Rack Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-rose-600/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2">
              Vocal Chain DSP Rack
              <span className="text-neutral-400 font-normal lowercase">({trackName})</span>
            </h3>
            <p className="text-[10px] text-neutral-400">
              Pro Studio Channel Strip: 80Hz Low-Cut • Compressor • 3-Band Parametric EQ • Formant Resonator • Space Sends
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
        >
          Close Rack
        </button>
      </div>

      {/* 5 Modular Modules in Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
        {/* Module 1: High-Pass Filter (Low-Cut at 80Hz) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-rose-400 flex items-center gap-1 text-[11px]">
                <Activity className="w-3 h-3" /> High-Pass (Low-Cut)
              </span>
              <button
                onClick={() => onChange({ highPassEnabled: !config.highPassEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  config.highPassEnabled
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.highPassEnabled ? 'ON' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Cuts sub-bass rumble, mic handling, and vocal plosives.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Cutoff Frequency</span>
                <span className="text-rose-400 font-mono">{config.highPassFreq} Hz</span>
              </div>
              <input
                type="range"
                min={40}
                max={200}
                step={5}
                value={config.highPassFreq}
                onChange={(e) => onChange({ highPassFreq: Number(e.target.value) })}
                className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[9px] text-neutral-400">
              <span>Standard 80Hz Vocal Cut</span>
              <button
                onClick={() => onChange({ highPassFreq: 80, highPassEnabled: true })}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                Set 80Hz
              </button>
            </div>
          </div>
        </div>

        {/* Module 2: Dynamic Range Compressor */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-1 text-[11px]">
                <Sliders className="w-3 h-3" /> Compressor
              </span>
              <button
                onClick={() => onChange({ compressorEnabled: !config.compressorEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  config.compressorEnabled
                    ? 'bg-amber-600 text-white'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.compressorEnabled ? 'ACTIVE' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Glues dynamics and levels peaks for a polished vocal.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Threshold</span>
                <span className="text-amber-400 font-mono">{config.threshold} dB</span>
              </div>
              <input
                type="range"
                min={-40}
                max={0}
                step={1}
                value={config.threshold}
                onChange={(e) => onChange({ threshold: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Ratio</span>
                <span className="text-amber-400 font-mono">{config.ratio}:1</span>
              </div>
              <input
                type="range"
                min={1.5}
                max={8}
                step={0.5}
                value={config.ratio}
                onChange={(e) => onChange({ ratio: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-between text-[9px] text-neutral-400">
              <span>Attack: {Math.round(config.attack * 1000)}ms</span>
              <span>Release: {Math.round(config.release * 1000)}ms</span>
            </div>
          </div>
        </div>

        {/* Module 3: 3-Band Parametric EQ */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-cyan-400 flex items-center gap-1 text-[11px]">
                <Activity className="w-3 h-3" /> Parametric EQ
              </span>
              <button
                onClick={() => onChange({ eqEnabled: !config.eqEnabled })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  config.eqEnabled
                    ? 'bg-cyan-600 text-white'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {config.eqEnabled ? 'ON' : 'BYPASS'}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Warmth (Low), Presence (Mid), Air (High).
            </p>
          </div>

          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>Low Body (120Hz)</span>
                <span className="text-cyan-400 font-mono">{config.lowGain > 0 ? `+${config.lowGain}` : config.lowGain}dB</span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={0.5}
                value={config.lowGain}
                onChange={(e) => onChange({ lowGain: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>Mid Clarity ({config.midFreq}Hz)</span>
                <span className="text-cyan-400 font-mono">{config.midGain > 0 ? `+${config.midGain}` : config.midGain}dB</span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={0.5}
                value={config.midGain}
                onChange={(e) => onChange({ midGain: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>Vocal Air (9kHz)</span>
                <span className="text-cyan-400 font-mono">{config.highGain > 0 ? `+${config.highGain}` : config.highGain}dB</span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={0.5}
                value={config.highGain}
                onChange={(e) => onChange({ highGain: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Module 4: Natural Formant & Pitch Control (Non-Robotic) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3" /> Formant & Pitch
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 py-0.5 rounded border border-emerald-700/50">
                Natural DSP
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Non-robotic acoustic vocal tract shaping and micro-tuning.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Formant Shift</span>
                <span className="text-emerald-400 font-mono">
                  {config.formantShift > 0 ? `+${config.formantShift}%` : `${config.formantShift}%`}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={2}
                value={config.formantShift}
                onChange={(e) => onChange({ formantShift: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-400">
                <span>Deeper/Chest</span>
                <span>Brighter/Head</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Vocal Warmth Resonance</span>
                <span className="text-emerald-400 font-mono">
                  {Math.round(config.formantWarmth * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.formantWarmth}
                onChange={(e) => onChange({ formantWarmth: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Module 5: Reverb & Delay Bus Sends ("In the Track" Space) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-400 flex items-center gap-1 text-[11px]">
                <Sliders className="w-3 h-3" /> Space Sends (In The Track)
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Bends vocals into the acoustic mix environment.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Studio Plate Reverb Send</span>
                <span className="text-indigo-400 font-mono">
                  {Math.round(config.reverbSend * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={config.reverbSend}
                onChange={(e) => onChange({ reverbSend: Number(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Echo / Delay Send</span>
                <span className="text-indigo-400 font-mono">
                  {Math.round(config.delaySend * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={config.delaySend}
                onChange={(e) => onChange({ delaySend: Number(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-between text-[8px] text-neutral-400 pt-0.5">
              <span>Time: ~280ms synced</span>
              <span>Damping: 3.5kHz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
