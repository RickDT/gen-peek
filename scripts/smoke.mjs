import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const esm = await import("../dist/index.js");
const cjs = require("../dist/index.cjs");

for (const entry of [esm, cjs]) {
  if (typeof entry.parseImageMeta !== "function") {
    throw new Error("Expected parseImageMeta export to be available.");
  }
}

console.log("Smoke check passed for ESM and CJS exports.");
