import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { oxc: true, resolver: "oxc" },
  exports: false,
  clean: true,
  sourcemap: true,
});
