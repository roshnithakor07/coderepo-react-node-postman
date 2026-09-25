import { useState, useCallback, useRef } from "react";
import { KeyValueEditor } from "./KeyValueEditor.jsx";
import { AuthPanel } from "./AuthPanel.jsx";
import { buildDisplayUrl, syncParamsFromUrlEdit, tokenizeUrlForDisplay } from "./url.js";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODY_TYPES = ["none", "json", "form", "text", "xml"];

const METHOD_COLORS = {
	GET: "#4ade80",
	POST: "#60a5fa",
	PUT: "#fbbf24",
	PATCH: "#c084fc",
	DELETE: "#f87171",
	HEAD: "#34d399",
	OPTIONS: "#fb923c",
};

function countEnabled(rows) {
	return (rows || []).filter((r) => r.enabled && r.key).length;
}
function hasAuth(auth) {
	if (!auth || auth.type === "none") return false;
	return auth.type === "bearer"
		? !!auth.token
		: auth.type === "basic"
			? !!auth.username
			: auth.type === "apikey"
				? !!auth.apiKeyName
				: false;
}

export function RequestBuilder({ request, onRequestChange, onSend, onSave, sending, activeEnvironmentVariables = [] }) {
	const [activeTab, setActiveTab] = useState("Params");
	const overlayRef = useRef(null);
	const set = useCallback((field, value) => onRequestChange({ ...request, [field]: value }), [request, onRequestChange]);
	const onUrlChange = useCallback(
		(e) => {
			const { base, params: nextParams } = syncParamsFromUrlEdit(e.target.value, request.params || []);
			onRequestChange({ ...request, url: base, params: nextParams });
		},
		[request, onRequestChange],
	);
	// Keeps the read-only highlight layer in lockstep when the real input
	// auto-scrolls its text (e.g. a URL longer than the visible field).
	const onUrlScroll = useCallback((e) => {
		if (overlayRef.current) overlayRef.current.scrollLeft = e.target.scrollLeft;
	}, []);
	const isVariableResolved = useCallback(
		(key) => activeEnvironmentVariables.some((v) => v.enabled && v.key === key),
		[activeEnvironmentVariables],
	);

	const { method = "GET", url = "", params = [], headers = [], auth = { type: "none" }, body = "", bodyType = "none" } = request;
	const displayUrl = buildDisplayUrl(url, params);

	const tabs = [
		{ label: "Params", badge: countEnabled(params) || null },
		{ label: "Auth", badge: hasAuth(auth) ? "●" : null },
		{ label: "Headers", badge: countEnabled(headers) || null },
		{ label: "Body", badge: bodyType !== "none" && body ? "●" : null },
	];

	return (
		<div className="request-builder">
			<div className="request-bar">
				<select
					className="method-select"
					value={method}
					onChange={(e) => set("method", e.target.value)}
					style={{ color: METHOD_COLORS[method] || "inherit" }}
					aria-label="HTTP method"
				>
					{METHODS.map((m) => (
						<option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
							{m}
						</option>
					))}
				</select>

				<div className="url-input-wrap">
					<div className="url-highlight" ref={overlayRef} aria-hidden="true">
						{displayUrl
							? tokenizeUrlForDisplay(displayUrl).map((token, i) =>
									token.type === "variable" ? (
										<span key={i} className={isVariableResolved(token.key) ? "url-var-resolved" : "url-var-unresolved"}>
											{token.value}
										</span>
									) : (
										<span key={i}>{token.value}</span>
									),
								)
							: null}
					</div>
					<input
						className="url-input"
						type="text"
						value={displayUrl}
						onChange={onUrlChange}
						onScroll={onUrlScroll}
						onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSend()}
						placeholder="Enter request URL — use {{variable}} for environment values"
						aria-label="Request URL"
						spellCheck={false}
					/>
				</div>

				<button className="save-btn" onClick={onSave} disabled={!url || sending} title="Save to collection">
					Save
				</button>
				<button className="send-btn" onClick={onSend} disabled={!url || sending} aria-label="Send request">
					{sending ? "Sending…" : "Send"}
				</button>
			</div>

			{sending && (
				<div className="request-loading-bar" role="progressbar" aria-label="Sending request">
					<span />
				</div>
			)}

			<div className="tabs" role="tablist">
				{tabs.map(({ label, badge }) => (
					<button
						key={label}
						role="tab"
						className={`tab-btn ${activeTab === label ? "active" : ""}`}
						aria-selected={activeTab === label}
						onClick={() => setActiveTab(label)}
					>
						{label}
						{badge != null && <span className="tab-count">{badge}</span>}
					</button>
				))}
			</div>

			<div className="tab-panel" role="tabpanel">
				{activeTab === "Params" && (
					<KeyValueEditor rows={params} onChange={(v) => set("params", v)} keyPlaceholder="Parameter" valuePlaceholder="Value" />
				)}
				{activeTab === "Auth" && <AuthPanel auth={auth} onChange={(v) => set("auth", v)} />}
				{activeTab === "Headers" && (
					<KeyValueEditor
						rows={headers}
						onChange={(v) => set("headers", v)}
						keyPlaceholder="Header name"
						valuePlaceholder="Header value"
					/>
				)}
				{activeTab === "Body" && (
					<div className="body-panel">
						<div className="body-type-row">
							<span className="body-type-label">Body type</span>
							{BODY_TYPES.map((t) => (
								<label className="body-type-radio" key={t}>
									<input
										type="radio"
										name="bodyType"
										value={t}
										checked={bodyType === t}
										onChange={() => set("bodyType", t)}
									/>
									{t}
								</label>
							))}
						</div>
						{bodyType !== "none" ? (
							<textarea
								className="body-textarea"
								value={body}
								onChange={(e) => set("body", e.target.value)}
								placeholder={bodyType === "json" ? '{\n  "key": "value"\n}' : "Request body content"}
								spellCheck={false}
							/>
						) : (
							<p className="body-none-msg">This request has no body. Select a content type above to add one.</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
