import { useState, useEffect } from "react";
import { duplicateNameMessage, hasNameConflict } from "./savedRequest.js";

export function SaveRequestModal({ request, collections, onClose, onSave }) {
	const [name, setName] = useState(request?.name || `${request?.method || "GET"} ${request?.url || ""}`.slice(0, 80).trim());
	const [collectionId, setCollectionId] = useState(collections[0]?._id || "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	// A duplicate name, shown under the name field: checked as the user types
	// (and when the collection changes), or reported by the server (409).
	const [serverNameError, setServerNameError] = useState("");
	const targetRequests = collections.find((c) => c._id === collectionId)?.requests || [];
	const nameError = serverNameError || (name.trim() && hasNameConflict(targetRequests, name) ? duplicateNameMessage(name) : "");

	useEffect(() => {
		const handler = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

	async function handleSave() {
		if (!name.trim()) return setError("Request name is required.");
		if (!collectionId) return setError("Select a collection.");
		setSaving(true);
		try {
			await onSave(collectionId, { ...request, name: name.trim() });
			onClose();
		} catch (e) {
			if (e.code === "DUPLICATE_NAME") setServerNameError(e.message);
			else setError(e.message);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<div className="modal save-modal" role="dialog" aria-modal="true" aria-label="Save request">
				<div className="modal-header">
					<h2>Save request</h2>
					<button className="modal-close" onClick={onClose} aria-label="Close">
						×
					</button>
				</div>
				<div className="modal-body">
					{error && (
						<div className="login-error" role="alert" style={{ marginBottom: 14 }}>
							{error}
						</div>
					)}
					<div className="save-field">
						<label htmlFor="req-name">Request name</label>
						<input
							id="req-name"
							className="save-input"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								setServerNameError("");
							}}
							placeholder="My request"
							autoFocus
							aria-invalid={Boolean(nameError)}
							aria-describedby={nameError ? "req-name-error" : undefined}
						/>
						{nameError && (
							<p id="req-name-error" className="field-error" role="alert">
								{nameError}
							</p>
						)}
					</div>
					<div className="save-field">
						<label htmlFor="col-sel">Collection</label>
						{collections.length === 0 ? (
							<p className="auth-none-msg">No collections found. Create a collection first from the sidebar.</p>
						) : (
							<select
								id="col-sel"
								className="save-select"
								value={collectionId}
								onChange={(e) => {
									setCollectionId(e.target.value);
									setServerNameError("");
								}}
							>
								{collections.map((c) => (
									<option key={c._id} value={c._id}>
										{c.name}
									</option>
								))}
							</select>
						)}
					</div>
				</div>
				<div className="modal-footer">
					<button className="btn-ghost" onClick={onClose}>
						Cancel
					</button>
					<button
						className="btn-primary"
						onClick={handleSave}
						disabled={saving || !collectionId || !name.trim() || Boolean(nameError)}
					>
						{saving ? "Saving…" : "Save to collection"}
					</button>
				</div>
			</div>
		</div>
	);
}
