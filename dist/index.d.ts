//#region src/types.d.ts
type AISource = "Cake" | "ComfyUI" | "A1111" | "Forge" | "Fooocus" | "InvokeAI" | "SwarmUI" | "NovelAI" | "Unknown";
type PNGChunks = Record<string, string>;
interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
}
type ComfyWorkflow = Record<string, ComfyNode>;
interface CakeMeta {
  source: "Cake";
  snapshot: Record<string, unknown>;
  rawChunks: PNGChunks;
}
interface ComfyMeta {
  source: "ComfyUI";
  workflow: ComfyWorkflow;
  samplerInputs?: Record<string, unknown>;
  rawChunks: PNGChunks;
}
interface A1111Meta {
  source: "A1111" | "Forge" | "Fooocus";
  prompt: string;
  negativePrompt: string;
  params: Record<string, string>;
  rawParameters: string;
  rawChunks: PNGChunks;
}
interface InvokeAIMeta {
  source: "InvokeAI";
  data: Record<string, unknown>;
  rawChunks: PNGChunks;
}
interface SwarmUIMeta {
  source: "SwarmUI";
  data: Record<string, unknown>;
  rawChunks: PNGChunks;
}
interface NovelAIMeta {
  source: "NovelAI";
  prompt: string;
  comment: Record<string, unknown>;
  rawChunks: PNGChunks;
}
interface UnknownMeta {
  source: "Unknown";
  rawChunks: PNGChunks;
}
type ImageMeta = CakeMeta | ComfyMeta | A1111Meta | InvokeAIMeta | SwarmUIMeta | NovelAIMeta | UnknownMeta;
//#endregion
//#region src/index.d.ts
declare function parseImageMeta(input: ArrayBuffer | Uint8Array): Promise<ImageMeta>;
//#endregion
export { type A1111Meta, type AISource, type CakeMeta, type ComfyMeta, type ComfyNode, type ComfyWorkflow, type ImageMeta, type InvokeAIMeta, type NovelAIMeta, type PNGChunks, type SwarmUIMeta, type UnknownMeta, parseImageMeta };
//# sourceMappingURL=index.d.mts.map