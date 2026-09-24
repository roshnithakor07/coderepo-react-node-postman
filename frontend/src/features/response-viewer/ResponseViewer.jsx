import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { statusClass, formatSize, formatTime, tryFormatJson, isJson } from "../../shared/utils/format.js";
import { JsonView } from "./JsonView.jsx";

function SnippetPanel({ request, activeEnvironmentId, onGenerateSnippet }) {
	const [lang, setLang] = useState("curl");
	const [snippet, setSnippet] = useState("");
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const generationRef = useRef(0);
	const hasUrl = !!request?.url?.trim();

	// Regenerates whenever the selected language, the request itself (new
	// object identity on every field edit, see App.jsx's updateRequest), or
	// the active environment changes — not just on a language-button click —
	// so the displayed snippet never goes stale relative to the request.
	// onGenerateSnippet is deliberately not a dependency: it's a fresh
	// function every render, and request/activeEnvironmentId already capture
	// every change that should trigger a regeneration.
	useEffect(() => {
		const generation = ++generationRef.current;
		if (!hasUrl) { setSnippet(""); setLoading(false); return; }
		// Generation is normally near-instant; only flip on the loader if it's
		// still running past this threshold, so a fast response never flashes it.
		const loaderTimer = setTimeout(() => {
			if (generationRef.current === generation) setLoading(true);
		}, 150);
		onGenerateSnippet(lang)
			.then((r) => { if (generationRef.current === generation) setSnippet(r?.snippet || ""); })
			.catch(() => { if (generationRef.current === generation) setSnippet("// Failed to generate snippet."); })
			.finally(() => {
				clearTimeout(loaderTimer);
				if (generationRef.current === generation) setLoading(false);
			});
		return () => clearTimeout(loaderTimer);
	}, [lang, request, activeEnvironmentId, hasUrl]);

	async function copy() {
		try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
	}

	return (
		<div className="snippet-panel">
			<div className="snippet-lang-row">
				{["curl", "fetch", "axios", "python"].map(l => (
					<button key={l} className={`snippet-lang-btn ${lang === l ? "active" : ""}`} onClick={() => setLang(l)}>{l}</button>
				))}
			</div>
			{loading && <div className="response-loading"><div className="spinner" /> Generating snippet…</div>}
			{!loading && snippet && (
				<>
					<pre className="snippet-code">{snippet}</pre>
					<div className="snippet-actions">
						<button className={`snippet-copy-btn ${copied ? "snippet-copied" : ""}`} onClick={copy}>
							{copied ? "✓ Copied!" : "Copy to clipboard"}
						</button>
					</div>
				</>
			)}
			{!loading && !snippet && (
				<p className="body-none-msg">Enter a request URL to generate a code snippet.</p>
			)}
		</div>
	);
}

const TABS = ["Pretty", "Raw", "Headers"];

export function ResponseViewer({ response, sending, request, activeEnvironmentId, onGenerateSnippet, onClear }) {
	const [activeTab, setActiveTab] = useState("Pretty");
	const [showSnippet, setShowSnippet] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentMatch, setCurrentMatch] = useState(0);
	const [matchTotal, setMatchTotal] = useState(0);
	const containerRef = useRef(null);
	const searchInputRef = useRef(null);

	// Wraps every occurrence of the current search query inside `text`,
	// case-insensitively, in a <mark>. Shared across the Raw tab's flat text
	// and every leaf JsonView renders. This is intentionally a *pure*
	// function of (text, searchQuery) — it does not count or number matches
	// itself. Counting/numbering instead reads the already-committed DOM in
	// an effect below: React 18 StrictMode double-invokes render functions
	// (including JsonView's, independently of this component's own render),
	// so a shared counter mutated as a side effect of rendering would double
	// itself on every leaf without that ever showing up in the actual DOM —
	// querying the committed marks after the fact sidesteps that entirely.
	const highlightText = useCallback((text) => {
		if (!searchQuery) return text;
		const lower = text.toLowerCase();
		const q = searchQuery.toLowerCase();
		if (!lower.includes(q)) return text;
		const parts = [];
		let i = 0;
		while (i < text.length) {
			const idx = lower.indexOf(q, i);
			if (idx === -1) { parts.push(text.slice(i)); break; }
			if (idx > i) parts.push(text.slice(i, idx));
			parts.push(<mark key={idx} className="search-match">{text.slice(idx, idx + searchQuery.length)}</mark>);
			i = idx + searchQuery.length;
		}
		return parts;
	}, [searchQuery]);

	const statusCls = response ? statusClass(response.status) : "serr";
	const prettyBody = useCallback(() => (response?.body ? tryFormatJson(response.body) : ""), [response?.body]);
	const headerEntries = response?.headers ? Object.entries(response.headers) : [];
	// Only a JSON body gets the tree view; anything else (HTML, XML, plain
	// text) keeps the existing flat <pre> — JsonView has nothing to render
	// for a non-object/array payload anyway.
	const parsedJson = useMemo(() => {
		if (!response?.body || !isJson(response.body)) return undefined;
		const value = JSON.parse(response.body);
		return value !== null && typeof value === "object" ? value : undefined;
	}, [response?.body]);

	// Counts matches from the already-committed DOM rather than during
	// render (see highlightText's comment above for why) — runs after every
	// commit that could have changed which matches exist, and resets to the
	// first match rather than trying to preserve a position that may no
	// longer exist.
	useEffect(() => {
		const marks = containerRef.current?.querySelectorAll("mark.search-match") ?? [];
		setMatchTotal(marks.length);
		setCurrentMatch(0);
	}, [searchQuery, activeTab, response]);

	// Applies the "current match" style and scrolls it into view. Depends on
	// the same triggers as the effect above, not just currentMatch — the set
	// of DOM marks can change completely while currentMatch numerically
	// stays at 0 (e.g. typing a new query).
	useEffect(() => {
		const marks = containerRef.current?.querySelectorAll("mark.search-match") ?? [];
		marks.forEach((el, i) => el.classList.toggle("search-match-current", i === currentMatch));
		if (searchOpen) marks[currentMatch]?.scrollIntoView({ block: "center" });
	}, [currentMatch, searchOpen, searchQuery, activeTab, response]);

	// Plain client-side download — no dependency needed for a Blob + object
	// URL + a programmatic <a download>.
	function saveResponseAsFile() {
		if (!response?.body) return;
		const blob = new Blob([response.body], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `response-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(""); }, []);
	const toggleSearch = useCallback(() => {
		if (searchOpen) { closeSearch(); return; }
		setSearchOpen(true);
		requestAnimationFrame(() => searchInputRef.current?.focus());
	}, [searchOpen, closeSearch]);
	const goToMatch = useCallback((delta) => {
		setCurrentMatch(m => matchTotal === 0 ? 0 : (m + delta + matchTotal) % matchTotal);
	}, [matchTotal]);

	// Ctrl/Cmd+F opens the in-response search instead of the browser's own
	// find bar — but only when there's a response to search and the user
	// isn't currently typing in some other field (Params/Headers/Body/URL),
	// so that native find still works everywhere else in the app.
	useEffect(() => {
		function handler(e) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
				const active = document.activeElement;
				const typingElsewhere = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") && !containerRef.current?.contains(active);
				if (typingElsewhere || !response || response.error) return;
				e.preventDefault();
				setSearchOpen(true);
				requestAnimationFrame(() => searchInputRef.current?.focus());
			} else if (e.key === "Escape" && searchOpen && document.activeElement !== document.body) {
				const withinContainer = containerRef.current?.contains(document.activeElement);
				if (withinContainer) closeSearch();
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [response, searchOpen, closeSearch]);

	const SnippetToggle = (
		<button
			className={`icon-btn ${showSnippet ? "active" : ""}`}
			onClick={() => setShowSnippet(s => !s)}
			title="Code snippets"
			style={{ width: "auto", padding: "0 10px", fontSize: 11, fontWeight: 700, gap: 4 }}
		>
			&lt;/&gt; Snippets
		</button>
	);

	if (sending) return (
		<div className="response-viewer">
			<div className="response-bar"><span className="response-bar-title">Response</span></div>
			<div className="response-loading"><div className="spinner" /> Sending request…</div>
		</div>
	);

	if (!response) return (
		<div className="response-viewer">
			<div className="response-bar">
				<span className="response-bar-title">Response</span>
				<div style={{ marginLeft: "auto" }}>{SnippetToggle}</div>
			</div>
			{showSnippet
				? <SnippetPanel request={request} activeEnvironmentId={activeEnvironmentId} onGenerateSnippet={onGenerateSnippet} />
				: (
					<div className="response-empty">
						<div className="response-empty-icon">📡</div>
						<p>Hit <strong>Send</strong> to see the response</p>
						<small>Ctrl+Enter to send from the URL bar</small>
					</div>
				)
			}
		</div>
	);

	return (
		<div className="response-viewer" ref={containerRef}>
			<div className="response-bar">
				<span className="response-bar-title">Response</span>
				{response.error
					? <span className="status-badge serr">Error</span>
					: <span className={`status-badge ${statusCls}`}>{response.status} {response.statusText}</span>
				}
				<div className="response-meta">
					{response.responseTime != null && (
						<span className="meta-chip" title="Response time">
							⏱ {formatTime(response.responseTime)}
						</span>
					)}
					{response.size > 0 && (
						<span className="meta-chip" title="Response size">
							⚖ {formatSize(response.size)}
						</span>
					)}
				</div>
				<div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
					{!response.error && (
						<button
							className={`icon-btn ${searchOpen ? "active" : ""}`}
							onClick={toggleSearch}
							title="Search response (Ctrl+F)"
						>
							🔍
						</button>
					)}
					{!response.error && (
						<button
							className="icon-btn"
							onClick={saveResponseAsFile}
							disabled={!response.body}
							title={response.body ? "Save response as .json" : "No response body to save"}
						>
							⭳
						</button>
					)}
					<button
						className="icon-btn"
						onClick={onClear}
						title="Clear response"
						style={{ width: "auto", padding: "0 10px", fontSize: 11, fontWeight: 700 }}
					>
						Clear
					</button>
					{SnippetToggle}
				</div>
			</div>

			{showSnippet
				? <SnippetPanel request={request} activeEnvironmentId={activeEnvironmentId} onGenerateSnippet={onGenerateSnippet} />
				: (
					<>
						{response.error
							? (
								<div className="response-error">
									<strong>Request failed</strong>
									<span>{response.error}</span>
								</div>
							)
							: (
								<>
									<div className="tabs" role="tablist">
										{TABS.map(t => (
											<button key={t} role="tab" className={`tab-btn ${activeTab === t ? "active" : ""}`} aria-selected={activeTab === t} onClick={() => setActiveTab(t)}>
												{t}
												{t === "Headers" && headerEntries.length > 0 && <span className="tab-count">{headerEntries.length}</span>}
											</button>
										))}
									</div>
									{searchOpen && activeTab !== "Headers" && (
										<div className="response-search-bar">
											<span className="response-search-icon">🔍</span>
											<input
												ref={searchInputRef}
												className="response-search-input"
												value={searchQuery}
												onChange={e => setSearchQuery(e.target.value)}
												onKeyDown={e => {
													if (e.key === "Enter") { e.preventDefault(); goToMatch(e.shiftKey ? -1 : 1); }
													else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
												}}
												placeholder="Search this response…"
											/>
											<span className="response-search-count">{matchTotal > 0 ? `${currentMatch + 1} of ${matchTotal}` : searchQuery ? "0 results" : ""}</span>
											<button className="response-search-nav" onClick={() => goToMatch(-1)} disabled={matchTotal === 0} aria-label="Previous match" title="Previous match (Shift+Enter)">↑</button>
											<button className="response-search-nav" onClick={() => goToMatch(1)} disabled={matchTotal === 0} aria-label="Next match" title="Next match (Enter)">↓</button>
											<button className="response-search-nav" onClick={closeSearch} aria-label="Close search" title="Close (Esc)">✕</button>
										</div>
									)}
									<div className="response-body-wrap" role="tabpanel">
										{activeTab === "Pretty"  && (
											parsedJson !== undefined
												? <div className="response-body response-body-json"><JsonView value={parsedJson} highlight={highlightText} forceExpanded={searchOpen && !!searchQuery} /></div>
												: <pre className="response-body">{highlightText(prettyBody()) || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>
										)}
										{activeTab === "Raw"     && <pre className="response-body">{(response.body && highlightText(response.body)) || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>}
										{activeTab === "Headers" && (
											<table className="headers-table">
												<thead><tr><th>Header</th><th>Value</th></tr></thead>
												<tbody>
													{headerEntries.length === 0
														? <tr><td colSpan={2} style={{ color: "var(--text-tertiary)", textAlign: "center" }}>No response headers</td></tr>
														: headerEntries.map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)
													}
												</tbody>
											</table>
										)}
									</div>
								</>
							)
						}
					</>
				)
			}
		</div>
	);
}
