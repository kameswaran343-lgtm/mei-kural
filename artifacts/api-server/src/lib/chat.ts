import type { ChatResult } from "@workspace/api-zod";
import { DECOYS, KURAL_BY_NUMBER } from "./corpus";
import { verifyQuote } from "./verifier";

interface Scenario {
  id: string;
  label: string;
  quote: string;
  raw: (quote: string) => string;
  claimedNumber?: number;
}

const scenarios: Scenario[] = [
  {
    id: "1",
    label: "Misquoted couplet",
    quote: (() => {
      const kural = KURAL_BY_NUMBER.get(391)!;
      return `${kural.line1} ${kural.line2.replace(/தக$/u, "தக்க")}`;
    })(),
    raw: (quote) => `The Tirukkural says: “${quote}” (Kural 391).`,
  },
  {
    id: "2",
    label: "Misattributed Purananuru line",
    quote: DECOYS.find((item) => item.work === "Purananuru")?.text ?? "",
    raw: (quote) => `Valluvar wrote, “${quote}.”`,
  },
  {
    id: "3",
    label: "Fabricated quotation",
    quote: "தோல்வி என்பது வெற்றிக்கு முதல் படி",
    raw: (quote) => `The Tirukkural teaches: “${quote}.”`,
  },
  {
    id: "4",
    label: "Spliced lines",
    quote: `${KURAL_BY_NUMBER.get(391)!.line1}\n${KURAL_BY_NUMBER.get(396)!.line2}`,
    raw: (quote) => `Kural 391 reads: “${quote}.”`,
  },
  {
    id: "5",
    label: "Wrong couplet number",
    quote: `${KURAL_BY_NUMBER.get(616)!.line1}\n${KURAL_BY_NUMBER.get(616)!.line2}`,
    raw: (quote) => `Kural 618 says: “${quote}.”`,
    claimedNumber: 618,
  },
  {
    id: "6",
    label: "Correct couplet",
    quote: `${KURAL_BY_NUMBER.get(322)!.line1}\n${KURAL_BY_NUMBER.get(322)!.line2}`,
    raw: (quote) => `Kural 322 says: “${quote}.”`,
  },
];

function safeText(quote: string, claimedNumber?: number): {
  replacement: string;
  finding: string;
  correctedNumber?: number;
} {
  const result = verifyQuote(quote, claimedNumber);
  const finding = result.claimCheck === "WRONG_NUMBER"
    ? `WRONG_NUMBER — the couplet is Kural ${result.kural?.number}, not ${claimedNumber}.`
    : `${result.verdict}${result.kural ? ` — Kural ${result.kural.number}` : ""}`;
  if (
    result.kural &&
    ["VERIFIED", "VERIFIED_FRAGMENT", "MISQUOTED", "WRONG_NUMBER"].includes(result.verdict)
  ) {
    return {
      replacement: `${result.kural.line1}\n${result.kural.line2}`,
      finding,
      ...(result.claimCheck === "WRONG_NUMBER" ? { correctedNumber: result.kural.number } : {}),
    };
  }
  return { replacement: "[unverified quote removed]", finding };
}

export function runGuardedChat(mode?: string): ChatResult {
  const scenario = scenarios.find((item) => item.id === mode) ?? scenarios[0];
  const raw = scenario.raw(scenario.quote);
  const safe = safeText(scenario.quote, scenario.claimedNumber);
  let guarded = raw.replace(scenario.quote, safe.replacement);
  if (safe.correctedNumber) {
    guarded = guarded.replace(/Kural\s+\d+/u, `Kural ${safe.correctedNumber}`);
  }
  const findings = [
    scenario.label,
    safe.finding,
    "Guarded text uses only corpus wording or removes the unverified quote.",
  ];
  return { raw, guarded, findings };
}

export const CHAT_SCENARIOS = scenarios.map(({ id, label }) => ({ id, label }));
