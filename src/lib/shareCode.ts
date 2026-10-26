import { decodeHouse, encodeHouse, type SharedHouse } from "../engine/houseShare";
import type { HouseContent } from "../engine/types";

// Share codes as players see them: "RRH1." and the house's compact JSON
// (engine/houseShare.ts), deflated and base64url'd so it copies cleanly.
// "RRH0." is the same JSON uncompressed, for browsers without
// CompressionStream. Codes are untrusted: decoding goes through
// decodeHouse, which checks everything against content.

const COMPRESSED = "RRH1.";
const PLAIN = "RRH0.";
/** Longest code accepted, so a pasted novel can't hang the page. */
export const MAX_CODE_LENGTH = 20_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Most bytes a code may expand to: far more than any real house. */
const MAX_JSON_BYTES = 200_000;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error("Code too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The share code for a house. */
export async function toShareCode(house: SharedHouse): Promise<string> {
  const json = new TextEncoder().encode(encodeHouse(house));
  if (typeof CompressionStream === "undefined") return PLAIN + toBase64Url(json);
  return COMPRESSED + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Reads a pasted code (spaces and line breaks are ignored), or null. */
export async function fromShareCode(code: string, content: HouseContent): Promise<SharedHouse | null> {
  const text = code.replace(/\s+/g, "");
  if (text.length > MAX_CODE_LENGTH) return null;
  try {
    if (text.startsWith(PLAIN)) return decodeHouse(new TextDecoder().decode(fromBase64Url(text.slice(PLAIN.length))), content);
    if (text.startsWith(COMPRESSED)) {
      if (typeof DecompressionStream === "undefined") return null;
      const bytes = await pipe(fromBase64Url(text.slice(COMPRESSED.length)), new DecompressionStream("deflate-raw"));
      return decodeHouse(new TextDecoder().decode(bytes), content);
    }
  } catch {
    return null;
  }
  return null;
}
