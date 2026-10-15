export interface NormalizedTamil {
  norm: string;
  normNospace: string;
}

const TAMIL_OR_SPACE = /[^\u0B80-\u0BFF\s]/gu;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/gu;
const GRAPHEME = /[\u0B85-\u0B94\u0B83]|[\u0B95-\u0BB9][\u0BBE-\u0BCD\u0BD7]?|./gu;

export function normalizeTamil(input: string): NormalizedTamil {
  const norm = input
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(TAMIL_OR_SPACE, "")
    .replace(/\s+/gu, " ")
    .trim();
  return { norm, normNospace: norm.replace(/\s/gu, "") };
}

export function splitGraphemes(input: string): string[] {
  return input.match(GRAPHEME) ?? [];
}

export function wordCount(input: string): number {
  const norm = normalizeTamil(input).norm;
  return norm ? norm.split(/\s+/u).length : 0;
}
