import type { GuardResult, QuoteSegment } from "@workspace/api-zod";
import { KURAL_BY_NUMBER } from "./corpus";
import { verifyQuote } from "./verifier";

interface Span {
  start: number;
  end: number;
  open: string;
  close: string;
  text: string;
}

function findSpans(text: string): Span[] {
  const spans: Span[] = [];
  const quoted = /(["“‘«])([\s\S]+?)(["”’»])/gu;
  for (const match of text.matchAll(quoted)) {
    const start = match.index ?? 0;
    const full = match[0];
    spans.push({
      start,
      end: start + full.length,
      open: match[1],
      close: match[3],
      text: match[2],
    });
  }

  const tamilRun = /[\u0B80-\u0BFF][\u0B80-\u0BFF\s.,!?;:–—'"“”‘’()（）-]*/gu;
  for (const match of text.matchAll(tamilRun)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (spans.some((span) => start < span.end && end > span.start)) continue;
    const trimmed = match[0].trim();
    if (trimmed.split(/\s+/u).length >= 3) {
      const leading = match[0].indexOf(trimmed);
      spans.push({
        start: start + Math.max(leading, 0),
        end: start + Math.max(leading, 0) + trimmed.length,
        open: "",
        close: "",
        text: trimmed,
      });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

export function guardText(text: string): GuardResult {
  const spans = findSpans(text);
  const segments: QuoteSegment[] = [];
  let correctedText = text;
  let verified = 0;
  let removed = 0;
  let correctionCount = 0;
  for (const span of [...spans].reverse()) {
    const result = verifyQuote(span.text);
    const segment: QuoteSegment = {
      text: span.text,
      verdict: result.verdict,
      start: span.start,
      end: span.end,
      ...(result.kural ? { kuralNumber: result.kural.number } : {}),
    };
    segments.unshift(segment);

    let replacement = span.text;
    if (
      result.kural &&
      ["VERIFIED", "VERIFIED_FRAGMENT", "MISQUOTED", "WRONG_NUMBER"].includes(result.verdict)
    ) {
      const canonical = `${result.kural.line1}\n${result.kural.line2}`;
      replacement = `${span.open}${canonical}${span.close}`;
      if (result.verdict === "MISQUOTED") correctionCount += 1;
      else verified += 1;
    } else {
      replacement = "[unverified quote removed]";
      removed += 1;
    }
    correctedText =
      correctedText.slice(0, span.start) + replacement + correctedText.slice(span.end);
  }

  const summary = spans.length
    ? `${verified} source-backed, ${correctionCount} corrected, ${removed} removed`
    : "No Tamil quotation spans found.";
  return { segments, summary, correctedText };
}

export function safeCanonical(number: number): string | null {
  const kural = KURAL_BY_NUMBER.get(number);
  return kural ? `${kural.line1}\n${kural.line2}` : null;
}
