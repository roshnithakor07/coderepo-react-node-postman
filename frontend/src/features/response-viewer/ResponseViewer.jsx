import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { statusClass, formatSize, formatTime } from "../../shared/utils/format.js";
import { JsonView } from "./JsonView.jsx";
import { findJsonMatches, countTextMatches, nextMatchIndex, normalizeQuery } from "./jsonSearch.js";
import { highlightText } from "./highlight.jsx";
import { computeDefaultExpanded, collectAllContainerPaths } from "./jsonTree.js";

// Above this size, the JSON tree defaults to collapsed/off in favor of Raw —
// even with virtualization, parsing + the very first paint of a response
// this large is enough to feel sluggish, so the user opts in explicitly.
const LARGE_RESPONSE_BYTES = 2 * 1024 * 1024;
const SEARCH_DEBOUNCE_MS = 200;

function LargeResponseNotice({ sizeLabel, onViewAnyway }) {
	return (
		<div className="response-large-notice">
			<div className="response-empty-icon">⚠️</div>
			<p>Large response ({sizeLabel}) — tree view may be slow</p>
			<small>Raw view is shown by default for responses over 2 MB.</small>
			<button type="button" className="btn-ghost" onClick={onViewAnyway}>View as tree anyway</button>
		</div>
	);
}

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

// Owns the search box's live text and its debounce, so a keystroke only
// re-renders this bar — never ResponseViewer or the JSON tree. The parent
// receives the text ~SEARCH_DEBOUNCE_MS after typing pauses (onQueryChange)
// and hands back `appliedQuery`, the text its match count belongs to; while
// the two differ the count is stale, so the bar says "Searching…" instead
// of showing it. It starts from `appliedQuery`, so the text survives the
// bar unmounting (e.g. while the Headers tab is showing).
function SearchBar({ inputRef, appliedQuery, matchTotal, currentMatch, onQueryChange, onNavigate, onClose }) {
	const [query, setQuery] = useState(appliedQuery);
	useEffect(() => {
		const t = setTimeout(() => onQueryChange(query), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(t);
	}, [query, onQueryChange]);

	const pending = normalizeQuery(query) !== normalizeQuery(appliedQuery);
	const status = !normalizeQuery(query) ? ""
		: pending ? "Searching…"
		: matchTotal > 0 ? `${currentMatch + 1} of ${matchTotal}`
		: "0 results";
	const canNavigate = !pending && matchTotal > 0;

	return (
		<div className="response-search-bar">
			<span className="response-search-icon">🔍</span>
			<input
				ref={inputRef}
				className="response-search-input"
				value={query}
				onChange={e => setQuery(e.target.value)}
				onKeyDown={e => {
					if (e.key === "Enter") {
						e.preventDefault();
						// Enter before the debounce fires applies the query now
						// (landing on its first match) instead of doing nothing.
						if (pending) onQueryChange(query);
						else if (canNavigate) onNavigate(e.shiftKey ? -1 : 1);
					}
					else if (e.key === "Escape") { e.preventDefault(); onClose(); }
				}}
				placeholder="Search this response…"
			/>
			<span className="response-search-count" aria-live="polite">{status}</span>
			<button className="response-search-nav" onClick={() => onNavigate(-1)} disabled={!canNavigate} aria-label="Previous match" title="Previous match (Shift+Enter)">↑</button>
			<button className="response-search-nav" onClick={() => onNavigate(1)} disabled={!canNavigate} aria-label="Next match" title="Next match (Enter)">↓</button>
			<button className="response-search-nav" onClick={onClose} aria-label="Close search" title="Close (Esc)">✕</button>
		</div>
	);
}

const TABS = ["Pretty", "Raw", "Headers"];

export function ResponseViewer({ response, sending, request, activeEnvironmentId, onGenerateSnippet, onClear }) {
	const [activeTab, setActiveTab] = useState("Pretty");
	const [showSnippet, setShowSnippet] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [currentMatch, setCurrentMatch] = useState(0);
	const [viewTreeAnyway, setViewTreeAnyway] = useState(false);
	const [expandedPaths, setExpandedPaths] = useState(() => new Set());
	const containerRef = useRef(null);
	const bodyWrapRef = useRef(null);
	const searchInputRef = useRef(null);

	const statusCls = response ? statusClass(response.status) : "serr";
	// Parsed exactly once per response body (useMemo keyed on response.body),
	// never re-parsed on unrelated re-renders (typing in the search box,
	// toggling a tree node, etc.) — the tree, the search index, the pretty
	// text, and the size-fallback check all read from this one parse.
	const parsedBody = useMemo(() => {
		if (!response?.body) return { ok: false };
		try { return { ok: true, value: JSON.parse(response.body) }; } catch { return { ok: false }; }
	}, [response?.body]);
	const headerEntries = response?.headers ? Object.entries(response.headers) : [];
	// Only a JSON object/array body gets the tree view; anything else (HTML,
	// XML, plain text, a bare JSON scalar) keeps the existing flat <pre> —
	// JsonView has nothing to render for a non-container payload anyway.
	const parsedJson = parsedBody.ok && parsedBody.value !== null && typeof parsedBody.value === "object" ? parsedBody.value : undefined;

	// Resets expansion to the smart defaults the instant parsedJson changes —
	// done as a render-phase state adjustment (React's sanctioned pattern for
	// "derived state that depends on a prop/memo changing"), not a useEffect,
	// specifically so a brand new response never paints one frame with the
	// *previous* response's expanded paths before correcting itself.
	const [expandedForJson, setExpandedForJson] = useState(parsedJson);
	if (parsedJson !== expandedForJson) {
		setExpandedForJson(parsedJson);
		setExpandedPaths(parsedJson !== undefined ? computeDefaultExpanded(parsedJson) : new Set());
	}

	const isLargeResponse = (response?.size ?? 0) > LARGE_RESPONSE_BYTES;
	const showJsonTree = parsedJson !== undefined && (!isLargeResponse || viewTreeAnyway);
	// The flat pretty-printed text is only needed when the Pretty tab isn't
	// showing the tree; built from the existing parse, once per response.
	const needsPrettyText = activeTab === "Pretty" && !showJsonTree;
	const prettyText = useMemo(() => {
		if (!needsPrettyText) return "";
		return parsedBody.ok ? JSON.stringify(parsedBody.value, null, 2) : (response?.body ?? "");
	}, [needsPrettyText, parsedBody, response?.body]);

	// New response → forget any earlier "view as tree anyway" override, and
	// default straight to Raw for a large one so the user never has to wait
	// on a tree render they didn't ask for.
	useEffect(() => {
		setViewTreeAnyway(false);
		if ((response?.size ?? 0) > LARGE_RESPONSE_BYTES) setActiveTab("Raw");
	}, [response]);

	const onToggleNode = useCallback((path) => {
		setExpandedPaths(prev => {
			const next = new Set(prev);
			next.has(path) ? next.delete(path) : next.add(path);
			return next;
		});
	}, []);
	const expandAll = useCallback(() => {
		if (parsedJson !== undefined) setExpandedPaths(collectAllContainerPaths(parsedJson));
	}, [parsedJson]);
	const collapseAll = useCallback(() => setExpandedPaths(new Set()), []);

	// The search box's live text lives in SearchBar; everything here —
	// walking the parsed JSON for matches, expanding paths, highlighting —
	// runs against debouncedQuery, which SearchBar sets ~200ms after typing
	// pauses, so a fast typist never re-renders this component or the tree.
	const searchQuery = normalizeQuery(debouncedQuery);

	// The actual match-finding, computed once per (parsed value, debounced
	// query) pair — walks the parsed data, not the DOM, and not during
	// JsonView's render. Each match is one leaf/key whose value contains the
	// query (not one per substring occurrence within it) — with jump-to-match
	// navigation, "one match = one row to visit" is the useful granularity;
	// multiple occurrences within the same row are all visible together the
	// instant you scroll to it.
	const jsonMatches = useMemo(
		() => (parsedJson !== undefined ? findJsonMatches(parsedJson, debouncedQuery) : null),
		[parsedJson, debouncedQuery]
	);
	const searchableText = activeTab === "Raw" ? response?.body : (showJsonTree ? null : prettyText);
	const textMatchCount = useMemo(
		() => (searchableText != null ? countTextMatches(searchableText, debouncedQuery) : 0),
		[searchableText, debouncedQuery]
	);
	const usingJsonMatches = activeTab === "Pretty" && showJsonTree;
	const matchTotal = usingJsonMatches ? jsonMatches?.count ?? 0 : textMatchCount;
	const currentJsonMatch = usingJsonMatches ? jsonMatches?.matches[currentMatch] : undefined;

	// Resets to the first match whenever the query or the searched view
	// changes, rather than trying to preserve a position that may no longer
	// exist.
	useEffect(() => { setCurrentMatch(0); }, [debouncedQuery, activeTab, response]);

	// Jump-to-match for the JSON tree: expand exactly the current match's own
	// ancestor chain (not every match's — see jsonSearch.js) so it becomes
	// reachable, then JsonView's own effect (driven by scrollToPath/
	// scrollNonce below) locates and scrolls to it once it exists in the
	// freshly-flattened rows.
	useEffect(() => {
		if (!currentJsonMatch) return;
		setExpandedPaths(prev => {
			let changed = false;
			const next = new Set(prev);
			for (const p of currentJsonMatch.ancestorPaths) {
				if (!next.has(p)) { next.add(p); changed = true; }
			}
			return changed ? next : prev;
		});
	}, [currentJsonMatch]);

	// Raw tab has no tree/ancestors — matches are just <mark> elements in a
	// flat <pre>, so "current" is still applied by finding them in the
	// committed DOM and scrolling. This is a plain post-commit navigation
	// aid, not a counting mechanism (matchTotal above already came from the
	// memoized computation) — see transcripts/02-design-decisions.md for why
	// that distinction matters under StrictMode.
	useEffect(() => {
		if (usingJsonMatches) return;
		const marks = containerRef.current?.querySelectorAll("mark.search-match") ?? [];
		marks.forEach((el, i) => el.classList.toggle("search-match-current", i === currentMatch));
		if (searchOpen) marks[currentMatch]?.scrollIntoView({ block: "center" });
	}, [currentMatch, searchOpen, matchTotal, usingJsonMatches]);

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

	const closeSearch = useCallback(() => { setSearchOpen(false); setDebouncedQuery(""); }, []);
	const toggleSearch = useCallback(() => {
		if (searchOpen) { closeSearch(); return; }
		setSearchOpen(true);
		requestAnimationFrame(() => searchInputRef.current?.focus());
	}, [searchOpen, closeSearch]);
	const goToMatch = useCallback((delta) => {
		setCurrentMatch(m => nextMatchIndex(m, delta, matchTotal));
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
										<SearchBar
											inputRef={searchInputRef}
											appliedQuery={debouncedQuery}
											matchTotal={matchTotal}
											currentMatch={currentMatch}
											onQueryChange={setDebouncedQuery}
											onNavigate={goToMatch}
											onClose={closeSearch}
										/>
									)}
									{activeTab === "Pretty" && showJsonTree && (
										<div className="json-toolbar">
											<button type="button" className="json-toolbar-btn" onClick={expandAll}>Expand all</button>
											<button type="button" className="json-toolbar-btn" onClick={collapseAll}>Collapse all</button>
										</div>
									)}
									<div className="response-body-wrap" role="tabpanel" ref={bodyWrapRef}>
										{activeTab === "Pretty"  && (
											parsedJson === undefined
												? <pre className="response-body">{highlightText(prettyText, searchQuery) || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>
												: !showJsonTree
													? <LargeResponseNotice sizeLabel={formatSize(response.size)} onViewAnyway={() => setViewTreeAnyway(true)} />
													: (
														<div className="response-body response-body-json">
															<JsonView
																value={parsedJson}
																expandedPaths={expandedPaths}
																onToggle={onToggleNode}
																query={searchQuery}
																activePath={currentJsonMatch?.path}
																scrollContainerRef={bodyWrapRef}
																scrollNonce={currentMatch}
															/>
														</div>
													)
										)}
										{activeTab === "Raw"     && <pre className="response-body">{(response.body && highlightText(response.body, searchQuery)) || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>}
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
