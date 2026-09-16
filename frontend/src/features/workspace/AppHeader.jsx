import { useState } from "react";
import { getTheme, setTheme } from "../../shared/utils/theme.js";

function BrandIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" fill="none" />
			<circle cx="12" cy="12" r="2.5" fill="#fff" />
			<line x1="12" y1="12" x2="18" y2="6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

export function AppHeader({ account, environments, activeEnvId, sidebarCollapsed, onToggleSidebar, onEnvChange, onOpenEnvs, onLogout }) {
	const [theme, setThemeState] = useState(getTheme());

	function toggleTheme() {
		const next = theme === "dark" ? "light" : "dark";
		setTheme(next);
		setThemeState(next);
	}

	const activeEnv = environments.find((e) => e.isActive);

	return (
		<header className="app-header">
			<button className="icon-btn sidebar-toggle" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"} title="Toggle sidebar">
				☰
			</button>
			<a className="header-brand" href="#" onClick={(e) => e.preventDefault()}>
				<div className="brand-icon"><BrandIcon /></div>
				<span>Postman Clone</span>
			</a>

			<div className="header-actions">
				<div className="env-selector">
					<label htmlFor="env-select">Environment</label>
					<select
						id="env-select"
						className="env-select"
						value={activeEnv?._id || ""}
						onChange={(e) => onEnvChange(e.target.value)}
						aria-label="Active environment"
					>
						<option value="">No environment</option>
						{environments.map((env) => (
							<option key={env._id} value={env._id}>{env.name}</option>
						))}
					</select>
					<button className="icon-btn" onClick={onOpenEnvs} title="Manage environments" aria-label="Manage environments" style={{ fontSize: 16 }}>
						⚙
					</button>
				</div>

				<button className="icon-btn theme-btn" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label="Toggle theme">
					{theme === "dark" ? "☀️" : "🌙"}
				</button>

				<button className="icon-btn profile-btn" title={account?.email} aria-label="Account">
					<span style={{ fontSize: 13, fontWeight: 600 }}>{account?.name?.split(" ")[0]}</span>
				</button>

				<button className="logout-btn" onClick={onLogout}>Sign out</button>
			</div>
		</header>
	);
}
