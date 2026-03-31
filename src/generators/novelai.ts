import type { NovelAIMeta, PNGChunks } from "../types.ts";

export function parseNovelAI(chunks: PNGChunks): NovelAIMeta {
  const prompt = chunks.Description ?? chunks.Title ?? "";
  const commentRaw = chunks.Comment ?? chunks.comment ?? "{}";
  const comment = (() => {
    try {
      return JSON.parse(commentRaw) as Record<string, unknown>;
    } catch {
      return { raw: commentRaw };
    }
  })();
  return { source: "NovelAI", prompt, comment, rawChunks: chunks };
}
