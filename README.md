# gen-peek

`gen-peek` extracts embedded AI generator metadata from images so other tools can inspect how an image was made.

It currently parses metadata from PNG, JPEG, and WebP images and recognizes these sources:

- `ComfyUI`
- `A1111`
- `Forge`
- `Fooocus`
- `InvokeAI`
- `SwarmUI`
- `NovelAI`
- `Cake`
- `Unknown`

## Install

```bash
pnpm add gen-peek
```

## Basic usage

```ts
import { parseImageMeta } from "gen-peek";

const fileBuffer = await fetch(imageUrl).then((response) => response.arrayBuffer());
const result = await parseImageMeta(fileBuffer);

console.log(result.source);
console.log(result.rawChunks);
```

## Narrow by generator

```ts
import { parseImageMeta } from "gen-peek";

const result = await parseImageMeta(await file.arrayBuffer());

if (result.source === "ComfyUI") {
  console.log(result.workflow);
  console.log(result.samplerInputs);
}

if (result.source === "A1111" || result.source === "Forge" || result.source === "Fooocus") {
  console.log(result.prompt);
  console.log(result.params["Steps"]);
}
```

## Handle unknown metadata gracefully

```ts
import { parseImageMeta } from "gen-peek";

const result = await parseImageMeta(await file.arrayBuffer());

if (result.source === "Unknown") {
  console.log("No supported generator metadata found.");
} else {
  console.log(`Parsed metadata from ${result.source}.`);
}
```

## Notes

- The public API is intentionally small for v1: `parseImageMeta(input)` plus the exported result types.
- `Cake` metadata remains supported as one of the recognized metadata formats.
- Unsupported or missing metadata returns `source: "Unknown"` instead of throwing.
