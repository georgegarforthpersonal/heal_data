/**
 * Extract a time range from a WAV file as a new WAV Blob.
 *
 * Uses File.slice() to avoid loading the entire file into memory,
 * which is critical for large recordings (100MB+).
 */

import { parseTimeToSeconds } from './time';

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export async function extractWavSnippet(
  file: File,
  startTime: string,
  endTime: string,
): Promise<Blob> {
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);

  // Read just the first 1KB to parse the WAV header
  const headerSlice = file.slice(0, 1024);
  const headerBuffer = await headerSlice.arrayBuffer();
  const headerView = new DataView(headerBuffer);

  // Verify RIFF/WAVE
  const riff = String.fromCharCode(
    headerView.getUint8(0), headerView.getUint8(1),
    headerView.getUint8(2), headerView.getUint8(3),
  );
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

  // Walk chunks to find fmt and data
  let offset = 12; // Skip RIFF header (12 bytes)
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < headerBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      headerView.getUint8(offset), headerView.getUint8(offset + 1),
      headerView.getUint8(offset + 2), headerView.getUint8(offset + 3),
    );
    const chunkSize = headerView.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = headerView.getUint16(offset + 10, true);
      sampleRate = headerView.getUint32(offset + 12, true);
      blockAlign = headerView.getUint16(offset + 20, true);
      bitsPerSample = headerView.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // Padding byte for odd-sized chunks
  }

  if (!sampleRate || !dataOffset) {
    throw new Error('Could not parse WAV header');
  }

  // Calculate byte range for the snippet
  const bytesPerSecond = sampleRate * blockAlign;
  let startByte = Math.floor(startSeconds * bytesPerSecond);
  startByte -= startByte % blockAlign; // Align to block boundary
  let endByte = Math.ceil(endSeconds * bytesPerSecond);
  endByte += (blockAlign - (endByte % blockAlign)) % blockAlign; // Align
  endByte = Math.min(endByte, dataSize);
  const snippetDataSize = endByte - startByte;

  // Read just the snippet data from the file (no full-file read)
  const snippetSlice = file.slice(dataOffset + startByte, dataOffset + startByte + snippetDataSize);
  const snippetData = await snippetSlice.arrayBuffer();

  // Build new WAV: 44-byte header + snippet data
  const wavBuffer = new ArrayBuffer(44 + snippetDataSize);
  const wavView = new DataView(wavBuffer);

  // RIFF header
  writeString(wavView, 0, 'RIFF');
  wavView.setUint32(4, 36 + snippetDataSize, true);
  writeString(wavView, 8, 'WAVE');

  // fmt chunk
  writeString(wavView, 12, 'fmt ');
  wavView.setUint32(16, 16, true); // PCM fmt chunk size
  wavView.setUint16(20, 1, true); // Audio format: PCM
  wavView.setUint16(22, numChannels, true);
  wavView.setUint32(24, sampleRate, true);
  wavView.setUint32(28, sampleRate * blockAlign, true); // Byte rate
  wavView.setUint16(32, blockAlign, true);
  wavView.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(wavView, 36, 'data');
  wavView.setUint32(40, snippetDataSize, true);

  // Copy audio data
  new Uint8Array(wavBuffer, 44).set(new Uint8Array(snippetData));

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
