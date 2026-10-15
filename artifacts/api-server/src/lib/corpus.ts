import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Kural } from "@workspace/api-zod";
import seed from "../../data/seed.json";
import decoyData from "../../data/decoys.json";
import { normalizeTamil, splitGraphemes } from "./normalization";

export interface Decoy {
  work: string;
  author: string;
  reference: string;
  text: string;
}

function paalFor(number: number): Kural["paal"] {
  if (number <= 380) return "Aram";
  if (number <= 1080) return "Porul";
  return "Inbam";
}

function toKural(raw: Record<string, unknown>): Kural | null {
  const number = Number(raw.number ?? raw.Number ?? raw.id);
  const line1 = String(raw.line1 ?? raw.Line1 ?? raw.line_1 ?? "").trim();
  const line2 = String(raw.line2 ?? raw.Line2 ?? raw.line_2 ?? "").trim();
  if (!Number.isInteger(number) || number < 1 || number > 1330 || !line1 || !line2) {
    return null;
  }
  return {
    number,
    line1,
    line2,
    paal: paalFor(number),
    adhikaramNo: Math.ceil(number / 10),
    translation: String(raw.translation ?? raw.Translation ?? raw.English ?? ""),
    explanation: String(
      raw.explanation ?? raw.Explanation ?? raw.mv ?? raw.sp ?? "",
    ),
  };
}

function corpusFile(): string {
  return path.resolve(__dirname, "../data/corpus.json");
}

function validateCorpus(entries: Kural[], allowSeed: boolean): void {
  if (allowSeed) {
    if (!entries.length || entries.some((entry) => !entry.line1 || !entry.line2)) {
      throw new Error("The demo seed corpus is empty or malformed.");
    }
    return;
  }
  if (entries.length !== 1330) {
    throw new Error(`Expected 1330 couplets; received ${entries.length}.`);
  }
  entries.forEach((entry, index) => {
    if (entry.number !== index + 1 || splitGraphemes(entry.line1).length === 0 ||
      splitGraphemes(entry.line2).length === 0) {
      throw new Error(`Corpus sequence or couplet validation failed at ${index + 1}.`);
    }
  });
}

function loadCorpus(): { entries: Kural[]; demo: boolean; hash: string } {
  let entries: Kural[] = [];
  let demo = false;
  try {
    const rawText = readFileSync(corpusFile(), "utf8");
    const parsed: unknown = JSON.parse(rawText);
    if (!Array.isArray(parsed)) throw new Error("Corpus JSON root must be an array.");
    entries = parsed
      .map((row) => (row && typeof row === "object" ? toKural(row as Record<string, unknown>) : null))
      .filter((row): row is Kural => row !== null)
      .sort((a, b) => a.number - b.number);
    validateCorpus(entries, false);
  } catch {
    demo = true;
    entries = (seed as Array<Record<string, unknown>>)
      .map(toKural)
      .filter((row): row is Kural => row !== null)
      .sort((a, b) => a.number - b.number);
    validateCorpus(entries, true);
  }
  const canonical = JSON.stringify(entries);
  return {
    entries,
    demo,
    hash: createHash("sha256").update(canonical).digest("hex"),
  };
}

const loaded = loadCorpus();

export const KURALS: Kural[] = loaded.entries;
export const DEMO_CORPUS = loaded.demo;
export const CORPUS_HASH = loaded.hash;
export const DECOYS = decoyData as Decoy[];
export const KURAL_BY_NUMBER = new Map(KURALS.map((kural) => [kural.number, kural]));
export const NORMALIZED_KURALS = KURALS.map((kural) => {
  const text = normalizeTamil(`${kural.line1} ${kural.line2}`);
  return { kural, ...text };
});
