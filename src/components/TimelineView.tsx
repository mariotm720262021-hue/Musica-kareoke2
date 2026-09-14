import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioTrack, TransportState } from '../types/audio';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TimelineViewProps {
  tracks: AudioTrack[];
  transport: TransportState;
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onSeek: (time: number) => void;
  onUpdateLoop: (loopStart: number, loopEnd: number) => void;
  onUpdateTrackStartTime: (trackId: string, newStartTime: number) => void;
  isLiveRecording: boolean;
  liveRecordingTrackId: string | null;
  livePeakLevel: number;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  transport,
  selectedTrackId,
  onSelectTrack,
  onSeek,
  onUpdateLoop,
  onUpdateTrackStartTime,
  isLiveRecording,
  liveRecordingTrackId,
  livePeakLevel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const trackCanvasRefs = useRef<{ [trackId: string]: HTMLCanvasElement | null }>({});

  // Pixels per second zoom factor (default: 40px per second)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(45);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragInitialTrackTime, setDragInitialTrackTime] = useState(0);

  // Maximum duration shown on the timeline
  const maxTrackEnd = tracks.reduce(
    (max, t) => Math.max(max, (t.startTime || 0) + (t.duration || 0)),
    30
  );
  const totalTimelineDuration = Math.max(45, maxTrackEnd + 15, transport.loopEnd + 10);
  const timelineWidth = Math.max(800, totalTimelineDuration * pixelsPerSecond);

  // Handle ruler click or drag to seek
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const seekTime = Math.max(0, clickX / pixelsPerSecond);
    onSeek(seekTime);
    setIsDraggingPlayhead(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (isDraggingPlayhead) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const seekTime = Math.max(0, mouseX / pixelsPerSecond);
        onSeek(seekTime);
      } else if (draggingTrackId) {
        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(0, dragInitialTrackTime + deltaTime);
        onUpdateTrackStartTime(draggingTrackId, newStartTime);
      }
    },
    [isDraggingPlayhead, draggingTrackId, dragStartX, dragInitialTrackTime, pixelsPerSecond, onSeek, onUpdateTrackStartTime]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingPlayhead(false);
    setDraggingTrackId(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Draw top timeline ruler
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = timelineWidth * dpr;
    canvas.height = 32 * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, timelineWidth, 32);

    // Background
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, timelineWidth, 32);

    // Loop region background
    if (transport.loop) {
      const loopStartX = transport.loopStart * pixelsPerSecond;
      const loopEndX = transport.loopEnd * pixelsPerSecond;
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, 32);

      // Loop handles
      ctx.fillStyle = '#818cf8';
      ctx.fillRect(loopStartX, 0, 3, 32);
      ctx.fillRect(loopEndX - 3, 0, 3, 32);
    }

    // Grid ticks (seconds and bars based on BPM)
    const secondsPerBeat = 60 / transport.bpm;
    const secondsPerBar = secondsPerBeat * 4;

    ctx.font = '10px monospace';
    ctx.fillStyle = '#737373';
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;

    // Draw bars
    for (let t = 0; t <= totalTimelineDuration; t += secondsPerBar) {
      const x = t * pixelsPerSecond;
      const barNum = Math.floor(t / secondsPerBar) + 1;

      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x, 32);
      ctx.stroke();

      ctx.fillText(`${barNum}`, x + 4, 14);
    }

    // Minor beat ticks
    for (let t = 0; t <= totalTimelineDuration; t += secondsPerBeat) {
      const x = t * pixelsPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 32);
      ctx.stroke();
    }
  }, [timelineWidth, pixelsPerSecond, totalTimelineDuration, transport.loop, transport.loopStart, transport.loopEnd, transport.bpm]);

  // Draw waveforms for each track
  useEffect(() => {
    tracks.forEach((track) => {
      const canvas = trackCanvasRefs.current[track.id];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = timelineWidth * dpr;
      canvas.height = 112 * dpr; // 28 * 4 (h-28 in Tailwind is 112px)
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, timelineWidth, 112);

      // Lane background grid
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 1;
      const secondsPerBeat = 60 / transport.bpm;
      const secondsPerBar = secondsPerBeat * 4;
      for (let t = 0; t <= totalTimelineDuration; t += secondsPerBar) {
        const x = t * pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 112);
        ctx.stroke();
      }

      // Centerline
      ctx.strokeStyle = '#262626';
      ctx.beginPath();
      ctx.moveTo(0, 56);
      ctx.lineTo(timelineWidth, 56);
      ctx.stroke();

      // If this track is actively recording, draw live pulsing waveform
      if (isLiveRecording && liveRecordingTrackId === track.id) {
        const recStartX = (transport.currentTime - 1) * pixelsPerSecond;
        const recWidth = Math.max(30, pixelsPerSecond * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(Math.max(0, recStartX), 4, recWidth, 104);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.max(0, recStartX), 4, recWidth, 104);

        ctx.fillStyle = '#ef4444';
        const barH = 10 + livePeakLevel * 80;
        ctx.fillRect(Math.max(0, recStartX) + recWidth - 6, 56 - barH / 2, 4, barH);
      }

      // Render actual audio waveform if present
      if (track.audioBuffer && track.peaks) {
        const startX = (track.startTime || 0) * pixelsPerSecond;
        const width = (track.duration || track.audioBuffer.duration) * pixelsPerSecond;

        // Clip container background
        ctx.fillStyle = track.color + '15'; // 10% opacity
        ctx.strokeStyle = track.color + '60';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(startX, 6, width, 100, 4);
        ctx.fill();
        ctx.stroke();

        // Clip label
        ctx.fillStyle = track.color;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(track.name, startX + 6, 18);

        // Draw waveform peaks
        const peaks = track.peaks;
        const numPeaks = peaks.length;
        ctx.fillStyle = track.color;

        for (let i = 0; i < numPeaks; i++) {
          const x = startX + (i / numPeaks) * width;
          const peak = peaks[i];
          const height = Math.max(2, peak * 86);
          const y = 56 - height / 2;
          ctx.fillRect(x, y, Math.max(1, width / numPeaks - 0.5), height);
        }
      } else if (!track.audioBuffer) {
        // Empty track lane prompt
        ctx.fillStyle = '#404040';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Empty Track — Arm REC or Import Audio', 200, 60);
        ctx.textAlign = 'left';
      }
    });
  }, [
    tracks,
    timelineWidth,
    pixelsPerSecond,
    totalTimelineDuration,
    transport.bpm,
    transport.currentTime,
    isLiveRecording,
    liveRecordingTrackId,
    livePeakLevel,
  ]);

  // Current playhead position in pixels
  const playheadX = transport.currentTime * pixelsPerSecond;

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative select-none">
      {/* Zoom Bar & Timeline Stats */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-1 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 font-medium">Timeline Tracks</span>
          <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">
            {tracks.length} Channels
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono">Zoom: {pixelsPerSecond}px/s</span>
          <button
            onClick={() => setPixelsPerSecond((z) => Math.max(20, z - 10))}
            title="Zoom Out"
            className="p-1 hover:bg-neutral-800 rounded text-neutral-300"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPixelsPerSecond((z) => Math.min(120, z + 10))}
            title="Zoom In"
            className="p-1 hover:bg-neutral-800 rounded text-neutral-300"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPixelsPerSecond(45)}
            title="Reset Zoom"
            className="p-1 hover:bg-neutral-800 rounded text-neutral-300"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Timeline Stage */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative bg-neutral-950"
      >
        {/* Top Time Ruler */}
        <div
          onMouseDown={handleRulerMouseDown}
          className="sticky top-0 z-20 cursor-pointer h-8 bg-neutral-900 border-b border-neutral-800"
          style={{ width: `${timelineWidth}px` }}
        >
          <canvas ref={rulerCanvasRef} className="w-full h-full block" />
        </div>

        {/* Tracks Area */}
        <div className="relative" style={{ width: `${timelineWidth}px` }}>
          {tracks.map((track) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={`relative h-28 border-b border-neutral-800/80 transition-colors ${
                selectedTrackId === track.id ? 'bg-neutral-900/40' : 'hover:bg-neutral-900/20'
              }`}
            >
              <canvas
                ref={(el) => {
                  trackCanvasRefs.current[track.id] = el;
                }}
                className="w-full h-full block"
              />

              {/* Clip draggable handle overlay if clip exists */}
              {track.audioBuffer && (
                <div
                  style={{
                    left: `${(track.startTime || 0) * pixelsPerSecond}px`,
                    width: `${(track.duration || 0) * pixelsPerSecond}px`,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingTrackId(track.id);
                    setDragStartX(e.clientX);
                    setDragInitialTrackTime(track.startTime || 0);
                  }}
                  title="Click and drag to slide audio clip on timeline"
                  className="absolute top-1 bottom-1 rounded border border-white/10 hover:border-cyan-400/50 cursor-grab active:cursor-grabbing group"
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute top-1 right-2 text-[9px] bg-black/80 px-1.5 py-0.5 rounded text-neutral-300 pointer-events-none">
                    Drag Clip
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Draggable Playhead Vertical Needle */}
          <div
            style={{ left: `${playheadX}px` }}
            className="absolute top-0 bottom-0 w-px bg-cyan-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.8)]"
          >
            {/* Playhead pointer triangle */}
            <div className="absolute -top-8 -left-2 w-0 h-0 border-x-[8px] border-x-transparent border-t-[10px] border-t-cyan-400 drop-shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
};
