import { useCallback, useEffect, useRef, useState } from "react";
import { parseBulkText, rowsToBulkText } from "./kvBulk.js";

const EMPTY_ROW = { key: "", value: "", enabled: true };

// One table row. The trailing placeholder row renders through this same
// component with the same element structure, so when typing turns it into a
// real row React keeps the focused input (and its caret) in place.
function KeyValueRow({ row, isPlaceholder, onEdit, onRemove, keyPlaceholder, valuePlaceholder }) {
	return (
		<div className={`kv-row${isPlaceholder ? " kv-row-placeholder" : ""}`}>
			<input
				type="checkbox"
				className="kv-checkbox"
				checked={row.enabled}
				onChange={(e) => onEdit("enabled", e.target.checked)}
				disabled={isPlaceholder}
				tabIndex={isPlaceholder ? -1 : undefined}
				aria-label="Enable"
			/>
			<input
				className="kv-input"
				value={row.key}
				onChange={(e) => onEdit("key", e.target.value)}
				placeholder={keyPlaceholder}
				disabled={!row.enabled}
				aria-label={keyPlaceholder}
			/>
			<input
				className="kv-input"
				value={row.value}
				onChange={(e) => onEdit("value", e.target.value)}
				placeholder={valuePlaceholder}
				disabled={!row.enabled}
				aria-label={valuePlaceholder}
			/>
			<input
				className="kv-input kv-input-desc"
				value={row.description ?? ""}
				onChange={(e) => onEdit("description", e.target.value)}
				placeholder="Description"
				disabled={!row.enabled}
				aria-label="Description"
			/>
			<button
				type="button"
				className="kv-del-btn"
				onClick={onRemove}
				disabled={isPlaceholder}
				tabIndex={isPlaceholder ? -1 : undefined}
				aria-label="Remove row"
				title="Remove row"
			>
				×
			</button>
		</div>
	);
}

// Raw-text editing of the same rows ("key:value" per line, "//" disables a
// row — see kvBulk.js). Every edit is applied to the rows immediately, so the
// URL bar keeps following Params while typing here. Descriptions aren't part
// of the text; they're carried over from the rows as they were when bulk
// editing started (or last changed from outside).
function BulkEditor({ rows, onChange }) {
	const [text, setText] = useState(() => rowsToBulkText(rows));
	const [descriptionSource, setDescriptionSource] = useState(rows);
	// The rows this editor last produced — anything else arriving through
	// props came from outside (e.g. the URL bar), so the text is rebuilt.
	const emittedRowsRef = useRef(rows);

	useEffect(() => {
		if (rows === emittedRowsRef.current) return;
		emittedRowsRef.current = rows;
		setText(rowsToBulkText(rows));
		setDescriptionSource(rows);
	}, [rows]);

	function handleChange(e) {
		const nextRows = parseBulkText(e.target.value, descriptionSource);
		setText(e.target.value);
		emittedRowsRef.current = nextRows;
		onChange(nextRows);
	}

	return (
		<div className="kv-bulk">
			<textarea
				className="kv-bulk-textarea"
				value={text}
				onChange={handleChange}
				placeholder={"key:value\n//disabled-key:value"}
				spellCheck={false}
				aria-label="Bulk edit"
				autoFocus
			/>
			<p className="kv-bulk-hint">
				One <code>key:value</code> per line. Start a line with <code>//</code> to disable it.
			</p>
		</div>
	);
}

export function KeyValueEditor({ rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value" }) {
	const [bulkMode, setBulkMode] = useState(false);
	const update = useCallback(
		(i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))),
		[rows, onChange],
	);
	const remove = useCallback((i) => onChange(rows.filter((_, idx) => idx !== i)), [rows, onChange]);
	// Typing into the trailing placeholder row turns it into a real row; a new
	// placeholder then appears below it.
	const addFromPlaceholder = useCallback((field, value) => onChange([...rows, { ...EMPTY_ROW, [field]: value }]), [rows, onChange]);

	return (
		<div className="kv-editor">
			<div className="kv-toolbar">
				<button type="button" className="kv-mode-btn" aria-pressed={bulkMode} onClick={() => setBulkMode((on) => !on)}>
					{bulkMode ? "Key-value edit" : "Bulk edit"}
				</button>
			</div>
			{bulkMode ? (
				<BulkEditor rows={rows} onChange={onChange} />
			) : (
				<>
					<div className="kv-header-row">
						<span />
						<span className="kv-col-label">{keyPlaceholder}</span>
						<span className="kv-col-label">{valuePlaceholder}</span>
						<span className="kv-col-label">Description</span>
						<span />
					</div>
					{/* The placeholder is the last item of the same list (key = its
					    future index), so React matches it to the real row it becomes. */}
					{[
						...rows.map((row, i) => (
							<KeyValueRow
								key={i}
								row={row}
								onEdit={(field, value) => update(i, field, value)}
								onRemove={() => remove(i)}
								keyPlaceholder={keyPlaceholder}
								valuePlaceholder={valuePlaceholder}
							/>
						)),
						<KeyValueRow
							key={rows.length}
							row={EMPTY_ROW}
							isPlaceholder
							onEdit={addFromPlaceholder}
							keyPlaceholder={keyPlaceholder}
							valuePlaceholder={valuePlaceholder}
						/>,
					]}
				</>
			)}
		</div>
	);
}
