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
import { ConfirmDialog } from "./shared/components/ConfirmDialog.jsx";

const DEFAULT_REQUEST = { method: "GET", url: "", params: [{ key: "", value: "", enabled: false }, { key: "", value: "", enabled: false }], headers: [], body: "", bodyType: "none", auth: { type: "none" } };

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
		<div className="app-boot" aria-label="Loading Reqway" role="status">
			<div className="app-boot-brand">
				<div className="brand-icon"><BrandIcon /></div>
				<span>Reqway</span>
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
	const [confirmDialog, setConfirmDialog] = useState(null);
	const [splitterY, setSplitterY] = useState(50);
	const [sidebarWidth, setSidebarWidth] = useState(260);
	const draggingRef = useRef(false);
	const sidebarDraggingRef = useRef(false);
	const containerRef = useRef(null);
	// Bumped by every action that changes what "the current request" means —
	// selecting a saved/history request, or editing any field. handleSend()
	// captures this before its await and checks it after: if a slower, earlier
	// send's result comes back after the user has moved on, its generation no
	// longer matches and the stale response/error/loading state is discarded
	// instead of being applied on top of whatever is now on screen.
	const requestGenerationRef = useRef(0);

	// Closing the sidebar must not leave it remembering a narrow resized width —
	// reopening should always start from the normal, usable default.
	useEffect(() => {
		if (sidebarCollapsed) setSidebarWidth(260);
	}, [sidebarCollapsed]);

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

	// Single centralized place every request-context change flows through:
	// RequestBuilder's onRequestChange (method/url/params/headers/auth/body
	// edits) and both request-selection handlers all call this instead of
	// setRequest directly, so none of those trigger points need their own
	// copy of the invalidation logic.
	function updateRequest(next) {
		requestGenerationRef.current += 1;
		setSending(false);
		setRequest(next);
	}

	async function handleSend() {
		if (!request.url || sending) return;
		const generation = requestGenerationRef.current;
		setSending(true);
		setResponse(null);
		setError("");
		try {
			const activeEnv = environments.find((e) => e.isActive);
			const result = await proxyApi.send({ ...request, environmentId: activeEnv?._id });
			if (requestGenerationRef.current === generation) setResponse(result);
			await loadHistory();
		} catch (e) {
			if (requestGenerationRef.current === generation) setError(e.message);
		} finally {
			if (requestGenerationRef.current === generation) setSending(false);
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
		updateRequest({
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
		updateRequest({
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

	function handleDeleteCollection(collection) {
		setConfirmDialog({
			title: "Delete collection?",
			message: `You’re about to permanently delete “${collection.name}” and all requests inside it. This action cannot be undone.`,
			confirmLabel: "Delete collection",
			onConfirm: async () => {
				setConfirmDialog(null);
				await collectionApi.remove(collection._id);
				setCollections((prev) => prev.filter((c) => c._id !== collection._id));
			},
		});
	}

	function handleClearHistory() {
		setConfirmDialog({
			title: "Clear request history?",
			message: "You’re about to permanently remove all saved request history. This action cannot be undone.",
			confirmLabel: "Clear history",
			onConfirm: async () => {
				setConfirmDialog(null);
				await historyApi.clear();
				setHistory([]);
			},
		});
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
			const pct = Math.max(5, Math.min(95, ((me.clientY - rect.top) / rect.height) * 100));
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

	// Sidebar resize drag — drag right widens, drag left narrows, dragging past the
	// minimum snaps into the existing collapsed state rather than shrinking further.
	function onSidebarResizeMouseDown(e) {
		e.preventDefault();
		sidebarDraggingRef.current = true;
		// Below the 768px breakpoint the sidebar becomes a toggled overlay and the
		// "sidebar-collapsed" class's meaning inverts (it then means "shown"), so the
		// away/visible booleans below have to flip with it to match the existing CSS.
		const isMobile = window.innerWidth <= 768;
		function onMove(me) {
			// If a mouseup was ever lost (e.g. the button was released outside the
			// browser window), the next mousemove's own buttons state catches it and
			// ends the drag immediately, instead of trusting the ref indefinitely.
			if (!sidebarDraggingRef.current || me.buttons !== 1) {
				onUp();
				return;
			}
			if (me.clientX < 180) {
				setSidebarCollapsed(!isMobile);
				return;
			}
			setSidebarCollapsed(isMobile);
			setSidebarWidth(Math.max(180, Math.min(480, me.clientX)));
		}
		function onUp() {
			sidebarDraggingRef.current = false;
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		}
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}

	return (
		<div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} style={{ "--sidebar-w": `${sidebarWidth}px` }}>
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
				onResizeMouseDown={onSidebarResizeMouseDown}
			/>
			<main className="workspace">
				{error && (
					<div className="service-error" role="alert">
						<span>{error}</span>
						<button onClick={() => setError("")}>Dismiss</button>
					</div>
				)}
				<div className="workspace-panes" ref={containerRef}>
					<div className="resizable-pane" style={{ flex: `0 0 ${splitterY}%`, minHeight: "95px" }}>
						<RequestBuilder
							request={request}
							onRequestChange={updateRequest}
							onSend={handleSend}
							onSave={() => setShowSave(true)}
							sending={sending}
							activeEnvironmentVariables={environments.find((e) => e.isActive)?.variables || []}
						/>
					</div>
					<div
						className="splitter"
						onMouseDown={onSplitterMouseDown}
						role="separator"
						aria-label="Resize panels"
						title="Drag to resize"
					/>
					<div className="resizable-pane" style={{ flex: `1 1 ${100 - splitterY}%`, minHeight: "56px" }}>
						<ResponseViewer
							response={response}
							sending={sending}
							request={request}
							activeEnvironmentId={environments.find((e) => e.isActive)?._id}
							onGenerateSnippet={handleGenerateSnippet}
						/>
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

			{confirmDialog && (
				<ConfirmDialog
					{...confirmDialog}
					onCancel={() => setConfirmDialog(null)}
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
