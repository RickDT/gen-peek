const esm = await import("../dist/index.mjs");

if (typeof esm.parseImageMeta !== "function") {
  throw new Error("Expected parseImageMeta export to be available.");
}

console.log("Smoke check passed for ESM exports.");
