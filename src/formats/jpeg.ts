import { parseExifUserComment } from "./exif.ts";

export function extractJPEGUserComment(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      break;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = view.getUint16(offset + 2, false);
    if (marker === 0xe1 && offset + 10 <= bytes.length) {
      const header = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
      );
      if (header === "Exif") {
        return parseExifUserComment(buffer, bytes, view, offset + 10);
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
}
