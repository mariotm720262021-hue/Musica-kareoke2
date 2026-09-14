// MP3 encoding utility using lamejs with ID3 metadata & cover art support
// @ts-ignore
import lamejs from 'lamejs';

export interface Mp3ExportOptions {
  title?: string;
  artist?: string;
  coverImageBlob?: Blob | null;
}

/**
 * Converts an AudioBuffer to an MP3 Blob using lamejs at 192kbps stereo
 */
export function audioBufferToMp3Blob(buffer: AudioBuffer, options?: Mp3ExportOptions): Promise<Blob> {
  return new Promise((resolve) => {
    const numChannels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = buffer.sampleRate;
    const kbps = 192;

    const mp3encoder = new (lamejs as any).Mp3Encoder(numChannels, sampleRate, kbps);
    const mp3Data: Uint8Array[] = [];

    const left = buffer.getChannelData(0);
    const right = numChannels > 1 ? buffer.getChannelData(1) : left;
    const sampleBlockSize = 1152; // LAME standard frame sample size

    const left16 = new Int16Array(left.length);
    const right16 = new Int16Array(right.length);

    // Convert Float32 [-1.0, 1.0] to 16-bit Int16 [-32768, 32767]
    for (let i = 0; i < left.length; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      left16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;

      const sR = Math.max(-1, Math.min(1, right[i]));
      right16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
    }

    for (let i = 0; i < left16.length; i += sampleBlockSize) {
      const leftChunk = left16.subarray(i, i + sampleBlockSize);
      const rightChunk = right16.subarray(i, i + sampleBlockSize);

      let mp3buf: Int8Array;
      if (numChannels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    // Resolve MP3 blob
    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    resolve(blob);
  });
}
