import type { PNGChunks } from "../types.ts";

const latin1 = new TextDecoder("iso-8859-1");
const utf8 = new TextDecoder("utf-8");
const COMPRESSED_PREFIX = "__compressed__";

async function inflate(compressed: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== "undefined") {
    const decompressionStream = new DecompressionStream("deflate");
    const writer = decompressionStream.writable.getWriter();
    await writer.write(Uint8Array.from(compressed));
    await writer.close();

    const chunks: Uint8Array[] = [];
    const reader = decompressionStream.readable.getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      chunks.push(result.value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let cursor = 0;
    for (const chunk of chunks) {
      output.set(chunk, cursor);
      cursor += chunk.length;
    }
    return utf8.decode(output);
  }

  const importNodeZlib = new Function("return import('node:zlib')") as () => Promise<
    typeof import("node:zlib")
  >;
  const zlib = await importNodeZlib();
  return await new Promise<string>((resolve, reject) => {
    zlib.inflate(Buffer.from(compressed), (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result.toString("utf-8"));
    });
  });
}

function extractRaw(buffer: ArrayBuffer): Record<string, string | Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks: Record<string, string | Uint8Array> = {};

  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const data = bytes.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "tEXt") {
      const separatorIndex = data.indexOf(0);
      if (separatorIndex !== -1) {
        const key = latin1.decode(data.slice(0, separatorIndex));
        chunks[key] = latin1.decode(data.slice(separatorIndex + 1));
      }
    } else if (type === "iTXt") {
      const separatorIndex = data.indexOf(0);
      if (separatorIndex !== -1 && separatorIndex + 2 < data.length) {
        const key = latin1.decode(data.slice(0, separatorIndex));
        const compressionFlag = data[separatorIndex + 1];
        const compressionMethod = data[separatorIndex + 2];
        let cursor = separatorIndex + 3;
        while (cursor < data.length && data[cursor] !== 0) {
          cursor += 1;
        }
        if (cursor >= data.length) {
          continue;
        }
        cursor += 1;
        while (cursor < data.length && data[cursor] !== 0) {
          cursor += 1;
        }
        if (cursor >= data.length) {
          continue;
        }
        cursor += 1;

        if (compressionFlag === 1 && compressionMethod === 0) {
          chunks[`${COMPRESSED_PREFIX}${key}`] = data.slice(cursor);
        } else if (compressionFlag === 0) {
          chunks[key] = utf8.decode(data.slice(cursor));
        }
      }
    } else if (type === "zTXt") {
      const separatorIndex = data.indexOf(0);
      if (separatorIndex !== -1) {
        const key = latin1.decode(data.slice(0, separatorIndex));
        chunks[`${COMPRESSED_PREFIX}${key}`] = data.slice(separatorIndex + 2);
      }
    } else if (type === "IEND") {
      break;
    }
  }

  return chunks;
}

export async function extractPNGChunks(buffer: ArrayBuffer): Promise<PNGChunks> {
  const raw = extractRaw(buffer);
  const resolved: PNGChunks = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(COMPRESSED_PREFIX)) {
      resolved[key] = value as string;
      continue;
    }
    const chunkKey = key.slice(COMPRESSED_PREFIX.length);
    try {
      resolved[chunkKey] = await inflate(value as Uint8Array);
    } catch {
      resolved[chunkKey] = "[compressed text decompression failed]";
    }
  }
  return resolved;
}
