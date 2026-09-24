import { useState, useCallback } from "react";

// Self-written JSON tree renderer: syntax highlighting + collapsible
// objects/arrays. No dependency — this is small enough (and specific
// enough to this app's own token-driven color scheme) that pulling in a
// library would cost more than it saves.
//
// Color mapping reuses existing design tokens rather than inventing new
// ones (see transcripts/02-design-decisions.md for the exact mapping and
// why): keys use --info (the same blue already used for header-table
// keys), strings --success, numbers --warning, booleans --patch, null
// --text-tertiary, punctuation --text-secondary.

const identity = (text) => text;

function JsonPrimitive({ value, highlight }) {
	if (value === null) return <span className="json-null">{highlight("null")}</span>;
	if (typeof value === "boolean") return <span className="json-bool">{highlight(String(value))}</span>;
	if (typeof value === "number") return <span className="json-number">{highlight(String(value))}</span>;
	return (
		<span className="json-string">
			"{highlight(String(value))}"
		</span>
	);
}

function JsonNode({ value, path, collapsed, onToggle, highlight, forceExpanded }) {
	if (value === null || typeof value !== "object") {
		return <JsonPrimitive value={value} highlight={highlight} />;
	}

	const isArray = Array.isArray(value);
	const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
	const open = isArray ? "[" : "{";
	const close = isArray ? "]" : "}";

	if (entries.length === 0) {
		return <span className="json-punct">{open}{close}</span>;
	}

	// While a search is active, every node renders expanded regardless of
	// its own collapsed state, so a match inside a collapsed branch is still
	// findable — the user's actual collapse choices are preserved underneath
	// and reappear once the search is cleared.
	const isCollapsed = !forceExpanded && collapsed.has(path);
	const countLabel = isArray ? `${entries.length} item${entries.length === 1 ? "" : "s"}` : `${entries.length} key${entries.length === 1 ? "" : "s"}`;

	return (
		<span className="json-node">
			<button type="button" className="json-toggle" onClick={() => onToggle(path)} aria-label={isCollapsed ? "Expand" : "Collapse"} aria-expanded={!isCollapsed}>
				<span className={`json-caret ${isCollapsed ? "" : "open"}`}>▶</span>
			</button>
			<span className="json-punct">{open}</span>
			{isCollapsed ? (
				<>
					<button type="button" className="json-collapsed-summary" onClick={() => onToggle(path)}>{countLabel}</button>
					<span className="json-punct">{close}</span>
				</>
			) : (
				<>
					<div className="json-children">
						{entries.map(([key, val], i) => (
							<div className="json-row" key={key}>
								{!isArray && (
									<>
										<span className="json-key">"{highlight(key)}"</span>
										<span className="json-punct">: </span>
									</>
								)}
								<JsonNode value={val} path={`${path}.${key}`} collapsed={collapsed} onToggle={onToggle} highlight={highlight} forceExpanded={forceExpanded} />
								{i < entries.length - 1 && <span className="json-punct">,</span>}
							</div>
						))}
					</div>
					<span className="json-punct">{close}</span>
				</>
			)}
		</span>
	);
}

// `highlight(text) => ReactNode` lets a caller (the in-response search
// feature) wrap matched substrings without JsonView needing to know
// anything about search — every leaf's raw text is piped through it.
// Defaults to a no-op so JSON display works with zero search wiring.
export function JsonView({ value, highlight = identity, forceExpanded = false }) {
	const [collapsed, setCollapsed] = useState(() => new Set());
	const onToggle = useCallback((path) => {
		setCollapsed(prev => {
			const next = new Set(prev);
			next.has(path) ? next.delete(path) : next.add(path);
			return next;
		});
	}, []);

	return (
		<div className="json-view">
			<JsonNode value={value} path="$" collapsed={collapsed} onToggle={onToggle} highlight={highlight} forceExpanded={forceExpanded} />
		</div>
	);
}
