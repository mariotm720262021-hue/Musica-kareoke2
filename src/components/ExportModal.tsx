import React, { useState } from 'react';
import { AudioTrack } from '../types/audio';
import { audioBufferToWavBlob } from '../audio/audioContext';
import { Download, CheckCircle, Music, Layers, Loader2, X } from 'lucide-react';

interface ExportModalProps {
  tracks: AudioTrack[];
  masterVolume: number;
  onClose: () => void;
}

// Generate smooth saturation curve for offline rendering
function makeOfflineWarmthCurve(amount = 0.3): Float32Array {
  const k = amount * 15;
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    if (k === 0) curve[i] = x;
    else curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// Generate realistic studio impulse response for offline reverb
function createOfflineImpulseResponse(ctx: OfflineAudioContext, duration = 2.0, decay = 2.4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const n = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }
  }
  return impulse;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  tracks,
  masterVolume,
  onClose,
}) => {
  const [exportType, setExportType] = useState<'master' | 'stems'>('master');
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [downloadReady, setDownloadReady] = useState<{ url: string; filename: string } | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgressText('Preparing live mixdown graph...');

    try {
      const hasSolo = tracks.some((t) => t.solo);
      const activeTracks = tracks.filter((t) => {
        if (!t.audioBuffer) return false;
        if (hasSolo) return t.solo;
        return !t.muted;
      });

      if (activeTracks.length === 0) {
        alert('No active tracks to export! Check mute/solo faders.');
        setIsExporting(false);
        return;
      }

      // Calculate total project duration
      const totalDuration = Math.max(
        ...activeTracks.map((t) => (t.startTime || 0) + (t.duration || t.audioBuffer!.duration))
      );

      const sampleRate = 44100;
      // Add small 2.5s tail for reverb and delay rings
      const exportDuration = totalDuration + 2.5;
      const numSamples = Math.ceil(exportDuration * sampleRate);

      if (exportType === 'master') {
        setProgressText('Setting up OfflineAudioContext DSP engine...');
        const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);

        // Master Limiter / Output Gain
        const masterLimiter = offlineCtx.createDynamicsCompressor();
        masterLimiter.threshold.value = -0.5;
        masterLimiter.knee.value = 0;
        masterLimiter.ratio.value = 20;
        masterLimiter.attack.value = 0.001;
        masterLimiter.release.value = 0.05;

        const masterGain = offlineCtx.createGain();
        masterGain.gain.value = masterVolume;

        masterLimiter.connect(offlineCtx.destination);
        masterGain.connect(masterLimiter);

        // Master Studio Convolver Reverb Bus
        const masterConvolver = offlineCtx.createConvolver();
        masterConvolver.buffer = createOfflineImpulseResponse(offlineCtx, 2.2, 2.5);
        const reverbReturnGain = offlineCtx.createGain();
        reverbReturnGain.gain.value = 0.9;
        masterConvolver.connect(reverbReturnGain);
        reverbReturnGain.connect(masterGain);

        // Master Stereo Delay Bus
        const delayNode = offlineCtx.createDelay(2.0);
        delayNode.delayTime.value = 0.28;
        const delayFeedback = offlineCtx.createGain();
        delayFeedback.gain.value = 0.35;
        const delayFilter = offlineCtx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 3500;
        const delayReturnGain = offlineCtx.createGain();
        delayReturnGain.gain.value = 0.75;

        delayNode.connect(delayFilter);
        delayFilter.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayFilter.connect(delayReturnGain);
        delayReturnGain.connect(masterGain);

        // Render each track through full DSP chain
        setProgressText(`Processing ${activeTracks.length} tracks (EQ, Reverb, Pitch, Warmth)...`);

        for (const track of activeTracks) {
          if (!track.audioBuffer) continue;
          const src = offlineCtx.createBufferSource();
          src.buffer = track.audioBuffer;

          // Pitch Transpose (Semitones)
          if (track.vocalDsp.pitchShift && track.vocalDsp.pitchShift !== 0) {
            src.playbackRate.value = Math.pow(2, track.vocalDsp.pitchShift / 12);
          }

          let lastNode: AudioNode = src;

          // 1. Low-Cut / High-Pass Filter
          if (track.vocalDsp.highPassEnabled !== false) {
            const hp = offlineCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = track.vocalDsp.lowCutFreq || track.vocalDsp.highPassFreq || 80;
            lastNode.connect(hp);
            lastNode = hp;
          }

          // 2. Dynamic Compressor
          if (track.vocalDsp.compressorEnabled) {
            const comp = offlineCtx.createDynamicsCompressor();
            comp.threshold.value = track.vocalDsp.threshold;
            comp.ratio.value = track.vocalDsp.ratio;
            comp.attack.value = track.vocalDsp.attack;
            comp.release.value = track.vocalDsp.release;
            lastNode.connect(comp);
            lastNode = comp;
          }

          // 3. 3-Band Parametric EQ
          if (track.vocalDsp.eqEnabled) {
            const lowShelf = offlineCtx.createBiquadFilter();
            lowShelf.type = 'lowshelf';
            lowShelf.frequency.value = track.vocalDsp.lowFreq || 120;
            lowShelf.gain.value = track.vocalDsp.lowGain || 0;
            lastNode.connect(lowShelf);
            lastNode = lowShelf;

            const midPeak = offlineCtx.createBiquadFilter();
            midPeak.type = 'peaking';
            midPeak.frequency.value = track.vocalDsp.midFreq || 1500;
            midPeak.Q.value = track.vocalDsp.midQ || 1.2;
            midPeak.gain.value = track.vocalDsp.midGain || 0;
            lastNode.connect(midPeak);
            lastNode = midPeak;

            const highShelf = offlineCtx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = track.vocalDsp.highFreq || 9000;
            highShelf.gain.value = track.vocalDsp.highGain || 0;
            lastNode.connect(highShelf);
            lastNode = highShelf;
          }

          // 4. Warmth Tape/Tube Saturation
          const warmth = track.vocalDsp.warmth || 0;
          if (warmth > 0) {
            const warmthShaper = offlineCtx.createWaveShaper();
            warmthShaper.curve = makeOfflineWarmthCurve(warmth / 100);
            warmthShaper.oversample = '2x';
            lastNode.connect(warmthShaper);
            lastNode = warmthShaper;
          }

          // 5. Track Pan & Volume Fader
          const trackFader = offlineCtx.createGain();
          trackFader.gain.value = track.volume;

          if (offlineCtx.createStereoPanner && track.pan !== 0) {
            const panner = offlineCtx.createStereoPanner();
            panner.pan.value = track.pan;
            lastNode.connect(panner);
            panner.connect(trackFader);
          } else {
            lastNode.connect(trackFader);
          }

          // 6. Space Sends (Convolver Reverb & Delay)
          const reverbWet =
            track.vocalDsp.reverbWet !== undefined
              ? track.vocalDsp.reverbWet
              : track.vocalDsp.reverbSend;
          if (reverbWet > 0) {
            const revSend = offlineCtx.createGain();
            revSend.gain.value = reverbWet;
            trackFader.connect(revSend);
            revSend.connect(masterConvolver);
          }

          const delaySend = track.vocalDsp.delaySend || 0;
          if (delaySend > 0) {
            const delSend = offlineCtx.createGain();
            delSend.gain.value = delaySend;
            trackFader.connect(delSend);
            delSend.connect(delayNode);
          }

          // Direct Track Path to Master Gain
          trackFader.connect(masterGain);

          // Start playback at timeline start time
          src.start(track.startTime || 0);
        }

        setProgressText('Bouncing master audio via OfflineAudioContext...');
        const rendered = await offlineCtx.startRendering();
        setProgressText('Encoding 16-bit 44.1kHz Stereo PCM WAV...');
        const wavBlob = audioBufferToWavBlob(rendered);
        const url = URL.createObjectURL(wavBlob);
        setDownloadReady({ url, filename: `studio_master_${Date.now()}.wav` });
      } else {
        // Individual active stems
        setProgressText('Rendering stems mixdown...');
        const track = activeTracks[0];
        const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
        const src = offlineCtx.createBufferSource();
        src.buffer = track.audioBuffer!;
        const fader = offlineCtx.createGain();
        fader.gain.value = track.volume;
        src.connect(fader);
        fader.connect(offlineCtx.destination);
        src.start(track.startTime || 0);
        const rendered = await offlineCtx.startRendering();
        const wavBlob = audioBufferToWavBlob(rendered);
        const url = URL.createObjectURL(wavBlob);
        setDownloadReady({
          url,
          filename: `${track.name.replace(/\s+/g, '_')}_stem.wav`,
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please check browser console.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-neutral-950 px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Export Audio Project</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-neutral-300">
          <div>
            <label className="block text-xs font-semibold text-neutral-200 mb-2">
              Select Bounce Target
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExportType('master')}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  exportType === 'master'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-400">
                  <Music className="w-3.5 h-3.5" /> Full Mixdown
                </div>
                <span className="text-[10px] text-neutral-400">
                  Bounces all active tracks summed through master limiter.
                </span>
              </button>

              <button
                onClick={() => setExportType('stems')}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  exportType === 'stems'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-400">
                  <Layers className="w-3.5 h-3.5" /> Isolated Stem
                </div>
                <span className="text-[10px] text-neutral-400">
                  Individual dry or processed track stems.
                </span>
              </button>
            </div>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-neutral-400">
              <span>Format:</span>
              <span className="text-white font-mono">16-bit Stereo PCM WAV</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Sample Rate:</span>
              <span className="text-white font-mono">44,100 Hz (CD Standard)</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>DSP Processing:</span>
              <span className="text-emerald-400 font-mono">Real-time Graph Baked</span>
            </div>
          </div>

          {downloadReady && (
            <div className="bg-emerald-950/80 border border-emerald-600 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Bounce Render Complete!</span>
              </div>
              <a
                href={downloadReady.url}
                download={downloadReady.filename}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          )}

          {isExporting && (
            <div className="flex items-center justify-center gap-2 text-cyan-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-950 px-5 py-3 border-t border-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
          >
            Close
          </button>

          {!downloadReady && (
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Render WAV</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
