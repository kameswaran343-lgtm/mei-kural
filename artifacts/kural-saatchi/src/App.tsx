import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetKuralHealth, useVerifyKural, useGuardText, useGuardedChat, useSearchKurals, useListKurals, useGetKural, getGetKuralQueryKey, useRunBenchmark } from '@workspace/api-client-react';
import type { VerificationResult, GuardResult, ChatResult, KuralSearchResult, BenchmarkResult, Kural } from '@workspace/api-client-react';
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Copy, Database, FileSearch, Fingerprint, FlaskConical, Gauge, History, Layers3, Menu, Moon, Search, Shield, ShieldCheck, Sun, X, ArrowRight, ExternalLink, Quote, AlertTriangle, CheckCircle2, XCircle, MinusCircle, CircleDot, RotateCcw } from 'lucide-react';
import html2canvas from 'html2canvas';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
type Tab = 'verify' | 'guard' | 'chat' | 'search' | 'browse' | 'benchmark' | 'how';
const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: 'verify', label: 'Verify', icon: ShieldCheck }, { id: 'guard', label: 'AI Guard', icon: Fingerprint },
  { id: 'chat', label: 'Guarded Chat', icon: Layers3 }, { id: 'search', label: 'Find a Kural', icon: Search },
  { id: 'browse', label: 'Browse', icon: BookOpen }, { id: 'benchmark', label: 'Benchmark Lab', icon: FlaskConical },
  { id: 'how', label: 'How it works', icon: CircleHelp },
];
const chatScenarios = [
  { id: '1', label: 'Misquoted' }, { id: '2', label: 'Misattributed' },
  { id: '3', label: 'Fabricated' }, { id: '4', label: 'Spliced' },
  { id: '5', label: 'Wrong number' }, { id: '6', label: 'Verified' },
];
type VerificationExample = { title: string; number: number | ''; text: string };
const verdictMeta: Record<string, { title: string; symbol: string; className: string; detail: string }> = {
  VERIFIED: { title: 'Verified', symbol: '✓', className: 'good', detail: 'Exact match in the source corpus' },
  VERIFIED_FRAGMENT: { title: 'Verified fragment', symbol: '◒', className: 'partial', detail: 'A contiguous fragment of a source couplet' },
  MISQUOTED: { title: 'Misquoted', symbol: '≠', className: 'warning', detail: 'A source match exists, but the wording differs' },
  SPLICED: { title: 'Spliced', symbol: '⧉', className: 'warning', detail: 'Text spans multiple source couplets' },
  MISATTRIBUTED: { title: 'Misattributed', symbol: '↗', className: 'warning', detail: 'The wording belongs to another work or author' },
  NOT_FOUND: { title: 'Not found', symbol: '∅', className: 'unknown', detail: 'No deterministic source match was found' },
  TOO_SHORT: { title: 'Too short', symbol: '—', className: 'unknown', detail: 'Not enough text to verify safely' },
  WRONG_NUMBER: { title: 'Wrong number', symbol: '≠', className: 'warning', detail: 'Claimed number does not match the source' },
  OK: { title: 'Claim supported', symbol: '✓', className: 'good', detail: 'Claim is supported by the source' },
  UNSUPPORTED_CLAIM: { title: 'Unsupported claim', symbol: '?', className: 'unknown', detail: 'The source does not support this claim' },
};
const fallbackMeta = { title: 'Unclassified', symbol: '?', className: 'unknown', detail: 'No matching verdict label was returned' };
const pct = (value: number | undefined) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

function App() {
  const [tab, setTab] = useState<Tab>('verify');
  const [theme, setTheme] = useState<'dark' | 'parchment'>(() => localStorage.getItem('kural-theme') === 'parchment' ? 'parchment' : 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const health = useGetKuralHealth();
  const source391 = useGetKural(391, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(391) } });
  const source396 = useGetKural(396, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(396) } });
  const source616 = useGetKural(616, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(616) } });
  const examples: VerificationExample[] = [
    { title: 'Authentic couplet', number: 391, text: source391.data ? `${source391.data.line1}\n${source391.data.line2}` : '' },
    { title: 'One word changed', number: 391, text: source391.data ? `${source391.data.line1}\n${source391.data.line2.replace(/தக\.?$/u, 'தக்க')}` : '' },
    { title: 'Lines spliced', number: 391, text: source391.data && source396.data ? `${source391.data.line1}\n${source396.data.line2}` : '' },
    { title: 'Misattributed line', number: '', text: 'யாதும் ஊரே யாவரும் கேளிர்' },
    { title: 'Unverifiable quote', number: '', text: 'தோல்வி என்பது வெற்றிக்கு முதல் படி' },
    { title: 'Wrong number', number: 618, text: source616.data ? `${source616.data.line1}\n${source616.data.line2}` : '' },
  ];
  const verify = useVerifyKural();
  const guard = useGuardText();
  const chat = useGuardedChat();
  const search = useSearchKurals();
  const benchmark = useRunBenchmark();
  const [quote, setQuote] = useState('');
  const [claimedNumber, setClaimedNumber] = useState('');
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [guardText, setGuardText] = useState('');
  const [guardResult, setGuardResult] = useState<GuardResult | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatMode, setChatMode] = useState('1');
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);
  const [chatView, setChatView] = useState<'guarded' | 'raw'>('guarded');
  const [meaningQuery, setMeaningQuery] = useState('');
  const [searchResult, setSearchResult] = useState<KuralSearchResult | null>(null);
  const [paal, setPaal] = useState('');
  const [adhikaram, setAdhikaram] = useState('');
  const [browseQuery, setBrowseQuery] = useState('');
  const [page, setPage] = useState(1);
  const [benchResult, setBenchResult] = useState<BenchmarkResult | null>(null);
  const [thresholds, setThresholds] = useState({ misquoteMin: 0.8, spliceLineMin: 0.9, decoyMin: 0.9 });
  const [history, setHistory] = useState<{ text: string; verdict: string; at: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('kural-history') || '[]') as { text: string; verdict: string; at: string }[]; } catch { return []; }
  });
  const [copyNote, setCopyNote] = useState('');
  const list = useListKurals({ ...(paal ? { paal: paal as 'Aram' | 'Porul' | 'Inbam' } : {}), ...(adhikaram ? { adhikaram: Number(adhikaram) } : {}), ...(browseQuery ? { q: browseQuery } : {}), page });

  useEffect(() => {
    document.documentElement.classList.toggle('parchment', theme === 'parchment');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('kural-theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('kural-history', JSON.stringify(history.slice(0, 8))); }, [history]);
  const changeTab = (id: Tab) => { setTab(id); setMobileNav(false); };
  const submitVerify = (text = quote, number = claimedNumber) => {
    if (!text.trim()) return;
    setQuote(text);
    verify.mutate({ data: { text, ...(number.trim() ? { claimedNumber: Number(number) } : {}) } }, {
      onSuccess: (result) => {
        setVerification(result);
        setHistory((old) => [{ text, verdict: result.verdict, at: new Date().toISOString() }, ...old].slice(0, 8));
      },
    });
  };
  const runGuard = () => { if (guardText.trim()) guard.mutate({ data: { text: guardText } }, { onSuccess: setGuardResult }); };
  const runChat = (mode = chatMode) => chat.mutate({ data: { message: chatText.trim() || 'Run the selected guarded-chat scenario.', mode } }, { onSuccess: setChatResult });
  const runSearch = () => { if (meaningQuery.trim()) search.mutate({ data: { query: meaningQuery } }, { onSuccess: setSearchResult }); };
  const runBenchmark = () => benchmark.mutate({ data: { thresholds } }, { onSuccess: setBenchResult });
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopyNote('Copied to clipboard'); window.setTimeout(() => setCopyNote(''), 1800); }
    catch { setCopyNote('Clipboard access unavailable'); window.setTimeout(() => setCopyNote(''), 2200); }
  };

  return <div className={`grain min-h-[100dvh] bg-background text-foreground ${theme === 'parchment' ? 'parchment' : ''}`}>
    <div className="app-frame">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>கு</span></div>
          <div><div className="brand-name">குறள் சாட்சி</div><div className="brand-sub">KURAL SAATCHI <span>·</span> SOURCE FIRST</div></div>
          <button className="icon-button close-mobile" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18}/></button>
        </div>
        <div className="nav-label">THE WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {tabs.map((item, i) => <button key={item.id} onClick={() => changeTab(item.id)} className={`nav-item ${tab === item.id ? 'active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} data-testid={`nav-${item.id}`}>
            <item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{i === 0 && <span className="nav-count">01</span>}
          </button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="corpus-mini">
            <div className="corpus-mini-top"><span className={`health-dot ${health.data?.status === 'ok' || health.data?.status === 'healthy' ? 'online' : ''}`}></span><span>Source corpus</span><span className="mono">{health.isLoading ? '…' : health.data?.count?.toLocaleString() ?? '—'}</span></div>
            <div className="corpus-hash">{health.data?.corpusHash ? `${health.data.corpusHash.slice(0, 12)}…` : 'Corpus status'}</div>
          </div>
          <div className="side-foot"><span>Evidence, never intuition.</span><span className="mono">v0.1</span></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation overlay" onClick={() => setMobileNav(false)} />}
      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
          <div className="topbar-crumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{tabs.find((t) => t.id === tab)?.label}</b></div>
          <div className="topbar-actions">
            <div className="corpus-status" aria-live="polite"><span className={`health-dot ${health.data?.status === 'ok' || health.data?.status === 'healthy' ? 'online' : ''}`}></span><span>{health.isLoading ? 'Checking corpus' : health.isError ? 'Corpus unavailable' : health.data?.demoCorpus ? 'Demo corpus' : 'Corpus connected'}</span></div>
            <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'parchment' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'parchment' : 'dark'} theme`} data-testid="button-theme"><span>{theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}</span><span>{theme === 'dark' ? 'Parchment' : 'Night'}</span></button>
          </div>
        </header>
        <div className="content-scroll">
          <div className="content-wrap fade-in" key={tab}>
            {health.data?.demoCorpus && <div className="demo-banner" role="status"><AlertTriangle size={15}/> DEMO CORPUS · Only {health.data.count} seeded couplets are loaded. Verification coverage is incomplete.</div>}
            {tab === 'verify' && <VerifyPage quote={quote} setQuote={setQuote} claimedNumber={claimedNumber} setClaimedNumber={setClaimedNumber} result={verification} loading={verify.isPending} error={verify.isError ? errorText(verify.error) : ''} submit={submitVerify} examples={examples} history={history} restore={(text) => { setQuote(text); submitVerify(text, ''); }} copy={copyText} corpusHash={health.data?.corpusHash ?? ''} />}
            {tab === 'guard' && <GuardPage value={guardText} setValue={setGuardText} result={guardResult} loading={guard.isPending} error={guard.isError ? errorText(guard.error) : ''} submit={runGuard} />}
            {tab === 'chat' && <ChatPage value={chatText} setValue={setChatText} result={chatResult} loading={chat.isPending} error={chat.isError ? errorText(chat.error) : ''} submit={runChat} mode={chatMode} setMode={setChatMode} view={chatView} setView={setChatView} />}
            {tab === 'search' && <SearchPage value={meaningQuery} setValue={setMeaningQuery} result={searchResult} loading={search.isPending} error={search.isError ? errorText(search.error) : ''} submit={runSearch} />}
            {tab === 'browse' && <BrowsePage query={browseQuery} setQuery={(v) => { setBrowseQuery(v); setPage(1); }} paal={paal} setPaal={(v) => { setPaal(v); setPage(1); }} adhikaram={adhikaram} setAdhikaram={(v) => { setAdhikaram(v); setPage(1); }} data={list.data} loading={list.isLoading} error={list.isError ? errorText(list.error) : ''} retry={() => void list.refetch()} page={page} setPage={setPage} />}
            {tab === 'benchmark' && <BenchmarkPage result={benchResult} loading={benchmark.isPending} error={benchmark.isError ? errorText(benchmark.error) : ''} thresholds={thresholds} setThresholds={setThresholds} submit={(value) => benchmark.mutate({ data: { thresholds: value ?? thresholds } }, { onSuccess: setBenchResult })} />}
            {tab === 'how' && <HowPage/>}
          </div>
        </div>
        <footer className="global-footer"><span><span className="footer-seal">●</span> Tirukkural source corpus · {health.data?.count ?? '—'} couplets validated at startup · <a href="/docs">How verification works</a></span><span className="mono hash-footer" title={health.data?.corpusHash ?? 'Corpus hash unavailable'}>SHA-256 {health.data?.corpusHash ?? '—'}</span></footer>
      </main>
      {copyNote && <div className="toast-note" role="status">{copyNote}</div>}
    </div>
  </div>;
}

function PageHeading({ eyebrow, title, description, right }: { eyebrow: string; title: string; description: string; right?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{right && <div className="heading-action">{right}</div>}</div>;
}
function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) { return <div className="section-title"><h2>{children}</h2>{extra}</div>; }
function LoadingBlock({ label = 'Reading source records' }: { label?: string }) { return <div className="loading-state" role="status"><span className="skeleton-line wide"/><span className="skeleton-line"/><span className="loading-caption"><span className="health-dot online"/>{label}…</span></div>; }
function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state-card error-state" role="alert"><AlertTriangle size={19}/><div><b>Could not load this evidence</b><p>{message}</p></div>{retry && <button className="button secondary small" onClick={retry}><RotateCcw size={14}/> Retry</button>}</div>; }
function EmptyState({ icon: Icon = FileSearch, title, body }: { icon?: typeof Search; title: string; body: string }) { return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><b>{title}</b><p>{body}</p></div>; }
function Button({ children, onClick, disabled, kind = 'primary', type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet'; type?: 'button' | 'submit'; className?: string }) { return <button type={type} disabled={disabled} onClick={onClick} className={`button ${kind} ${className}`}>{children}</button>; }
function VerdictBadge({ verdict }: { verdict: string }) { const meta = verdictMeta[verdict] ?? fallbackMeta; return <span className={`verdict-badge ${meta.className}`} aria-label={`Verdict: ${verdict}`}><span aria-hidden="true">{meta.symbol}</span><span>{verdict}</span></span>; }

function VerifyPage({ quote, setQuote, claimedNumber, setClaimedNumber, result, loading, error, submit, examples: examplesList, history, restore, copy, corpusHash }: { quote: string; setQuote: (v: string) => void; claimedNumber: string; setClaimedNumber: (v: string) => void; result: VerificationResult | null; loading: boolean; error: string; submit: (text?: string, number?: string) => void; examples: VerificationExample[]; history: { text: string; verdict: string; at: string }[]; restore: (text: string) => void; copy: (text: string) => void; corpusHash: string }) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [certificateBusy, setCertificateBusy] = useState(false);
  const [certificateError, setCertificateError] = useState('');
  const downloadCertificate = async () => {
    if (!result?.kural || !certificateRef.current) return;
    setCertificateBusy(true);
    setCertificateError('');
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(certificateRef.current, { backgroundColor: '#10172a', scale: 2, useCORS: true });
      const anchor = document.createElement('a');
      anchor.download = `kural-saatchi-${result.kural.number}.png`;
      anchor.href = canvas.toDataURL('image/png');
      anchor.click();
    } catch {
      setCertificateError('The certificate image could not be created. Try again after the page fonts load.');
    } finally {
      setCertificateBusy(false);
    }
  };
  const meta = result ? verdictMeta[result.verdict] ?? fallbackMeta : null;
  return <>
    <PageHeading eyebrow="SOURCE VERIFICATION / 01" title="Prove the quotation." description="A quote is verified only when it matches the Tirukkural source. No match? We abstain." right={<span className="trust-pill"><Database size={14}/> Source corpus · 1,330 couplets</span>}/>
    <div className="verify-grid">
      <div className="primary-column">
        <Panel className="input-panel">
          <div className="panel-kicker"><span className="step-number">01</span><div><b>Enter a quotation</b><small>Paste the Tamil text exactly as it was shared.</small></div><span className="mono char-count">{quote.length.toLocaleString()} / 10,000</span></div>
          <label className="sr-only" htmlFor="quote-input">Tamil quotation</label>
          <textarea id="quote-input" data-testid="input-quote" className="quote-input tamil" dir="auto" placeholder="சரிபார்க்க வேண்டிய குறளை இங்கே உள்ளிடவும்…" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={10000} />
          <div className="input-bottom"><div className="number-input-wrap"><label htmlFor="number-input">Claimed kural no.</label><input id="number-input" data-testid="input-claimed-number" type="number" min={1} max={1330} placeholder="Optional" value={claimedNumber} onChange={(e) => setClaimedNumber(e.target.value)}/></div><Button onClick={() => submit()} disabled={loading || !quote.trim()}><ShieldCheck size={16}/>{loading ? 'Checking source…' : 'Verify quotation'}<ArrowRight size={15}/></Button></div>
          {loading && <div className="progress-line" aria-label="Verifying quotation"><span/></div>}
          {error && <ErrorState message={error} retry={() => submit()}/>}
          <div className="deterministic-note"><Fingerprint size={15}/><span>Exact and normalized text matching against the source corpus. No generated confidence.</span></div>
        </Panel>
        <div className="examples-section">
          <SectionTitle extra={<span className="subtle-label">TRY A REFERENCE TEST</span>}>Six verification examples</SectionTitle>
          <div className="example-grid">{examplesList.map((item, i) => <button className="example-tile" key={`${item.title}-${i}`} disabled={!item.text} onClick={() => { setQuote(item.text); setClaimedNumber(String(item.number)); }} data-testid={`example-${i + 1}`}><span className="example-index">0{i + 1}</span><span className="example-name">{item.title}</span><span className="example-tamil tamil" dir="auto">{item.text || 'Loading canonical source text…'}</span><span className="example-num mono">{item.number ? `CLAIM #${item.number}` : 'NO CLAIM'} <ArrowRight size={13}/></span></button>)}</div>
        </div>
        {history.length > 0 && <Panel className="history-panel"><SectionTitle extra={<span className="mono subtle-label">LOCAL ONLY · {history.length}</span>}>Recent checks</SectionTitle><div className="history-list">{history.slice(0, 4).map((item, i) => <button key={`${item.at}-${i}`} className="history-row" onClick={() => restore(item.text)}><History size={15}/><span className="history-text tamil" dir="auto">{item.text.replace(/\n/g, ' ')}</span><VerdictBadge verdict={item.verdict}/><span className="history-time">{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></button>)}</div></Panel>}
      </div>
      <div className="evidence-column">
        {!result && !loading && <div className="evidence-intro"><div className="seal-large"><span>கு</span><i/></div><div className="evidence-intro-label">THE STANDARD OF PROOF</div><h2>Show the line.<br/><em>Not a score.</em></h2><p>Kural Saatchi compares the submitted text against the canonical corpus and returns the source evidence behind every verdict.</p><div className="intro-rule"/><div className="intro-meta"><span><CheckCircle2 size={15}/> Corpus-grounded</span><span><XCircle size={15}/> Abstains on uncertainty</span></div></div>}
        {loading && <Panel><LoadingBlock label="Comparing against the corpus"/></Panel>}
        {result && meta && <Panel className={`result-card ${meta.className}`} aria-live="polite">
          <div className="result-topline"><span className="subtle-label">VERIFICATION RESULT</span><span className="mono result-id">KURAL SAATCHI / 01</span></div>
          <div className="result-verdict"><div className="verdict-symbol" aria-hidden="true">{meta.symbol}</div><div><VerdictBadge verdict={result.verdict}/><h2>{meta.title}</h2><p>{meta.detail}</p></div></div>
          {result.message && <p className="result-message">{result.message}</p>}
          {result.claimCheck && <div className="claim-check"><span className="subtle-label">NUMBER CLAIM</span><VerdictBadge verdict={result.claimCheck}/>{result.claimedNumber && <span className="mono">Claimed #{result.claimedNumber}</span>}</div>}
          <div className="confidence-meter"><div className="confidence-heading"><span className="subtle-label">MATCH SIGNAL · NOT A PROBABILITY</span><span className="mono">{pct(result.confidence)}</span></div><div className="confidence-track" role="meter" aria-label="Deterministic match signal" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.max(0, Math.min(1, result.confidence))}><span style={{ width: `${Math.max(0, Math.min(100, result.confidence * 100))}%` }}/></div><small>Similarity supports triage; only source matching determines the verdict.</small></div>
          {result.kural && <div className="source-block"><div className="source-title"><span className="subtle-label">MATCHED SOURCE</span><span className="mono source-number">NO. {result.kural.number}</span></div><KuralText kural={result.kural}/><div className="source-actions"><button className="copy-source" onClick={() => copy(`${result.kural?.line1}\n${result.kural?.line2}`)}><Copy size={13}/> Copy source couplet</button><Button kind="secondary" className="small" onClick={() => void downloadCertificate()} disabled={certificateBusy}><FileSearch size={14}/>{certificateBusy ? 'Preparing PNG…' : 'Download certificate PNG'}</Button></div>{certificateError && <p className="certificate-error" role="alert">{certificateError}</p>}<div className="certificate-render" ref={certificateRef} aria-hidden="true"><div className="certificate-frame"><div className="certificate-top">KURAL SAATCHI <span>குறள் சாட்சி</span></div><div className="certificate-rule"/><div className="certificate-label">SOURCE VERIFICATION CERTIFICATE</div><h2>Verified against the Tirukkural</h2><div className="certificate-number">Kural {result.kural.number} · {result.kural.paal} · Chapter {result.kural.adhikaramNo}</div><p className="certificate-tamil">{result.kural.line1}<br/>{result.kural.line2}</p><p className="certificate-translation">{result.kural.translation}</p><div className="certificate-rule"/><div className="certificate-footer"><span>SHA-256 · {corpusHash || 'unavailable'}</span><span>{new Date().toLocaleString()}</span></div></div></div></div>}
          {result.diff && result.diff.length > 0 && <div className="diff-block"><div className="subtle-label">WORDING COMPARISON</div><p className="diff-content tamil" dir="auto">{result.diff.map((part, i) => <span key={`${part.type}-${i}`} className={`diff-${part.type}`}>{part.text}</span>)}</p><div className="diff-legend"><span><i className="diff-swatch equal"/> Matched</span><span><i className="diff-swatch sub"/> Changed</span><span><i className="diff-swatch ins"/> Added</span></div></div>}
          {result.splicedReferences?.length > 0 && <div className="spliced-block"><div className="subtle-label">SOURCE REFERENCES</div>{result.splicedReferences.map((k) => <div className="source-ref" key={k.number}><span className="mono">#{k.number}</span><span className="tamil" dir="auto">{k.line1} / {k.line2}</span></div>)}</div>}
          {result.evidence?.length > 0 && <div className="evidence-list"><div className="subtle-label">EVIDENCE</div>{result.evidence.map((e, i) => <div className="evidence-row" key={`${e.label}-${i}`}><span className="evidence-check"><Check size={12}/></span><div><b>{e.label}</b><p>{e.detail}</p></div></div>)}</div>}
          {result.nearest?.length > 0 && <div className="nearest-list"><div className="subtle-label">NEAREST SOURCE MATCHES</div>{result.nearest.map((n) => <div className="nearest-row" key={n.kural.number}><div className="nearest-text"><span className="mono">#{n.kural.number}</span><p className="tamil" dir="auto">{n.kural.line1}<br/>{n.kural.line2}</p></div><div className="nearest-score"><b>{n.label}</b><span className="mono">{pct(n.score)}</span></div></div>)}</div>}
          {result.trace?.length > 0 && <details className="trace-details"><summary><span><Clock3 size={14}/> Matching trace</span><span className="mono">{result.trace.length} stages</span></summary><div className="trace-list">{result.trace.map((stage, i) => <div className="trace-row" key={`${stage.stage}-${i}`}><span className="trace-node">{String(i + 1).padStart(2, '0')}</span><span className="trace-stage">{stage.stage}</span><span>{stage.detail}</span><span className="mono">{stage.ms} ms</span></div>)}</div></details>}
          {!result.kural && result.evidence?.length === 0 && result.nearest?.length === 0 && <div className="no-evidence"><MinusCircle size={16}/><span>No source evidence returned. The system does not infer a match.</span></div>}
        </Panel>}
      </div>
    </div>
  </>;
}

function KuralText({ kural }: { kural: Kural }) { return <div className="kural-lines tamil" dir="auto"><span>{kural.line1}</span><span>{kural.line2}</span><div className="kural-meta">{kural.paal} <i/> Chapter {kural.adhikaramNo}</div>{kural.translation && <p className="translation">{kural.translation}</p>}{kural.explanation && <p className="explanation">{kural.explanation}</p>}</div>; }

function GuardPage({ value, setValue, result, loading, error, submit }: { value: string; setValue: (v: string) => void; result: GuardResult | null; loading: boolean; error: string; submit: () => void }) {
  const [actionNote, setActionNote] = useState('');
  const copyCorrected = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.correctedText);
      setActionNote('Corrected text copied');
    } catch {
      setActionNote('Clipboard access unavailable');
    }
  };
  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'kural-saatchi-guard-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <><PageHeading eyebrow="QUOTE-AWARE TEXT / 02" title="Keep quotes accountable." description="Paste a paragraph. Detected quotation spans are checked against the source, individually."/>
    <div className="tool-layout"><div className="primary-column"><Panel className="input-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>Text to inspect</b><small>Up to 30,000 characters. Non-quote prose remains untouched.</small></div><span className="mono char-count">{value.length.toLocaleString()} / 30,000</span></div><label className="sr-only" htmlFor="guard-input">Paragraph to check</label><textarea id="guard-input" data-testid="input-guard-text" className="quote-input paragraph-input" placeholder="Paste a paragraph containing quotations…" value={value} onChange={(e) => setValue(e.target.value)} maxLength={30000}/><div className="input-bottom"><span className="deterministic-note inline"><Fingerprint size={15}/> Per-quote corpus verification</span><Button onClick={submit} disabled={loading || !value.trim()}><Shield size={15}/>{loading ? 'Inspecting text…' : 'Inspect paragraph'}<ArrowRight size={15}/></Button></div>{error && <ErrorState message={error} retry={submit}/>}</Panel>
      {loading && <Panel><LoadingBlock label="Finding and checking quotation spans"/></Panel>}
      {result && <Panel className="result-card guard-results"><div className="result-topline"><span className="subtle-label">PARAGRAPH FINDINGS</span><span className="mono">{result.segments.length} SEGMENTS</span></div><h2 className="result-heading">{result.summary}</h2><div className="segment-list">{result.segments.map((segment, i) => <article className="segment-card" key={`${segment.start}-${segment.end}-${i}`}><div className="segment-head"><span className="mono segment-range">SPAN {String(i + 1).padStart(2, '0')} · {segment.start}–{segment.end}</span><VerdictBadge verdict={segment.verdict}/></div><blockquote className="segment-quote tamil" dir="auto">“{segment.text}”</blockquote>{segment.kuralNumber && <div className="segment-kural"><BookOpen size={14}/> Matched to Kural <b>{segment.kuralNumber}</b></div>}</article>)}</div><div className="corrected-box"><div className="corrected-head"><div><span className="subtle-label">CORRECTED RESULT</span><p>Guarded text with unsupported quotation claims handled.</p></div></div><div className="corrected-text">{result.correctedText}</div><div className="download-actions"><Button kind="secondary" className="small" onClick={() => void copyCorrected()}><Copy size={14}/>Copy corrected text</Button><Button kind="secondary" className="small" onClick={downloadReport}><FileSearch size={14}/>Download report JSON</Button>{actionNote && <span role="status" className="action-note">{actionNote}</span>}</div></div></Panel>}
      {!result && !loading && <div className="quiet-note"><Quote size={17}/><span>Only detected quote spans are evaluated. The service reports its own findings and corrected text.</span></div>}</div>
      <aside className="side-note"><div className="side-note-icon"><Fingerprint size={19}/></div><span className="eyebrow">SPAN-BY-SPAN</span><h3>One paragraph.<br/>Many claims.</h3><p>Every quotation is surfaced as its own segment with a source verdict. A supported neighboring quote cannot lend credibility to an unsupported one.</p><div className="mini-process"><span>Text</span><i/><span>Quote spans</span><i/><span>Source verdicts</span></div></aside></div>
  </>;
}

function ChatPage({ value, setValue, result, loading, error, submit, mode, setMode, view, setView }: { value: string; setValue: (v: string) => void; result: ChatResult | null; loading: boolean; error: string; submit: () => void; mode: string; setMode: (v: string) => void; view: 'guarded' | 'raw'; setView: (v: 'guarded' | 'raw') => void }) {
  return <><PageHeading eyebrow="GROUNDED RESPONSE / 03" title="Compare the guard." description="See raw output beside the guarded version, with findings that explain what changed."/>
    <div className="chat-layout"><div className="primary-column"><Panel className="input-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>Choose a test scenario</b><small>Simulator mode compares a canned raw response with the real verifier.</small></div></div><div className="scenario-strip" role="group" aria-label="Guarded chat scenario">{chatScenarios.map((scenario) => <button key={scenario.id} className={`scenario-chip ${mode === scenario.id ? 'selected' : ''}`} aria-pressed={mode === scenario.id} onClick={() => setMode(scenario.id)}>{scenario.label}</button>)}</div><label className="sr-only" htmlFor="chat-input">Optional context</label><textarea id="chat-input" data-testid="input-chat" className="chat-input" placeholder="Optional context for the demonstration…" value={value} onChange={(e) => setValue(e.target.value)} maxLength={10000}/><div className="input-bottom"><span className="deterministic-note inline"><Command size={15}/> Simulator only · raw output is explicitly unverified</span><Button onClick={submit} disabled={loading}>{loading ? 'Comparing…' : 'Run comparison'}<ArrowRight size={15}/></Button></div>{error && <ErrorState message={error} retry={submit}/>}</Panel>
      {loading && <Panel><LoadingBlock label="Preparing guarded comparison"/></Panel>}
      {result && <><div className="view-switch" role="tablist" aria-label="Response view"><button role="tab" aria-selected={view === 'guarded'} className={view === 'guarded' ? 'selected' : ''} onClick={() => setView('guarded')}><ShieldCheck size={15}/> Guarded</button><button role="tab" aria-selected={view === 'raw'} className={view === 'raw' ? 'selected' : ''} onClick={() => setView('raw')}>Raw <span className="raw-warning">UNVERIFIED</span></button></div><Panel className={`chat-output ${view === 'raw' ? 'raw-output' : ''}`}><div className="result-topline"><span className="subtle-label">{view === 'guarded' ? 'GUARDED RESPONSE' : 'RAW RESPONSE'}</span>{view === 'raw' && <span className="raw-warning">NOT SOURCE-CHECKED</span>}</div><p>{view === 'guarded' ? result.guarded : result.raw}</p></Panel><Panel className="findings-panel"><SectionTitle extra={<span className="mono subtle-label">{result.findings.length} FINDINGS</span>}>What the guard found</SectionTitle>{result.findings.length ? <ul className="finding-list">{result.findings.map((finding, i) => <li key={`${i}-${finding}`}><span className="finding-index">{String(i + 1).padStart(2, '0')}</span><span>{finding}</span></li>)}</ul> : <EmptyState icon={CheckCircle2} title="No findings returned" body="The guarded comparison included no finding details."/>}</Panel></>}
      {!result && !loading && <div className="quiet-note"><ShieldCheck size={17}/><span>Raw output is provided for contrast only. Use the guarded result when evidence matters.</span></div>}</div>
      <aside className="side-note chat-side"><div className="side-note-icon"><Layers3 size={19}/></div><span className="eyebrow">TWO OUTPUTS</span><h3>Readable.<br/>Then accountable.</h3><p>The raw response is shown as returned. The guarded response is constrained by quotation checks; inspect the findings to see why.</p><div className="legend-line"><span className="legend-square guarded-square"/> Source checked</div><div className="legend-line"><span className="legend-square raw-square"/> No source check</div></aside></div>
  </>;
}

function SearchPage({ value, setValue, result, loading, error, submit }: { value: string; setValue: (v: string) => void; result: KuralSearchResult | null; loading: boolean; error: string; submit: () => void }) {
  return <><PageHeading eyebrow="MEANING SEARCH / 04" title="Find a Kural." description="Search by meaning or theme. Results are real couplets from the connected corpus."/>
    <Panel className="search-panel"><form className="search-form" onSubmit={(e) => { e.preventDefault(); submit(); }}><label className="sr-only" htmlFor="meaning-search">Search by meaning</label><Search size={20}/><input id="meaning-search" data-testid="input-meaning-search" placeholder="Try: kindness, patience, friendship…" value={value} onChange={(e) => setValue(e.target.value)}/><Button type="submit" disabled={loading || !value.trim()}>{loading ? 'Searching…' : 'Search'}<ArrowRight size={15}/></Button></form><div className="search-tip"><span className="eyebrow">SEARCH THE MEANING, NOT JUST THE WORDING</span><span className="mono">SOURCE CORPUS ONLY</span></div></Panel>
    {error && <ErrorState message={error} retry={submit}/>}
    {loading && <div className="result-grid">{[0,1,2].map((i) => <Panel key={i}><LoadingBlock label="Searching source couplets"/></Panel>)}</div>}
    {result && !loading && <div className="search-results"><div className="results-summary"><div><span className="eyebrow">SOURCE MATCHES</span><h2>{result.total.toLocaleString()} {result.total === 1 ? 'Kural' : 'Kurals'} found</h2></div><span className="mono">QUERY / {value}</span></div>{result.results.length ? <div className="result-grid">{result.results.map((item) => <Panel className="search-result-card" key={item.kural.number}><div className="search-result-head"><span className="mono">KURAL {item.kural.number}</span><span className="match-label">{item.label} <b>{pct(item.score)}</b></span></div><KuralText kural={item.kural}/></Panel>)}</div> : <EmptyState icon={Search} title="No source matches" body="No couplets were returned for this meaning search. Try a different phrasing."/>}</div>}
    {!result && !loading && !error && <div className="search-empty-plate"><div className="search-ornament">கு</div><p>Search themes in ethics, statecraft, love, friendship, learning, and more.</p></div>}
  </>;
}

function BrowsePage({ query, setQuery, paal, setPaal, adhikaram, setAdhikaram, data, loading, error, retry, page, setPage }: { query: string; setQuery: (v: string) => void; paal: string; setPaal: (v: string) => void; adhikaram: string; setAdhikaram: (v: string) => void; data?: { items: Kural[]; total: number; page: number; pageSize: number }; loading: boolean; error: string; retry: () => void; page: number; setPage: (v: number) => void }) {
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const detail = useGetKural(selectedNumber ?? 1, { query: { enabled: selectedNumber !== null, queryKey: getGetKuralQueryKey(selectedNumber ?? 1) } });
  return <><PageHeading eyebrow="CANONICAL CORPUS / 05" title="Browse the source." description="Explore the real couplets by division, chapter, or text. Every line is corpus data." right={<span className="trust-pill"><BookOpen size={14}/> 1,330 couplets</span>}/>
    <Panel className="browse-filters"><div className="filter-search"><Search size={17}/><label className="sr-only" htmlFor="browse-search">Filter couplets</label><input id="browse-search" data-testid="input-browse-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter text…"/></div><label className="filter-select-label">DIVISION<select aria-label="Filter by division" value={paal} onChange={(e) => setPaal(e.target.value)}><option value="">All divisions</option><option value="Aram">Aram · virtue</option><option value="Porul">Porul · polity</option><option value="Inbam">Inbam · love</option></select></label><label className="filter-select-label">CHAPTER NO.<input aria-label="Filter by chapter number" type="number" min="1" max="133" value={adhikaram} onChange={(e) => setAdhikaram(e.target.value)} placeholder="All"/></label></Panel>
    {error ? <ErrorState message={error} retry={retry}/> : loading ? <div className="browse-list">{[0,1,2,3].map((i) => <Panel key={i}><LoadingBlock/></Panel>)}</div> : data?.items?.length ? <><div className="browse-meta"><span className="mono">SHOWING {((page - 1) * data.pageSize + 1).toLocaleString()}–{Math.min(page * data.pageSize, data.total).toLocaleString()} OF {data.total.toLocaleString()}</span><span>Verified source text</span></div>{selectedNumber !== null && <Panel className="browse-detail"><div className="source-title"><span className="subtle-label">SOURCE RECORD · LOADED BY NUMBER</span><button className="icon-button" aria-label="Close source detail" onClick={() => setSelectedNumber(null)}><X size={16}/></button></div>{detail.isLoading ? <LoadingBlock label={`Loading Kural ${selectedNumber}`}/> : detail.data ? <KuralText kural={detail.data}/> : detail.isError ? <ErrorState message={errorText(detail.error)}/> : null}</Panel>}<div className="browse-list">{data.items.map((kural) => <Panel className="browse-kural" key={kural.number}><div className="browse-no"><span className="subtle-label">KURAL</span><strong>{String(kural.number).padStart(4, '0')}</strong><span className="paal-chip">{kural.paal}</span><button className="detail-link" onClick={() => setSelectedNumber(kural.number)}>View source detail <ArrowRight size={13}/></button></div><KuralText kural={kural}/></Panel>)}</div><div className="pagination"><span className="mono">PAGE {page} / {pages}</span><div><Button kind="secondary" className="small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/>Previous</Button><Button kind="secondary" className="small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next<ChevronRight size={15}/></Button></div></div></> : <EmptyState icon={BookOpen} title="No couplets in this view" body="Try clearing a filter, or browse another division."/>}
  </>;
}

function BenchmarkPage({ result, loading, error, thresholds, setThresholds, submit }: { result: BenchmarkResult | null; loading: boolean; error: string; thresholds: { misquoteMin: number; spliceLineMin: number; decoyMin: number }; setThresholds: (v: { misquoteMin: number; spliceLineMin: number; decoyMin: number }) => void; submit: (v?: { misquoteMin: number; spliceLineMin: number; decoyMin: number }) => void }) {
  const recomputeTimer = useRef<number | null>(null);
  const updateThreshold = (key: keyof typeof thresholds, value: number) => {
    const next = { ...thresholds, [key]: value };
    setThresholds(next);
    if (recomputeTimer.current !== null) window.clearTimeout(recomputeTimer.current);
    recomputeTimer.current = window.setTimeout(() => submit(next), 450);
  };
  const controls: { key: keyof typeof thresholds; label: string; description: string }[] = [{ key: 'misquoteMin', label: 'Misquote minimum', description: 'Similarity floor to classify a changed quote.' }, { key: 'spliceLineMin', label: 'Splice line minimum', description: 'Line match floor used for splice detection.' }, { key: 'decoyMin', label: 'Decoy minimum', description: 'Match threshold for number decoys.' }];
  return <><PageHeading eyebrow="EVALUATION / 06" title="Measure the abstentions." description="Run the benchmark suite against the configured thresholds. Review false accepts, abstention, and the baseline." right={<Button onClick={submit} disabled={loading}><FlaskConical size={15}/>{loading ? 'Running suite…' : 'Run benchmark'}<ArrowRight size={15}/></Button>}/>
    <div className="benchmark-layout"><Panel className="threshold-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>Decision thresholds</b><small>Results recompute after a short pause while you adjust a slider.</small></div></div>{controls.map((control) => <label className="threshold-control" key={control.key}><span className="threshold-label"><b>{control.label}</b><span className="mono">{thresholds[control.key].toFixed(2)}</span></span><input aria-label={control.label} type="range" min="0.3" max="1" step="0.01" value={thresholds[control.key]} onChange={(e) => updateThreshold(control.key, Number(e.target.value))}/><small>{control.description}</small></label>)}<div className="threshold-foot"><Fingerprint size={14}/> A stricter threshold may increase abstention.</div></Panel>
    <div className="benchmark-results">{error && <ErrorState message={error} retry={submit}/>}
      {loading && <Panel><LoadingBlock label="Evaluating benchmark set"/></Panel>}
      {result && !loading && <><div className="metric-strip"><Metric label="Test cases" value={result.total.toLocaleString()}/><Metric label="False accept rate" value={pct(result.falseAcceptRate)} tone="danger"/><Metric label="Abstention rate" value={pct(result.abstentionRate)} tone="gold"/></div><Panel className="metrics-panel"><SectionTitle>Verdict metrics</SectionTitle><div className="metric-table"><div className="metric-table-row table-head"><span>VERDICT</span><span>CASES</span><span>CORRECT</span><span>ACCURACY</span><span>RATE</span></div>{result.metrics.map((m) => <div className="metric-table-row" key={m.label}><span>{m.label}</span><span className="mono">{m.count}</span><span className="mono">{m.correct}</span><span className="mono">{pct(m.accuracy)}</span><span className="metric-bar-wrap"><i style={{ width: `${Math.max(0, Math.min(100, m.accuracy * 100))}%` }}/></span></div>)}</div></Panel><div className="benchmark-bottom"><Panel className="matrix-panel"><SectionTitle>Confusion matrix</SectionTitle>{result.matrix.length ? <table className="matrix-table"><thead><tr><th>Actual / predicted</th>{['Real','Corrupted','Spliced','Fabricated','Decoy'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.matrix.map((row, r) => <tr key={r}><th>{['Real','Corrupted','Spliced','Fabricated','Decoy'][r]}</th>{row.map((cell, c) => <td key={c} className={r === c ? 'matrix-hit' : ''}>{cell}</td>)}</tr>)}</tbody></table> : <EmptyState icon={Gauge} title="No matrix returned" body="This run did not include confusion matrix data."/>}</Panel><Panel className="baseline-panel"><span className="eyebrow">BASELINE COMPARISON</span><h3>Verifier vs baseline</h3><div className="baseline-row"><span>False accept · verifier</span><b>{pct(result.falseAcceptRate)}</b></div><div className="baseline-row"><span>False accept · baseline</span><b>{pct(result.baseline.falseAcceptRate)}</b></div><div className="baseline-row"><span>Baseline accuracy</span><b>{pct(result.baseline.accuracy)}</b></div><div className="baseline-note">Rates reported by the benchmark run.</div></Panel></div></>}
      {!result && !loading && !error && <div className="benchmark-empty"><div className="benchmark-icon"><Gauge size={24}/></div><span className="eyebrow">WAITING FOR A RUN</span><h2>No performance claim without a test.</h2><p>Run the benchmark to see corpus-derived metrics. This screen never substitutes sample numbers for a real evaluation.</p></div>}
    </div></div>
  </>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className={`metric-card ${tone || ''}`}><span className="eyebrow">{label}</span><b>{value}</b><span className="metric-mark">RUN RESULT</span></div>; }

function HowPage() {
  const stages = [
    { no: '01', title: 'Receive the claim', text: 'The submitted Tamil text and optional claimed couplet number are kept as the verification input.', icon: Quote, tag: 'INPUT' },
    { no: '02', title: 'Normalize safely', text: 'Text normalization prepares comparable strings. It does not generate, paraphrase, or complete a quote.', icon: Layers3, tag: 'PREPARE' },
    { no: '03', title: 'Match the corpus', text: 'The verifier compares against the Tirukkural corpus and records candidate source references.', icon: Database, tag: 'MATCH' },
    { no: '04', title: 'Classify the evidence', text: 'Exact, fragment, changed, spliced, attributed elsewhere, not found, and too-short outcomes remain distinct.', icon: FileSearch, tag: 'VERDICT' },
    { no: '05', title: 'Show or abstain', text: 'A supported verdict includes its source and trace. When evidence is insufficient, the tool declines to claim a match.', icon: ShieldCheck, tag: 'EVIDENCE' },
  ];
  return <><PageHeading eyebrow="METHOD / 07" title="A claim needs a source." description="Kural Saatchi is built around deterministic corpus matching—not a model’s sense of plausibility."/>
    <div className="method-intro"><div className="method-seal">கு</div><div><span className="eyebrow">THE VERIFICATION CONTRACT</span><p>We do not ask whether a line <em>sounds</em> like the Tirukkural. We ask whether there is a reproducible match in the source.</p></div></div>
    <div className="stage-list">{stages.map((stage) => <article className="stage-row" key={stage.no}><div className="stage-number mono">{stage.no}</div><div className="stage-icon"><stage.icon size={18}/></div><div className="stage-copy"><span className="eyebrow">{stage.tag}</span><h2>{stage.title}</h2><p>{stage.text}</p></div><ArrowRight className="stage-arrow" size={17}/></article>)}</div>
    <div className="method-principle"><div><span className="eyebrow">THE IMPORTANT DISTINCTION</span><h2>Similarity is not proof.</h2></div><p>A nearby text can be useful as evidence, but it is never silently upgraded to a verified quotation. Verdict, source line, diff, and trace are surfaced separately.</p></div>
    <div className="verdict-reference"><div className="verdict-reference-head"><span className="eyebrow">VERDICT VOCABULARY</span><span className="mono">CLOSED SET</span></div><div className="verdict-reference-grid">{['VERIFIED','VERIFIED_FRAGMENT','MISQUOTED','SPLICED','MISATTRIBUTED','NOT_FOUND','TOO_SHORT'].map((v) => <div className="verdict-reference-item" key={v}><VerdictBadge verdict={v}/><span>{(verdictMeta[v] ?? fallbackMeta).detail}</span></div>)}</div></div>
  </>;
}

function DocsPage() {
  const endpoints = [
    ['GET', '/api/health', 'Corpus count, source hash, and demo-corpus status.'],
    ['POST', '/api/verify', 'Deterministic quote verification, claim check, evidence, diff, and pipeline trace.'],
    ['POST', '/api/guard', 'Quote spans, per-span findings, and safely corrected text.'],
    ['POST', '/api/chat', 'Six canned raw-versus-guarded simulator scenarios.'],
    ['POST', '/api/search', 'Search source couplets by wording or indexed translation/commentary.'],
    ['GET', '/api/kurals', 'Browse source text with paal, chapter number, query, and page filters.'],
    ['GET', '/api/kurals/{number}', 'Retrieve one canonical couplet by number.'],
    ['POST', '/api/benchmark/run', 'Run seeded verifier and naïve-baseline benchmark cases.'],
  ];
  return <main className="docs-page"><div className="docs-header"><a href="/" className="docs-back"><ChevronLeft size={16}/> Return to verifier</a><span className="eyebrow">KURAL SAATCHI / DOCUMENTATION</span><h1>Verification API</h1><p>The verifier uses deterministic string matching against the checked-in Tirukkural corpus. A language model never decides whether a quotation is authentic.</p></div><Panel className="docs-contract"><h2>Verification outcomes</h2><p>Exact matches and source fragments can be verified. Near matches are labeled misquoted; mixed couplets, configured decoys, and unsupported text are classified separately. Short or uncertain input is not promoted to a match.</p><div className="docs-note"><Fingerprint size={16}/> Similarity scores rank candidates only. A score is not proof and does not turn a non-match into a verified quotation.</div></Panel><Panel className="docs-endpoints"><h2>Endpoints</h2><div className="docs-endpoint-list">{endpoints.map(([method, path, description]) => <div className="docs-endpoint" key={path}><span className={`http-method ${method.toLowerCase()}`}>{method}</span><code>{path}</code><span>{description}</span></div>)}</div></Panel><Panel className="docs-contract"><h2>Corpus integrity</h2><p>The full dataset is validated for 1,330 contiguous entries and two non-empty Tamil lines per entry at startup. The SHA-256 digest is shown in the app footer. If the corpus file is missing or invalid, the app falls back to the clearly marked seed corpus and does not claim full coverage.</p></Panel></main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={App}/><Route path="/docs" component={DocsPage}/><Route component={NotFound}/></Switch></ErrorBoundary>;
}
function Root() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>; }
export default Root;
