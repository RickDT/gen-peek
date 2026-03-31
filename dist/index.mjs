//#region src/formats/png.ts
const latin1$1 = new TextDecoder("iso-8859-1");
const utf8$1 = new TextDecoder("utf-8");
const COMPRESSED_PREFIX = "__compressed__";
async function inflate(compressed) {
	if (typeof DecompressionStream !== "undefined") {
		const decompressionStream = new DecompressionStream("deflate");
		const writer = decompressionStream.writable.getWriter();
		await writer.write(Uint8Array.from(compressed));
		await writer.close();
		const chunks = [];
		const reader = decompressionStream.readable.getReader();
		while (true) {
			const result = await reader.read();
			if (result.done) break;
			chunks.push(result.value);
		}
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const output = new Uint8Array(totalLength);
		let cursor = 0;
		for (const chunk of chunks) {
			output.set(chunk, cursor);
			cursor += chunk.length;
		}
		return utf8$1.decode(output);
	}
	const zlib = await new Function("return import('node:zlib')")();
	return await new Promise((resolve, reject) => {
		zlib.inflate(Buffer.from(compressed), (error, result) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(result.toString("utf-8"));
		});
	});
}
function extractRaw(buffer) {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);
	const chunks = {};
	let offset = 8;
	while (offset + 12 <= bytes.length) {
		const length = view.getUint32(offset, false);
		const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
		const data = bytes.slice(offset + 8, offset + 8 + length);
		offset += 12 + length;
		if (type === "tEXt") {
			const separatorIndex = data.indexOf(0);
			if (separatorIndex !== -1) {
				const key = latin1$1.decode(data.slice(0, separatorIndex));
				chunks[key] = latin1$1.decode(data.slice(separatorIndex + 1));
			}
		} else if (type === "iTXt") {
			const separatorIndex = data.indexOf(0);
			if (separatorIndex !== -1 && separatorIndex + 2 < data.length) {
				const key = latin1$1.decode(data.slice(0, separatorIndex));
				const compressionFlag = data[separatorIndex + 1];
				const compressionMethod = data[separatorIndex + 2];
				let cursor = separatorIndex + 3;
				while (cursor < data.length && data[cursor] !== 0) cursor += 1;
				if (cursor >= data.length) continue;
				cursor += 1;
				while (cursor < data.length && data[cursor] !== 0) cursor += 1;
				if (cursor >= data.length) continue;
				cursor += 1;
				if (compressionFlag === 1 && compressionMethod === 0) chunks[`${COMPRESSED_PREFIX}${key}`] = data.slice(cursor);
				else if (compressionFlag === 0) chunks[key] = utf8$1.decode(data.slice(cursor));
			}
		} else if (type === "zTXt") {
			const separatorIndex = data.indexOf(0);
			if (separatorIndex !== -1) {
				const key = latin1$1.decode(data.slice(0, separatorIndex));
				chunks[`${COMPRESSED_PREFIX}${key}`] = data.slice(separatorIndex + 2);
			}
		} else if (type === "IEND") break;
	}
	return chunks;
}
async function extractPNGChunks(buffer) {
	const raw = extractRaw(buffer);
	const resolved = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!key.startsWith(COMPRESSED_PREFIX)) {
			resolved[key] = value;
			continue;
		}
		const chunkKey = key.slice(14);
		try {
			resolved[chunkKey] = await inflate(value);
		} catch {
			resolved[chunkKey] = "[compressed text decompression failed]";
		}
	}
	return resolved;
}
//#endregion
//#region src/formats/exif.ts
function parseExifUserComment(buffer, bytes, view, tiffStart) {
	if (tiffStart < 0 || tiffStart + 8 > bytes.length) return null;
	const byteOrder = String.fromCharCode(bytes[tiffStart], bytes[tiffStart + 1]);
	if (byteOrder !== "II" && byteOrder !== "MM") return null;
	const littleEndian = byteOrder === "II";
	const read16 = (offset) => view.getUint16(tiffStart + offset, littleEndian);
	const read32 = (offset) => view.getUint32(tiffStart + offset, littleEndian);
	if (read16(2) !== 42) return null;
	let userComment = null;
	function readIFD(ifdOffset) {
		if (ifdOffset + 2 > buffer.byteLength - tiffStart) return;
		const count = read16(ifdOffset);
		for (let index = 0; index < count; index += 1) {
			const entryOffset = ifdOffset + 2 + index * 12;
			if (entryOffset + 12 > buffer.byteLength - tiffStart) break;
			const tag = read16(entryOffset);
			const components = read32(entryOffset + 4);
			if (tag === 34665) try {
				readIFD(read32(entryOffset + 8));
			} catch {}
			if (tag === 37510 && components > 8) try {
				const dataOffset = read32(entryOffset + 8);
				const raw = bytes.slice(tiffStart + dataOffset + 8, tiffStart + dataOffset + components);
				userComment = new TextDecoder("utf-8", { fatal: false }).decode(raw).split("\0").join("").trim();
			} catch {}
		}
	}
	try {
		readIFD(read32(4));
	} catch {}
	if (typeof userComment !== "string") return null;
	return userComment;
}
//#endregion
//#region src/formats/jpeg.ts
function extractJPEGUserComment(buffer) {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);
	let offset = 2;
	while (offset + 4 <= bytes.length) {
		if (bytes[offset] !== 255) break;
		const marker = bytes[offset + 1];
		if (marker === 217 || marker === 218) break;
		const segmentLength = view.getUint16(offset + 2, false);
		if (marker === 225 && offset + 10 <= bytes.length) {
			if (String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]) === "Exif") return parseExifUserComment(buffer, bytes, view, offset + 10);
		}
		offset += 2 + segmentLength;
	}
	return null;
}
//#endregion
//#region src/formats/webp.ts
function extractWebPExifUserComment(buffer) {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const chunkType = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
		const chunkLength = view.getUint32(offset + 4, true);
		const chunkDataOffset = offset + 8;
		if (chunkType === "EXIF" && chunkDataOffset + chunkLength <= bytes.length) return parseExifUserComment(buffer, bytes, view, chunkDataOffset + (chunkLength >= 6 && String.fromCharCode(bytes[chunkDataOffset], bytes[chunkDataOffset + 1], bytes[chunkDataOffset + 2], bytes[chunkDataOffset + 3]) === "Exif" ? 6 : 0));
		offset += 8 + chunkLength + chunkLength % 2;
	}
	return null;
}
//#endregion
//#region src/generators/cake.ts
const CAKE_CHUNK_KEY = "cake:project";
const utf8 = new TextDecoder("utf-8");
function decodeBase64Utf8(value) {
	try {
		if (typeof Buffer !== "undefined") return Buffer.from(value, "base64").toString("utf-8");
		if (typeof atob !== "undefined") {
			const binary = atob(value);
			const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
			return utf8.decode(bytes);
		}
	} catch {}
	return null;
}
function chunksFromExifUserComment(comment) {
	const trimmed = comment.trim();
	if (!trimmed.startsWith("Cake:") && !trimmed.startsWith("Cake64:")) return { parameters: trimmed };
	const snapshotJson = trimmed.startsWith("Cake64:") ? decodeBase64Utf8(trimmed.slice(7).trim()) : trimmed.slice(5).trim();
	if (!snapshotJson) return { parameters: trimmed };
	try {
		if (JSON.parse(snapshotJson)?.generator === "Cake") return { [CAKE_CHUNK_KEY]: snapshotJson };
	} catch {}
	return { parameters: trimmed };
}
function parseCake(chunks) {
	const raw = chunks["cake:project"] ?? "{}";
	return {
		source: "Cake",
		snapshot: (() => {
			try {
				return JSON.parse(raw);
			} catch {
				return { raw };
			}
		})(),
		rawChunks: chunks
	};
}
//#endregion
//#region src/generators/comfyui.ts
function parseComfyUI(chunks) {
	const workflow = JSON.parse(chunks.prompt ?? chunks.workflow ?? "{}");
	const samplerNode = Object.values(workflow).find((node) => node.class_type?.startsWith("KSampler"));
	return {
		source: "ComfyUI",
		workflow,
		samplerInputs: samplerNode ? Object.fromEntries(Object.entries(samplerNode.inputs).filter(([, value]) => !Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string")) : void 0,
		rawChunks: chunks
	};
}
//#endregion
//#region src/generators/a1111.ts
function parseA1111Style(source, chunks) {
	const raw = chunks.parameters ?? "";
	let prompt = raw;
	let negativePrompt = "";
	let parameterLine = "";
	const negativeIndex = raw.indexOf("\nNegative prompt:");
	if (negativeIndex !== -1) {
		prompt = raw.slice(0, negativeIndex).trim();
		const remainder = raw.slice(negativeIndex + 17);
		const stepIndex = remainder.search(/\n(?:Steps|Size|Model|CFG):/);
		if (stepIndex !== -1) {
			negativePrompt = remainder.slice(0, stepIndex).trim();
			parameterLine = remainder.slice(stepIndex + 1).trim();
		} else negativePrompt = remainder.trim();
	} else {
		const stepIndex = raw.search(/\nSteps:/);
		if (stepIndex !== -1) {
			prompt = raw.slice(0, stepIndex).trim();
			parameterLine = raw.slice(stepIndex + 1).trim();
		}
	}
	const params = {};
	parameterLine.replace(/([^,:\n]+):\s*([^,\n]+)/g, (_, key, value) => {
		params[key.trim()] = value.trim();
		return "";
	});
	return {
		source,
		prompt,
		negativePrompt,
		params,
		rawParameters: raw,
		rawChunks: chunks
	};
}
//#endregion
//#region src/generators/invokeai.ts
function parseInvokeAI(chunks) {
	const raw = chunks.invokeai_metadata ?? chunks["sd-metadata"] ?? chunks.Dream ?? "{}";
	return {
		source: "InvokeAI",
		data: (() => {
			try {
				return JSON.parse(raw);
			} catch {
				return { raw };
			}
		})(),
		rawChunks: chunks
	};
}
//#endregion
//#region src/generators/swarmui.ts
function parseSwarmUI(chunks) {
	const raw = chunks.sui_image_params ?? "{}";
	return {
		source: "SwarmUI",
		data: (() => {
			try {
				return JSON.parse(raw);
			} catch {
				return { raw };
			}
		})(),
		rawChunks: chunks
	};
}
//#endregion
//#region src/generators/novelai.ts
function parseNovelAI(chunks) {
	const prompt = chunks.Description ?? chunks.Title ?? "";
	const commentRaw = chunks.Comment ?? chunks.comment ?? "{}";
	return {
		source: "NovelAI",
		prompt,
		comment: (() => {
			try {
				return JSON.parse(commentRaw);
			} catch {
				return { raw: commentRaw };
			}
		})(),
		rawChunks: chunks
	};
}
//#endregion
//#region src/index.ts
const PNG_SIG = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
const latin1 = new TextDecoder("iso-8859-1");
function isPNG(bytes) {
	return PNG_SIG.every((value, index) => bytes[index] === value);
}
function isJPEG(bytes) {
	return bytes[0] === 255 && bytes[1] === 216;
}
function isWebP(bytes) {
	return bytes.length >= 12 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP";
}
function toArrayBuffer(input) {
	if (input instanceof ArrayBuffer) return input;
	return Uint8Array.from(input).buffer;
}
function detectSource(chunks) {
	if (chunks["cake:project"]) try {
		if (JSON.parse(chunks["cake:project"])?.generator === "Cake") return "Cake";
	} catch {}
	if (chunks.prompt || chunks.workflow) try {
		const data = JSON.parse(chunks.prompt ?? chunks.workflow ?? "");
		if (data && typeof data === "object" && !Array.isArray(data)) return "ComfyUI";
	} catch {}
	if (chunks.invokeai_metadata || chunks["sd-metadata"] || chunks.Dream) return "InvokeAI";
	if (chunks.sui_image_params) return "SwarmUI";
	if (chunks.parameters) {
		const parameters = chunks.parameters;
		if (/fooocus/i.test(parameters)) return "Fooocus";
		if (/forge|sd webui forge/i.test(parameters)) return "Forge";
		return "A1111";
	}
	const comment = chunks.Comment ?? chunks.comment;
	if (comment) try {
		const parsed = JSON.parse(comment);
		if (parsed && (parsed.steps !== void 0 || parsed.sampler !== void 0)) return "NovelAI";
	} catch {}
	return "Unknown";
}
async function parseImageMeta(input) {
	const buffer = toArrayBuffer(input);
	const bytes = new Uint8Array(buffer);
	let chunks = {};
	if (isPNG(bytes)) chunks = await extractPNGChunks(buffer);
	else if (isJPEG(bytes)) {
		const comment = extractJPEGUserComment(buffer);
		if (comment) chunks = chunksFromExifUserComment(comment);
	} else if (isWebP(bytes)) {
		const comment = extractWebPExifUserComment(buffer);
		if (comment) chunks = chunksFromExifUserComment(comment);
	} else {
		const text = latin1.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
		const markerIndex = text.indexOf("parameters");
		if (markerIndex !== -1) {
			const cleaned = text.slice(markerIndex + 10).split("\0").join("").trim();
			if (cleaned.length >= 10) chunks = { parameters: cleaned };
		}
	}
	const source = detectSource(chunks);
	switch (source) {
		case "Cake": return parseCake(chunks);
		case "ComfyUI": return parseComfyUI(chunks);
		case "A1111":
		case "Forge":
		case "Fooocus": return parseA1111Style(source, chunks);
		case "InvokeAI": return parseInvokeAI(chunks);
		case "SwarmUI": return parseSwarmUI(chunks);
		case "NovelAI": return parseNovelAI(chunks);
		default: return {
			source: "Unknown",
			rawChunks: chunks
		};
	}
}
//#endregion
export { parseImageMeta };

//# sourceMappingURL=index.mjs.map