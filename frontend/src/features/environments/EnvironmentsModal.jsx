import { useState } from "react";

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

export function EnvironmentsModal({ environments, onClose, onCreate, onUpdate, onActivate, onDelete }) {
	const [selected, setSelected] = useState(null);
	const [editName, setEditName] = useState("");
	const [editVars, setEditVars] = useState([]);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	function selectEnv(env) { setSelected(env); setEditName(env.name); setEditVars(env.variables || []); setCreating(false); setError(""); }
	function startCreate() { setSelected(null); setCreating(true); setNewName(""); setEditVars([]); setError(""); }

	async function handleCreate() {
		if (!newName.trim()) return setError("Name is required.");
		setSaving(true);
		try { await onCreate({ name: newName.trim(), variables: editVars }); setCreating(false); setError(""); }
		catch (e) { setError(e.message); } finally { setSaving(false); }
	}

	async function handleSave() {
		if (!selected) return;
		setSaving(true);
		try { await onUpdate(selected._id, { name: editName.trim(), variables: editVars }); setError(""); }
		catch (e) { setError(e.message); } finally { setSaving(false); }
	}

	async function handleActivate(env) {
		try { await onActivate(env._id); } catch (e) { setError(e.message); }
	}

	async function handleDelete(env) {
		if (!confirm(`Delete "${env.name}"?`)) return;
		try { await onDelete(env._id); if (selected?._id === env._id) { setSelected(null); setCreating(false); } }
		catch (e) { setError(e.message); }
	}

	return (
		<div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
			<div className="modal" role="dialog" aria-modal="true" aria-label="Environments">
				<div className="modal-header">
					<h2>Environments</h2>
					<button className="modal-close" onClick={onClose} aria-label="Close">×</button>
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
								<input className="save-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Environment name" />
							</div>
							<VariableEditor variables={editVars} onChange={setEditVars} />
						</div>
					)}
					{creating && (
						<div>
							<div className="save-field">
								<label className="env-vars-title" style={{ display: "block", marginBottom: 6 }}>New environment name</label>
								<input className="save-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Development, Production" autoFocus />
							</div>
							<VariableEditor variables={editVars} onChange={setEditVars} />
						</div>
					)}
				</div>
				<div className="modal-footer">
					<button className="btn-ghost" onClick={startCreate}>+ New environment</button>
					{creating && <button className="btn-primary" onClick={handleCreate} disabled={saving || !newName.trim()}>{saving ? "Creating…" : "Create"}</button>}
					{selected && !creating && <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>}
					{!creating && !selected && <button className="btn-ghost" onClick={onClose}>Close</button>}
				</div>
			</div>
		</div>
	);
}
