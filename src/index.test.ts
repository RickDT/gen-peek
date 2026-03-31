import { describe, expect, it } from "vitest";

import { parseImageMeta } from "./index.ts";
import type { A1111Meta, CakeMeta, ComfyMeta, InvokeAIMeta, NovelAIMeta, SwarmUIMeta } from "./index.ts";

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data: Uint8Array): number {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const buf = new ArrayBuffer(12 + data.length);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  view.setUint32(0, data.length, false);
  bytes.set(typeBytes, 4);
  bytes.set(data, 8);

  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput), false);

  return bytes;
}

function buildTExtChunk(key: string, value: string): Uint8Array {
  const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  const keyBytes = latin1(key);
  const valBytes = latin1(value);
  const data = new Uint8Array(keyBytes.length + 1 + valBytes.length);
  data.set(keyBytes, 0);
  data[keyBytes.length] = 0;
  data.set(valBytes, keyBytes.length + 1);
  return buildPNGChunk("tEXt", data);
}

function buildITxtChunk(key: string, value: string): Uint8Array {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(key);
  const valBytes = enc.encode(value);
  const data = new Uint8Array(keyBytes.length + 1 + 2 + 1 + 1 + valBytes.length);
  let offset = 0;
  data.set(keyBytes, offset);
  offset += keyBytes.length;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data.set(valBytes, offset);
  return buildPNGChunk("iTXt", data);
}

function buildMinimalIHDR(): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, 1, false);
  view.setUint32(4, 1, false);
  data[8] = 8;
  data[9] = 2;
  return buildPNGChunk("IHDR", data);
}

function buildIENDChunk(): Uint8Array {
  return buildPNGChunk("IEND", new Uint8Array(0));
}

function assemblePNG(...chunks: Uint8Array[]): ArrayBuffer {
  const total = PNG_SIG.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  buf.set(PNG_SIG, offset);
  offset += PNG_SIG.length;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
  }
  return buf.buffer;
}

describe("parseImageMeta", () => {
  it("returns Unknown for an empty buffer", async () => {
    const result = await parseImageMeta(new Uint8Array(0));
    expect(result.source).toBe("Unknown");
  });

  it("returns Unknown for a PNG with no recognised chunks", async () => {
    const png = assemblePNG(buildMinimalIHDR(), buildIENDChunk());
    const result = await parseImageMeta(png);
    expect(result.source).toBe("Unknown");
  });

  it("parses ComfyUI workflow from the prompt tEXt chunk", async () => {
    const workflow = {
      "1": { class_type: "KSampler", inputs: { steps: 20, cfg: 7, seed: 42 } },
    };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("prompt", JSON.stringify(workflow)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("ComfyUI");
    const meta = result as ComfyMeta;
    expect(meta.workflow["1"]!.class_type).toBe("KSampler");
    expect(meta.samplerInputs).toEqual({ steps: 20, cfg: 7, seed: 42 });
  });

  it("parses A1111 parameters chunk", async () => {
    const params =
      "a beautiful landscape\nNegative prompt: ugly, blurry\nSteps: 30, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x512, Model: v1-5";
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("parameters", params),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("A1111");
    const meta = result as A1111Meta;
    expect(meta.prompt).toBe("a beautiful landscape");
    expect(meta.negativePrompt).toBe("ugly, blurry");
    expect(meta.params["Steps"]).toBe("30");
    expect(meta.params["Seed"]).toBe("12345");
  });

  it("detects Forge from parameters chunk", async () => {
    const params = "portrait\nNegative prompt: bad\nSteps: 20, Model: sd webui forge";
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("parameters", params),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("Forge");
  });

  it("detects Fooocus from parameters chunk", async () => {
    const params = "portrait\nNegative prompt: bad\nFooocus v2.0";
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("parameters", params),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("Fooocus");
  });

  it("parses InvokeAI metadata", async () => {
    const data = { model: { name: "v1-5" }, positive_prompt: "cat" };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("invokeai_metadata", JSON.stringify(data)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("InvokeAI");
    expect((result as InvokeAIMeta).data).toEqual(data);
  });

  it("parses SwarmUI metadata", async () => {
    const data = { prompt: "a cat", model: "sd15" };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("sui_image_params", JSON.stringify(data)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("SwarmUI");
    expect((result as SwarmUIMeta).data).toEqual(data);
  });

  it("parses NovelAI Comment chunk", async () => {
    const comment = { steps: 28, sampler: "k_euler", seed: 9999 };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("Description", "anime girl"),
      buildTExtChunk("Comment", JSON.stringify(comment)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("NovelAI");
    const meta = result as NovelAIMeta;
    expect(meta.prompt).toBe("anime girl");
    expect(meta.comment["steps"]).toBe(28);
  });

  it("parses Cake snapshot from cake:project iTXt chunk", async () => {
    const snapshot = {
      generator: "Cake",
      version: 1,
      project: { name: "My Project", layerOrder: [] },
      layers: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildITxtChunk("cake:project", JSON.stringify(snapshot)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(png);
    expect(result.source).toBe("Cake");
    const meta = result as CakeMeta;
    expect(meta.snapshot["generator"]).toBe("Cake");
  });

  it("accepts Uint8Array input as well as ArrayBuffer", async () => {
    const workflow = { "1": { class_type: "KSampler", inputs: { steps: 10, cfg: 5 } } };
    const png = assemblePNG(
      buildMinimalIHDR(),
      buildTExtChunk("prompt", JSON.stringify(workflow)),
      buildIENDChunk(),
    );
    const result = await parseImageMeta(new Uint8Array(png));
    expect(result.source).toBe("ComfyUI");
  });
});
