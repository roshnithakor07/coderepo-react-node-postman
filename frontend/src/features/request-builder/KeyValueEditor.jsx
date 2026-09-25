import { useCallback } from "react";

export function KeyValueEditor({ rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value" }) {
	const update = useCallback(
		(i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))),
		[rows, onChange],
	);
	const remove = useCallback((i) => onChange(rows.filter((_, idx) => idx !== i)), [rows, onChange]);
	const add = useCallback(() => onChange([...rows, { key: "", value: "", enabled: true }]), [rows, onChange]);

	return (
		<div className="kv-editor">
			{rows.length > 0 && (
				<div className="kv-header-row">
					<span />
					<span className="kv-col-label">{keyPlaceholder}</span>
					<span className="kv-col-label">{valuePlaceholder}</span>
					<span />
				</div>
			)}
			{rows.map((row, i) => (
				<div className="kv-row" key={i}>
					<input
						type="checkbox"
						className="kv-checkbox"
						checked={row.enabled}
						onChange={(e) => update(i, "enabled", e.target.checked)}
						aria-label="Enable"
					/>
					<input
						className="kv-input"
						value={row.key}
						onChange={(e) => update(i, "key", e.target.value)}
						placeholder={keyPlaceholder}
						disabled={!row.enabled}
					/>
					<input
						className="kv-input"
						value={row.value}
						onChange={(e) => update(i, "value", e.target.value)}
						placeholder={valuePlaceholder}
						disabled={!row.enabled}
					/>
					<button className="kv-del-btn" onClick={() => remove(i)} aria-label="Remove" title="Remove row">
						×
					</button>
				</div>
			))}
			<button className="add-row-btn" onClick={add}>
				+ Add row
			</button>
		</div>
	);
}
