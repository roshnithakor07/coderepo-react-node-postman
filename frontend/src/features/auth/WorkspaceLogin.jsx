import { useState } from "react";

function BrandIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="1.8" fill="none" />
			<circle cx="12" cy="12" r="2.5" fill="#fff" />
			<line x1="12" y1="12" x2="18.5" y2="5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

export function WorkspaceLogin({ error, loading, onLogin }) {
	const [email, setEmail] = useState("alex.rivera@postman.dev");
	const [password, setPassword] = useState("password123");

	function handleSubmit(e) {
		e.preventDefault();
		if (!loading) onLogin(email, password);
	}

	return (
		<div className="login-page">
			<div className="login-card">
				<div className="login-brand">
					<div className="brand-icon"><BrandIcon /></div>
					<span>Reqway</span>
				</div>
				<h1>Welcome back</h1>
				<p>Sign in to your workspace to continue.</p>
				<form onSubmit={handleSubmit}>
					<div className="login-field">
						<label htmlFor="login-email">Email address</label>
						<input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={loading} />
					</div>
					<div className="login-field">
						<label htmlFor="login-password">Password</label>
						<input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required disabled={loading} />
					</div>
					<button className="login-submit" type="submit" disabled={loading}>
						{loading ? "Signing in…" : "Sign in"}
					</button>
					{error && <div className="login-error" role="alert">{error}</div>}
				</form>
				<div className="login-hint">
					<strong>Demo credentials</strong> — password: <strong>password123</strong><br />
					alex.rivera@postman.dev · jordan.kim@postman.dev
				</div>
			</div>
		</div>
	);
}
