import { useState, useCallback } from "react";
import { statusClass, formatSize, formatTime, tryFormatJson } from "../../shared/utils/format.js";

function SnippetPanel({ onGenerateSnippet }) {
	const [lang, setLang] = useState("curl");
	const [snippet, setSnippet] = useState("");
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	async function generate(l) {
		setLang(l); setLoading(true);
		try { const r = await onGenerateSnippet(l); setSnippet(r?.snippet || ""); }
		catch { setSnippet("// Failed to generate snippet."); }
		finally { setLoading(false); }
	}

	async function copy() {
		try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
	}

	return (
		<div className="snippet-panel">
			<div className="snippet-lang-row">
				{["curl", "fetch", "axios", "python"].map(l => (
					<button key={l} className={`snippet-lang-btn ${lang === l ? "active" : ""}`} onClick={() => generate(l)}>{l}</button>
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
				<p className="body-none-msg">Select a language above to generate a ready-to-use code snippet for this request.</p>
			)}
		</div>
	);
}

const TABS = ["Pretty", "Raw", "Headers"];

export function ResponseViewer({ response, sending, onGenerateSnippet }) {
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
				? <SnippetPanel onGenerateSnippet={onGenerateSnippet} />
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
				<div style={{ marginLeft: "auto" }}>{SnippetToggle}</div>
			</div>

			{showSnippet
				? <SnippetPanel onGenerateSnippet={onGenerateSnippet} />
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
