import type { CakeMeta, PNGChunks } from "../types.ts";

export const CAKE_CHUNK_KEY = "cake:project";

const utf8 = new TextDecoder("utf-8");

function decodeBase64Utf8(value: string): string | null {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "base64").toString("utf-8");
    }
    if (typeof atob !== "undefined") {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return utf8.decode(bytes);
    }
  } catch {}
  return null;
}

export function chunksFromExifUserComment(comment: string): PNGChunks {
  const trimmed = comment.trim();
  if (!trimmed.startsWith("Cake:") && !trimmed.startsWith("Cake64:")) {
    return { parameters: trimmed };
  }

  const snapshotJson = trimmed.startsWith("Cake64:")
    ? decodeBase64Utf8(trimmed.slice("Cake64:".length).trim())
    : trimmed.slice("Cake:".length).trim();
  if (!snapshotJson) {
    return { parameters: trimmed };
  }

  try {
    const parsed = JSON.parse(snapshotJson) as { generator?: unknown };
    if (parsed?.generator === "Cake") {
      return { [CAKE_CHUNK_KEY]: snapshotJson };
    }
  } catch {}

  return { parameters: trimmed };
}

export function parseCake(chunks: PNGChunks): CakeMeta {
  const raw = chunks[CAKE_CHUNK_KEY] ?? "{}";
  const snapshot = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  })();
  return { source: "Cake", snapshot, rawChunks: chunks };
}
