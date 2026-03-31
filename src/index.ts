export type {
  AISource,
  PNGChunks,
  ComfyNode,
  ComfyWorkflow,
  CakeMeta,
  ComfyMeta,
  A1111Meta,
  InvokeAIMeta,
  SwarmUIMeta,
  NovelAIMeta,
  UnknownMeta,
  ImageMeta,
} from "./types.ts";

import { extractPNGChunks } from "./formats/png.ts";
import { extractJPEGUserComment } from "./formats/jpeg.ts";
import { extractWebPExifUserComment } from "./formats/webp.ts";
import { CAKE_CHUNK_KEY, chunksFromExifUserComment, parseCake } from "./generators/cake.ts";
import { parseComfyUI } from "./generators/comfyui.ts";
import { parseA1111Style } from "./generators/a1111.ts";
import { parseInvokeAI } from "./generators/invokeai.ts";
import { parseSwarmUI } from "./generators/swarmui.ts";
import { parseNovelAI } from "./generators/novelai.ts";
import type { AISource, ImageMeta, PNGChunks } from "./types.ts";

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const latin1 = new TextDecoder("iso-8859-1");

function isPNG(bytes: Uint8Array): boolean {
  return PNG_SIG.every((value, index) => bytes[index] === value);
}

function isJPEG(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  );
}

function toArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  return Uint8Array.from(input).buffer;
}

function detectSource(chunks: PNGChunks): AISource {
  if (chunks[CAKE_CHUNK_KEY]) {
    try {
      const data = JSON.parse(chunks[CAKE_CHUNK_KEY]);
      if (data?.generator === "Cake") {
        return "Cake";
      }
    } catch {}
  }

  if (chunks.prompt || chunks.workflow) {
    try {
      const data = JSON.parse(chunks.prompt ?? chunks.workflow ?? "");
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return "ComfyUI";
      }
    } catch {}
  }

  if (chunks.invokeai_metadata || chunks["sd-metadata"] || chunks.Dream) {
    return "InvokeAI";
  }

  if (chunks.sui_image_params) {
    return "SwarmUI";
  }

  if (chunks.parameters) {
    const parameters = chunks.parameters;
    if (/fooocus/i.test(parameters)) {
      return "Fooocus";
    }
    if (/forge|sd webui forge/i.test(parameters)) {
      return "Forge";
    }
    return "A1111";
  }

  const comment = chunks.Comment ?? chunks.comment;
  if (comment) {
    try {
      const parsed = JSON.parse(comment);
      if (parsed && (parsed.steps !== undefined || parsed.sampler !== undefined)) {
        return "NovelAI";
      }
    } catch {}
  }

  return "Unknown";
}

export async function parseImageMeta(input: ArrayBuffer | Uint8Array): Promise<ImageMeta> {
  const buffer = toArrayBuffer(input);
  const bytes = new Uint8Array(buffer);
  let chunks: PNGChunks = {};

  if (isPNG(bytes)) {
    chunks = await extractPNGChunks(buffer);
  } else if (isJPEG(bytes)) {
    const comment = extractJPEGUserComment(buffer);
    if (comment) {
      chunks = chunksFromExifUserComment(comment);
    }
  } else if (isWebP(bytes)) {
    const comment = extractWebPExifUserComment(buffer);
    if (comment) {
      chunks = chunksFromExifUserComment(comment);
    }
  } else {
    const text = latin1.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
    const markerIndex = text.indexOf("parameters");
    if (markerIndex !== -1) {
      const cleaned = text
        .slice(markerIndex + "parameters".length)
        .split("\0")
        .join("")
        .trim();
      if (cleaned.length >= 10) {
        chunks = { parameters: cleaned };
      }
    }
  }

  const source = detectSource(chunks);
  switch (source) {
    case "Cake":
      return parseCake(chunks);
    case "ComfyUI":
      return parseComfyUI(chunks);
    case "A1111":
    case "Forge":
    case "Fooocus":
      return parseA1111Style(source, chunks);
    case "InvokeAI":
      return parseInvokeAI(chunks);
    case "SwarmUI":
      return parseSwarmUI(chunks);
    case "NovelAI":
      return parseNovelAI(chunks);
    default:
      return { source: "Unknown", rawChunks: chunks };
  }
}
