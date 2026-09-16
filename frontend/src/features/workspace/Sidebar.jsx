import { useState, useRef, useEffect } from "react";
import { statusClass } from "../../shared/utils/format.js";

function CollectionMenu({ collection, onRename, onDelete, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		function handler(e) {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [onClose]);

	return (
		<div className="dropdown-menu" ref={ref} role="menu">
			<button className="dropdown-item" role="menuitem" onClick={() => { onRename(collection); onClose(); }}>Rename</button>
			<button className="dropdown-item danger" role="menuitem" onClick={() => { onDelete(collection); onClose(); }}>Delete</button>
		</div>
	);
}

function CollectionItem({ collection, activeRequestId, onSelectRequest, onRenameCollection, onDeleteCollection, onDeleteRequest }) {
	const [open, setOpen] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);

	const requests = collection.requests || [];

	return (
		<div className="collection-item">
			<div className="menu-anchor">
				<button
					className="collection-header"
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
				>
					<span className={`collection-chevron ${open ? "open" : ""}`}>▶</span>
					<span className="collection-name" title={collection.name}>{collection.name}</span>
					<button
						className="collection-menu-btn"
						onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m); }}
						aria-label="Collection options"
						aria-haspopup="true"
					>
						⋯
					</button>
				</button>
				{menuOpen && (
					<CollectionMenu
						collection={collection}
						onRename={onRenameCollection}
						onDelete={onDeleteCollection}
						onClose={() => setMenuOpen(false)}
					/>
				)}
			</div>
			{open && (
				<div className="collection-requests">
					{requests.length === 0 && (
						<div style={{ padding: "4px 8px", color: "var(--faint)", fontSize: 12 }}>No saved requests</div>
					)}
					{requests.map((req) => (
						<div key={req._id} style={{ position: "relative" }}>
							<button
								className={`request-item ${activeRequestId === req._id ? "active" : ""}`}
								onClick={() => onSelectRequest(req)}
							>
								<span className={`method-badge method-${req.method}`}>{req.method}</span>
								<span className="req-name" title={req.name}>{req.name}</span>
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function NewCollectionForm({ onSave, onCancel }) {
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(e) {
		e.preventDefault();
		if (!name.trim()) return;
		setSaving(true);
		try {
			await onSave(name.trim());
			onCancel();
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, padding: "6px 4px" }}>
			<input
				className="kv-input"
				style={{ flex: 1 }}
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="Collection name"
				autoFocus
				disabled={saving}
			/>
			<button className="btn-primary" type="submit" style={{ height: 34, padding: "0 10px", fontSize: 12 }} disabled={saving || !name.trim()}>
				{saving ? "…" : "Save"}
			</button>
			<button className="btn-ghost" type="button" onClick={onCancel} style={{ height: 34, padding: "0 8px", fontSize: 12 }}>
				✕
			</button>
		</form>
	);
}

export function Sidebar({ collections, history, activeRequestId, onSelectRequest, onCreateCollection, onRenameCollection, onDeleteCollection, onClearHistory, onSelectHistory }) {
	const [activeTab, setActiveTab] = useState("Collections");
	const [showNewForm, setShowNewForm] = useState(false);
	const [renaming, setRenaming] = useState(null);
	const [newName, setNewName] = useState("");

	async function handleCreateCollection(name) {
		await onCreateCollection(name);
		setShowNewForm(false);
	}

	async function handleRenameSubmit(collection) {
		if (!newName.trim()) return setRenaming(null);
		await onRenameCollection(collection._id, newName.trim());
		setRenaming(null);
		setNewName("");
	}

	function startRename(collection) {
		setRenaming(collection);
		setNewName(collection.name);
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
							{tab === "History" && history.length > 0 && (
								<span style={{ marginLeft: 5, fontSize: 10, color: "var(--muted)" }}>({history.length})</span>
							)}
						</button>
					))}
				</div>
				<div className="sidebar-content">
					{activeTab === "Collections" && (
						<>
							<div className="sidebar-header">
								<h3>Collections</h3>
								<button className="new-btn" onClick={() => setShowNewForm((s) => !s)}>+ New</button>
							</div>
							{showNewForm && (
								<NewCollectionForm onSave={handleCreateCollection} onCancel={() => setShowNewForm(false)} />
							)}
							{collections.length === 0 && !showNewForm && (
								<div className="empty-state">
									<div className="empty-state-icon">📁</div>
									<span>No collections yet. Create one to organize your requests.</span>
								</div>
							)}
							{collections.map((col) => (
								renaming?._id === col._id ? (
									<form key={col._id} onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(col); }} style={{ display: "flex", gap: 6, padding: "4px" }}>
										<input className="kv-input" style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
										<button className="btn-primary" type="submit" style={{ height: 30, padding: "0 8px", fontSize: 12 }}>✓</button>
										<button className="btn-ghost" type="button" onClick={() => setRenaming(null)} style={{ height: 30, padding: "0 6px", fontSize: 12 }}>✕</button>
									</form>
								) : (
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
							<div className="sidebar-header">
								<h3>Recent</h3>
							</div>
							{history.length === 0 ? (
								<div className="empty-state">
									<div className="empty-state-icon">🕐</div>
									<span>Your sent requests will appear here.</span>
								</div>
							) : (
								<>
									{history.map((entry) => (
										<button
											key={entry._id}
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
									))}
									<button className="history-clear-btn" onClick={onClearHistory}>Clear history</button>
								</>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
