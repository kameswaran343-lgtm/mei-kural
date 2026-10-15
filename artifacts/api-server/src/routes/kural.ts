import { Router, type IRouter } from "express";
import {
  GetKuralParams,
  GetKuralHealthResponse,
  GetKuralResponse,
  GuardTextBody,
  GuardTextResponse,
  GuardedChatBody,
  GuardedChatResponse,
  ListKuralsQueryParams,
  ListKuralsResponse,
  RunBenchmarkBody,
  RunBenchmarkResponse,
  SearchKuralsBody,
  SearchKuralsResponse,
  VerifyKuralBody,
  VerifyKuralResponse,
} from "@workspace/api-zod";
import { runBenchmark } from "../lib/benchmark";
import { runGuardedChat } from "../lib/chat";
import {
  CORPUS_HASH,
  DEMO_CORPUS,
  KURAL_BY_NUMBER,
  KURALS,
} from "../lib/corpus";
import { guardText } from "../lib/guard";
import { normalizeTamil } from "../lib/normalization";
import { searchCorpus } from "../lib/search";
import { verifyQuote } from "../lib/verifier";

const router: IRouter = Router();
const PAGE_SIZE = 20;

router.get("/health", (_req, res): void => {
  const data = GetKuralHealthResponse.parse({
    status: "ok",
    count: KURALS.length,
    corpusHash: CORPUS_HASH,
    demoCorpus: DEMO_CORPUS,
  });
  res.json(data);
});

router.post("/verify", (req, res): void => {
  const input = VerifyKuralBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const result = VerifyKuralResponse.parse(
    verifyQuote(input.data.text, input.data.claimedNumber, input.data.thresholds),
  );
  res.json(result);
});

router.post("/guard", (req, res): void => {
  const input = GuardTextBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  res.json(GuardTextResponse.parse(guardText(input.data.text)));
});

router.post("/chat", (req, res): void => {
  const input = GuardedChatBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  res.json(GuardedChatResponse.parse(runGuardedChat(input.data.mode)));
});

router.post("/search", (req, res): void => {
  const input = SearchKuralsBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  res.json(SearchKuralsResponse.parse(searchCorpus(input.data.query)));
});

router.get("/kurals", (req, res): void => {
  const parsed = ListKuralsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { paal, adhikaram, q } = parsed.data;
  const page = parsed.data.page ?? 1;
  let results = KURALS;
  if (paal) results = results.filter((kural) => kural.paal === paal);
  if (adhikaram) results = results.filter((kural) => kural.adhikaramNo === adhikaram);
  if (q) {
    const normalizedQuery = normalizeTamil(q).normNospace;
    const englishQuery = q.toLowerCase().trim();
    results = results.filter((kural) => {
      const tamilSource = normalizeTamil(`${kural.line1} ${kural.line2}`).normNospace;
      const tamilExplanation = normalizeTamil(kural.explanation ?? "").normNospace;
      const english = `${kural.translation} ${kural.explanation ?? ""}`.toLowerCase();
      return (
        (normalizedQuery && (tamilSource.includes(normalizedQuery) || tamilExplanation.includes(normalizedQuery))) ||
        english.includes(englishQuery)
      );
    });
  }
  const total = results.length;
  const items = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  res.json(ListKuralsResponse.parse({ items, total, page, pageSize: PAGE_SIZE }));
});

router.get("/kurals/:number", (req, res): void => {
  const params = GetKuralParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const kural = KURAL_BY_NUMBER.get(params.data.number);
  if (!kural) {
    res.status(404).json({ error: "Kural not found." });
    return;
  }
  res.json(GetKuralResponse.parse(kural));
});

router.post("/benchmark/run", (req, res): void => {
  const input = RunBenchmarkBody.safeParse(req.body ?? {});
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  res.json(RunBenchmarkResponse.parse(runBenchmark(input.data)));
});

export default router;
