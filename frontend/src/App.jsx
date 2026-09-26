import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { ToastStack, useToasts } from "./shared/components/Toasts.jsx";
import {
	addSavedRequest,
	buildDuplicatePayload,
	findSavedRequest,
	insertSavedRequestInOrder,
	nextCopyName,
	isSavedRequestDirty,
	removeSavedRequest,
	replaceSavedRequest,
	toSavedFields,
} from "./features/collections/savedRequest.js";

// How far the request/response divider may travel, read from the live
// layout (both bars can change height, e.g. the request bar wraps on narrow
// screens): the request pane can't shrink past the bottom of its tab strip,
// the response pane can't shrink past the bottom of its header bar. Content
// below either may collapse and scroll.
function measurePaneMinimums(requestPane, responsePane) {
	const bottomWithin = (pane, selector) => {
		const el = pane?.querySelector(selector);
		return el ? Math.ceil(el.getBoundingClientRect().bottom - pane.getBoundingClientRect().top) : 0;
	};
	return { request: bottomWithin(requestPane, ".request-builder > .tabs"), response: bottomWithin(responsePane, ".response-bar") };
}

const DEFAULT_REQUEST = {
	method: "GET",
	url: "",
	params: [],
	headers: [],
	body: "",
	bodyType: "none",
	auth: { type: "none" },
};

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
				<div className="brand-icon">
					<BrandIcon />
				</div>
				<span>Reqway</span>
			</div>
			<div className="app-boot-progress" aria-hidden="true">
				<span />
			</div>
		</div>
	);
}

export function PostmanWorkspace({ account, onLogout }) {
	const [collections, setCollections] = useState([]);
	const [environments, setEnvironments] = useState([]);
	const [history, setHistory] = useState([]);
	const [historyCursor, setHistoryCursor] = useState(null);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [request, setRequest] = useState(DEFAULT_REQUEST);
	const [response, setResponse] = useState(null);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const [activeRequestId, setActiveRequestId] = useState(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [showEnvs, setShowEnvs] = useState(false);
	const [showSave, setShowSave] = useState(false);
	const [confirmDialog, setConfirmDialog] = useState(null);
	const [savingRequest, setSavingRequest] = useState(false);
	const { toasts, notify, dismiss } = useToasts();
	// Saved requests with a duplicate in flight — a second request for the same
	// one is ignored, so a double click can't create two copies.
	const duplicatingRef = useRef(new Set());
	// Request pane height in px; null until the first layout, when it's set to
	// the pane's natural height (see the layout effect below).
	const [requestPaneHeight, setRequestPaneHeight] = useState(null);
	const [paneMinimums, setPaneMinimums] = useState({ request: 0, response: 0 });
	const [sidebarWidth, setSidebarWidth] = useState(290);
	const draggingRef = useRef(false);
	const sidebarDraggingRef = useRef(false);
	const containerRef = useRef(null);
	const requestPaneRef = useRef(null);
	const responsePaneRef = useRef(null);
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
		if (sidebarCollapsed) setSidebarWidth(290);
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

	// Always replaces (used on mount and after every send) — the first page
	// is the source of truth for "what's most recent," so a refresh discards
	// whatever additional pages "Load more" had appended.
	const loadHistory = useCallback(async () => {
		try {
			const { items, nextCursor } = await historyApi.list();
			setHistory(items);
			setHistoryCursor(nextCursor);
		} catch (e) {
			setError(e.message);
		}
	}, []);

	const loadMoreHistory = useCallback(async () => {
		if (!historyCursor || historyLoadingMore) return;
		setHistoryLoadingMore(true);
		try {
			const { items, nextCursor } = await historyApi.list({ cursor: historyCursor });
			setHistory((prev) => [...prev, ...items]);
			setHistoryCursor(nextCursor);
		} catch (e) {
			setError(e.message);
		} finally {
			setHistoryLoadingMore(false);
		}
	}, [historyCursor, historyLoadingMore]);

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
			// Deliberately not awaited: refreshing the History sidebar shouldn't
			// hold the response on screen waiting for it. loadHistory has its own
			// internal try/catch, so this can't produce an unhandled rejection.
			loadHistory();
		} catch (e) {
			if (requestGenerationRef.current === generation) setError(e.message);
		} finally {
			if (requestGenerationRef.current === generation) setSending(false);
		}
	}

	function handleClearResponse() {
		setResponse(null);
	}

	async function handleGenerateSnippet(language) {
		const activeEnv = environments.find((e) => e.isActive);
		return snippetApi.generate({ ...request, language, environmentId: activeEnv?._id });
	}

	// The saved request currently loaded into the builder (if it still exists)
	// and whether the builder has diverged from it.
	const activeSaved = findSavedRequest(collections, activeRequestId);
	const activeRequestDirty = activeSaved ? isSavedRequestDirty(request, activeSaved.request) : false;

	// "Save as" from the dialog: creates a new saved request, which then becomes
	// the loaded one, so the next Save updates it instead of duplicating it.
	// Errors propagate to the dialog, which shows them inline.
	async function handleSaveRequest(collectionId, data) {
		const created = await collectionApi.createRequest(collectionId, data);
		setCollections((prev) => addSavedRequest(prev, collectionId, created));
		setActiveRequestId(created._id);
		notify("success", `Saved “${created.name}”`);
	}

	// The Save button: updates the loaded saved request in place (PUT), or
	// opens the save dialog when nothing saved is loaded.
	async function handleSaveClick() {
		if (!activeSaved) {
			setShowSave(true);
			return;
		}
		if (savingRequest) return;
		setSavingRequest(true);
		try {
			const updated = await collectionApi.updateRequest(activeSaved.request._id, toSavedFields(request));
			setCollections((prev) => replaceSavedRequest(prev, updated));
			notify("success", `Saved changes to “${updated.name}”`);
		} catch (e) {
			notify("error", `Couldn’t save “${activeSaved.request.name}”: ${e.message}`);
		} finally {
			setSavingRequest(false);
		}
	}

	// Resolves to true on success so the inline rename form knows to close.
	async function handleRenameRequest(req, name) {
		try {
			const updated = await collectionApi.updateRequest(req._id, { name });
			setCollections((prev) => replaceSavedRequest(prev, updated));
			notify("success", `Renamed to “${updated.name}”`);
			return true;
		} catch (e) {
			notify("error", `Couldn’t rename “${req.name}”: ${e.message}`);
			return false;
		}
	}

	// Duplicates from the stored version (not unsaved builder edits) through the
	// existing create route, then loads the copy. On failure nothing changes.
	async function handleDuplicateRequest(req) {
		if (duplicatingRef.current.has(req._id)) return;
		duplicatingRef.current.add(req._id);
		try {
			const collection = collections.find((c) => (c.requests || []).some((r) => r._id === req._id));
			if (!collection) throw new Error("The request is no longer in a collection.");
			const name = nextCopyName(
				req.name,
				(collection.requests || []).map((r) => r.name),
			);
			const created = await collectionApi.createRequest(collection._id, buildDuplicatePayload(req, name));
			setCollections((prev) => insertSavedRequestInOrder(prev, collection._id, created));
			handleSelectRequest(created);
			notify("success", `Cloned as “${created.name}”`);
		} catch (e) {
			notify("error", `Couldn’t clone “${req.name}”: ${e.message}`);
		} finally {
			duplicatingRef.current.delete(req._id);
		}
	}

	// Copies the URL exactly as saved — {{variables}} stay unresolved. The
	// Clipboard API can be missing (non-secure context) or refused; both land
	// in the error toast.
	async function handleCopyRequestUrl(req) {
		try {
			await navigator.clipboard.writeText(req.url || "");
			notify("success", "URL copied");
		} catch {
			notify("error", "Couldn’t copy the URL — clipboard access was blocked.");
		}
	}

	function handleDeleteRequest(req) {
		setConfirmDialog({
			title: "Delete saved request?",
			message: `You’re about to permanently delete “${req.name}”. This action cannot be undone.`,
			confirmLabel: "Delete request",
			onConfirm: async () => {
				setConfirmDialog(null);
				try {
					await collectionApi.removeRequest(req._id);
					setCollections((prev) => removeSavedRequest(prev, req._id));
					// The builder keeps its contents; it's just no longer linked.
					setActiveRequestId((id) => (id === req._id ? null : id));
					notify("success", `Deleted “${req.name}”`);
				} catch (e) {
					notify("error", `Couldn’t delete “${req.name}”: ${e.message}`);
				}
			},
		});
	}

	// No confirm: the entry disappears at once and comes back if the server
	// refuses, so the list always reflects what's actually stored.
	async function handleDeleteHistoryEntry(entry) {
		const index = history.findIndex((e) => e._id === entry._id);
		setHistory((prev) => prev.filter((e) => e._id !== entry._id));
		try {
			await historyApi.remove(entry._id);
			notify("success", "Removed from history");
		} catch (e) {
			setHistory((prev) => {
				if (prev.some((e2) => e2._id === entry._id)) return prev;
				const next = [...prev];
				next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, entry);
				return next;
			});
			notify("error", `Couldn’t remove the history entry: ${e.message}`);
		}
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

	async function handleSelectHistory(summary) {
		// The sidebar list only carries lightweight summaries now (id, method,
		// url, status, time, size, createdAt) — no headers/body — so the full
		// entry has to be fetched before it can be reloaded into the builder.
		let entry;
		try {
			entry = await historyApi.getById(summary._id);
		} catch (e) {
			setError(e.message);
			return;
		}
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

	// Resolves to true on success so the inline rename form knows to close.
	async function handleRenameCollection(id, name) {
		try {
			const updated = await collectionApi.update(id, { name });
			setCollections((prev) => prev.map((c) => (c._id === id ? { ...c, name: updated.name } : c)));
			notify("success", `Renamed to “${updated.name}”`);
			return true;
		} catch (e) {
			notify("error", `Couldn’t rename the collection: ${e.message}`);
			return false;
		}
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
				setHistoryCursor(null);
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
		return updated;
	}

	async function handleActivateEnv(id) {
		await environmentApi.activate(id);
		setEnvironments((prev) => prev.map((e) => ({ ...e, isActive: e._id === id })));
	}

	async function handleDeleteEnv(id) {
		await environmentApi.remove(id);
		setEnvironments((prev) => prev.filter((e) => e._id !== id));
	}

	// Default split: on first layout the request pane renders at its natural
	// height — request bar, tabs, the table header, its one empty row and the
	// panel's bottom padding — and that height is then fixed in px. Runs
	// before paint, so no partially cut row is ever shown.
	useLayoutEffect(() => {
		if (requestPaneHeight !== null || !requestPaneRef.current) return;
		setRequestPaneHeight(Math.ceil(requestPaneRef.current.getBoundingClientRect().height));
		setPaneMinimums(measurePaneMinimums(requestPaneRef.current, responsePaneRef.current));
	}, [requestPaneHeight]);

	// The bars' heights depend on the window width, so re-read the minimums.
	useEffect(() => {
		function onResize() {
			setPaneMinimums(measurePaneMinimums(requestPaneRef.current, responsePaneRef.current));
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Splitter drag: the pane follows the pointer's movement from where the
	// divider was grabbed (no jump on grab), clamped to the measured minimums.
	function onSplitterMouseDown(e) {
		e.preventDefault();
		if (!containerRef.current || !requestPaneRef.current) return;
		draggingRef.current = true;
		const minimums = measurePaneMinimums(requestPaneRef.current, responsePaneRef.current);
		setPaneMinimums(minimums);
		const startY = e.clientY;
		const startHeight = requestPaneRef.current.getBoundingClientRect().height;
		const splitterHeight = e.currentTarget.getBoundingClientRect().height;
		function onMove(me) {
			if (!draggingRef.current || !containerRef.current) return;
			const available = containerRef.current.getBoundingClientRect().height - splitterHeight;
			const max = Math.max(minimums.request, available - minimums.response);
			setRequestPaneHeight(Math.min(max, Math.max(minimums.request, startHeight + me.clientY - startY)));
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
				onToggleSidebar={() => setSidebarCollapsed((s) => !s)}
				onEnvChange={handleEnvChange}
				onOpenEnvs={() => setShowEnvs(true)}
				onLogout={onLogout}
			/>
			<Sidebar
				collections={collections}
				history={history}
				historyHasMore={Boolean(historyCursor)}
				historyLoadingMore={historyLoadingMore}
				onLoadMoreHistory={loadMoreHistory}
				activeRequestId={activeSaved ? activeRequestId : null}
				activeRequestDirty={activeRequestDirty}
				onSelectRequest={handleSelectRequest}
				onCreateCollection={handleCreateCollection}
				onRenameCollection={handleRenameCollection}
				onDeleteCollection={handleDeleteCollection}
				onRenameRequest={handleRenameRequest}
				onDuplicateRequest={handleDuplicateRequest}
				onCopyRequestUrl={handleCopyRequestUrl}
				onDeleteRequest={handleDeleteRequest}
				onClearHistory={handleClearHistory}
				onSelectHistory={handleSelectHistory}
				onDeleteHistoryEntry={handleDeleteHistoryEntry}
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
					<div
						className="resizable-pane"
						ref={requestPaneRef}
						style={{
							flex: requestPaneHeight === null ? "0 0 auto" : `0 1 ${requestPaneHeight}px`,
							minHeight: paneMinimums.request,
						}}
					>
						<RequestBuilder
							request={request}
							onRequestChange={updateRequest}
							onSend={handleSend}
							onSave={handleSaveClick}
							onSaveAs={() => setShowSave(true)}
							savingRequest={savingRequest}
							savedContext={
								activeSaved
									? {
											collectionName: activeSaved.collection.name,
											name: activeSaved.request.name,
											dirty: activeRequestDirty,
										}
									: null
							}
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
					<div className="resizable-pane" ref={responsePaneRef} style={{ flex: "1 1 0", minHeight: paneMinimums.response }}>
						<ResponseViewer
							response={response}
							sending={sending}
							request={request}
							activeEnvironmentId={environments.find((e) => e.isActive)?._id}
							onGenerateSnippet={handleGenerateSnippet}
							onClear={handleClearResponse}
						/>
					</div>
				</div>
			</main>

			{showEnvs && (
				<EnvironmentsModal
					environments={environments}
					onClose={() => {
						setShowEnvs(false);
					}}
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

			{confirmDialog && <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(null)} />}
			<ToastStack toasts={toasts} onDismiss={dismiss} />
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
		return () => {
			active = false;
		};
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
