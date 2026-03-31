import type { SwarmUIMeta, PNGChunks } from "../types.ts";

export function parseSwarmUI(chunks: PNGChunks): SwarmUIMeta {
  const raw = chunks.sui_image_params ?? "{}";
  const data = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  })();
  return { source: "SwarmUI", data, rawChunks: chunks };
}
