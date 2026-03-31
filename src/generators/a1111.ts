import type { A1111Meta, PNGChunks } from "../types.ts";

export function parseA1111Style(
  source: "A1111" | "Forge" | "Fooocus",
  chunks: PNGChunks,
): A1111Meta {
  const raw = chunks.parameters ?? "";
  let prompt = raw;
  let negativePrompt = "";
  let parameterLine = "";

  const negativeIndex = raw.indexOf("\nNegative prompt:");
  if (negativeIndex !== -1) {
    prompt = raw.slice(0, negativeIndex).trim();
    const remainder = raw.slice(negativeIndex + "\nNegative prompt:".length);
    const stepIndex = remainder.search(/\n(?:Steps|Size|Model|CFG):/);
    if (stepIndex !== -1) {
      negativePrompt = remainder.slice(0, stepIndex).trim();
      parameterLine = remainder.slice(stepIndex + 1).trim();
    } else {
      negativePrompt = remainder.trim();
    }
  } else {
    const stepIndex = raw.search(/\nSteps:/);
    if (stepIndex !== -1) {
      prompt = raw.slice(0, stepIndex).trim();
      parameterLine = raw.slice(stepIndex + 1).trim();
    }
  }

  const params: Record<string, string> = {};
  parameterLine.replace(/([^,:\n]+):\s*([^,\n]+)/g, (_, key: string, value: string) => {
    params[key.trim()] = value.trim();
    return "";
  });

  return { source, prompt, negativePrompt, params, rawParameters: raw, rawChunks: chunks };
}
