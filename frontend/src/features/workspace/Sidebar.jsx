import { useState, useRef } from "react";
import { statusClass } from "../../shared/utils/format.js";
import { ActionMenu } from "../../shared/components/ActionMenu.jsx";
import { CloneIcon, ClipboardIcon, PencilIcon, TrashIcon } from "../../shared/components/icons.jsx";

// A ⋯ button that opens an ActionMenu (same look for collections and saved
// requests). ArrowDown on the button also opens it, as in a native menu button.
function MenuButton({ className, label, items }) {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);
	return (
		<>
			<button
				ref={ref}
				className={className}
				onClick={(e) => {
					e.stopPropagation();
					setOpen((o) => !o);
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" && !open) {
						e.preventDefault();
						e.stopPropagation();
						setOpen(true);
					}
				}}
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
			>
				⋯
			</button>
			{open && <ActionMenu anchorRef={ref} items={items} label={label} onClose={() => setOpen(false)} />}
		</>
	);
}

// Inline rename form, used for saved requests. `onSubmit(name)` resolves to
// true on success; on failure the form stays open so the name isn't lost.
function InlineRename({ initial, onSubmit, onCancel, label }) {
	const [value, setValue] = useState(initial);
	const [pending, setPending] = useState(false);
	const name = value.trim();
	// Nothing to save when the name is empty or unchanged; Enter then does nothing.
	const canSubmit = !pending && name.length > 0 && name !== initial;
	async function handleSubmit(e) {
		e.preventDefault();
		if (!canSubmit) return;
		setPending(true);
		const ok = await onSubmit(name);
		setPending(false);
		if (ok) onCancel();
	}
	return (
		<form
			className="inline-form"
			onSubmit={handleSubmit}
			onKeyDown={(e) => {
				if (e.key === "Escape" && !pending) {
					e.preventDefault();
					e.stopPropagation();
					onCancel();
				}
			}}
		>
			<input
				className="inline-input"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onFocus={(e) => e.target.select()}
				autoFocus
				disabled={pending}
				aria-label={label}
			/>
			<button
				className={`inline-btn inline-btn-ok${pending ? " is-saving" : ""}`}
				type="submit"
				disabled={!canSubmit}
				aria-label={pending ? "Saving name" : "Save name"}
				aria-busy={pending}
				title={pending ? "Saving…" : "Save name (Enter)"}
			>
				{pending ? <span className="inline-btn-spinner" aria-hidden="true" /> : "✓"}
			</button>
			<button
				className="inline-btn inline-btn-cancel"
				type="button"
				onClick={onCancel}
				disabled={pending}
				aria-label="Cancel rename"
				title="Cancel (Esc)"
			>
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
	onDuplicateRequest,
	onCopyRequestUrl,
	onDeleteRequest,
}) {
	const [open, setOpen] = useState(defaultOpen);
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
						// Only the header itself — keys on its ⋯ button or menu are theirs.
						if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
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
					<MenuButton
						className="collection-menu-btn"
						label={`Options for ${collection.name}`}
						items={[
							{ id: "rename", label: "Rename", icon: <PencilIcon />, onSelect: () => onRenameCollection(collection) },
							{ divider: true },
							{
								id: "delete",
								label: "Delete",
								icon: <TrashIcon />,
								danger: true,
								onSelect: () => onDeleteCollection(collection),
							},
						]}
					/>
				</div>
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
										<MenuButton
											className="request-menu-btn"
											label={`Options for ${req.name}`}
											items={[
												{
													id: "clone",
													label: "Clone",
													busyLabel: "Cloning…",
													icon: <CloneIcon />,
													async: true,
													onSelect: () => onDuplicateRequest(req),
												},
												{
													id: "copy",
													label: "Copy",
													icon: <ClipboardIcon />,
													onSelect: () => onCopyRequestUrl(req),
												},
												{
													id: "rename",
													label: "Rename",
													icon: <PencilIcon />,
													onSelect: () => setRenamingRequestId(req._id),
												},
												{ divider: true },
												{
													id: "delete",
													label: "Delete",
													icon: <TrashIcon />,
													danger: true,
													onSelect: () => onDeleteRequest(req),
												},
											]}
										/>
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
	onDuplicateRequest,
	onCopyRequestUrl,
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

	function startRename(col) {
		setRenaming(col);
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
									<InlineRename
										key={col._id}
										initial={col.name}
										label={`Rename ${col.name}`}
										onSubmit={(name) => onRenameCollection(col._id, name)}
										onCancel={() => setRenaming(null)}
									/>
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
										onDuplicateRequest={onDuplicateRequest}
										onCopyRequestUrl={onCopyRequestUrl}
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
