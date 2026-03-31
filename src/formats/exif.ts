export function parseExifUserComment(
  buffer: ArrayBuffer,
  bytes: Uint8Array,
  view: DataView,
  tiffStart: number,
): string | null {
  const byteOrder = String.fromCharCode(bytes[tiffStart], bytes[tiffStart + 1]);
  const littleEndian = byteOrder === "II";
  const read16 = (offset: number) => view.getUint16(tiffStart + offset, littleEndian);
  const read32 = (offset: number) => view.getUint32(tiffStart + offset, littleEndian);

  if (read16(2) !== 42) {
    return null;
  }

  let userComment: string | null = null;

  function readIFD(ifdOffset: number): void {
    if (ifdOffset + 2 > buffer.byteLength - tiffStart) {
      return;
    }

    const count = read16(ifdOffset);
    for (let index = 0; index < count; index += 1) {
      const entryOffset = ifdOffset + 2 + index * 12;
      if (entryOffset + 12 > buffer.byteLength - tiffStart) {
        break;
      }

      const tag = read16(entryOffset);
      const components = read32(entryOffset + 4);

      if (tag === 0x8769) {
        try {
          readIFD(read32(entryOffset + 8));
        } catch {}
      }

      if (tag === 0x9286 && components > 8) {
        try {
          const dataOffset = read32(entryOffset + 8);
          const raw = bytes.slice(tiffStart + dataOffset + 8, tiffStart + dataOffset + components);
          userComment = new TextDecoder("utf-8", { fatal: false })
            .decode(raw)
            .split("\0")
            .join("")
            .trim();
        } catch {}
      }
    }
  }

  try {
    readIFD(read32(4));
  } catch {}

  if (typeof userComment !== "string") {
    return null;
  }
  return userComment;
}
