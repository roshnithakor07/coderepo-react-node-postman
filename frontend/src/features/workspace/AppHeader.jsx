function BrandIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="1.8" fill="none" />
			<circle cx="12" cy="12" r="2.5" fill="#fff" />
			<line x1="12" y1="12" x2="18.5" y2="5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

export function AppHeader({ account, environments, sidebarCollapsed, onToggleSidebar, onEnvChange, onOpenEnvs, onLogout }) {
	const activeEnv = environments.find(e => e.isActive);
	const initials = account?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

	return (
		<header className="app-header">
			<button className="icon-btn sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">
				☰
			</button>
			<div className="header-brand">
				<div className="brand-icon"><BrandIcon /></div>
				<span>Reqway</span>
			</div>
			<div className="header-divider" aria-hidden="true" />

			<div className="header-actions">
				<div className="env-selector">
					<label htmlFor="env-select">Env</label>
					<select
						id="env-select"
						className="env-select"
						value={activeEnv?._id || ""}
						onChange={e => onEnvChange(e.target.value)}
						aria-label="Active environment"
					>
						<option value="">No environment</option>
						{environments.map(env => (
							<option key={env._id} value={env._id}>{env.name}</option>
						))}
					</select>
					<button className="icon-btn" onClick={onOpenEnvs} title="Manage environments" aria-label="Manage environments">
						⚙
					</button>
				</div>

				<div className="header-divider" aria-hidden="true" />

				<div className="account-chip" title={account?.email}>
					<div className="account-avatar">{initials}</div>
					<span>{account?.name?.split(" ")[0] || "User"}</span>
				</div>

				<button className="logout-btn" onClick={onLogout}>Sign out</button>
			</div>
		</header>
	);
}
