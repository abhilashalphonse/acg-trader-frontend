import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Bug, CheckCircle2, ChevronDown,
  ChevronRight, CircleHelp, Headset, MessageSquareText, Rocket, Search,
  ShieldCheck, Wrench, X,
} from 'lucide-react';
import { HELP_ARTICLES, HELP_SECTIONS, findHelpArticles, getHelpArticle } from './helpContent.js';
import { REPORT_CATEGORIES, requestHumanSupport, submitHelpRequest } from './supportClient.js';

const SECTION_ICONS = { start: Rocket, guides: BookOpen, faq: CircleHelp, troubleshooting: Wrench };
const FORM_ICONS = { bug: Bug, feedback: MessageSquareText, support: Headset };
const FORMS = [
  { id: 'bug', title: 'Report a Bug', subtitle: 'Tell us what went wrong so we can investigate.' },
  { id: 'feedback', title: 'Send Feedback', subtitle: 'Suggest an improvement to ACG Trader.' },
  { id: 'support', title: 'Contact Support', subtitle: 'Ask our support team about your trading experience.' },
];
const FEEDBACK_CATEGORIES = ['Feature Request', 'UI/UX Improvement', 'General Suggestion', 'Other'];
const caption = 'text-[12px] leading-relaxed text-[#96a4b5]';
const tile = 'rounded-lg border border-white/[0.08] bg-[#14181e] transition hover:border-[#195be1]/40 hover:bg-[#192029]';

export default function HelpCenter({ onClose, desktop = false, symbol = '', timeframe = '' }) {
  const rootRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [page, setPage] = useState({ kind: 'home', id: null });
  const [query, setQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [sendDiagnostics, setSendDiagnostics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [lastForm, setLastForm] = useState('support');

  const results = useMemo(() => findHelpArticles(query), [query]);
  const activeArticle = page.kind === 'article' ? getHelpArticle(page.id) : null;
  const activeSection = HELP_SECTIONS.find(item => item.id === page.id);
  const activeForm = FORMS.find(item => item.id === page.id);
  const sectionArticles = useMemo(() => findHelpArticles('', page.id), [page.id]);
  const openPage = (kind, id = null) => {
    setPage({ kind, id });
    setError('');
    if (kind === 'form') {
      setCategory(id === 'feedback' ? FEEDBACK_CATEGORIES[0] : id === 'bug' ? REPORT_CATEGORIES[0] : 'Platform Support');
      setDescription('');
      setExpected('');
      setSendDiagnostics(false);
    }
    rootRef.current?.querySelector('[data-help-scroll]')?.scrollTo({ top: 0 });
  };
  const back = () => {
    if (page.kind === 'article') {
      const article = getHelpArticle(page.id);
      openPage(article ? 'section' : 'home', article?.section || null);
    } else if (page.kind === 'receipt') {
      openPage('home');
    } else {
      openPage('home');
    }
  };

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    const original = document.body.style.overflow;
    if (!desktop) document.body.style.overflow = 'hidden';
    const t = window.requestAnimationFrame(() => rootRef.current?.querySelector('[data-help-first]')?.focus());
    return () => {
      window.cancelAnimationFrame(t);
      document.body.style.overflow = original;
      returnFocusRef.current?.isConnected && returnFocusRef.current.focus?.();
    };
  }, [desktop]);

  const handleKeys = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...(rootRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href]') || [])]
      .filter(element => element.getClientRects().length > 0);
    if (!nodes.length) return;
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
  };

  const send = async event => {
    event.preventDefault();
    if (busy || description.trim().length < 10) return;
    setBusy(true);
    setError('');
    const kind = page.id;
    setLastForm(kind);
    try {
      const context = sendDiagnostics ? {
        symbol, timeframe, browser: navigator.userAgent, build: import.meta.env.VITE_GIT_SHA || '',
      } : null;
      const data = await submitHelpRequest({
        kind, category, description: description.trim(), expected: kind === 'bug' ? expected : '',
        context, humanReview: kind !== 'support',
      });
      setReceipt(data);
      setPage({ kind: 'receipt', id: kind });
    } catch (cause) {
      setError(cause?.name === 'TimeoutError'
        ? 'Request timed out. The report may have reached support. Check before submitting again.'
        : cause?.message || 'Could not reach support. Your draft has not been cleared.');
    } finally { setBusy(false); }
  };

  const askHuman = async () => {
    if (!receipt?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = await requestHumanSupport(receipt.id);
      setReceipt(current => ({ ...current, escalated: updated.status === 'ESCALATED', status: updated.status }));
    } catch (cause) { setError(cause?.message || 'Handoff failed. Please try again later.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[205]" data-acg-hotkeys-suspend="true" onKeyDown={handleKeys}>
      <button type="button" aria-label="Close Help Center" onClick={() => !busy && onClose()}
        className="absolute inset-0 h-full w-full cursor-default bg-black/55 md:bg-black/20" />
      <section ref={rootRef} role="dialog" aria-modal="true" aria-label="ACG Trader Help Center"
        className={
          'absolute flex flex-col overflow-hidden border border-white/[0.10] bg-[#0A0C0F] text-[#e6edf5] shadow-[0_18px_75px_rgba(0,0,0,.65)] ' +
          (desktop
            ? 'right-[50px] top-[56px] bottom-[14px] w-[390px] max-w-[calc(100vw-68px)] rounded-xl'
            : 'bottom-0 left-0 right-0 mx-auto h-[90dvh] max-w-[460px] rounded-t-[24px]')
        }>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {page.kind !== 'home' ? (
              <button data-help-first type="button" aria-label="Back" onClick={back}
                className="grid size-9 shrink-0 place-items-center rounded-md text-[#a2b2c3] hover:bg-white/[0.07]">
                <ArrowLeft size={18}/>
              </button>
            ) : <CircleHelp data-help-first size={19} className="text-[#648fff]" />}
            <h2 className="truncate text-[16px] font-bold">
              {page.kind === 'home' ? 'Help Center' :
                page.kind === 'section' ? activeSection?.label :
                page.kind === 'article' ? 'Help Article' :
                page.kind === 'form' ? activeForm?.title : 'Request Received'}
            </h2>
          </div>
          <button type="button" aria-label="Close Help Center" disabled={busy} onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-md text-[#a2b2c3] hover:bg-white/[0.07] disabled:opacity-50"><X size={19}/></button>
        </header>
        <div data-help-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-width:thin]">
          {page.kind === 'home' && (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-[13px] text-[#9aaabd]">How can we help you?</p>
                <label className="flex items-center gap-2 rounded-lg border border-white/[0.11] bg-[#151a20] px-3 py-2.5">
                  <Search size={16} className="shrink-0 text-[#8b9aab]"/>
                  <input data-help-first autoComplete="off" type="search" value={query} onChange={event => setQuery(event.target.value)}
                    placeholder="Search answers and guides" aria-label="Search help articles"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-[#748397]"/>
                </label>
              </div>
              {query.trim() ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8193a8]">{results.length} result(s)</p>
                  {results.map(article => (
                    <button key={article.id} type="button" onClick={() => openPage('article', article.id)}
                      className={'w-full p-3 text-left ' + tile}>
                      <span className="block text-[13px] font-semibold">{article.title}</span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-[#93a2b1]">{article.summary}</span>
                    </button>
                  ))}
                  {!results.length && <p className={caption}>No articles match. Try different words or contact support below.</p>}
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8596ad]">Explore ACG Trader</p>
                  <div className="grid grid-cols-2 gap-2">
                    {HELP_SECTIONS.map(section => {
                      const Icon = SECTION_ICONS[section.id];
                      const count = HELP_ARTICLES.filter(article => article.section === section.id).length;
                      return (
                        <button type="button" key={section.id} onClick={() => openPage('section', section.id)}
                          className={'min-h-[115px] p-3 text-left ' + tile}>
                          <Icon size={19} className="mb-3 text-[#739aff]"/>
                          <span className="block text-[13px] font-semibold">{section.label}</span>
                          <span className="mt-1 block text-[11px] text-[#8e9db0]">{count} articles</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8596ad]">Contact & Feedback</p>
                <div className="overflow-hidden rounded-lg border border-white/[0.08]">
                  {FORMS.map(form => {
                    const Icon = FORM_ICONS[form.id];
                    return <button type="button" key={form.id} onClick={() => openPage('form', form.id)}
                      className="flex min-h-[64px] w-full items-center gap-3 border-b border-white/[0.08] px-3 text-left last:border-0 hover:bg-white/[0.045]">
                      <Icon size={19} className="shrink-0 text-[#9caec6]"/>
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{form.title}</span>
                        <span className="mt-1 block text-[11px] text-[#8595a8]">{form.subtitle}</span></span>
                      <ChevronRight size={15} className="shrink-0 text-[#8393a5]"/>
                    </button>;
                  })}
                </div>
              </div>
            </div>
          )}
          {page.kind === 'section' && activeSection && (
            <div className="space-y-3">
              <p className={caption}>Select a topic to read the guide or get a quick answer.</p>
              {sectionArticles.map(article => (
                <div key={article.id} className={tile}>
                  {page.id === 'faq' ? (
                    <>
                      <button type="button" aria-expanded={expandedFaq === article.id}
                        onClick={() => setExpandedFaq(current => current === article.id ? null : article.id)}
                        className="flex min-h-[48px] w-full items-center justify-between gap-2 p-3 text-left">
                        <span className="text-[13px] font-semibold">{article.title}</span>
                        <ChevronDown size={15} className={'shrink-0 text-[#9aabbc] transition ' + (expandedFaq === article.id ? 'rotate-180' : '')}/>
                      </button>
                      {expandedFaq === article.id && <div className="border-t border-white/[0.08] p-3 text-[12px] leading-6 text-[#b0bdcb]">{article.summary}</div>}
                    </>
                  ) : (
                    <button type="button" className="flex w-full items-center gap-2 p-3 text-left" onClick={() => openPage('article', article.id)}>
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{article.title}</span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-[#92a2b3]">{article.summary}</span></span>
                      <ChevronRight size={16} className="shrink-0 text-[#93a0ad]"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {page.kind === 'article' && activeArticle && (
            <article className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8199bc]">
                {HELP_SECTIONS.find(section => section.id === activeArticle.section)?.label}
              </p>
              <h3 className="text-[20px] font-bold leading-7 text-white">{activeArticle.title}</h3>
              <p className="text-[13px] leading-6 text-[#bbc7d4]">{activeArticle.summary}</p>
              {activeArticle.steps.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[13px] font-semibold">How to do it</h4>
                  {activeArticle.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#182640] text-[12px] font-semibold text-[#91b0ff]">{index + 1}</span>
                      <p className="pt-0.5 text-[13px] leading-6 text-[#b4c2d0]">{step}</p>
                    </div>
                  ))}
                </div>
              )}
              {activeArticle.note && <div className="rounded-lg border border-[#354358] bg-[#131a24] p-3">
                <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-[#bccbe4]"><ShieldCheck size={15}/> Important</div>
                <p className="text-[12px] leading-5 text-[#aab9cd]">{activeArticle.note}</p>
              </div>}
              <div className="border-t border-white/[0.08] pt-4">
                <p className="mb-2 text-[12px] text-[#90a2b5]">Still need help?</p>
                <button type="button" onClick={() => openPage('form','support')}
                  className="flex items-center gap-2 text-[13px] font-semibold text-[#9ab8ff]">Contact Support <ArrowRight size={15}/></button>
              </div>
            </article>
          )}
          {page.kind === 'form' && activeForm && (
            <form className="space-y-4" onSubmit={send}>
              <p className={caption}>{activeForm.subtitle}</p>
              <div className="space-y-1.5">
                <label htmlFor="help-category" className="text-[12px] font-semibold">Category</label>
                <select id="help-category" value={category} onChange={event => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.12] bg-[#14181e] p-3 text-[13px] text-white outline-none focus:border-[#195be1]">
                  {(page.id === 'bug' ? REPORT_CATEGORIES : page.id === 'feedback' ? FEEDBACK_CATEGORIES : ['Platform Support', 'Trading Account', 'Other']).map(value => <option key={value}>{value}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="help-description" className="text-[12px] font-semibold">{page.id === 'bug' ? 'What happened?' : page.id === 'feedback' ? 'Your suggestion' : 'How can we help?'}</label>
                <textarea id="help-description" required minLength={10} maxLength={2000} rows={5}
                  value={description} onChange={event => setDescription(event.target.value)}
                  placeholder="Include what you were doing and any message you saw."
                  className="w-full resize-y rounded-lg border border-white/[0.12] bg-[#14181e] p-3 text-[13px] leading-6 text-white outline-none placeholder:text-[#768699] focus:border-[#195be1]"/>
                <p className="text-right text-[11px] text-[#7e8e9d]">{description.length}/2000</p>
              </div>
              {page.id === 'bug' && <div className="space-y-1.5">
                <label htmlFor="help-expected" className="text-[12px] font-semibold">What did you expect? <span className="font-normal text-[#8395a8]">(optional)</span></label>
                <textarea id="help-expected" rows={2} maxLength={350} value={expected} onChange={event => setExpected(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.12] bg-[#14181e] p-3 text-[13px] text-white outline-none focus:border-[#195be1]"/>
              </div>}
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.08] bg-[#12161c] p-3">
                <input type="checkbox" checked={sendDiagnostics} onChange={event => setSendDiagnostics(event.target.checked)}
                  className="mt-1 accent-[#195be1]"/>
                <span className="text-[12px] leading-5 text-[#aab9c9]">Include symbol, timeframe, browser and UTC time to help investigate. No passwords, tokens or account financial data are included.</span>
              </label>
              <p className="text-[11px] leading-5 text-[#8293a5]">Screenshots are not supported in this version. Please do not include private credentials or personal payment details.</p>
              {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-[#251016] p-3 text-[12px] leading-5 text-[#ffadb8]">{error}</p>}
              <button disabled={busy || description.trim().length < 10} type="submit"
                className="w-full rounded-lg bg-[#195be1] p-3 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? 'Submitting…' : page.id === 'support' ? 'Send to Support' : 'Submit ' + (page.id === 'bug' ? 'Bug Report' : 'Feedback')}
              </button>
              <p className="text-center text-[11px] text-[#8293a5]">Submission requires an available connection to ACG Funded Support.</p>
            </form>
          )}
          {page.kind === 'receipt' && receipt && (
            <div className="space-y-4 pt-5 text-center">
              <CheckCircle2 size={36} className="mx-auto text-[#54c99b]"/>
              <h3 className="text-[18px] font-bold">Request saved</h3>
              <p className={caption}>Your {lastForm === 'bug' ? 'bug report' : lastForm === 'feedback' ? 'feedback' : 'support request'} was recorded by ACG support.</p>
              <div className="break-all rounded-lg border border-white/[0.10] bg-[#14181e] p-3 text-[12px]">
                Reference: <strong>{receipt.id}</strong>
              </div>
              {receipt.escalated
                ? <p className="text-[12px] text-[#7fe3b4]">Assigned to the human support queue.</p>
                : <p className="text-[12px] leading-5 text-[#e7c789]">{receipt.followUpNeeded ? 'Saved, but human handoff could not be confirmed.' : 'Saved as a support conversation. A human has not yet been assigned.'}</p>}
              {lastForm === 'support' && receipt.answer && <div className="rounded-lg border border-white/[0.08] bg-[#13181f] p-3 text-left"><p className="mb-1 text-[12px] font-bold">Support response</p><p className="whitespace-pre-wrap text-[12px] leading-5 text-[#b3c1d0]">{receipt.answer}</p></div>}
              {!receipt.escalated && <button type="button" onClick={askHuman} disabled={busy}
                className="w-full rounded-lg border border-[#195be1]/60 bg-[#13213e] p-3 text-[13px] font-semibold text-[#bdd0ff] disabled:opacity-50">
                {busy ? 'Requesting…' : 'Request Human Review'}
              </button>}
              {error && <p role="alert" className="text-[12px] text-[#ffadb8]">{error}</p>}
              <button type="button" onClick={() => openPage('home')} className="w-full rounded-lg border border-white/[0.1] p-3 text-[13px] font-semibold">Return to Help Center</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
