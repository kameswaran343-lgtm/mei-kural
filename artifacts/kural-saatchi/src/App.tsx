import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetKuralHealth, useVerifyKural, useGuardText, useGuardedChat, useSearchKurals, useListKurals, useGetKural, getGetKuralQueryKey, useRunBenchmark } from '@workspace/api-client-react';
import type { VerificationResult, GuardResult, ChatResult, KuralSearchResult, BenchmarkResult, Kural } from '@workspace/api-client-react';
import { BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Copy, Database, FileSearch, Fingerprint, FlaskConical, Gauge, History, Languages, Layers3, Menu, Moon, Search, Shield, ShieldCheck, Sun, X, ArrowRight, ExternalLink, Quote, AlertTriangle, CheckCircle2, XCircle, MinusCircle, CircleDot, RotateCcw } from 'lucide-react';
import html2canvas from 'html2canvas';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { LanguageProvider, useLanguage, type TranslationKey } from '@/lib/i18n';

const queryClient = new QueryClient();
type Tab = 'verify' | 'guard' | 'chat' | 'search' | 'browse' | 'benchmark' | 'how';

const getVerdictMeta = (t: (key: TranslationKey) => string): Record<string, { title: string; symbol: string; className: string; detail: string }> => ({
  VERIFIED: { title: t('verdict_VERIFIED_title'), symbol: '✓', className: 'good', detail: t('verdict_VERIFIED_detail') },
  VERIFIED_FRAGMENT: { title: t('verdict_VERIFIED_FRAGMENT_title'), symbol: '◒', className: 'partial', detail: t('verdict_VERIFIED_FRAGMENT_detail') },
  MISQUOTED: { title: t('verdict_MISQUOTED_title'), symbol: '≠', className: 'warning', detail: t('verdict_MISQUOTED_detail') },
  SPLICED: { title: t('verdict_SPLICED_title'), symbol: '⧉', className: 'warning', detail: t('verdict_SPLICED_detail') },
  MISATTRIBUTED: { title: t('verdict_MISATTRIBUTED_title'), symbol: '↗', className: 'warning', detail: t('verdict_MISATTRIBUTED_detail') },
  NOT_FOUND: { title: t('verdict_NOT_FOUND_title'), symbol: '∅', className: 'unknown', detail: t('verdict_NOT_FOUND_detail') },
  TOO_SHORT: { title: t('verdict_TOO_SHORT_title'), symbol: '—', className: 'unknown', detail: t('verdict_TOO_SHORT_detail') },
  WRONG_NUMBER: { title: t('verdict_WRONG_NUMBER_title'), symbol: '≠', className: 'warning', detail: t('verdict_WRONG_NUMBER_detail') },
  OK: { title: t('verdict_OK_title'), symbol: '✓', className: 'good', detail: t('verdict_OK_detail') },
  UNSUPPORTED_CLAIM: { title: t('verdict_UNSUPPORTED_CLAIM_title'), symbol: '?', className: 'unknown', detail: t('verdict_UNSUPPORTED_CLAIM_detail') },
});

type VerificationExample = { title: string; number: number | ''; text: string };
const pct = (value: number | undefined) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function App() {
  const { lang, toggleLang, t } = useLanguage();
  const [tab, setTab] = useState<Tab>('verify');
  const [theme, setTheme] = useState<'dark' | 'parchment'>(() => localStorage.getItem('kural-theme') === 'parchment' ? 'parchment' : 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const health = useGetKuralHealth();
  const source391 = useGetKural(391, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(391) } });
  const source396 = useGetKural(396, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(396) } });
  const source616 = useGetKural(616, { query: { enabled: tab === 'verify', queryKey: getGetKuralQueryKey(616) } });

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'verify', label: t('tab_verify'), icon: ShieldCheck },
    { id: 'guard', label: t('tab_guard'), icon: Fingerprint },
    { id: 'chat', label: t('tab_chat'), icon: Layers3 },
    { id: 'search', label: t('tab_search'), icon: Search },
    { id: 'browse', label: t('tab_browse'), icon: BookOpen },
    { id: 'benchmark', label: t('tab_benchmark'), icon: FlaskConical },
    { id: 'how', label: t('tab_how'), icon: CircleHelp },
  ];

  const examples: VerificationExample[] = [
    { title: t('example_1'), number: 391, text: source391.data ? `${source391.data.line1}\n${source391.data.line2}` : '' },
    { title: t('example_2'), number: 391, text: source391.data ? `${source391.data.line1}\n${source391.data.line2.replace(/தக\.?$/u, 'தக்க')}` : '' },
    { title: t('example_3'), number: 391, text: source391.data && source396.data ? `${source391.data.line1}\n${source396.data.line2}` : '' },
    { title: t('example_4'), number: '', text: 'யாதும் ஊரே யாவரும் கேளிர்' },
    { title: t('example_5'), number: '', text: 'தோல்வி என்பது வெற்றிக்கு முதல் படி' },
    { title: t('example_6'), number: 618, text: source616.data ? `${source616.data.line1}\n${source616.data.line2}` : '' },
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
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopyNote(t('copied_to_clipboard')); window.setTimeout(() => setCopyNote(''), 1800); }
    catch { setCopyNote(t('clipboard_unavailable')); window.setTimeout(() => setCopyNote(''), 2200); }
  };

  return <div className={`grain min-h-[100dvh] bg-background text-foreground ${theme === 'parchment' ? 'parchment' : ''}`}>
    <div className="app-frame">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>கு</span></div>
          <div><div className="brand-name">{t('brand_name')}</div><div className="brand-sub">{t('brand_sub')}</div></div>
          <button className="icon-button close-mobile" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18}/></button>
        </div>
        <div className="nav-label">{t('workspace')}</div>
        <nav className="nav-list" aria-label="Main navigation">
          {tabs.map((item, i) => <button key={item.id} onClick={() => changeTab(item.id)} className={`nav-item ${tab === item.id ? 'active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} data-testid={`nav-${item.id}`}>
            <item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{i === 0 && <span className="nav-count">01</span>}
          </button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="corpus-mini">
            <div className="corpus-mini-top"><span className={`health-dot ${health.data?.status === 'ok' || health.data?.status === 'healthy' ? 'online' : ''}`}></span><span>{t('source_corpus')}</span><span className="mono">{health.isLoading ? '…' : health.data?.count?.toLocaleString() ?? '—'}</span></div>
            <div className="corpus-hash">{health.data?.corpusHash ? `${health.data.corpusHash.slice(0, 12)}…` : t('source_corpus')}</div>
          </div>
          <div className="side-foot"><span>{t('evidence_never_intuition')}</span><span className="mono">{t('version')}</span></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation overlay" onClick={() => setMobileNav(false)} />}
      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
          <div className="topbar-crumb"><span>{t('workspace')}</span><span className="crumb-slash">/</span><b>{tabs.find((tItem) => tItem.id === tab)?.label}</b></div>
          <div className="topbar-actions">
            <div className="corpus-status" aria-live="polite"><span className={`health-dot ${health.data?.status === 'ok' || health.data?.status === 'healthy' ? 'online' : ''}`}></span><span>{health.isLoading ? t('checking_corpus') : health.isError ? t('corpus_unavailable') : health.data?.demoCorpus ? t('demo_corpus') : t('corpus_connected')}</span></div>
            <button className="lang-toggle" onClick={toggleLang} aria-label={`Switch to ${lang === 'ta' ? 'English' : 'Tamil'}`} data-testid="button-language" title={lang === 'ta' ? 'Switch to English' : 'தமிழுக்கு மாறவும்'}>
              <Languages size={15}/>
              <span>{t('lang_toggle_btn')}</span>
            </button>
            <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'parchment' : 'dark')} aria-label={t('switch_to_theme', { theme: theme === 'dark' ? t('theme_parchment') : t('theme_night') })} data-testid="button-theme">
              <span>{theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}</span>
              <span>{theme === 'dark' ? t('theme_parchment') : t('theme_night')}</span>
            </button>
          </div>
        </header>
        <div className="content-scroll">
          <div className="content-wrap fade-in" key={`${tab}-${lang}`}>
            {health.data?.demoCorpus && <div className="demo-banner" role="status"><AlertTriangle size={15}/> {t('demo_banner', { count: health.data.count })}</div>}
            {tab === 'verify' && <VerifyPage quote={quote} setQuote={setQuote} claimedNumber={claimedNumber} setClaimedNumber={setClaimedNumber} result={verification} loading={verify.isPending} error={verify.isError ? errorText(verify.error, t('could_not_load_evidence')) : ''} submit={submitVerify} examples={examples} history={history} restore={(text) => { setQuote(text); submitVerify(text, ''); }} copy={copyText} corpusHash={health.data?.corpusHash ?? ''} />}
            {tab === 'guard' && <GuardPage value={guardText} setValue={setGuardText} result={guardResult} loading={guard.isPending} error={guard.isError ? errorText(guard.error, t('could_not_load_evidence')) : ''} submit={runGuard} />}
            {tab === 'chat' && <ChatPage value={chatText} setValue={setChatText} result={chatResult} loading={chat.isPending} error={chat.isError ? errorText(chat.error, t('could_not_load_evidence')) : ''} submit={runChat} mode={chatMode} setMode={setChatMode} view={chatView} setView={setChatView} />}
            {tab === 'search' && <SearchPage value={meaningQuery} setValue={setMeaningQuery} result={searchResult} loading={search.isPending} error={search.isError ? errorText(search.error, t('could_not_load_evidence')) : ''} submit={runSearch} />}
            {tab === 'browse' && <BrowsePage query={browseQuery} setQuery={(v) => { setBrowseQuery(v); setPage(1); }} paal={paal} setPaal={(v) => { setPaal(v); setPage(1); }} adhikaram={adhikaram} setAdhikaram={(v) => { setAdhikaram(v); setPage(1); }} data={list.data} loading={list.isLoading} error={list.isError ? errorText(list.error, t('could_not_load_evidence')) : ''} retry={() => void list.refetch()} page={page} setPage={setPage} />}
            {tab === 'benchmark' && <BenchmarkPage result={benchResult} loading={benchmark.isPending} error={benchmark.isError ? errorText(benchmark.error, t('could_not_load_evidence')) : ''} thresholds={thresholds} setThresholds={setThresholds} submit={(value) => benchmark.mutate({ data: { thresholds: value ?? thresholds } }, { onSuccess: setBenchResult })} />}
            {tab === 'how' && <HowPage/>}
          </div>
        </div>
        <footer className="global-footer"><span><span className="footer-seal">●</span> {t('footer_corpus_text', { count: health.data?.count ?? '—' })}<a href="/docs">{t('how_verification_works')}</a></span><span className="mono hash-footer" title={health.data?.corpusHash ?? 'Corpus hash unavailable'}>SHA-256 {health.data?.corpusHash ?? '—'}</span></footer>
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
function LoadingBlock({ label }: { label?: string }) {
  const { t } = useLanguage();
  const text = label || t('reading_source_records');
  return <div className="loading-state" role="status"><span className="skeleton-line wide"/><span className="skeleton-line"/><span className="loading-caption"><span className="health-dot online"/>{text}…</span></div>;
}
function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useLanguage();
  return <div className="state-card error-state" role="alert"><AlertTriangle size={19}/><div><b>{t('could_not_load_evidence')}</b><p>{message}</p></div>{retry && <button className="button secondary small" onClick={retry}><RotateCcw size={14}/> {t('retry')}</button>}</div>;
}
function EmptyState({ icon: Icon = FileSearch, title, body }: { icon?: typeof Search; title: string; body: string }) { return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><b>{title}</b><p>{body}</p></div>; }
function Button({ children, onClick, disabled, kind = 'primary', type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet'; type?: 'button' | 'submit'; className?: string }) { return <button type={type} disabled={disabled} onClick={onClick} className={`button ${kind} ${className}`}>{children}</button>; }

function VerdictBadge({ verdict }: { verdict: string }) {
  const { t } = useLanguage();
  const metaMap = getVerdictMeta(t);
  const meta = metaMap[verdict] ?? { title: verdict, symbol: '?', className: 'unknown', detail: '' };
  return <span className={`verdict-badge ${meta.className}`} aria-label={`${meta.title} (${verdict})`}><span aria-hidden="true">{meta.symbol}</span><span>{meta.title}</span></span>;
}

function VerifyPage({ quote, setQuote, claimedNumber, setClaimedNumber, result, loading, error, submit, examples: examplesList, history, restore, copy, corpusHash }: { quote: string; setQuote: (v: string) => void; claimedNumber: string; setClaimedNumber: (v: string) => void; result: VerificationResult | null; loading: boolean; error: string; submit: (text?: string, number?: string) => void; examples: VerificationExample[]; history: { text: string; verdict: string; at: string }[]; restore: (text: string) => void; copy: (text: string) => void; corpusHash: string }) {
  const { lang, t } = useLanguage();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [certificateBusy, setCertificateBusy] = useState(false);
  const [certificateError, setCertificateError] = useState('');
  const metaMap = getVerdictMeta(t);

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
      setCertificateError(t('certificate_err'));
    } finally {
      setCertificateBusy(false);
    }
  };
  const meta = result ? metaMap[result.verdict] ?? { title: result.verdict, symbol: '?', className: 'unknown', detail: t('verdict_fallback_detail') } : null;
  return <>
    <PageHeading eyebrow={t('verify_eyebrow')} title={t('verify_title')} description={t('verify_desc')} right={<span className="trust-pill"><Database size={14}/> {t('trust_pill_couplets')}</span>}/>
    <div className="verify-grid">
      <div className="primary-column">
        <Panel className="input-panel">
          <div className="panel-kicker"><span className="step-number">01</span><div><b>{t('step_enter_quote')}</b><small>{t('step_paste_sub')}</small></div><span className="mono char-count">{quote.length.toLocaleString()} / 10,000</span></div>
          <label className="sr-only" htmlFor="quote-input">Tamil quotation</label>
          <textarea id="quote-input" data-testid="input-quote" className="quote-input tamil" dir="auto" placeholder={t('quote_placeholder')} value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={10000} />
          <div className="input-bottom"><div className="number-input-wrap"><label htmlFor="number-input">{t('claimed_kural_no')}</label><input id="number-input" data-testid="input-claimed-number" type="number" min={1} max={1330} placeholder={t('optional')} value={claimedNumber} onChange={(e) => setClaimedNumber(e.target.value)}/></div><Button onClick={() => submit()} disabled={loading || !quote.trim()}><ShieldCheck size={16}/>{loading ? t('checking_source') : t('verify_button')}<ArrowRight size={15}/></Button></div>
          {loading && <div className="progress-line" aria-label="Verifying quotation"><span/></div>}
          {error && <ErrorState message={error} retry={() => submit()}/>}
          <div className="deterministic-note"><Fingerprint size={15}/><span>{t('deterministic_note')}</span></div>
        </Panel>
        <div className="examples-section">
          <SectionTitle extra={<span className="subtle-label">{t('try_reference_test')}</span>}>{t('examples_title')}</SectionTitle>
          <div className="example-grid">{examplesList.map((item, i) => <button className="example-tile" key={`${item.title}-${i}`} disabled={!item.text} onClick={() => { setQuote(item.text); setClaimedNumber(String(item.number)); }} data-testid={`example-${i + 1}`}><span className="example-index">0{i + 1}</span><span className="example-name">{item.title}</span><span className="example-tamil tamil" dir="auto">{item.text || t('loading_source_text')}</span><span className="example-num mono">{item.number ? t('claim_num', { number: item.number }) : t('no_claim')} <ArrowRight size={13}/></span></button>)}</div>
        </div>
        {history.length > 0 && <Panel className="history-panel"><SectionTitle extra={<span className="mono subtle-label">{t('local_only', { count: history.length })}</span>}>{t('recent_checks')}</SectionTitle><div className="history-list">{history.slice(0, 4).map((item, i) => <button key={`${item.at}-${i}`} className="history-row" onClick={() => restore(item.text)}><History size={15}/><span className="history-text tamil" dir="auto">{item.text.replace(/\n/g, ' ')}</span><VerdictBadge verdict={item.verdict}/><span className="history-time">{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></button>)}</div></Panel>}
      </div>
      <div className="evidence-column">
        {!result && !loading && <div className="evidence-intro"><div className="seal-large"><span>கு</span><i/></div><div className="evidence-intro-label">{t('standard_of_proof')}</div><h2>{t('show_the_line')}</h2><p>{t('proof_desc')}</p><div className="intro-rule"/><div className="intro-meta"><span><CheckCircle2 size={15}/> {t('corpus_grounded')}</span><span><XCircle size={15}/> {t('abstains_on_uncertainty')}</span></div></div>}
        {loading && <Panel><LoadingBlock label={t('comparing_against_corpus')}/></Panel>}
        {result && meta && <Panel className={`result-card ${meta.className}`} aria-live="polite">
          <div className="result-topline"><span className="subtle-label">{t('verification_result')}</span><span className="mono result-id">{t('kural_saatchi_id')}</span></div>
          <div className="result-verdict"><div className="verdict-symbol" aria-hidden="true">{meta.symbol}</div><div><VerdictBadge verdict={result.verdict}/><h2>{meta.title}</h2><p>{meta.detail}</p></div></div>
          {result.message && <p className="result-message">{result.message}</p>}
          {result.claimCheck && <div className="claim-check"><span className="subtle-label">{t('number_claim')}</span><VerdictBadge verdict={result.claimCheck}/>{result.claimedNumber && <span className="mono">{t('claimed_number_label', { number: result.claimedNumber })}</span>}</div>}
          <div className="confidence-meter"><div className="confidence-heading"><span className="subtle-label">{t('match_signal')}</span><span className="mono">{pct(result.confidence)}</span></div><div className="confidence-track" role="meter" aria-label="Deterministic match signal" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.max(0, Math.min(1, result.confidence))}><span style={{ width: `${Math.max(0, Math.min(100, result.confidence * 100))}%` }}/></div><small>{t('similarity_sub')}</small></div>
          {result.kural && <div className="source-block"><div className="source-title"><span className="subtle-label">{t('matched_source')}</span><span className="mono source-number">{t('source_no', { number: result.kural.number })}</span></div><KuralText kural={result.kural}/><div className="source-actions"><button className="copy-source" onClick={() => copy(`${result.kural?.line1}\n${result.kural?.line2}`)}><Copy size={13}/> {t('copy_source_couplet')}</button><Button kind="secondary" className="small" onClick={() => void downloadCertificate()} disabled={certificateBusy}><FileSearch size={14}/>{certificateBusy ? t('preparing_png') : t('download_certificate_png')}</Button></div>{certificateError && <p className="certificate-error" role="alert">{certificateError}</p>}<div className="certificate-render" ref={certificateRef} aria-hidden="true"><div className="certificate-frame"><div className="certificate-top">KURAL SAATCHI <span>குறள் சாட்சி</span></div><div className="certificate-rule"/><div className="certificate-label">{t('cert_title')}</div><h2>{t('cert_verified_against')}</h2><div className="certificate-number">{t('cert_kural_detail', { number: result.kural.number, paal: result.kural.paal === 'Aram' ? t('paal_aram') : result.kural.paal === 'Porul' ? t('paal_porul') : t('paal_inbam'), chapter: result.kural.adhikaramNo })}</div><p className="certificate-tamil">{result.kural.line1}<br/>{result.kural.line2}</p><p className="certificate-translation">{result.kural.translation}</p><div className="certificate-rule"/><div className="certificate-footer"><span>{t('cert_sha', { hash: corpusHash ? `${corpusHash.slice(0, 16)}…` : 'unavailable' })}</span><span>{new Date().toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-US')}</span></div></div></div></div>}
          {result.diff && result.diff.length > 0 && <div className="diff-block"><div className="subtle-label">{t('wording_comparison')}</div><p className="diff-content tamil" dir="auto">{result.diff.map((part, i) => <span key={`${part.type}-${i}`} className={`diff-${part.type}`}>{part.text}</span>)}</p><div className="diff-legend"><span><i className="diff-swatch equal"/> {t('diff_matched')}</span><span><i className="diff-swatch sub"/> {t('diff_changed')}</span><span><i className="diff-swatch ins"/> {t('diff_added')}</span></div></div>}
          {result.splicedReferences?.length > 0 && <div className="spliced-block"><div className="subtle-label">{t('source_references')}</div>{result.splicedReferences.map((k) => <div className="source-ref" key={k.number}><span className="mono">#{k.number}</span><span className="tamil" dir="auto">{k.line1} / {k.line2}</span></div>)}</div>}
          {result.evidence?.length > 0 && <div className="evidence-list"><div className="subtle-label">{t('evidence')}</div>{result.evidence.map((e, i) => <div className="evidence-row" key={`${e.label}-${i}`}><span className="evidence-check"><Check size={12}/></span><div><b>{e.label}</b><p>{e.detail}</p></div></div>)}</div>}
          {result.nearest?.length > 0 && <div className="nearest-list"><div className="subtle-label">{t('nearest_source_matches')}</div>{result.nearest.map((n) => <div className="nearest-row" key={n.kural.number}><div className="nearest-text"><span className="mono">#{n.kural.number}</span><p className="tamil" dir="auto">{n.kural.line1}<br/>{n.kural.line2}</p></div><div className="nearest-score"><b>{n.label}</b><span className="mono">{pct(n.score)}</span></div></div>)}</div>}
          {result.trace?.length > 0 && <details className="trace-details"><summary><span><Clock3 size={14}/> {t('matching_trace')}</span><span className="mono">{t('stages_count', { count: result.trace.length })}</span></summary><div className="trace-list">{result.trace.map((stage, i) => <div className="trace-row" key={`${stage.stage}-${i}`}><span className="trace-node">{String(i + 1).padStart(2, '0')}</span><span className="trace-stage">{stage.stage}</span><span>{stage.detail}</span><span className="mono">{stage.ms} ms</span></div>)}</div></details>}
          {!result.kural && result.evidence?.length === 0 && result.nearest?.length === 0 && <div className="no-evidence"><MinusCircle size={16}/><span>{t('no_evidence_returned')}</span></div>}
        </Panel>}
      </div>
    </div>
  </>;
}

function KuralText({ kural }: { kural: Kural }) {
  const { t } = useLanguage();
  const paalName = kural.paal === 'Aram' ? t('paal_aram') : kural.paal === 'Porul' ? t('paal_porul') : t('paal_inbam');
  const chapterText = t('chapter_label', { number: kural.adhikaramNo });

  return <div className="kural-lines tamil" dir="auto">
    <span>{kural.line1}</span>
    <span>{kural.line2}</span>
    <div className="kural-meta">{paalName} <i/> {chapterText}</div>
    {kural.explanation && <div className="kural-explanation-block"><span className="kural-field-label">{t('explanation_heading')}</span><p className="explanation">{kural.explanation}</p></div>}
    {kural.translation && <div className="kural-translation-block"><span className="kural-field-label">{t('translation_heading')}</span><p className="translation">{kural.translation}</p></div>}
  </div>;
}

function GuardPage({ value, setValue, result, loading, error, submit }: { value: string; setValue: (v: string) => void; result: GuardResult | null; loading: boolean; error: string; submit: () => void }) {
  const { t } = useLanguage();
  const [actionNote, setActionNote] = useState('');
  const copyCorrected = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.correctedText);
      setActionNote(t('corrected_copied'));
    } catch {
      setActionNote(t('clipboard_unavailable'));
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
  return <><PageHeading eyebrow={t('guard_eyebrow')} title={t('guard_title')} description={t('guard_desc')}/>
    <div className="tool-layout"><div className="primary-column"><Panel className="input-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>{t('text_to_inspect')}</b><small>{t('inspect_sub')}</small></div><span className="mono char-count">{value.length.toLocaleString()} / 30,000</span></div><label className="sr-only" htmlFor="guard-input">Paragraph to check</label><textarea id="guard-input" data-testid="input-guard-text" className="quote-input paragraph-input" placeholder={t('guard_placeholder')} value={value} onChange={(e) => setValue(e.target.value)} maxLength={30000}/><div className="input-bottom"><span className="deterministic-note inline"><Fingerprint size={15}/> {t('per_quote_verification')}</span><Button onClick={submit} disabled={loading || !value.trim()}><Shield size={15}/>{loading ? t('inspecting_text') : t('inspect_button')}<ArrowRight size={15}/></Button></div>{error && <ErrorState message={error} retry={submit}/>}</Panel>
      {loading && <Panel><LoadingBlock label={t('finding_and_checking')}/></Panel>}
      {result && <Panel className="result-card guard-results"><div className="result-topline"><span className="subtle-label">{t('paragraph_findings')}</span><span className="mono">{t('segments_count', { count: result.segments.length })}</span></div><h2 className="result-heading">{result.summary}</h2><div className="segment-list">{result.segments.map((segment, i) => <article className="segment-card" key={`${segment.start}-${segment.end}-${i}`}><div className="segment-head"><span className="mono segment-range">{t('span_range', { index: String(i + 1).padStart(2, '0'), start: segment.start, end: segment.end })}</span><VerdictBadge verdict={segment.verdict}/></div><blockquote className="segment-quote tamil" dir="auto">“{segment.text}”</blockquote>{segment.kuralNumber && <div className="segment-kural"><BookOpen size={14}/> {t('matched_to_kural', { number: segment.kuralNumber })}</div>}</article>)}</div><div className="corrected-box"><div className="corrected-head"><div><span className="subtle-label">{t('corrected_result')}</span><p>{t('corrected_desc')}</p></div></div><div className="corrected-text">{result.correctedText}</div><div className="download-actions"><Button kind="secondary" className="small" onClick={() => void copyCorrected()}><Copy size={14}/>{t('copy_corrected_text')}</Button><Button kind="secondary" className="small" onClick={downloadReport}><FileSearch size={14}/>{t('download_report_json')}</Button>{actionNote && <span role="status" className="action-note">{actionNote}</span>}</div></div></Panel>}
      {!result && !loading && <div className="quiet-note"><Quote size={17}/><span>{t('guard_quiet_note')}</span></div>}</div>
      <aside className="side-note"><div className="side-note-icon"><Fingerprint size={19}/></div><span className="eyebrow">{t('span_by_span')}</span><h3>{t('one_paragraph_many_claims')}</h3><p>{t('span_by_span_desc')}</p><div className="mini-process"><span>{t('process_text')}</span><i/><span>{t('process_quote_spans')}</span><i/><span>{t('process_source_verdicts')}</span></div></aside></div>
  </>;
}

function ChatPage({ value, setValue, result, loading, error, submit, mode, setMode, view, setView }: { value: string; setValue: (v: string) => void; result: ChatResult | null; loading: boolean; error: string; submit: () => void; mode: string; setMode: (v: string) => void; view: 'guarded' | 'raw'; setView: (v: 'guarded' | 'raw') => void }) {
  const { t } = useLanguage();
  const scenarios = [
    { id: '1', label: t('scenario_1') }, { id: '2', label: t('scenario_2') },
    { id: '3', label: t('scenario_3') }, { id: '4', label: t('scenario_4') },
    { id: '5', label: t('scenario_5') }, { id: '6', label: t('scenario_6') },
  ];

  return <><PageHeading eyebrow={t('chat_eyebrow')} title={t('chat_title')} description={t('chat_desc')}/>
    <div className="chat-layout"><div className="primary-column"><Panel className="input-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>{t('choose_scenario')}</b><small>{t('simulator_sub')}</small></div></div><div className="scenario-strip" role="group" aria-label="Guarded chat scenario">{scenarios.map((scenario) => <button key={scenario.id} className={`scenario-chip ${mode === scenario.id ? 'selected' : ''}`} aria-pressed={mode === scenario.id} onClick={() => setMode(scenario.id)}>{scenario.label}</button>)}</div><label className="sr-only" htmlFor="chat-input">Optional context</label><textarea id="chat-input" data-testid="input-chat" className="chat-input" placeholder={t('optional_context')} value={value} onChange={(e) => setValue(e.target.value)} maxLength={10000}/><div className="input-bottom"><span className="deterministic-note inline"><Command size={15}/> {t('simulator_only_note')}</span><Button onClick={submit} disabled={loading}>{loading ? t('comparing') : t('run_comparison')}<ArrowRight size={15}/></Button></div>{error && <ErrorState message={error} retry={submit}/>}</Panel>
      {loading && <Panel><LoadingBlock label={t('preparing_comparison')}/></Panel>}
      {result && <><div className="view-switch" role="tablist" aria-label="Response view"><button role="tab" aria-selected={view === 'guarded'} className={view === 'guarded' ? 'selected' : ''} onClick={() => setView('guarded')}><ShieldCheck size={15}/> {t('tab_guarded')}</button><button role="tab" aria-selected={view === 'raw'} className={view === 'raw' ? 'selected' : ''} onClick={() => setView('raw')}>{t('tab_raw')} <span className="raw-warning">{t('unverified')}</span></button></div><Panel className={`chat-output ${view === 'raw' ? 'raw-output' : ''}`}><div className="result-topline"><span className="subtle-label">{view === 'guarded' ? t('guarded_response') : t('raw_response')}</span>{view === 'raw' && <span className="raw-warning">{t('not_source_checked')}</span>}</div><p>{view === 'guarded' ? result.guarded : result.raw}</p></Panel><Panel className="findings-panel"><SectionTitle extra={<span className="mono subtle-label">{t('findings_count', { count: result.findings.length })}</span>}>{t('what_guard_found')}</SectionTitle>{result.findings.length ? <ul className="finding-list">{result.findings.map((finding, i) => <li key={`${i}-${finding}`}><span className="finding-index">{String(i + 1).padStart(2, '0')}</span><span>{finding}</span></li>)}</ul> : <EmptyState icon={CheckCircle2} title={t('no_findings_title')} body={t('no_findings_body')}/>}</Panel></>}
      {!result && !loading && <div className="quiet-note"><ShieldCheck size={17}/><span>{t('chat_quiet_note')}</span></div>}</div>
      <aside className="side-note chat-side"><div className="side-note-icon"><Layers3 size={19}/></div><span className="eyebrow">{t('two_outputs')}</span><h3>{t('readable_accountable')}</h3><p>{t('chat_side_desc')}</p><div className="legend-line"><span className="legend-square guarded-square"/> {t('source_checked')}</div><div className="legend-line"><span className="legend-square raw-square"/> {t('no_source_check')}</div></aside></div>
  </>;
}

function SearchPage({ value, setValue, result, loading, error, submit }: { value: string; setValue: (v: string) => void; result: KuralSearchResult | null; loading: boolean; error: string; submit: () => void }) {
  const { t } = useLanguage();
  return <><PageHeading eyebrow={t('search_eyebrow')} title={t('search_title')} description={t('search_desc')}/>
    <Panel className="search-panel"><form className="search-form" onSubmit={(e) => { e.preventDefault(); submit(); }}><label className="sr-only" htmlFor="meaning-search">Search by meaning</label><Search size={20}/><input id="meaning-search" data-testid="input-meaning-search" placeholder={t('search_placeholder')} value={value} onChange={(e) => setValue(e.target.value)}/><Button type="submit" disabled={loading || !value.trim()}>{loading ? t('searching') : t('search_button')}<ArrowRight size={15}/></Button></form><div className="search-tip"><span className="eyebrow">{t('search_tip')}</span><span className="mono">{t('source_corpus_only')}</span></div></Panel>
    {error && <ErrorState message={error} retry={submit}/>}
    {loading && <div className="result-grid">{[0,1,2].map((i) => <Panel key={i}><LoadingBlock label={t('searching_couplets')}/></Panel>)}</div>}
    {result && !loading && <div className="search-results"><div className="results-summary"><div><span className="eyebrow">{t('source_matches')}</span><h2>{t('kurals_found', { count: result.total, noun: result.total === 1 ? 'Kural' : 'Kurals' })}</h2></div><span className="mono">{t('query_label', { query: value })}</span></div>{result.results.length ? <div className="result-grid">{result.results.map((item) => <Panel className="search-result-card" key={item.kural.number}><div className="search-result-head"><span className="mono">{t('kural_number_title', { number: item.kural.number })}</span><span className="match-label">{item.label} <b>{pct(item.score)}</b></span></div><KuralText kural={item.kural}/></Panel>)}</div> : <EmptyState icon={Search} title={t('no_source_matches')} body={t('no_source_matches_detail')}/>}</div>}
    {!result && !loading && !error && <div className="search-empty-plate"><div className="search-ornament">கு</div><p>{t('search_empty_intro')}</p></div>}
  </>;
}

function BrowsePage({ query, setQuery, paal, setPaal, adhikaram, setAdhikaram, data, loading, error, retry, page, setPage }: { query: string; setQuery: (v: string) => void; paal: string; setPaal: (v: string) => void; adhikaram: string; setAdhikaram: (v: string) => void; data?: { items: Kural[]; total: number; page: number; pageSize: number }; loading: boolean; error: string; retry: () => void; page: number; setPage: (v: number) => void }) {
  const { t } = useLanguage();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const detail = useGetKural(selectedNumber ?? 1, { query: { enabled: selectedNumber !== null, queryKey: getGetKuralQueryKey(selectedNumber ?? 1) } });
  return <><PageHeading eyebrow={t('browse_eyebrow')} title={t('browse_title')} description={t('browse_desc')} right={<span className="trust-pill"><BookOpen size={14}/> {t('trust_pill_couplets')}</span>}/>
    <Panel className="browse-filters"><div className="filter-search"><Search size={17}/><label className="sr-only" htmlFor="browse-search">Filter couplets</label><input id="browse-search" data-testid="input-browse-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('filter_couplets_placeholder')}/></div><label className="filter-select-label">{t('division_label')}<select aria-label="Filter by division" value={paal} onChange={(e) => setPaal(e.target.value)}><option value="">{t('all_divisions')}</option><option value="Aram">{t('browse_paal_aram')}</option><option value="Porul">{t('browse_paal_porul')}</option><option value="Inbam">{t('browse_paal_inbam')}</option></select></label><label className="filter-select-label">{t('chapter_no_label')}<input aria-label="Filter by chapter number" type="number" min="1" max="133" value={adhikaram} onChange={(e) => setAdhikaram(e.target.value)} placeholder={t('all')}/></label></Panel>
    {error ? <ErrorState message={error} retry={retry}/> : loading ? <div className="browse-list">{[0,1,2,3].map((i) => <Panel key={i}><LoadingBlock/></Panel>)}</div> : data?.items?.length ? <><div className="browse-meta"><span className="mono">{t('showing_couplets', { from: ((page - 1) * data.pageSize + 1).toLocaleString(), to: Math.min(page * data.pageSize, data.total).toLocaleString(), total: data.total.toLocaleString() })}</span><span>{t('verified_source_text')}</span></div>{selectedNumber !== null && <Panel className="browse-detail"><div className="source-title"><span className="subtle-label">{t('source_record_detail')}</span><button className="icon-button" aria-label="Close source detail" onClick={() => setSelectedNumber(null)}><X size={16}/></button></div>{detail.isLoading ? <LoadingBlock label={`Kural ${selectedNumber}`}/> : detail.data ? <KuralText kural={detail.data}/> : detail.isError ? <ErrorState message={errorText(detail.error, t('could_not_load_evidence'))}/> : null}</Panel>}<div className="browse-list">{data.items.map((kural) => <Panel className="browse-kural" key={kural.number}><div className="browse-no"><span className="subtle-label">{t('kural_browse_card')}</span><strong>{String(kural.number).padStart(4, '0')}</strong><span className="paal-chip">{kural.paal === 'Aram' ? t('paal_aram') : kural.paal === 'Porul' ? t('paal_porul') : t('paal_inbam')}</span><button className="detail-link" onClick={() => setSelectedNumber(kural.number)}>{t('view_source_detail')} <ArrowRight size={13}/></button></div><KuralText kural={kural}/></Panel>)}</div><div className="pagination"><span className="mono">{t('page_count', { page, pages })}</span><div><Button kind="secondary" className="small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/>{t('previous')}</Button><Button kind="secondary" className="small" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('next')}<ChevronRight size={15}/></Button></div></div></> : <EmptyState icon={BookOpen} title={t('no_couplets_in_view')} body={t('no_couplets_sub')}/>}
  </>;
}

function BenchmarkPage({ result, loading, error, thresholds, setThresholds, submit }: { result: BenchmarkResult | null; loading: boolean; error: string; thresholds: { misquoteMin: number; spliceLineMin: number; decoyMin: number }; setThresholds: (v: { misquoteMin: number; spliceLineMin: number; decoyMin: number }) => void; submit: (v?: { misquoteMin: number; spliceLineMin: number; decoyMin: number }) => void }) {
  const { t } = useLanguage();
  const recomputeTimer = useRef<number | null>(null);
  const metaMap = getVerdictMeta(t);
  const updateThreshold = (key: keyof typeof thresholds, value: number) => {
    const next = { ...thresholds, [key]: value };
    setThresholds(next);
    if (recomputeTimer.current !== null) window.clearTimeout(recomputeTimer.current);
    recomputeTimer.current = window.setTimeout(() => submit(next), 450);
  };
  const controls: { key: keyof typeof thresholds; label: string; description: string }[] = [
    { key: 'misquoteMin', label: t('misquote_min'), description: t('misquote_min_desc') },
    { key: 'spliceLineMin', label: t('splice_min'), description: t('splice_min_desc') },
    { key: 'decoyMin', label: t('decoy_min'), description: t('decoy_min_desc') }
  ];
  const matrixLabels = [t('matrix_real'), t('matrix_corrupted'), t('matrix_spliced'), t('matrix_fabricated'), t('matrix_decoy')];

  return <><PageHeading eyebrow={t('benchmark_eyebrow')} title={t('benchmark_title')} description={t('benchmark_desc')} right={<Button onClick={submit} disabled={loading}><FlaskConical size={15}/>{loading ? t('running_suite') : t('run_benchmark')}<ArrowRight size={15}/></Button>}/>
    <div className="benchmark-layout"><Panel className="threshold-panel"><div className="panel-kicker"><span className="step-number">01</span><div><b>{t('decision_thresholds')}</b><small>{t('threshold_sub')}</small></div></div>{controls.map((control) => <label className="threshold-control" key={control.key}><span className="threshold-label"><b>{control.label}</b><span className="mono">{thresholds[control.key].toFixed(2)}</span></span><input aria-label={control.label} type="range" min="0.3" max="1" step="0.01" value={thresholds[control.key]} onChange={(e) => updateThreshold(control.key, Number(e.target.value))}/><small>{control.description}</small></label>)}<div className="threshold-foot"><Fingerprint size={14}/> {t('threshold_foot')}</div></Panel>
    <div className="benchmark-results">{error && <ErrorState message={error} retry={submit}/>}
      {loading && <Panel><LoadingBlock label={t('evaluating_benchmark')}/></Panel>}
      {result && !loading && <><div className="metric-strip"><Metric label={t('test_cases')} value={result.total.toLocaleString()}/><Metric label={t('false_accept_rate')} value={pct(result.falseAcceptRate)} tone="danger"/><Metric label={t('abstention_rate')} value={pct(result.abstentionRate)} tone="gold"/></div><Panel className="metrics-panel"><SectionTitle>{t('verdict_metrics')}</SectionTitle><div className="metric-table"><div className="metric-table-row table-head"><span>{t('th_verdict')}</span><span>{t('th_cases')}</span><span>{t('th_correct')}</span><span>{t('th_accuracy')}</span><span>{t('th_rate')}</span></div>{result.metrics.map((m) => <div className="metric-table-row" key={m.label}><span>{metaMap[m.label]?.title || m.label}</span><span className="mono">{m.count}</span><span className="mono">{m.correct}</span><span className="mono">{pct(m.accuracy)}</span><span className="metric-bar-wrap"><i style={{ width: `${Math.max(0, Math.min(100, m.accuracy * 100))}%` }}/></span></div>)}</div></Panel><div className="benchmark-bottom"><Panel className="matrix-panel"><SectionTitle>{t('confusion_matrix')}</SectionTitle>{result.matrix.length ? <table className="matrix-table"><thead><tr><th>{t('actual_predicted')}</th>{matrixLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.matrix.map((row, r) => <tr key={r}><th>{matrixLabels[r]}</th>{row.map((cell, c) => <td key={c} className={r === c ? 'matrix-hit' : ''}>{cell}</td>)}</tr>)}</tbody></table> : <EmptyState icon={Gauge} title={t('no_matrix_title')} body={t('no_matrix_body')}/>}</Panel><Panel className="baseline-panel"><span className="eyebrow">{t('baseline_comparison')}</span><h3>{t('verifier_vs_baseline')}</h3><div className="baseline-row"><span>{t('fa_verifier')}</span><b>{pct(result.falseAcceptRate)}</b></div><div className="baseline-row"><span>{t('fa_baseline')}</span><b>{pct(result.baseline.falseAcceptRate)}</b></div><div className="baseline-row"><span>{t('baseline_accuracy')}</span><b>{pct(result.baseline.accuracy)}</b></div><div className="baseline-note">{t('rates_reported_note')}</div></Panel></div></>}
      {!result && !loading && !error && <div className="benchmark-empty"><div className="benchmark-icon"><Gauge size={24}/></div><span className="eyebrow">{t('benchmark_eyebrow')}</span><h2>{t('benchmark_empty_title')}</h2><p>{t('benchmark_empty_desc')}</p></div>}
    </div></div>
  </>;
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { t } = useLanguage();
  return <div className={`metric-card ${tone || ''}`}><span className="eyebrow">{label}</span><b>{value}</b><span className="metric-mark">{t('run_result_tag')}</span></div>;
}

function HowPage() {
  const { t } = useLanguage();
  const stages = [
    { no: '01', title: t('stage_1_title'), text: t('stage_1_desc'), icon: Quote, tag: t('stage_1_tag') },
    { no: '02', title: t('stage_2_title'), text: t('stage_2_desc'), icon: Layers3, tag: t('stage_2_tag') },
    { no: '03', title: t('stage_3_title'), text: t('stage_3_desc'), icon: Database, tag: t('stage_3_tag') },
    { no: '04', title: t('stage_4_title'), text: t('stage_4_desc'), icon: FileSearch, tag: t('stage_4_tag') },
    { no: '05', title: t('stage_5_title'), text: t('stage_5_desc'), icon: ShieldCheck, tag: t('stage_5_tag') },
  ];
  const verdictKeys = ['VERIFIED','VERIFIED_FRAGMENT','MISQUOTED','SPLICED','MISATTRIBUTED','NOT_FOUND','TOO_SHORT'];
  const metaMap = getVerdictMeta(t);

  return <><PageHeading eyebrow={t('how_eyebrow')} title={t('how_title')} description={t('how_desc')}/>
    <div className="method-intro"><div className="method-seal">கு</div><div><span className="eyebrow">{t('verification_contract')}</span><p>{t('contract_quote')}</p></div></div>
    <div className="stage-list">{stages.map((stage) => <article className="stage-row" key={stage.no}><div className="stage-number mono">{stage.no}</div><div className="stage-icon"><stage.icon size={18}/></div><div className="stage-copy"><span className="eyebrow">{stage.tag}</span><h2>{stage.title}</h2><p>{stage.text}</p></div><ArrowRight className="stage-arrow" size={17}/></article>)}</div>
    <div className="method-principle"><div><span className="eyebrow">{t('important_distinction')}</span><h2>{t('similarity_not_proof')}</h2></div><p>{t('similarity_distinction_desc')}</p></div>
    <div className="verdict-reference"><div className="verdict-reference-head"><span className="eyebrow">{t('verdict_vocabulary')}</span><span className="mono">{t('closed_set')}</span></div><div className="verdict-reference-grid">{verdictKeys.map((v) => <div className="verdict-reference-item" key={v}><VerdictBadge verdict={v}/><span>{(metaMap[v])?.detail}</span></div>)}</div></div>
  </>;
}

function DocsPage() {
  const { lang, toggleLang, t } = useLanguage();
  const endpoints = [
    ['GET', '/api/health', t('endpoint_health')],
    ['POST', '/api/verify', t('endpoint_verify')],
    ['POST', '/api/guard', t('endpoint_guard')],
    ['POST', '/api/chat', t('endpoint_chat')],
    ['POST', '/api/search', t('endpoint_search')],
    ['GET', '/api/kurals', t('endpoint_kurals')],
    ['GET', '/api/kurals/{number}', t('endpoint_kural_detail')],
    ['POST', '/api/benchmark/run', t('endpoint_benchmark')],
  ];
  return <main className="docs-page">
    <div className="docs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
      <div>
        <a href="/" className="docs-back"><ChevronLeft size={16}/> {t('docs_back')}</a>
        <span className="eyebrow">{t('docs_eyebrow')}</span>
        <h1>{t('docs_title')}</h1>
        <p>{t('docs_desc')}</p>
      </div>
      <button className="lang-toggle" onClick={toggleLang} aria-label={`Switch to ${lang === 'ta' ? 'English' : 'Tamil'}`} data-testid="button-docs-language">
        <Languages size={15}/>
        <span>{t('lang_toggle_btn')}</span>
      </button>
    </div>
    <Panel className="docs-contract"><h2>{t('docs_outcomes')}</h2><p>{t('docs_outcomes_desc')}</p><div className="docs-note"><Fingerprint size={16}/> {t('docs_note')}</div></Panel>
    <Panel className="docs-endpoints"><h2>{t('docs_endpoints')}</h2><div className="docs-endpoint-list">{endpoints.map(([method, path, description]) => <div className="docs-endpoint" key={path}><span className={`http-method ${method.toLowerCase()}`}>{method}</span><code>{path}</code><span>{description}</span></div>)}</div></Panel>
    <Panel className="docs-contract"><h2>{t('docs_corpus_integrity')}</h2><p>{t('docs_integrity_desc')}</p></Panel>
  </main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={App}/><Route path="/docs" component={DocsPage}/><Route component={NotFound}/></Switch></ErrorBoundary>;
}
function Root() {
  return <QueryClientProvider client={queryClient}><LanguageProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider></LanguageProvider></QueryClientProvider>;
}
export default Root;
