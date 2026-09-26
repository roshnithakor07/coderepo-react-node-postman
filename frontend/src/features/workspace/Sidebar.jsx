import { useState, useRef, useEffect } from "react";
import { statusClass } from "../../shared/utils/format.js";

// Rename / Delete menu shared by collections and saved requests.
function ItemMenu({ onRename, onDelete, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		const handler = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", handler);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", handler);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);
	return (
		<div className="dropdown-menu" ref={ref} role="menu">
			<button
				className="dropdown-item"
				role="menuitem"
				onClick={() => {
					onRename();
					onClose();
				}}
			>
				✏ Rename
			</button>
			<button
				className="dropdown-item danger"
				role="menuitem"
				onClick={() => {
					onDelete();
					onClose();
				}}
			>
				🗑 Delete
			</button>
		</div>
	);
}

// Inline rename form, used for saved requests. `onSubmit(name)` resolves to
// true on success; on failure the form stays open so the name isn't lost.
function InlineRename({ initial, onSubmit, onCancel, label }) {
	const [value, setValue] = useState(initial);
	const [pending, setPending] = useState(false);
	async function handleSubmit(e) {
		e.preventDefault();
		const name = value.trim();
		if (!name || name === initial) return onCancel();
		setPending(true);
		const ok = await onSubmit(name);
		setPending(false);
		if (ok) onCancel();
	}
	return (
		<form className="inline-form" onSubmit={handleSubmit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
			<input
				className="inline-input"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				autoFocus
				disabled={pending}
				aria-label={label}
			/>
			<button className="inline-btn inline-btn-ok" type="submit" disabled={pending || !value.trim()} aria-label="Save name">
				{pending ? "…" : "✓"}
			</button>
			<button className="inline-btn inline-btn-cancel" type="button" onClick={onCancel} disabled={pending} aria-label="Cancel rename">
				✕
			</button>
		</form>
	);
}

function CollectionItem({
	collection,
	defaultOpen,
	activeRequestId,
	activeRequestDirty,
	onSelectRequest,
	onRenameCollection,
	onDeleteCollection,
	onRenameRequest,
	onDeleteRequest,
}) {
	const [open, setOpen] = useState(defaultOpen);
	const [menuOpen, setMenuOpen] = useState(false);
	const [requestMenuId, setRequestMenuId] = useState(null);
	const [renamingRequestId, setRenamingRequestId] = useState(null);
	const requests = collection.requests || [];

	return (
		<div className="collection-item">
			<div className="menu-anchor">
				<div
					className="collection-header"
					role="button"
					tabIndex={0}
					onClick={() => setOpen((o) => !o)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setOpen((o) => !o);
						}
					}}
					aria-expanded={open}
				>
					<span className={`collection-chevron ${open ? "open" : ""}`}>▶</span>
					<span className="coll-icon">📁</span>
					<span className="collection-name" title={collection.name}>
						{collection.name}
					</span>
					<button
						className="collection-menu-btn"
						onClick={(e) => {
							e.stopPropagation();
							setMenuOpen((m) => !m);
						}}
						aria-label={`Options for ${collection.name}`}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
					>
						⋯
					</button>
				</div>
				{menuOpen && (
					<ItemMenu
						onRename={() => onRenameCollection(collection)}
						onDelete={() => onDeleteCollection(collection)}
						onClose={() => setMenuOpen(false)}
					/>
				)}
			</div>
			{open && (
				<div className="collection-requests">
					{requests.length === 0 ? (
						<p className="no-data">No saved requests</p>
					) : (
						requests.map((req) =>
							renamingRequestId === req._id ? (
								<InlineRename
									key={req._id}
									initial={req.name}
									label={`Rename ${req.name}`}
									onSubmit={(name) => onRenameRequest(req, name)}
									onCancel={() => setRenamingRequestId(null)}
								/>
							) : (
								<div key={req._id} className={`request-row ${activeRequestId === req._id ? "active" : ""}`}>
									<button
										className={`request-item ${activeRequestId === req._id ? "active" : ""}`}
										onClick={() => onSelectRequest(req)}
									>
										<span className={`method-badge method-${req.method}`}>{req.method}</span>
										<span className="req-name" title={req.name}>
											{req.name}
										</span>
										{activeRequestId === req._id && activeRequestDirty && (
											<span className="request-dirty-dot" title="Unsaved changes" aria-label="Unsaved changes" />
										)}
									</button>
									<div className="menu-anchor">
										<button
											className="request-menu-btn"
											onClick={() => setRequestMenuId((id) => (id === req._id ? null : req._id))}
											aria-label={`Options for ${req.name}`}
											aria-haspopup="menu"
											aria-expanded={requestMenuId === req._id}
										>
											⋯
										</button>
										{requestMenuId === req._id && (
											<ItemMenu
												onRename={() => setRenamingRequestId(req._id)}
												onDelete={() => onDeleteRequest(req)}
												onClose={() => setRequestMenuId(null)}
											/>
										)}
									</div>
								</div>
							),
						)
					)}
				</div>
			)}
		</div>
	);
}

export function Sidebar({
	collections,
	history,
	historyHasMore,
	historyLoadingMore,
	onLoadMoreHistory,
	activeRequestId,
	activeRequestDirty,
	onSelectRequest,
	onCreateCollection,
	onRenameCollection,
	onDeleteCollection,
	onRenameRequest,
	onDeleteRequest,
	onClearHistory,
	onSelectHistory,
	onDeleteHistoryEntry,
	onResizeMouseDown,
}) {
	const [activeTab, setActiveTab] = useState("Collections");
	const [showNew, setShowNew] = useState(false);
	const [newName, setNewName] = useState("");
	const [renaming, setRenaming] = useState(null);
	const [renameName, setRenameName] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleCreate(e) {
		e.preventDefault();
		if (!newName.trim() || saving) return;
		setSaving(true);
		try {
			await onCreateCollection(newName.trim());
			setShowNew(false);
			setNewName("");
		} finally {
			setSaving(false);
		}
	}

	async function handleRename(e) {
		e.preventDefault();
		if (!renameName.trim()) return setRenaming(null);
		await onRenameCollection(renaming._id, renameName.trim());
		setRenaming(null);
		setRenameName("");
	}

	function startRename(col) {
		setRenaming(col);
		setRenameName(col.name);
	}

	return (
		<div className="sidebar">
			<div className="sidebar-inner">
				<div className="sidebar-tabs" role="tablist">
					{["Collections", "History"].map((tab) => (
						<button
							key={tab}
							role="tab"
							className={`sidebar-tab ${activeTab === tab ? "active" : ""}`}
							aria-selected={activeTab === tab}
							onClick={() => setActiveTab(tab)}
						>
							{tab}
						</button>
					))}
				</div>

				<div className="sidebar-content">
					{activeTab === "Collections" && (
						<>
							<div className="sidebar-section-header">
								<span className="sidebar-section-title">Collections</span>
								<button className="new-btn" onClick={() => setShowNew((s) => !s)}>
									+ New
								</button>
							</div>

							{showNew && (
								<form className="inline-form" onSubmit={handleCreate}>
									<input
										className="inline-input"
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
										placeholder="Collection name"
										autoFocus
										disabled={saving}
									/>
									<button className="inline-btn inline-btn-ok" type="submit" disabled={saving || !newName.trim()}>
										✓
									</button>
									<button
										className="inline-btn inline-btn-cancel"
										type="button"
										onClick={() => {
											setShowNew(false);
											setNewName("");
										}}
									>
										✕
									</button>
								</form>
							)}

							{collections.length === 0 && !showNew && (
								<div className="empty-state">
									<div className="empty-state-icon">📂</div>
									<p>No collections yet. Create one to start organizing your requests.</p>
								</div>
							)}

							{collections.map((col) =>
								renaming?._id === col._id ? (
									<form key={col._id} className="inline-form" onSubmit={handleRename}>
										<input
											className="inline-input"
											value={renameName}
											onChange={(e) => setRenameName(e.target.value)}
											autoFocus
										/>
										<button className="inline-btn inline-btn-ok" type="submit">
											✓
										</button>
										<button className="inline-btn inline-btn-cancel" type="button" onClick={() => setRenaming(null)}>
											✕
										</button>
									</form>
								) : (
									<CollectionItem
										key={col._id}
										collection={col}
										defaultOpen={col._id === collections[0]?._id}
										activeRequestId={activeRequestId}
										activeRequestDirty={activeRequestDirty}
										onSelectRequest={onSelectRequest}
										onRenameCollection={startRename}
										onDeleteCollection={onDeleteCollection}
										onRenameRequest={onRenameRequest}
										onDeleteRequest={onDeleteRequest}
									/>
								),
							)}
						</>
					)}

					{activeTab === "History" && (
						<>
							<div className="sidebar-section-header">
								<span className="sidebar-section-title">Recent</span>
							</div>
							{history.length === 0 ? (
								<div className="empty-state">
									<div className="empty-state-icon">🕐</div>
									<p>Your sent requests will appear here automatically.</p>
								</div>
							) : (
								<>
									{history.map((entry) => (
										<div key={entry._id} className="history-row">
											<button
												className="history-item"
												onClick={() => onSelectHistory(entry)}
												title={`${entry.method} ${entry.url}`}
											>
												<span className={`method-badge method-${entry.method}`}>{entry.method}</span>
												<span className="hist-url">{entry.url}</span>
												{entry.status && (
													<span className={`hist-status ${statusClass(entry.status)}`}>{entry.status}</span>
												)}
											</button>
											<button
												className="history-del-btn"
												onClick={() => onDeleteHistoryEntry(entry)}
												aria-label={`Delete history entry ${entry.method} ${entry.url}`}
												title="Delete from history"
											>
												×
											</button>
										</div>
									))}
									{historyHasMore && (
										<button className="history-load-more-btn" onClick={onLoadMoreHistory} disabled={historyLoadingMore}>
											{historyLoadingMore ? "Loading…" : "Load more"}
										</button>
									)}
									<button className="history-clear-btn" onClick={onClearHistory}>
										Clear history
									</button>
								</>
							)}
						</>
					)}
				</div>
			</div>
			<div
				className="sidebar-resizer"
				onMouseDown={onResizeMouseDown}
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize sidebar"
				title="Drag to resize"
			/>
		</div>
	);
}
