import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "./features/auth/auth.api.js";
import { WorkspaceLogin } from "./features/auth/WorkspaceLogin.jsx";
import { collectionApi } from "./features/collections/collection.api.js";
import { SaveRequestModal } from "./features/collections/SaveRequestModal.jsx";
import { environmentApi } from "./features/environments/environment.api.js";
import { EnvironmentsModal } from "./features/environments/EnvironmentsModal.jsx";
import { historyApi } from "./features/history/history.api.js";
import { proxyApi, snippetApi } from "./features/request-builder/request.api.js";
import { RequestBuilder } from "./features/request-builder/RequestBuilder.jsx";
import { syncParamsFromUrlEdit } from "./features/request-builder/url.js";
import { ResponseViewer } from "./features/response-viewer/ResponseViewer.jsx";
import { AppHeader } from "./features/workspace/AppHeader.jsx";
import { Sidebar } from "./features/workspace/Sidebar.jsx";
import { hasSessionToken, setSessionToken } from "./shared/api/client.js";
import { applyStoredTheme } from "./shared/utils/theme.js";

applyStoredTheme();

const DEFAULT_REQUEST = { method: "GET", url: "", params: [], headers: [], body: "", bodyType: "none", auth: { type: "none" } };

function BrandIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" fill="none" />
			<circle cx="12" cy="12" r="2.5" fill="#fff" />
			<line x1="12" y1="12" x2="18" y2="6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

function AppBoot() {
	return (
		<div className="app-boot" aria-label="Loading Postman Clone" role="status">
			<div className="app-boot-brand">
				<div className="brand-icon"><BrandIcon /></div>
				<span>Postman Clone</span>
			</div>
			<div className="app-boot-progress" aria-hidden="true"><span /></div>
		</div>
	);
}

export function PostmanWorkspace({ account, onLogout }) {
	const [collections, setCollections] = useState([]);
	const [environments, setEnvironments] = useState([]);
	const [history, setHistory] = useState([]);
	const [request, setRequest] = useState(DEFAULT_REQUEST);
	const [response, setResponse] = useState(null);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const [activeRequestId, setActiveRequestId] = useState(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [showEnvs, setShowEnvs] = useState(false);
	const [showSave, setShowSave] = useState(false);
	const [splitterY, setSplitterY] = useState(45);
	const draggingRef = useRef(false);
	const containerRef = useRef(null);

	const loadCollections = useCallback(async () => {
		try {
			setCollections(await collectionApi.list());
		} catch (e) {
			setError(e.message);
		}
	}, []);

	const loadEnvironments = useCallback(async () => {
		try {
			const envs = await environmentApi.list();
			setEnvironments(envs);
		} catch (e) {
			setError(e.message);
		}
	}, []);

	const loadHistory = useCallback(async () => {
		try {
			setHistory(await historyApi.list());
		} catch (e) {
			setError(e.message);
		}
	}, []);

	useEffect(() => {
		loadCollections();
		loadEnvironments();
		loadHistory();
	}, [loadCollections, loadEnvironments, loadHistory]);

	async function handleSend() {
		if (!request.url || sending) return;
		setSending(true);
		setResponse(null);
		setError("");
		try {
			const activeEnv = environments.find((e) => e.isActive);
			const result = await proxyApi.send({ ...request, environmentId: activeEnv?._id });
			setResponse(result);
			await loadHistory();
		} catch (e) {
			setError(e.message);
		} finally {
			setSending(false);
		}
	}

	async function handleGenerateSnippet(language) {
		const activeEnv = environments.find((e) => e.isActive);
		return snippetApi.generate({ ...request, language, environmentId: activeEnv?._id });
	}

	async function handleSaveRequest(collectionId, data) {
		await collectionApi.createRequest(collectionId, data);
		await loadCollections();
	}

	function handleSelectRequest(req) {
		setRequest({
			method: req.method || "GET",
			url: req.url || "",
			params: req.params || [],
			headers: req.headers || [],
			body: req.body || "",
			bodyType: req.bodyType || "none",
			auth: req.auth || { type: "none" },
		});
		setActiveRequestId(req._id);
		setResponse(null);
		setError("");
	}

	function handleSelectHistory(entry) {
		// History has no params field of its own (it only ever records the final,
		// merged URL that was actually sent) — hydrate params from that URL's
		// query string here, the same way typing/pasting a URL does, so the base
		// stored back into request.url is query-free and nothing gets sent twice.
		const { base, params } = syncParamsFromUrlEdit(entry.url || "", []);
		setRequest({
			method: entry.method || "GET",
			url: base,
			params,
			headers: Object.entries(entry.requestHeaders || {}).map(([key, value]) => ({ key, value, enabled: true })),
			body: entry.requestBody || "",
			bodyType: entry.requestBody ? "json" : "none",
			auth: { type: "none" },
		});
		setActiveRequestId(null);
		setResponse(null);
		setError("");
	}

	async function handleCreateCollection(name) {
		const created = await collectionApi.create({ name, description: "" });
		setCollections((prev) => [...prev, { ...created, requests: [] }]);
	}

	async function handleRenameCollection(id, name) {
		const updated = await collectionApi.update(id, { name });
		setCollections((prev) => prev.map((c) => (c._id === id ? { ...c, name: updated.name } : c)));
	}

	async function handleDeleteCollection(collection) {
		if (!confirm(`Delete collection "${collection.name}" and all its requests?`)) return;
		await collectionApi.remove(collection._id);
		setCollections((prev) => prev.filter((c) => c._id !== collection._id));
	}

	async function handleClearHistory() {
		if (!confirm("Clear all request history?")) return;
		await historyApi.clear();
		setHistory([]);
	}

	async function handleEnvChange(envId) {
		if (!envId) {
			const active = environments.find((e) => e.isActive);
			if (active) {
				await environmentApi.update(active._id, { isActive: false, name: active.name, variables: active.variables });
				setEnvironments((prev) => prev.map((e) => ({ ...e, isActive: false })));
			}
			return;
		}
		await environmentApi.activate(envId);
		setEnvironments((prev) => prev.map((e) => ({ ...e, isActive: e._id === envId })));
	}

	async function handleCreateEnv(data) {
		const created = await environmentApi.create(data);
		setEnvironments((prev) => {
			const deactivated = data.isActive ? prev.map((e) => ({ ...e, isActive: false })) : prev;
			return [...deactivated, created];
		});
	}

	async function handleUpdateEnv(id, data) {
		const updated = await environmentApi.update(id, data);
		setEnvironments((prev) => prev.map((e) => (e._id === id ? updated : e)));
	}

	async function handleActivateEnv(id) {
		await environmentApi.activate(id);
		setEnvironments((prev) => prev.map((e) => ({ ...e, isActive: e._id === id })));
	}

	async function handleDeleteEnv(id) {
		await environmentApi.remove(id);
		setEnvironments((prev) => prev.filter((e) => e._id !== id));
	}

	// Splitter drag
	function onSplitterMouseDown(e) {
		e.preventDefault();
		draggingRef.current = true;
		function onMove(me) {
			if (!draggingRef.current || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const pct = Math.max(20, Math.min(80, ((me.clientY - rect.top) / rect.height) * 100));
			setSplitterY(pct);
		}
		function onUp() {
			draggingRef.current = false;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	return (
		<div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
			<AppHeader
				account={account}
				environments={environments}
				activeEnvId={environments.find((e) => e.isActive)?._id}
				sidebarCollapsed={sidebarCollapsed}
				onToggleSidebar={() => setSidebarCollapsed((s) => !s)}
				onEnvChange={handleEnvChange}
				onOpenEnvs={() => setShowEnvs(true)}
				onLogout={onLogout}
			/>
			<Sidebar
				collections={collections}
				history={history}
				activeRequestId={activeRequestId}
				onSelectRequest={handleSelectRequest}
				onCreateCollection={handleCreateCollection}
				onRenameCollection={handleRenameCollection}
				onDeleteCollection={handleDeleteCollection}
				onClearHistory={handleClearHistory}
				onSelectHistory={handleSelectHistory}
			/>
			<main className="workspace">
				{error && (
					<div className="service-error" role="alert">
						<span>{error}</span>
						<button onClick={() => setError("")}>Dismiss</button>
					</div>
				)}
				<div className="workspace-panes" ref={containerRef}>
					<div className="resizable-pane" style={{ flex: `0 0 ${splitterY}%`, minHeight: "160px" }}>
						<RequestBuilder
							request={request}
							onRequestChange={setRequest}
							onSend={handleSend}
							onSave={() => setShowSave(true)}
							sending={sending}
						/>
					</div>
					<div
						className="splitter"
						onMouseDown={onSplitterMouseDown}
						role="separator"
						aria-label="Resize panels"
						title="Drag to resize"
					/>
					<div className="resizable-pane" style={{ flex: `1 1 ${100 - splitterY}%`, minHeight: "140px" }}>
						<ResponseViewer response={response} sending={sending} onGenerateSnippet={handleGenerateSnippet} />
					</div>
				</div>
			</main>

			{showEnvs && (
				<EnvironmentsModal
					environments={environments}
					onClose={() => { setShowEnvs(false); }}
					onCreate={handleCreateEnv}
					onUpdate={handleUpdateEnv}
					onActivate={handleActivateEnv}
					onDelete={handleDeleteEnv}
				/>
			)}

			{showSave && (
				<SaveRequestModal
					request={request}
					collections={collections}
					onClose={() => setShowSave(false)}
					onSave={handleSaveRequest}
				/>
			)}
		</div>
	);
}

export default function App() {
	const [account, setAccount] = useState(null);
	const [bootstrapping, setBootstrapping] = useState(true);
	const [authLoading, setAuthLoading] = useState(false);
	const [authError, setAuthError] = useState("");
	const accountRef = useRef(null);

	useEffect(() => {
		accountRef.current = account;
	}, [account]);

	useEffect(() => {
		const expire = (event) => {
			// A stale or invalidated token found on page load (e.g. after the demo
			// database is reset) is not a "session expired" event the person needs to
			// see — they were never shown as signed in this visit. Only surface the
			// message when it interrupts an account that was actually in use.
			const wasSignedIn = Boolean(accountRef.current);
			setSessionToken("");
			setAccount(null);
			if (wasSignedIn) setAuthError(event.detail || "Your session has expired. Please sign in again.");
		};
		window.addEventListener("postman-session-expired", expire);
		return () => window.removeEventListener("postman-session-expired", expire);
	}, []);

	useEffect(() => {
		let active = true;
		async function restore() {
			if (!hasSessionToken()) {
				if (active) setBootstrapping(false);
				return;
			}
			try {
				const result = await authApi.session();
				if (active) setAccount(result.account);
			} catch {
				setSessionToken("");
			} finally {
				if (active) setBootstrapping(false);
			}
		}
		restore();
		return () => { active = false; };
	}, []);

	async function login(email, password) {
		try {
			setAuthLoading(true);
			setAuthError("");
			const result = await authApi.login(email, password);
			setSessionToken(result.token);
			setAccount(result.account);
		} catch (e) {
			setAuthError(e.message);
		} finally {
			setAuthLoading(false);
		}
	}

	async function logout() {
		try {
			if (hasSessionToken()) await authApi.logout();
		} catch {}
		setSessionToken("");
		setAccount(null);
		setAuthError("");
	}

	if (bootstrapping) return <AppBoot />;
	if (!account) return <WorkspaceLogin error={authError} loading={authLoading} onLogin={login} />;
	return <PostmanWorkspace account={account} onLogout={logout} />;
}
