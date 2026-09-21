import { useState, useEffect } from "react";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog.jsx";

function VariableEditor({ variables, onChange }) {
	const update = (i, f, v) => onChange(variables.map((x, idx) => (idx === i ? { ...x, [f]: v } : x)));
	const remove = (i) => onChange(variables.filter((_, idx) => idx !== i));
	const add = () => onChange([...variables, { key: "", value: "", enabled: true }]);
	return (
		<div>
			<p className="env-vars-title">Variables</p>
			{variables.map((v, i) => (
				<div className="var-row" key={i}>
					<input type="checkbox" className="kv-checkbox" checked={v.enabled} onChange={e => update(i, "enabled", e.target.checked)} aria-label="Enable" />
					<input className="var-input" value={v.key} onChange={e => update(i, "key", e.target.value)} placeholder="Variable name" />
					<input className="var-input" value={v.value} onChange={e => update(i, "value", e.target.value)} placeholder="Value" />
					<button className="kv-del-btn" onClick={() => remove(i)} aria-label="Remove">×</button>
				</div>
			))}
			<button className="add-row-btn" onClick={add}>+ Add variable</button>
		</div>
	);
}

// Value-based normalization so dirty-checking compares actual data, not
// array/object identity — e.g. editing a value then typing it back to its
// original text must read as clean again (enabled defaults mirror the
// backend schema's `default: true` so an undefined field never reads as a
// spurious difference against a saved row that has it explicitly set).
function normalizeVars(vars) {
	return (vars || []).map(v => ({ key: v.key ?? "", value: v.value ?? "", enabled: v.enabled !== false }));
}

function isDraftDirty(name, vars, snapshot) {
	if (!snapshot) return false;
	if (name !== snapshot.name) return true;
	return JSON.stringify(normalizeVars(vars)) !== JSON.stringify(normalizeVars(snapshot.variables));
}

export function EnvironmentsModal({ environments, onClose, onCreate, onUpdate, onActivate, onDelete }) {
	const [selected, setSelected] = useState(null);
	const [editName, setEditName] = useState("");
	const [editVars, setEditVars] = useState([]);
	// The last successfully-persisted { name, variables } for `selected` —
	// the baseline the draft is compared against to decide dirty/clean.
	// null whenever nothing persisted is being edited (e.g. the create flow).
	const [savedSnapshot, setSavedSnapshot] = useState(null);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [saveFailed, setSaveFailed] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const [confirmDialog, setConfirmDialog] = useState(null);

	const isDirty = selected && !creating ? isDraftDirty(editName, editVars, savedSnapshot) : false;

	function requestClose() { confirmDiscardThen(onClose); }

	useEffect(() => {
		const handler = e => { if (e.key === "Escape") requestClose(); };
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [isDirty, onClose]);

	// Guards any action that would throw away the current draft (closing the
	// modal, selecting a different environment, starting a new one) behind a
	// confirmation — but only when there's actually something unsaved to lose.
	function confirmDiscardThen(action) {
		if (!isDirty) { action(); return; }
		setConfirmDialog({
			title: "Unsaved changes",
			message: "You have unsaved changes that haven't been saved. Discard them?",
			confirmLabel: "Discard changes",
			onConfirm: () => { setConfirmDialog(null); action(); },
		});
	}

	function applySelectEnv(env) {
		setSelected(env);
		setEditName(env.name);
		setEditVars(env.variables || []);
		setSavedSnapshot({ name: env.name, variables: env.variables || [] });
		setCreating(false);
		setError("");
		setSaveFailed(false);
		setCreateFailed(false);
	}
	function applyStartCreate() {
		setSelected(null);
		setCreating(true);
		setNewName("");
		setEditVars([]);
		setSavedSnapshot(null);
		setError("");
		setSaveFailed(false);
		setCreateFailed(false);
	}

	function selectEnv(env) { confirmDiscardThen(() => applySelectEnv(env)); }
	function startCreate() { confirmDiscardThen(() => applyStartCreate()); }

	// A stale "Could not save changes" from a prior failed attempt must not
	// linger once the user actually edits the data that caused it — otherwise
	// a corrected value still looks rejected until the next Save click. Only
	// clears when the visible error IS the save error (saveFailed), so an
	// unrelated activate/delete error elsewhere in the modal isn't dismissed
	// by typing here.
	function clearStaleSaveError() {
		if (saveFailed) { setSaveFailed(false); setError(""); }
	}
	function updateEditName(value) { setEditName(value); clearStaleSaveError(); }
	function updateEditVars(vars) { setEditVars(vars); clearStaleSaveError(); }

	// Same reasoning as clearStaleSaveError, mirrored for the create flow: a
	// failed Create's "Could not save changes" must not linger once the user
	// edits the data that caused it.
	function clearStaleCreateError() {
		if (createFailed) { setCreateFailed(false); setError(""); }
	}
	function updateNewName(value) { setNewName(value); clearStaleCreateError(); }
	function updateCreateVars(vars) { setEditVars(vars); clearStaleCreateError(); }

	async function handleCreate() {
		if (!newName.trim()) return setError("Name is required.");
		setSaving(true);
		try { await onCreate({ name: newName.trim(), variables: editVars }); setCreating(false); setError(""); setCreateFailed(false); }
		catch (e) { setError(e.message); setCreateFailed(true); } finally { setSaving(false); }
	}

	async function handleSave() {
		if (!selected || !isDirty) return;
		setSaving(true);
		try {
			const updated = await onUpdate(selected._id, { name: editName.trim(), variables: editVars });
			setError("");
			setSaveFailed(false);
			// Adopt the server's persisted values (it trims/normalizes) as the
			// new draft + snapshot, so the editor exactly reflects what was
			// actually saved rather than what was merely typed.
			const persisted = updated || { name: editName.trim(), variables: editVars };
			setSelected(prev => (prev ? { ...prev, ...persisted } : prev));
			setEditName(persisted.name);
			setEditVars(persisted.variables || []);
			setSavedSnapshot({ name: persisted.name, variables: persisted.variables || [] });
		}
		catch (e) { setError(e.message); setSaveFailed(true); }
		finally { setSaving(false); }
	}

	async function handleActivate(env) {
		try { await onActivate(env._id); } catch (e) { setError(e.message); }
	}

	function handleDelete(env) {
		setConfirmDialog({
			title: "Delete environment?",
			message: `You’re about to permanently delete “${env.name}” and its variables. This action cannot be undone.`,
			confirmLabel: "Delete environment",
			onConfirm: async () => {
				setConfirmDialog(null);
				try {
					await onDelete(env._id);
					if (selected?._id === env._id) { setSelected(null); setCreating(false); setSavedSnapshot(null); setSaveFailed(false); }
				}
				catch (e) { setError(e.message); }
			},
		});
	}

	// Create has no dirty/saved concept (nothing persisted to diff against yet) —
	// it only ever needs to surface a failed-attempt message, same wording and
	// styling as Save's, in the same footer slot.
	const showStatus = (selected && !creating) || (creating && createFailed);
	const statusText = creating ? "Could not save changes" : saveFailed ? "Could not save changes" : isDirty ? "Unsaved changes" : "✓ Saved";
	const statusClass = creating ? "danger" : saveFailed ? "danger" : isDirty ? "unsaved" : "saved";

	return (
		<>
		<div className="modal-overlay" onClick={e => e.target === e.currentTarget && requestClose()}>
			<div className="modal" role="dialog" aria-modal="true" aria-label="Environments">
				<div className="modal-header">
					<h2>Environments</h2>
					<button className="modal-close" onClick={requestClose} aria-label="Close">×</button>
				</div>
				<div className="modal-body">
					{error && <div className="login-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
					<div className="env-list">
						{environments.length === 0 && !creating && (
							<div className="empty-state">
								<div className="empty-state-icon">🌍</div>
								<p>No environments yet. Create one to use <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{"{{variables}}"}</code> in your requests.</p>
							</div>
						)}
						{environments.map(env => (
							<div key={env._id} className={`env-list-item ${selected?._id === env._id ? "selected" : ""}`} onClick={() => selectEnv(env)}>
								<div className={`env-active-dot ${env.isActive ? "active" : ""}`} title={env.isActive ? "Active" : "Inactive"} />
								<span className="env-list-name">{env.name}</span>
								<button className={`env-activate-btn ${env.isActive ? "active-env" : ""}`} onClick={e => { e.stopPropagation(); handleActivate(env); }}>
									{env.isActive ? "✓ Active" : "Activate"}
								</button>
								<button className="env-del-btn" onClick={e => { e.stopPropagation(); handleDelete(env); }} aria-label="Delete">×</button>
							</div>
						))}
					</div>

					{selected && !creating && (
						<div>
							<div className="save-field">
								<label className="env-vars-title" style={{ display: "block", marginBottom: 6 }}>Environment name</label>
								<input className="save-input" value={editName} onChange={e => updateEditName(e.target.value)} placeholder="Environment name" />
							</div>
							<VariableEditor variables={editVars} onChange={updateEditVars} />
						</div>
					)}
					{creating && (
						<div>
							<div className="save-field">
								<label className="env-vars-title" style={{ display: "block", marginBottom: 6 }}>New environment name</label>
								<input className="save-input" value={newName} onChange={e => updateNewName(e.target.value)} placeholder="e.g. Development, Production" autoFocus />
							</div>
							<VariableEditor variables={editVars} onChange={updateCreateVars} />
						</div>
					)}
				</div>
				<div className="modal-footer">
					{showStatus && <span className={`env-save-status ${statusClass}`} style={{ marginRight: "auto" }}>{statusText}</span>}
					<button className="btn-ghost" onClick={startCreate}>+ New environment</button>
					{creating && <button className="btn-primary" onClick={handleCreate} disabled={saving || !newName.trim()}>{saving ? "Creating…" : "Create"}</button>}
					{selected && !creating && <button className="btn-primary" onClick={handleSave} disabled={saving || !isDirty}>{saving ? "Saving…" : "Save changes"}</button>}
					{!creating && !selected && <button className="btn-ghost" onClick={requestClose}>Close</button>}
				</div>
			</div>
		</div>
		{confirmDialog && (
			<ConfirmDialog
				{...confirmDialog}
				onCancel={() => setConfirmDialog(null)}
			/>
		)}
		</>
	);
}
