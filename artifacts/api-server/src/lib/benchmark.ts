import type {
  BenchmarkInput,
  BenchmarkMetric,
  BenchmarkResult,
  Kural,
  VerificationResult,
} from "@workspace/api-zod";
import { DECOYS, KURALS } from "./corpus";
import { splitGraphemes } from "./normalization";
import { verifyQuote } from "./verifier";

type ClassName = "real" | "corrupted" | "spliced" | "fabricated" | "decoy";

interface Sample {
  truth: ClassName;
  text: string;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

function canonical(kural: Kural): string {
  return `${kural.line1}\n${kural.line2}`;
}

function addNoise(text: string, random: () => number): string {
  const punctuated = text.replace(/\n/u, random() > 0.5 ? "، " : "   ");
  return random() > 0.5 ? `“${punctuated}。”` : punctuated;
}

function corrupt(text: string, random: () => number): string {
  const graphemes = splitGraphemes(text);
  const edits = 1 + Math.floor(random() * 3);
  for (let edit = 0; edit < edits; edit += 1) {
    const index = Math.floor(random() * graphemes.length);
    const replacement = splitGraphemes(pick(KURALS, random).line1)[Math.floor(random() * 10)] ?? "ம்";
    const operation = random();
    if (operation < 0.3) {
      graphemes.splice(index, 1);
    } else if (operation < 0.6) {
      graphemes.splice(index, 0, replacement);
    } else {
      graphemes[index] = replacement === graphemes[index] ? "ம்" : replacement;
    }
  }
  return graphemes.join("");
}

function fabricate(kural: Kural, random: () => number): string {
  const sourceWords = canonical(kural).split(/\s+/u);
  const foreignWords = KURALS
    .filter((item) => item.number !== kural.number)
    .flatMap((item) => `${item.line1} ${item.line2}`.split(/\s+/u))
    .filter(Boolean);
  const indexes = sourceWords.map((_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j]!, indexes[i]!];
  }
  const count = Math.max(1, Math.ceil(sourceWords.length * 0.6));
  for (const target of indexes.slice(0, count)) {
    let replacement = pick(foreignWords, random);
    for (let attempt = 0; replacement === sourceWords[target] && attempt < 4; attempt += 1) {
      replacement = pick(foreignWords, random);
    }
    if (replacement === sourceWords[target]) replacement = `${replacement}ம்`;
    sourceWords[target] = replacement;
  }
  return sourceWords.join(" ");
}

function predictedClass(result: VerificationResult): ClassName {
  if (result.verdict === "VERIFIED" || result.verdict === "VERIFIED_FRAGMENT" || result.verdict === "WRONG_NUMBER") {
    return "real";
  }
  if (result.verdict === "MISQUOTED") return "corrupted";
  if (result.verdict === "SPLICED") return "spliced";
  if (result.verdict === "MISATTRIBUTED") return "decoy";
  return "fabricated";
}

const CLASSES: ClassName[] = ["real", "corrupted", "spliced", "fabricated", "decoy"];
const ACCEPTED = new Set(["VERIFIED", "VERIFIED_FRAGMENT", "WRONG_NUMBER"]);

export function runBenchmark(input: BenchmarkInput): BenchmarkResult {
  const random = randomGenerator(input.seed ?? 42);
  const samples: Sample[] = [];
  for (let index = 0; index < 200; index += 1) {
    samples.push({ truth: "real", text: addNoise(canonical(pick(KURALS, random)), random) });
    samples.push({ truth: "corrupted", text: corrupt(canonical(pick(KURALS, random)), random) });
    samples.push({ truth: "fabricated", text: fabricate(pick(KURALS, random), random) });
  }
  for (let index = 0; index < 100; index += 1) {
    const first = pick(KURALS, random);
    let second = pick(KURALS, random);
    while (second.number === first.number) second = pick(KURALS, random);
    samples.push({ truth: "spliced", text: `${first.line1}\n${second.line2}` });
  }
  for (const decoy of DECOYS) samples.push({ truth: "decoy", text: decoy.text });

  const matrix = CLASSES.map(() => CLASSES.map(() => 0));
  const correctCounts = new Map<ClassName, number>(CLASSES.map((name) => [name, 0]));
  const totals = new Map<ClassName, number>(CLASSES.map((name) => [name, 0]));
  let acceptedOutsideReal = 0;
  let negativeTotal = 0;
  let baselineCorrect = 0;
  let abstained = 0;
  const baselineConfusion = new Map<string, number>();

  for (const sample of samples) {
    const result = verifyQuote(sample.text, undefined, input.thresholds);
    const predicted = predictedClass(result);
    const truthIndex = CLASSES.indexOf(sample.truth);
    matrix[truthIndex]![CLASSES.indexOf(predicted)]! += 1;
    totals.set(sample.truth, (totals.get(sample.truth) ?? 0) + 1);
    if (predicted === sample.truth) correctCounts.set(sample.truth, (correctCounts.get(sample.truth) ?? 0) + 1);
    if (sample.truth === "fabricated" || sample.truth === "decoy") {
      negativeTotal += 1;
      if (ACCEPTED.has(result.verdict)) acceptedOutsideReal += 1;
    }
    if (result.verdict === "NOT_FOUND" || result.verdict === "TOO_SHORT") abstained += 1;

    // Deliberately weak reference baseline: accept the verifier's nearest fuzzy score at >= 0.6.
    const baselineAccept = result.confidence >= 0.6;
    if ((sample.truth === "real" && baselineAccept) || (sample.truth !== "real" && !baselineAccept)) {
      baselineCorrect += 1;
    }
    if (sample.truth === "fabricated" || sample.truth === "decoy") {
      baselineConfusion.set(sample.truth, (baselineConfusion.get(sample.truth) ?? 0) + Number(baselineAccept));
    }
  }

  const metrics: BenchmarkMetric[] = CLASSES.map((label) => {
    const count = totals.get(label) ?? 0;
    const correct = correctCounts.get(label) ?? 0;
    return { label, count, correct, accuracy: count ? correct / count : 0 };
  });
  const baselineNegativeTotal = (totals.get("fabricated") ?? 0) + (totals.get("decoy") ?? 0);
  const baselineFalseAccepts =
    (baselineConfusion.get("fabricated") ?? 0) + (baselineConfusion.get("decoy") ?? 0);

  return {
    total: samples.length,
    falseAcceptRate: negativeTotal ? acceptedOutsideReal / negativeTotal : 0,
    abstentionRate: samples.length ? abstained / samples.length : 0,
    metrics,
    matrix,
    baseline: {
      falseAcceptRate: baselineNegativeTotal ? baselineFalseAccepts / baselineNegativeTotal : 0,
      accuracy: samples.length ? baselineCorrect / samples.length : 0,
    },
  };
}
