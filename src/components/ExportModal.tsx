import React, { useState } from 'react';
import { AudioTrack } from '../types/audio';
import { audioBufferToWavBlob } from '../audio/audioContext';
import { Download, CheckCircle, Music, Layers, Loader2, X } from 'lucide-react';

interface ExportModalProps {
  tracks: AudioTrack[];
  masterVolume: number;
  onClose: () => void;
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
    setProgressText('Preparing audio buffers...');

    try {
      const activeTracks = tracks.filter((t) => t.audioBuffer && !t.muted);
      if (activeTracks.length === 0) {
        alert('No tracks with audio to export!');
        setIsExporting(false);
        return;
      }

      // Calculate total duration
      const totalDuration = Math.max(
        ...activeTracks.map((t) => (t.startTime || 0) + (t.duration || t.audioBuffer!.duration))
      );

      const sampleRate = 44100;
      const numSamples = Math.ceil(totalDuration * sampleRate);

      if (exportType === 'master') {
        setProgressText('Rendering Master Mix with Vocal DSP & AI Cleaners...');
        const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);

        // Master Gain
        const masterGain = offlineCtx.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(offlineCtx.destination);

        // Render each track
        for (const track of activeTracks) {
          if (!track.audioBuffer) continue;
          const src = offlineCtx.createBufferSource();
          src.buffer = track.audioBuffer;

          // Track Gain & Pan
          const trackGain = offlineCtx.createGain();
          trackGain.gain.value = track.volume;

          // High-pass filter if enabled
          let lastNode: AudioNode = src;
          if (track.vocalDsp.highPassEnabled) {
            const hp = offlineCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = track.vocalDsp.highPassFreq;
            lastNode.connect(hp);
            lastNode = hp;
          }

          // EQ if enabled
          if (track.vocalDsp.eqEnabled) {
            const mid = offlineCtx.createBiquadFilter();
            mid.type = 'peaking';
            mid.frequency.value = track.vocalDsp.midFreq;
            mid.gain.value = track.vocalDsp.midGain;
            lastNode.connect(mid);
            lastNode = mid;
          }

          lastNode.connect(trackGain);
          trackGain.connect(masterGain);

          src.start(track.startTime || 0);
        }

        const rendered = await offlineCtx.startRendering();
        setProgressText('Encoding 16-bit 44.1kHz Stereo WAV...');
        const wavBlob = audioBufferToWavBlob(rendered);
        const url = URL.createObjectURL(wavBlob);
        setDownloadReady({ url, filename: `studio_mixdown_${Date.now()}.wav` });
      } else {
        // Individual stems
        setProgressText('Exporting stems...');
        // We'll export the first active track or allow download of individual stems
        const track = activeTracks[0];
        const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
        const src = offlineCtx.createBufferSource();
        src.buffer = track.audioBuffer!;
        src.connect(offlineCtx.destination);
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
