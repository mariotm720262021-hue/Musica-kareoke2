import React from 'react';
import { AiEnhancerConfig } from '../types/audio';
import { Sparkles, ShieldCheck, Zap, Volume2, HelpCircle } from 'lucide-react';

interface AiAudioCleanerRackProps {
  trackName: string;
  config: AiEnhancerConfig;
  onChange: (updates: Partial<AiEnhancerConfig>) => void;
  onClose: () => void;
}

export const AiAudioCleanerRack: React.FC<AiAudioCleanerRackProps> = ({
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
          <div className="w-6 h-6 rounded bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                AI Audio Cleaner &amp; Restorer
              </h3>
              <span className="text-[10px] text-neutral-400 font-normal lowercase">
                ({trackName})
              </span>
              <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 font-semibold uppercase">
                Resynthesis DSP
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Noise Suppression Gate • Harmonic Exciter (Preserves Chords &amp; Pitch) • Transient Shaper • A/B Audition
            </p>
          </div>
        </div>

        {/* Global Enable & A/B Comparison Toggle */}
        <div className="flex items-center gap-3">
          {/* A/B Comparison Switch */}
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => onChange({ abTestMode: 'processed', enabled: true })}
              className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] ${
                config.enabled && config.abTestMode === 'processed'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              A: AI RESTORED
            </button>
            <button
              onClick={() => onChange({ abTestMode: 'original' })}
              className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] ${
                config.abTestMode === 'original'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              B: RAW ORIGINAL
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      </div>

      {/* 4 Main AI Enhancement Modules */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* Module 1: Noise Removal & Gate */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-cyan-400 flex items-center gap-1 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> Noise Suppression &amp; Gate
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Removes room hiss, fan noise, and background bleed between notes.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Gate Threshold</span>
                <span className="text-cyan-400 font-mono">{config.noiseGateThreshold} dB</span>
              </div>
              <input
                type="range"
                min={-60}
                max={-15}
                step={1}
                value={config.noiseGateThreshold}
                onChange={(e) => onChange({ noiseGateThreshold: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Suppression Depth</span>
                <span className="text-cyan-400 font-mono">{config.noiseReduction}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={config.noiseReduction}
                onChange={(e) => onChange({ noiseReduction: Number(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Module 2: Harmonic Exciter & Resynthesis */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-indigo-400 flex items-center gap-1 text-[11px]">
                <Zap className="w-3.5 h-3.5" /> Harmonic Resynthesis
              </span>
              <span className="text-[8px] bg-indigo-950 text-indigo-300 px-1 py-0.5 rounded border border-indigo-800/60">
                Chords Intact
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Rebuilds lost upper harmonics (2nd &amp; 3rd orders) without altering pitch or musical key.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Exciter Warmth &amp; Sparkle</span>
                <span className="text-indigo-400 font-mono">{config.harmonicExciter}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={2}
                value={config.harmonicExciter}
                onChange={(e) => onChange({ harmonicExciter: Number(e.target.value) })}
                className="w-full accent-indigo-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-400 mt-1">
                <span>Subtle Air</span>
                <span>Rich Harmonic Glow</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: Transient Shaper / Punch */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-amber-400 flex items-center gap-1 text-[11px]">
                <ActivityIcon className="w-3.5 h-3.5" /> Transient Punch Shaper
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Sharpens drum attacks, guitar plucks, and vocal consonants lost in muffled mic captures.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Attack Punch Boost</span>
                <span className="text-amber-400 font-mono">+{config.transientPunch}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={config.transientPunch}
                onChange={(e) => onChange({ transientPunch: Number(e.target.value) })}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-400 mt-1">
                <span>Soft Transients</span>
                <span>Crisp Punch</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 4: Spectral Clarity & Air */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[11px]">
                <Volume2 className="w-3.5 h-3.5" /> Spectral Clarity &amp; Air
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-2">
              Applies multiband psychoacoustic contouring to give clarity in dense mixes.
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Air Presence</span>
                <span className="text-emerald-400 font-mono">{config.spectralClarity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={config.spectralClarity}
                onChange={(e) => onChange({ spectralClarity: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-400 mt-1">
                <span>Flat</span>
                <span>Wide High-End Openness</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
