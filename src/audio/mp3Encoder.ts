// MP3 encoding utility using lamejs with ID3v2.3 metadata & cover art support
// @ts-ignore
import lamejs from 'lamejs';

export interface Mp3ExportOptions {
  title?: string;
  artist?: string;
  coverImageBlob?: Blob | null;
}

/**
 * Creates an ID3v2.3 tag header and frames for MP3 embedding (Title, Artist, Front Cover Picture)
 */
async function createId3Tag(options: Mp3ExportOptions): Promise<Uint8Array | null> {
  const frames: Uint8Array[] = [];

  // Helper to encode text to UTF-8
  const textEncoder = new TextEncoder();

  // Helper to create a standard text frame (TIT2 = Title, TPE1 = Artist)
  const createTextFrame = (id: string, text: string) => {
    if (!text || text.trim() === '') return null;
    const textBytes = textEncoder.encode(text);
    // 1 byte encoding (0x03 for UTF-8) + textBytes
    const bodyLength = 1 + textBytes.length;
    const frame = new Uint8Array(10 + bodyLength);

    // 4 bytes ID
    for (let i = 0; i < 4; i++) {
      frame[i] = id.charCodeAt(i);
    }
    // 4 bytes size (big endian)
    frame[4] = (bodyLength >> 24) & 0xff;
    frame[5] = (bodyLength >> 16) & 0xff;
    frame[6] = (bodyLength >> 8) & 0xff;
    frame[7] = bodyLength & 0xff;
    // 2 bytes flags
    frame[8] = 0;
    frame[9] = 0;
    // Body: 0x03 = UTF-8 encoding flag
    frame[10] = 0x03;
    frame.set(textBytes, 11);
    return frame;
  };

  if (options.title) {
    const titleFrame = createTextFrame('TIT2', options.title);
    if (titleFrame) frames.push(titleFrame);
  }

  if (options.artist) {
    const artistFrame = createTextFrame('TPE1', options.artist);
    if (artistFrame) frames.push(artistFrame);
  }

  // APIC: Attached Picture (Cover Art)
  if (options.coverImageBlob) {
    try {
      const mimeType = options.coverImageBlob.type || 'image/jpeg';
      const imageBuffer = await options.coverImageBlob.arrayBuffer();
      const imageBytes = new Uint8Array(imageBuffer);

      const mimeBytes = textEncoder.encode(mimeType);
      // Body: 1 byte encoding (0x00) + mimeType + null terminator (0x00) + picture type (0x03 = Cover front) + desc ("\0") + imageBytes
      const bodyLength = 1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length;
      const apicFrame = new Uint8Array(10 + bodyLength);

      // Frame ID "APIC"
      apicFrame[0] = 0x41; // 'A'
      apicFrame[1] = 0x50; // 'P'
      apicFrame[2] = 0x49; // 'I'
      apicFrame[3] = 0x43; // 'C'

      // Frame size
      apicFrame[4] = (bodyLength >> 24) & 0xff;
      apicFrame[5] = (bodyLength >> 16) & 0xff;
      apicFrame[6] = (bodyLength >> 8) & 0xff;
      apicFrame[7] = bodyLength & 0xff;
      // Flags
      apicFrame[8] = 0;
      apicFrame[9] = 0;

      let offset = 10;
      apicFrame[offset++] = 0x00; // Encoding (ISO-8859-1)
      apicFrame.set(mimeBytes, offset);
      offset += mimeBytes.length;
      apicFrame[offset++] = 0x00; // Null terminator for MIME
      apicFrame[offset++] = 0x03; // Picture Type: 0x03 = Cover (front)
      apicFrame[offset++] = 0x00; // Null terminator for Description
      apicFrame.set(imageBytes, offset);

      frames.push(apicFrame);
    } catch (e) {
      console.warn('Could not encode cover image into ID3:', e);
    }
  }

  if (frames.length === 0) return null;

  // Compute total frames size
  const totalFramesSize = frames.reduce((acc, f) => acc + f.length, 0);

  // ID3v2 Header: 10 bytes
  const id3Tag = new Uint8Array(10 + totalFramesSize);
  // Identifier "ID3"
  id3Tag[0] = 0x49; // 'I'
  id3Tag[1] = 0x44; // 'D'
  id3Tag[2] = 0x33; // '3'
  // Version 2.3.0
  id3Tag[3] = 0x03;
  id3Tag[4] = 0x00;
  // Flags
  id3Tag[5] = 0x00;
  // Size in 4 syncsafe bytes (7 bits per byte)
  id3Tag[6] = (totalFramesSize >> 21) & 0x7f;
  id3Tag[7] = (totalFramesSize >> 14) & 0x7f;
  id3Tag[8] = (totalFramesSize >> 7) & 0x7f;
  id3Tag[9] = totalFramesSize & 0x7f;

  // Copy frames
  let writeOffset = 10;
  for (const frame of frames) {
    id3Tag.set(frame, writeOffset);
    writeOffset += frame.length;
  }

  return id3Tag;
}

/**
 * Converts an AudioBuffer to an MP3 Blob using lamejs at 192kbps stereo with ID3v2.3 tags & album cover
 */
export async function audioBufferToMp3Blob(
  buffer: AudioBuffer,
  options?: Mp3ExportOptions
): Promise<Blob> {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const kbps = 192;

  const mp3encoder = new (lamejs as any).Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: (Uint8Array | Blob)[] = [];

  // If options provided, prepend ID3v2 tag
  if (options && (options.title || options.artist || options.coverImageBlob)) {
    const id3Header = await createId3Tag(options);
    if (id3Header) {
      mp3Data.push(id3Header);
    }
  }

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

  // Resolve final MP3 blob
  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}
