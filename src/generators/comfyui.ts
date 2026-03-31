import type { ComfyMeta, PNGChunks } from "../types.ts";

export function parseComfyUI(chunks: PNGChunks): ComfyMeta {
  const workflow = JSON.parse(chunks.prompt ?? chunks.workflow ?? "{}") as ComfyMeta["workflow"];
  const samplerNode = Object.values(workflow).find((node) =>
    node.class_type?.startsWith("KSampler"),
  );
  const samplerInputs = samplerNode
    ? Object.fromEntries(
        Object.entries(samplerNode.inputs).filter(
          ([, value]) =>
            !Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string",
        ),
      )
    : undefined;

  return { source: "ComfyUI", workflow, samplerInputs, rawChunks: chunks };
}
