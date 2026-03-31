import { parseExifUserComment } from "./exif.ts";

export function extractWebPExifUserComment(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkType === "EXIF" && chunkDataOffset + chunkLength <= bytes.length) {
      const hasExifHeader =
        chunkLength >= 6 &&
        String.fromCharCode(
          bytes[chunkDataOffset],
          bytes[chunkDataOffset + 1],
          bytes[chunkDataOffset + 2],
          bytes[chunkDataOffset + 3],
        ) === "Exif";
      return parseExifUserComment(buffer, bytes, view, chunkDataOffset + (hasExifHeader ? 6 : 0));
    }

    offset += 8 + chunkLength + (chunkLength % 2);
  }

  return null;
}
