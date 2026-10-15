import type { KuralSearchResult, NearestKural } from "@workspace/api-zod";
import { KURALS } from "./corpus";
import { normalizeTamil } from "./normalization";

const SEARCH_STOP_WORDS = new Set([
  "the", "and", "or", "to", "of", "a", "an", "is", "in", "for", "with", "that",
  "what", "how", "which", "about", "meaning", "kural",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

function englishTerms(text: string): string[] {
  return tokenize(text);
}

const searchDocuments = KURALS.map((kural) => {
  const tokens = tokenize(`${kural.translation} ${kural.explanation ?? ""}`);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return { kural, tokens, counts };
});
const docFrequency = new Map<string, number>();
for (const document of searchDocuments) {
  for (const term of document.counts.keys()) {
    docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
  }
}
function idf(term: string): number {
  return Math.log((searchDocuments.length + 1) / ((docFrequency.get(term) ?? 0) + 1)) + 1;
}
function cosine(query: Map<string, number>, document: Map<string, number>): number {
  let dot = 0;
  let queryNorm = 0;
  let documentNorm = 0;
  for (const value of query.values()) queryNorm += value * value;
  for (const value of document.values()) documentNorm += value * value;
  for (const [term, value] of query) dot += value * (document.get(term) ?? 0);
  if (!queryNorm || !documentNorm) return 0;
  return dot / Math.sqrt(queryNorm * documentNorm);
}

export function searchCorpus(query: string): KuralSearchResult {
  const queryTokens = englishTerms(query);
  const queryCounts = new Map<string, number>();
  for (const token of queryTokens) queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);
  const queryWeights = new Map<string, number>();
  for (const [term, count] of queryCounts) {
    queryWeights.set(term, (count / Math.max(1, queryTokens.length)) * idf(term));
  }
  const tamilQuery = normalizeTamil(query).normNospace;
  const rows: Array<{ kural: (typeof KURALS)[number]; score: number }> = [];
  for (const document of searchDocuments) {
    const documentWeights = new Map<string, number>();
    for (const [term, count] of document.counts) {
      documentWeights.set(term, (count / Math.max(1, document.tokens.length)) * idf(term));
    }
    let score = cosine(queryWeights, documentWeights);
    if (tamilQuery) {
      const sourceText = normalizeTamil(`${document.kural.line1} ${document.kural.line2} ${document.kural.explanation ?? ""}`).normNospace;
      if (sourceText.includes(tamilQuery)) score = Math.max(score, 1);
    }
    if (score > 0) rows.push({ kural: document.kural, score });
  }
  rows.sort((a, b) => b.score - a.score || a.kural.number - b.kural.number);
  const results: NearestKural[] = rows.slice(0, 20).map(({ kural, score }) => ({
    kural,
    score: Number(score.toFixed(4)),
    label: "Meaning search result",
  }));
  return { results, total: rows.length };
}
