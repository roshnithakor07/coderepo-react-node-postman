import { useState, useCallback } from "react";
import { KeyValueEditor } from "./KeyValueEditor.jsx";
import { AuthPanel } from "./AuthPanel.jsx";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODY_TYPES = ["none", "json", "form", "text", "xml"];
const TABS = ["Params", "Auth", "Headers", "Body"];

function countEnabled(rows) {
	return (rows || []).filter((r) => r.enabled && r.key).length;
}

function hasAuthConfig(auth) {
	if (!auth || auth.type === "none") return false;
	if (auth.type === "bearer") return Boolean(auth.token);
	if (auth.type === "basic") return Boolean(auth.username);
	if (auth.type === "apikey") return Boolean(auth.apiKeyName);
	return false;
}

export function RequestBuilder({ request, onRequestChange, onSend, onSave, sending }) {
	const [activeTab, setActiveTab] = useState("Params");

	const set = useCallback((field, value) => onRequestChange({ ...request, [field]: value }), [request, onRequestChange]);

	const method = request.method || "GET";
	const url = request.url || "";
	const params = request.params || [];
	const headers = request.headers || [];
	const auth = request.auth || { type: "none" };
	const body = request.body || "";
	const bodyType = request.bodyType || "none";

	const tabs = [
		{ label: "Params", badge: countEnabled(params) },
		{ label: "Auth", badge: hasAuthConfig(auth) ? "●" : null },
		{ label: "Headers", badge: countEnabled(headers) },
		{ label: "Body", badge: bodyType !== "none" && body ? "●" : null },
	];

	function handleKeyDown(e) {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSend();
	}

	return (
		<div className="request-builder">
			<div className="request-bar">
				<select
					className={`method-select method-${method}`}
					value={method}
					onChange={(e) => set("method", e.target.value)}
					aria-label="HTTP method"
				>
					{METHODS.map((m) => (
						<option key={m} value={m}>
							{m}
						</option>
					))}
				</select>
				<input
					className="url-input"
					type="text"
					value={url}
					onChange={(e) => set("url", e.target.value)}
					placeholder="Enter URL or paste here… (use {{variable}} for env vars)"
					onKeyDown={handleKeyDown}
					aria-label="Request URL"
				/>
				<button className="save-btn" onClick={onSave} disabled={!url || sending} title="Save to collection">
					Save
				</button>
				<button className="send-btn" onClick={onSend} disabled={!url || sending} aria-label="Send request">
					{sending ? "Sending…" : "Send"}
				</button>
			</div>

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
						{badge ? <span className="tab-count">{badge}</span> : null}
					</button>
				))}
			</div>

			<div className="tab-panel" role="tabpanel">
				{activeTab === "Params" && (
					<KeyValueEditor rows={params} onChange={(v) => set("params", v)} keyPlaceholder="Parameter" valuePlaceholder="Value" />
				)}
				{activeTab === "Auth" && <AuthPanel auth={auth} onChange={(v) => set("auth", v)} />}
				{activeTab === "Headers" && (
					<KeyValueEditor rows={headers} onChange={(v) => set("headers", v)} keyPlaceholder="Header name" valuePlaceholder="Header value" />
				)}
				{activeTab === "Body" && (
					<div>
						<div className="body-type-row">
							<span className="body-type-label">Body type:</span>
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
						{bodyType !== "none" && (
							<textarea
								className="body-textarea"
								value={body}
								onChange={(e) => set("body", e.target.value)}
								placeholder={bodyType === "json" ? '{\n  "key": "value"\n}' : "Request body"}
								spellCheck={false}
							/>
						)}
						{bodyType === "none" && (
							<p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
								This request does not have a body. Select a body type above to add one.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
