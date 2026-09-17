import { useState, useRef, useEffect } from "react";
import { statusClass } from "../../shared/utils/format.js";

function CollectionMenu({ collection, onRename, onDelete, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [onClose]);
	return (
		<div className="dropdown-menu" ref={ref} role="menu">
			<button className="dropdown-item" role="menuitem" onClick={() => { onRename(collection); onClose(); }}>✏ Rename</button>
			<button className="dropdown-item danger" role="menuitem" onClick={() => { onDelete(collection); onClose(); }}>🗑 Delete</button>
		</div>
	);
}

function CollectionItem({ collection, activeRequestId, onSelectRequest, onRenameCollection, onDeleteCollection }) {
	const [open, setOpen] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const requests = collection.requests || [];

	return (
		<div className="collection-item">
			<div className="menu-anchor">
				<button className="collection-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
					<span className={`collection-chevron ${open ? "open" : ""}`}>▶</span>
					<span className="coll-icon">📁</span>
					<span className="collection-name" title={collection.name}>{collection.name}</span>
					<button className="collection-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }} aria-label="Options" aria-haspopup="true">⋯</button>
				</button>
				{menuOpen && <CollectionMenu collection={collection} onRename={onRenameCollection} onDelete={onDeleteCollection} onClose={() => setMenuOpen(false)} />}
			</div>
			{open && (
				<div className="collection-requests">
					{requests.length === 0
						? <p className="no-data">No saved requests</p>
						: requests.map(req => (
							<button key={req._id} className={`request-item ${activeRequestId === req._id ? "active" : ""}`} onClick={() => onSelectRequest(req)}>
								<span className={`method-badge method-${req.method}`}>{req.method}</span>
								<span className="req-name" title={req.name}>{req.name}</span>
							</button>
						))
					}
				</div>
			)}
		</div>
	);
}

export function Sidebar({ collections, history, activeRequestId, onSelectRequest, onCreateCollection, onRenameCollection, onDeleteCollection, onClearHistory, onSelectHistory }) {
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
		try { await onCreateCollection(newName.trim()); setShowNew(false); setNewName(""); }
		finally { setSaving(false); }
	}

	async function handleRename(e) {
		e.preventDefault();
		if (!renameName.trim()) return setRenaming(null);
		await onRenameCollection(renaming._id, renameName.trim());
		setRenaming(null); setRenameName("");
	}

	function startRename(col) { setRenaming(col); setRenameName(col.name); }

	return (
		<div className="sidebar">
			<div className="sidebar-inner">
				<div className="sidebar-tabs" role="tablist">
					{["Collections", "History"].map(tab => (
						<button key={tab} role="tab" className={`sidebar-tab ${activeTab === tab ? "active" : ""}`} aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}>
							{tab}
						</button>
					))}
				</div>

				<div className="sidebar-content">
					{activeTab === "Collections" && (
						<>
							<div className="sidebar-section-header">
								<span className="sidebar-section-title">Collections</span>
								<button className="new-btn" onClick={() => setShowNew(s => !s)}>+ New</button>
							</div>

							{showNew && (
								<form className="inline-form" onSubmit={handleCreate}>
									<input className="inline-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Collection name" autoFocus disabled={saving} />
									<button className="inline-btn inline-btn-ok" type="submit" disabled={saving || !newName.trim()}>✓</button>
									<button className="inline-btn inline-btn-cancel" type="button" onClick={() => { setShowNew(false); setNewName(""); }}>✕</button>
								</form>
							)}

							{collections.length === 0 && !showNew && (
								<div className="empty-state">
									<div className="empty-state-icon">📂</div>
									<p>No collections yet. Create one to start organizing your requests.</p>
								</div>
							)}

							{collections.map(col => (
								renaming?._id === col._id
									? (
										<form key={col._id} className="inline-form" onSubmit={handleRename}>
											<input className="inline-input" value={renameName} onChange={e => setRenameName(e.target.value)} autoFocus />
											<button className="inline-btn inline-btn-ok" type="submit">✓</button>
											<button className="inline-btn inline-btn-cancel" type="button" onClick={() => setRenaming(null)}>✕</button>
										</form>
									)
									: (
										<CollectionItem
											key={col._id}
											collection={col}
											activeRequestId={activeRequestId}
											onSelectRequest={onSelectRequest}
											onRenameCollection={startRename}
											onDeleteCollection={onDeleteCollection}
										/>
									)
							))}
						</>
					)}

					{activeTab === "History" && (
						<>
							<div className="sidebar-section-header">
								<span className="sidebar-section-title">Recent</span>
							</div>
							{history.length === 0
								? (
									<div className="empty-state">
										<div className="empty-state-icon">🕐</div>
										<p>Your sent requests will appear here automatically.</p>
									</div>
								)
								: (
									<>
										{history.map(entry => (
											<button key={entry._id} className="history-item" onClick={() => onSelectHistory(entry)} title={`${entry.method} ${entry.url}`}>
												<span className={`method-badge method-${entry.method}`}>{entry.method}</span>
												<span className="hist-url">{entry.url}</span>
												{entry.status && <span className={`hist-status ${statusClass(entry.status)}`}>{entry.status}</span>}
											</button>
										))}
										<button className="history-clear-btn" onClick={onClearHistory}>Clear history</button>
									</>
								)
							}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
