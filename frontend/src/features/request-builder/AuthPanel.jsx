export function AuthPanel({ auth, onChange }) {
	const type = auth?.type || "none";
	const set = (field, value) => onChange({ ...auth, type, [field]: value });
	const setType = (t) => onChange({ type: t });

	return (
		<div className="auth-panel">
			<div className="auth-type-row">
				<span className="auth-type-label">Type</span>
				<select className="auth-type-select" value={type} onChange={(e) => setType(e.target.value)}>
					<option value="none">No Auth</option>
					<option value="bearer">Bearer Token</option>
					<option value="basic">Basic Auth</option>
					<option value="apikey">API Key</option>
				</select>
			</div>

			{type === "bearer" && (
				<div className="auth-field">
					<label>Token</label>
					<input
						className="auth-input"
						type="text"
						value={auth?.token || ""}
						onChange={(e) => set("token", e.target.value)}
						placeholder="Enter Bearer token or {{variable}}"
					/>
				</div>
			)}

			{type === "basic" && (
				<>
					<div className="auth-field">
						<label>Username</label>
						<input
							className="auth-input"
							type="text"
							value={auth?.username || ""}
							onChange={(e) => set("username", e.target.value)}
							placeholder="Username"
						/>
					</div>
					<div className="auth-field">
						<label>Password</label>
						<input
							className="auth-input"
							type="password"
							value={auth?.password || ""}
							onChange={(e) => set("password", e.target.value)}
							placeholder="Password"
						/>
					</div>
				</>
			)}

			{type === "apikey" && (
				<>
					<div className="auth-field">
						<label>Key name</label>
						<input
							className="auth-input"
							type="text"
							value={auth?.apiKeyName || ""}
							onChange={(e) => set("apiKeyName", e.target.value)}
							placeholder="X-API-Key"
						/>
					</div>
					<div className="auth-field">
						<label>Key value</label>
						<input
							className="auth-input"
							type="text"
							value={auth?.apiKeyValue || ""}
							onChange={(e) => set("apiKeyValue", e.target.value)}
							placeholder="Your API key or {{variable}}"
						/>
					</div>
					<div className="auth-field">
						<label>Add to</label>
						<div className="auth-placement">
							{["header", "query"].map((loc) => (
								<label className="auth-radio" key={loc}>
									<input
										type="radio"
										name="apiKeyIn"
										value={loc}
										checked={(auth?.apiKeyIn || "header") === loc}
										onChange={() => set("apiKeyIn", loc)}
									/>
									{loc === "header" ? "Header" : "Query param"}
								</label>
							))}
						</div>
					</div>
				</>
			)}

			{type === "none" && (
				<p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
					No authentication will be sent with this request.
				</p>
			)}
		</div>
	);
}
