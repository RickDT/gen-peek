import type { InvokeAIMeta, PNGChunks } from "../types.ts";

export function parseInvokeAI(chunks: PNGChunks): InvokeAIMeta {
  const raw = chunks.invokeai_metadata ?? chunks["sd-metadata"] ?? chunks.Dream ?? "{}";
  const data = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { raw };
    }
  })();
  return { source: "InvokeAI", data, rawChunks: chunks };
}
