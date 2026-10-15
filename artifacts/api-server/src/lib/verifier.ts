import type {
  DiffPart,
  Kural,
  NearestKural,
  Thresholds,
  VerificationResult,
} from "@workspace/api-zod";
import { DECOYS, KURALS, NORMALIZED_KURALS } from "./corpus";
import { normalizeTamil, splitGraphemes, wordCount } from "./normalization";

const DEFAULT_THRESHOLDS = {
  misquoteMin: Number(process.env.MISQUOTE_MIN ?? 0.8),
  spliceLineMin: Number(process.env.SPLICE_LINE_MIN ?? 0.9),
  decoyMin: Number(process.env.DECOY_MIN ?? 0.9),
};

interface TimedStage {
  stage: string;
  ms: number;
  detail: string;
}

interface Candidate extends NearestKural {
  fullScore: number;
  line1Score: number;
  line2Score: number;
}

function ngrams(value: string): Map<string, number> {
  const units = splitGraphemes(value);
  const counts = new Map<string, number>();
  for (let n = 2; n <= 4; n += 1) {
    for (let index = 0; index <= units.length - n; index += 1) {
      const gram = units.slice(index, index + n).join("");
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return counts;
}

const documentFrequency = new Map<string, number>();
const rawVectors = NORMALIZED_KURALS.map(({ normNospace }) => ngrams(normNospace));
for (const vector of rawVectors) {
  for (const gram of vector.keys()) {
    documentFrequency.set(gram, (documentFrequency.get(gram) ?? 0) + 1);
  }
}

function weightedVector(counts: Map<string, number>): Map<string, number> {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const result = new Map<string, number>();
  for (const [gram, count] of counts) {
    const idf = Math.log((KURALS.length + 1) / ((documentFrequency.get(gram) ?? 0) + 1)) + 1;
    result.set(gram, (count / total) * idf);
  }
  return result;
}

const tfidfVectors = rawVectors.map(weightedVector);
const tfidfNorms = tfidfVectors.map(vectorNorm);

function vectorNorm(vector: Map<string, number>): number {
  return Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(
  left: Map<string, number>,
  leftNorm: number,
  right: Map<string, number>,
  rightNorm: number,
): number {
  if (!leftNorm || !rightNorm) return 0;
  let dot = 0;
  for (const [key, value] of left) dot += value * (right.get(key) ?? 0);
  return dot / (leftNorm * rightNorm);
}

function editDistance(left: string[], right: string[]): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

function ratio(left: string, right: string): number {
  const a = splitGraphemes(left);
  const b = splitGraphemes(right);
  const denominator = Math.max(a.length, b.length);
  if (!denominator) return 1;
  return 1 - editDistance(a, b) / denominator;
}

function partialRatio(left: string, right: string): number {
  const a = splitGraphemes(left);
  const b = splitGraphemes(right);
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (!shorter.length) return 0;
  let best = 0;
  for (let start = 0; start <= longer.length - shorter.length; start += 1) {
    best = Math.max(best, ratio(shorter.join(""), longer.slice(start, start + shorter.length).join("")));
    if (best === 1) break;
  }
  return best;
}

function candidatesFor(queryNospace: string): Candidate[] {
  const queryVector = weightedVector(ngrams(queryNospace));
  const queryNorm = vectorNorm(queryVector);
  return tfidfVectors
    .map((vector, index) => ({
      index,
      lexical: cosineSimilarity(queryVector, queryNorm, vector, tfidfNorms[index] ?? 0),
    }))
    .sort((a, b) => b.lexical - a.lexical)
    .slice(0, 10)
    .map(({ index, lexical }) => {
      const { kural, normNospace } = NORMALIZED_KURALS[index];
      const line1 = normalizeTamil(kural.line1).normNospace;
      const line2 = normalizeTamil(kural.line2).normNospace;
      const fullScore = ratio(queryNospace, normNospace);
      const line1Score = partialRatio(queryNospace, line1);
      const line2Score = partialRatio(queryNospace, line2);
      const lineMax = Math.max(line1Score, line2Score);
      const score = Math.max(fullScore, fullScore * 0.6 + lineMax * 0.4);
      return { kural, score: Math.max(score, lexical * 0.7), label: "NOT a match", fullScore, line1Score, line2Score };
    })
    .sort((a, b) => b.score - a.score);
}

function diffGraphemes(input: string, canonical: string): DiffPart[] {
  const left = splitGraphemes(input);
  const right = splitGraphemes(canonical);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
  }
  const reversed: DiffPart[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      reversed.push({ type: "equal", text: left[i - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      reversed.push({ type: "sub", text: `${left[i - 1]} → ${right[j - 1]}` });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      reversed.push({ type: "del", text: left[i - 1] });
      i -= 1;
    } else {
      reversed.push({ type: "ins", text: right[j - 1] ?? "" });
      j -= 1;
    }
  }
  const ordered = reversed.reverse();
  const grouped: DiffPart[] = [];
  for (const part of ordered) {
    const last = grouped[grouped.length - 1];
    if (last && last.type === part.type && part.type !== "sub") {
      last.text += part.text;
    } else {
      grouped.push({ ...part });
    }
  }
  return grouped;
}

function makeBase(
  verdict: VerificationResult["verdict"],
  confidence: number,
  evidence: VerificationResult["evidence"],
  trace: TimedStage[],
  extra: Partial<VerificationResult> = {},
): VerificationResult {
  return {
    verdict,
    confidence,
    evidence,
    trace,
    nearest: [],
    splicedReferences: [],
    ...extra,
  };
}

function applyClaim(
  result: VerificationResult,
  claimedNumber: number | undefined,
): VerificationResult {
  if (claimedNumber === undefined) return result;
  result.claimedNumber = claimedNumber;
  if (result.kural) {
    result.claimCheck = result.kural.number === claimedNumber ? "OK" : "WRONG_NUMBER";
    if (
      result.claimCheck === "WRONG_NUMBER" &&
      (result.verdict === "VERIFIED" || result.verdict === "VERIFIED_FRAGMENT")
    ) {
      result.verdict = "WRONG_NUMBER";
      result.evidence = [
        ...result.evidence,
        { label: "Number mismatch", detail: `The text is Kural ${result.kural.number}, not ${claimedNumber}.` },
      ];
    }
  } else {
    result.claimCheck = "UNSUPPORTED_CLAIM";
  }
  return result;
}

function lineMatch(text: string): { kural: Kural; score: number } | null {
  const compact = normalizeTamil(text).normNospace;
  if (!compact) return null;
  let best: { kural: Kural; score: number } | null = null;
  for (const kural of KURALS) {
    const score = Math.max(
      ratio(compact, normalizeTamil(kural.line1).normNospace),
      ratio(compact, normalizeTamil(kural.line2).normNospace),
    );
    if (!best || score > best.score) best = { kural, score };
  }
  return best;
}

export function verifyQuote(
  text: string,
  claimedNumber?: number,
  overrides?: Thresholds,
): VerificationResult {
  const trace: TimedStage[] = [];
  const stage = (name: string, started: number, detail: string): void => {
    trace.push({ stage: name, ms: Math.max(0, Number((performance.now() - started).toFixed(2))), detail });
  };
  const preprocessStarted = performance.now();
  const normalized = normalizeTamil(text);
  const queryWords = wordCount(normalized.norm);
  const queryGraphemes = splitGraphemes(normalized.norm).length;
  stage("preprocess", preprocessStarted, `${queryWords} words, ${queryGraphemes} Tamil graphemes`);

  if (queryWords < 3 || queryGraphemes < 10) {
    const result = makeBase(
      "TOO_SHORT",
      0,
      [{ label: "Abstained", detail: "At least 3 words and 10 Tamil graphemes are required." }],
      trace,
      { message: "Too little text to verify safely." },
    );
    return applyClaim(result, claimedNumber);
  }

  const rawLines = text
    .split(/\r\n|[\n\r\u2028\u2029]/u)
    .filter((line) => line.trim().length > 0);
  if (rawLines.length > 2) {
    trace.push({
      stage: "format",
      ms: 0,
      detail: `Rejected ${rawLines.length} non-empty lines; a Tirukkural couplet has two lines.`,
    });
    const result = makeBase(
      "NOT_FOUND",
      0,
      [{ label: "Invalid couplet format", detail: "A Tirukkural couplet has two lines. Submit no more than two non-empty lines." }],
      trace,
      { message: "Cannot verify text with more than two non-empty lines." },
    );
    return applyClaim(result, claimedNumber);
  }

  const exactStarted = performance.now();
  const compactToKural = new Map(
    NORMALIZED_KURALS.map(({ normNospace, kural }) => [normNospace, kural]),
  );
  const exact = compactToKural.get(normalized.normNospace);
  if (exact) {
    stage("exact", exactStarted, "Spacing-insensitive full-couplet match.");
    const result = makeBase(
      "VERIFIED",
      1,
      [{ label: "Exact source match", detail: `Both lines match Kural ${exact.number} in the corpus.` }],
      trace,
      { kural: exact },
    );
    return applyClaim(result, claimedNumber);
  }

  const queryPadded = ` ${normalized.norm} `;
  const fragment = NORMALIZED_KURALS.find(({ norm, normNospace }) => {
    const hasWordBoundaries =
      queryWords >= 3 && ` ${norm} `.includes(queryPadded);
    const compactFragment =
      queryGraphemes >= 12 && normNospace.includes(normalized.normNospace);
    return hasWordBoundaries || compactFragment;
  });
  if (fragment) {
    const spacingDiffers = !fragment.norm.includes(normalized.norm);
    stage("exact", exactStarted, spacingDiffers ? "Tamil grapheme substring match; spacing differs." : "Word-boundary fragment match.");
    const result = makeBase(
      "VERIFIED_FRAGMENT",
      1,
      [{
        label: "Source fragment",
        detail: `The submitted text appears inside Kural ${fragment.kural.number}${spacingDiffers ? "; spacing differs." : "."}`,
      }],
      trace,
      { kural: fragment.kural },
    );
    return applyClaim(result, claimedNumber);
  }
  stage("exact", exactStarted, "No exact or fragment match.");

  const candidateStarted = performance.now();
  const candidates = candidatesFor(normalized.normNospace);
  stage("candidates", candidateStarted, `TF-IDF character n-grams retrieved ${candidates.length} candidates; reranked by grapheme similarity.`);
  const nearest: NearestKural[] = candidates
    .filter((candidate) => candidate.score >= 0.45)
    .slice(0, 5)
    .map(({ kural, score }) => ({ kural, score: Number(score.toFixed(4)), label: "NOT a match" }));

  const thresholds = {
    misquoteMin: overrides?.misquoteMin ?? DEFAULT_THRESHOLDS.misquoteMin,
    spliceLineMin: overrides?.spliceLineMin ?? DEFAULT_THRESHOLDS.spliceLineMin,
    decoyMin: overrides?.decoyMin ?? DEFAULT_THRESHOLDS.decoyMin,
  };

  const inputLines = text
    .split(/\r?\n/u)
    .map((line) => normalizeTamil(line).norm)
    .filter(Boolean);
  if (inputLines.length >= 2) {
    const spliceStarted = performance.now();
    const first = lineMatch(inputLines[0]);
    const second = lineMatch(inputLines[1]);
    if (
      first && second &&
      first.score >= thresholds.spliceLineMin &&
      second.score >= thresholds.spliceLineMin &&
      first.kural.number !== second.kural.number
    ) {
      stage("splice", spliceStarted, `Input lines match different couplets (${first.kural.number} and ${second.kural.number}).`);
      const result = makeBase(
        "SPLICED",
        Math.min(first.score, second.score),
        [
          { label: "Line 1", detail: `Matches Kural ${first.kural.number}, not the second source.` },
          { label: "Line 2", detail: `Matches Kural ${second.kural.number}, not the first source.` },
        ],
        trace,
        { splicedReferences: [first.kural, second.kural], nearest },
      );
      return applyClaim(result, claimedNumber);
    }
    stage("splice", spliceStarted, "No two-line cross-couplet splice detected.");
  } else {
    trace.push({ stage: "splice", ms: 0, detail: "Skipped: fewer than two input lines." });
  }

  const decoyStarted = performance.now();
  let bestDecoy: { text: string; work: string; author: string; reference: string; score: number } | null = null;
  for (const decoy of DECOYS) {
    const decoyText = normalizeTamil(decoy.text).normNospace;
    const score = ratio(normalized.normNospace, decoyText);
    if (!bestDecoy || score > bestDecoy.score) bestDecoy = { ...decoy, score };
  }
  if (bestDecoy && bestDecoy.score >= thresholds.decoyMin) {
    stage("decoy", decoyStarted, `${bestDecoy.work} quote match; not part of the Tirukkural corpus.`);
    const result = makeBase(
      "MISATTRIBUTED",
      bestDecoy.score,
      [{ label: "Different source", detail: `${bestDecoy.reference} — ${bestDecoy.work}, ${bestDecoy.author}.` }],
      trace,
      {
        nearest,
        misattributedWork: bestDecoy.work,
        misattributedAuthor: bestDecoy.author,
        message: "This quotation is not from the Tirukkural.",
      },
    );
    return applyClaim(result, claimedNumber);
  }
  stage("decoy", decoyStarted, "No configured decoy-source match.");

  const best = candidates[0];
  const misquoteStarted = performance.now();
  if (best && best.score >= (overrides?.misquoteMin ?? DEFAULT_THRESHOLDS.misquoteMin)) {
    const canonical = normalizeTamil(`${best.kural.line1} ${best.kural.line2}`).norm;
    const result = makeBase(
      "MISQUOTED",
      best.score,
      [{
        label: "Closest source couplet",
        detail: `The text differs from Kural ${best.kural.number}; use the canonical source text shown.`,
      }],
      trace,
      {
        kural: best.kural,
        diff: diffGraphemes(normalized.norm, canonical),
        nearest,
        message: "This resembles a real couplet but does not match its source wording.",
      },
    );
    stage("misquote", misquoteStarted, `Best reranked candidate ${best.kural.number} scored ${best.score.toFixed(3)}.`);
    return applyClaim(result, claimedNumber);
  }
  stage("misquote", misquoteStarted, best ? `Best score ${best.score.toFixed(3)} is below the abstention threshold.` : "No candidate passed retrieval.");

  const result = makeBase(
    "NOT_FOUND",
    best?.score ?? 0,
    [{ label: "Abstained", detail: "No source-backed match met the verification threshold." }],
    trace,
    {
      nearest,
      message: "Cannot verify. Do not present this as a Tirukkural couplet.",
    },
  );
  return applyClaim(result, claimedNumber);
}

export function getVerifierThresholds(): Thresholds {
  return { ...DEFAULT_THRESHOLDS };
}
