export type AISource =
  | "Cake"
  | "ComfyUI"
  | "A1111"
  | "Forge"
  | "Fooocus"
  | "InvokeAI"
  | "SwarmUI"
  | "NovelAI"
  | "Unknown";

export type PNGChunks = Record<string, string>;

export interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}

export type ComfyWorkflow = Record<string, ComfyNode>;

export interface CakeMeta {
  source: "Cake";
  snapshot: Record<string, unknown>;
  rawChunks: PNGChunks;
}

export interface ComfyMeta {
  source: "ComfyUI";
  workflow: ComfyWorkflow;
  samplerInputs?: Record<string, unknown>;
  rawChunks: PNGChunks;
}

export interface A1111Meta {
  source: "A1111" | "Forge" | "Fooocus";
  prompt: string;
  negativePrompt: string;
  params: Record<string, string>;
  rawParameters: string;
  rawChunks: PNGChunks;
}

export interface InvokeAIMeta {
  source: "InvokeAI";
  data: Record<string, unknown>;
  rawChunks: PNGChunks;
}

export interface SwarmUIMeta {
  source: "SwarmUI";
  data: Record<string, unknown>;
  rawChunks: PNGChunks;
}

export interface NovelAIMeta {
  source: "NovelAI";
  prompt: string;
  comment: Record<string, unknown>;
  rawChunks: PNGChunks;
}

export interface UnknownMeta {
  source: "Unknown";
  rawChunks: PNGChunks;
}

export type ImageMeta =
  | CakeMeta
  | ComfyMeta
  | A1111Meta
  | InvokeAIMeta
  | SwarmUIMeta
  | NovelAIMeta
  | UnknownMeta;
