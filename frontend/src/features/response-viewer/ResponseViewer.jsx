import { useState, useCallback } from "react";
import { statusClass, formatSize, formatTime, tryFormatJson } from "../../shared/utils/format.js";

const TABS = ["Pretty", "Raw", "Headers"];

function SnippetPanel({ request, onGenerateSnippet }) {
	const [lang, setLang] = useState("curl");
	const [snippet, setSnippet] = useState("");
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	async function generate(language) {
		setLang(language);
		setLoading(true);
		try {
			const result = await onGenerateSnippet(language);
			setSnippet(result?.snippet || "");
		} catch {
			setSnippet("// Failed to generate snippet");
		} finally {
			setLoading(false);
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(snippet);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	}

	return (
		<div className="snippet-panel">
			<div className="snippet-lang-row">
				{["curl", "fetch", "axios", "python"].map((l) => (
					<button key={l} className={`snippet-lang-btn ${lang === l ? "active" : ""}`} onClick={() => generate(l)}>
						{l}
					</button>
				))}
			</div>
			{loading && <div className="response-loading"><div className="spinner" /> Generating…</div>}
			{!loading && snippet && (
				<>
					<pre className="snippet-code">{snippet}</pre>
					<button className="snippet-copy-btn" onClick={copy}>
						{copied ? "Copied!" : "Copy"}
					</button>
				</>
			)}
			{!loading && !snippet && (
				<p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
					Select a language above to generate a code snippet for the current request.
				</p>
			)}
		</div>
	);
}

export function ResponseViewer({ response, sending, onGenerateSnippet }) {
	const [activeTab, setActiveTab] = useState("Pretty");
	const [showSnippet, setShowSnippet] = useState(false);

	const statusCls = response ? statusClass(response.status) : "";

	const prettyBody = useCallback(() => {
		if (!response?.body) return "";
		return tryFormatJson(response.body);
	}, [response?.body]);

	const headerEntries = response?.headers ? Object.entries(response.headers) : [];

	if (sending) {
		return (
			<div className="response-viewer">
				<div className="response-bar">
					<h3>Response</h3>
				</div>
				<div className="response-loading">
					<div className="spinner" aria-label="Loading" />
					<span>Sending request…</span>
				</div>
			</div>
		);
	}

	if (!response) {
		return (
			<div className="response-viewer">
				<div className="response-bar">
					<h3>Response</h3>
					<div style={{ marginLeft: "auto" }}>
						<button
							className={`icon-btn ${showSnippet ? "active" : ""}`}
							onClick={() => setShowSnippet((s) => !s)}
							title="Code snippet"
							style={{ width: "auto", padding: "0 12px", fontSize: 12, fontWeight: 600, gap: 5 }}
						>
							{"</>"}  Snippets
						</button>
					</div>
				</div>
				{showSnippet ? (
					<SnippetPanel onGenerateSnippet={onGenerateSnippet} />
				) : (
					<div className="response-empty">
						<div className="response-empty-icon">📡</div>
						<span>Send a request to see the response here.</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="response-viewer">
			<div className="response-bar">
				<h3>Response</h3>
				{response.error ? (
					<span className="status-badge serr">Error</span>
				) : (
					<span className={`status-badge ${statusCls}`}>
						{response.status} {response.statusText}
					</span>
				)}
				<div className="response-meta">
					{response.responseTime != null && (
						<span className="meta-chip">
							<strong>{formatTime(response.responseTime)}</strong>
						</span>
					)}
					{response.size != null && response.size > 0 && (
						<span className="meta-chip">
							<strong>{formatSize(response.size)}</strong>
						</span>
					)}
				</div>
				<div style={{ marginLeft: "auto" }}>
					<button
						className={`icon-btn ${showSnippet ? "active" : ""}`}
						onClick={() => setShowSnippet((s) => !s)}
						title="Code snippet"
						style={{ width: "auto", padding: "0 12px", fontSize: 12, fontWeight: 600 }}
					>
						{"</>"} Snippets
					</button>
				</div>
			</div>

			{showSnippet ? (
				<SnippetPanel onGenerateSnippet={onGenerateSnippet} />
			) : (
				<>
					{response.error ? (
						<div className="response-error" role="alert">
							<strong>Request failed: </strong>
							{response.error}
						</div>
					) : (
						<>
							<div className="tabs" role="tablist">
								{TABS.map((t) => (
									<button
										key={t}
										role="tab"
										className={`tab-btn ${activeTab === t ? "active" : ""}`}
										aria-selected={activeTab === t}
										onClick={() => setActiveTab(t)}
									>
										{t}
										{t === "Headers" && headerEntries.length > 0 && (
											<span className="tab-count">{headerEntries.length}</span>
										)}
									</button>
								))}
							</div>
							<div className="response-body-wrap" role="tabpanel">
								{activeTab === "Pretty" && (
									<pre className="response-body">{prettyBody() || <span style={{ color: "var(--muted)" }}>Empty response body</span>}</pre>
								)}
								{activeTab === "Raw" && (
									<pre className="response-body">{response.body || <span style={{ color: "var(--muted)" }}>Empty response body</span>}</pre>
								)}
								{activeTab === "Headers" && (
									<table className="headers-table">
										<thead>
											<tr>
												<th>Name</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											{headerEntries.length === 0 ? (
												<tr>
													<td colSpan={2} style={{ color: "var(--muted)", textAlign: "center" }}>
														No response headers
													</td>
												</tr>
											) : (
												headerEntries.map(([key, value]) => (
													<tr key={key}>
														<td>{key}</td>
														<td>{String(value)}</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								)}
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
}
