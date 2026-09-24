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
//
// Performance model (see transcripts/02-design-decisions.md for the
// measured freeze this replaced): a collapsed node's children are never
// rendered at all — not hidden with CSS, simply absent from the returned
// tree — so cost scales with what's actually visible, not with total
// response size. Two things keep a huge response from all being "visible"
// by default: DEFAULT_COLLAPSE_DEPTH (only the first couple of levels
// auto-expand) and MAX_ENTRIES_AUTO_EXPANDED (a container with more entries
// than this starts collapsed regardless of depth). A large array that *is*
// expanded still only renders a CHUNK_SIZE-item window at a time, grown by
// a "Show N more" control, rather than every item at once.

const identity = (text) => text;
const DEFAULT_COLLAPSE_DEPTH = 2; // depths 0 and 1 auto-expand; depth >= 2 auto-collapses
const MAX_ENTRIES_AUTO_EXPANDED = 100;
const CHUNK_SIZE = 100;

function defaultCollapsed(depth, entryCount) {
	return depth >= DEFAULT_COLLAPSE_DEPTH || entryCount > MAX_ENTRIES_AUTO_EXPANDED;
}

const EMPTY_SET = new Set();
const EMPTY_MAP = new Map();
function rangeArray(n) {
	return Array.from({ length: n }, (_, i) => i);
}

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

function JsonNode({ value, path, depth, toggled, onToggle, visibleCounts, onShowMore, highlight, searchExpandPaths, searchMatchedIndices }) {
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

	// toggled.has(path) means "the user clicked this node," which flips it
	// away from its computed default. A search match forces it open no
	// matter what, without touching — and without being confused with —
	// that toggle state, so clearing the search restores exactly what the
	// user had.
	const base = defaultCollapsed(depth, entries.length);
	const userFlipped = toggled.has(path);
	const isCollapsed = searchExpandPaths.has(path) ? false : (userFlipped ? !base : base);
	const countLabel = isArray ? `${entries.length} item${entries.length === 1 ? "" : "s"}` : `${entries.length} key${entries.length === 1 ? "" : "s"}`;

	// Which indices actually render, for an array: the normal contiguous
	// chunk window, UNION any specific indices a search matched elsewhere in
	// the array. Deliberately *not* "extend the window up to the furthest
	// match" — a match at index 4991 of 5000 would otherwise force nearly
	// the whole array to render just to reach it, reproducing the freeze
	// this chunking exists to prevent. Objects aren't chunked (their entry
	// count is what makes them auto-collapse at >100 instead).
	const windowSize = isArray ? (visibleCounts.get(path) ?? Math.min(CHUNK_SIZE, entries.length)) : entries.length;
	const matchedIdx = isArray ? (searchMatchedIndices.get(path) ?? EMPTY_SET) : EMPTY_SET;
	const shownIndices = isArray
		? (matchedIdx.size === 0
			? rangeArray(Math.min(windowSize, entries.length))
			: rangeArray(Math.min(windowSize, entries.length)).concat([...matchedIdx].filter(i => i >= windowSize).sort((a, b) => a - b)))
		: rangeArray(entries.length);
	const remaining = entries.length - shownIndices.length;

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
						{shownIndices.map((idx, i) => {
							const [key, val] = entries[idx];
							const isGapBefore = i > 0 && idx !== shownIndices[i - 1] + 1;
							return (
								<div className="json-row" key={key}>
									{isGapBefore && <div className="json-gap">⋯ {idx - shownIndices[i - 1] - 1} items skipped (matched below)</div>}
									{!isArray && (
										<>
											<span className="json-key">"{highlight(key)}"</span>
											<span className="json-punct">: </span>
										</>
									)}
									<JsonNode
										value={val}
										path={`${path}.${key}`}
										depth={depth + 1}
										toggled={toggled}
										onToggle={onToggle}
										visibleCounts={visibleCounts}
										onShowMore={onShowMore}
										highlight={highlight}
										searchExpandPaths={searchExpandPaths}
										searchMatchedIndices={searchMatchedIndices}
									/>
									{(i < shownIndices.length - 1 || remaining > 0) && <span className="json-punct">,</span>}
								</div>
							);
						})}
						{remaining > 0 && (
							<div className="json-row json-show-more-row">
								<button type="button" className="json-show-more" onClick={() => onShowMore(path, Math.min(windowSize + CHUNK_SIZE, entries.length))}>
									Show {Math.min(CHUNK_SIZE, entries.length - windowSize)} more
								</button>
								{entries.length - windowSize > CHUNK_SIZE && (
									<button type="button" className="json-show-more" onClick={() => onShowMore(path, entries.length)}>
										Show all ({entries.length})
									</button>
								)}
							</div>
						)}
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
// `searchExpandPaths`/`searchMatchedIndices` (both optional) come from
// jsonSearch.js's pure, memoized match-finder — JsonView never computes
// matches itself, it only respects where the caller says a match is.
export function JsonView({ value, highlight = identity, searchExpandPaths, searchMatchedIndices }) {
	const [toggled, setToggled] = useState(() => new Set());
	const [visibleCounts, setVisibleCounts] = useState(() => new Map());
	const onToggle = useCallback((path) => {
		setToggled(prev => {
			const next = new Set(prev);
			next.has(path) ? next.delete(path) : next.add(path);
			return next;
		});
	}, []);
	const onShowMore = useCallback((path, count) => {
		setVisibleCounts(prev => new Map(prev).set(path, count));
	}, []);

	return (
		<div className="json-view">
			<JsonNode
				value={value}
				path="$"
				depth={0}
				toggled={toggled}
				onToggle={onToggle}
				visibleCounts={visibleCounts}
				onShowMore={onShowMore}
				highlight={highlight}
				searchExpandPaths={searchExpandPaths ?? EMPTY_SET}
				searchMatchedIndices={searchMatchedIndices ?? EMPTY_MAP}
			/>
		</div>
	);
}
