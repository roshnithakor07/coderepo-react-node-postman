import { useState, useCallback, useEffect, useRef } from "react";
import { statusClass, formatSize, formatTime, tryFormatJson } from "../../shared/utils/format.js";

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

	const statusCls = response ? statusClass(response.status) : "serr";
	const prettyBody = useCallback(() => (response?.body ? tryFormatJson(response.body) : ""), [response?.body]);
	const headerEntries = response?.headers ? Object.entries(response.headers) : [];

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
		<div className="response-viewer">
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
									<div className="response-body-wrap" role="tabpanel">
										{activeTab === "Pretty"  && <pre className="response-body">{prettyBody() || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>}
										{activeTab === "Raw"     && <pre className="response-body">{response.body || <span style={{ color: "var(--text-tertiary)" }}>Empty response body</span>}</pre>}
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
