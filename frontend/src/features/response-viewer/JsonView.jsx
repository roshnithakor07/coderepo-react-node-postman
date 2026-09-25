import { memo, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { flattenTree } from "./jsonTree.js";
import { rowMatchesQuery } from "./jsonSearch.js";
import { highlightText } from "./highlight.jsx";

// Self-written, virtualized JSON tree renderer: syntax highlighting +
// collapsible objects/arrays + windowed rendering. No dependency (no
// react-window) — a fixed-row-height virtual list is a well-understood,
// small technique, and this app's rows are already fixed-height text lines,
// which is exactly the case hand-rolling suits.
//
// Color mapping reuses existing design tokens rather than inventing new
// ones (see transcripts/02-design-decisions.md for the exact mapping and
// why): keys use --info, strings --success, numbers --warning, booleans
// --patch, null --text-tertiary, punctuation --text-secondary.
//
// Performance model: jsonTree.js's flattenTree() only recurses into
// EXPANDED containers — a collapsed subtree contributes exactly one row,
// never its children — so flattening cost scales with what's expanded, not
// total response size. On top of that, this component only ever mounts the
// rows inside the current scroll viewport (+ a small overscan), regardless
// of how large `expandedPaths` makes the flattened list — that's what makes
// "Expand all" on a 5000-item array safe: flattening ~30,000 rows is a
// cheap plain-JS walk (no DOM), and only ~40 of them are ever real elements
// at once. ROW_HEIGHT must stay in sync with .json-vrow's CSS height/
// line-height — the virtualization math assumes every row is exactly this
// tall.
//
// Re-render model: JsonRow is memoized, and its props are all stable for a
// row whose match state didn't change — `row` objects keep their identity
// until flatRows is recomputed, `onToggle` is a stable callback, and only
// rows that actually contain a match receive the (normalized) query, so a
// new query re-renders just the matching rows and moving between matches
// re-renders just the old and new current rows. Scrolling only mounts the
// rows entering the window. JsonView itself is memoized and never receives
// the search box's live text, so typing doesn't render the tree at all.
export const ROW_HEIGHT = 20;
const OVERSCAN = 12;
const INDENT_PX = 14;

function JsonPrimitive({ value, query, isActive }) {
	if (value === null) return <span className="json-null">{highlightText("null", query, isActive)}</span>;
	if (typeof value === "boolean") return <span className="json-bool">{highlightText(String(value), query, isActive)}</span>;
	if (typeof value === "number") return <span className="json-number">{highlightText(String(value), query, isActive)}</span>;
	return <span className="json-string">"{highlightText(value, query, isActive)}"</span>;
}

function RowGutter({ row, onToggle }) {
	if (row.type !== "open" && row.type !== "collapsed") return <span className="json-vrow-gutter" />;
	return (
		<span className="json-vrow-gutter">
			<button
				type="button"
				className="json-toggle"
				onClick={() => onToggle(row.path)}
				aria-label={row.type === "collapsed" ? "Expand" : "Collapse"}
				aria-expanded={row.type === "open"}
			>
				<span className={`json-caret ${row.type === "open" ? "open" : ""}`}>▶</span>
			</button>
		</span>
	);
}

function RowKeyPrefix({ row, query, isActive }) {
	if (row.key === null) return null;
	return (
		<>
			<span className="json-key">"{highlightText(row.key, query, isActive)}"</span>
			<span className="json-punct">: </span>
		</>
	);
}

// `matchQuery` is "" unless this row contains a match (see the re-render
// model above); `isActive` is true only for the current match's row.
const JsonRow = memo(function JsonRow({ row, matchQuery, isActive, onToggle }) {
	const style = { paddingLeft: row.depth * INDENT_PX };
	if (row.type === "open") {
		return (
			<div className="json-vrow" style={style}>
				<RowGutter row={row} onToggle={onToggle} />
				<RowKeyPrefix row={row} query={matchQuery} isActive={isActive} />
				<span className="json-punct">{row.isArray ? "[" : "{"}</span>
			</div>
		);
	}
	if (row.type === "close") {
		return (
			<div className="json-vrow" style={style}>
				<span className="json-vrow-gutter" />
				<span className="json-punct">{row.isArray ? "]" : "}"}{row.needsComma ? "," : ""}</span>
			</div>
		);
	}
	if (row.type === "empty") {
		return (
			<div className="json-vrow" style={style}>
				<span className="json-vrow-gutter" />
				<RowKeyPrefix row={row} query={matchQuery} isActive={isActive} />
				<span className="json-punct">{row.isArray ? "[]" : "{}"}{row.needsComma ? "," : ""}</span>
			</div>
		);
	}
	if (row.type === "collapsed") {
		const countLabel = row.isArray ? `${row.entryCount} item${row.entryCount === 1 ? "" : "s"}` : `${row.entryCount} key${row.entryCount === 1 ? "" : "s"}`;
		return (
			<div className="json-vrow" style={style}>
				<RowGutter row={row} onToggle={onToggle} />
				<RowKeyPrefix row={row} query={matchQuery} isActive={isActive} />
				<span className="json-punct">{row.isArray ? "[" : "{"}</span>
				<button type="button" className="json-collapsed-summary" onClick={() => onToggle(row.path)}>{countLabel}</button>
				<span className="json-punct">{row.isArray ? "]" : "}"}{row.needsComma ? "," : ""}</span>
			</div>
		);
	}
	// leaf — title carries the untruncated value; long ones ellipsize per the CSS.
	return (
		<div className="json-vrow" style={style} title={String(row.value)}>
			<span className="json-vrow-gutter" />
			<RowKeyPrefix row={row} query={matchQuery} isActive={isActive} />
			<JsonPrimitive value={row.value} query={matchQuery} isActive={isActive} />
			{row.needsComma && <span className="json-punct">,</span>}
		</div>
	);
});

// `query` is the normalized, debounced search query ("" for none) and
// `activePath` the current match's row path. `expandedPaths`/`onToggle`
// are controlled from ResponseViewer (not owned locally) because search
// "jump to match" and the Expand-all/Collapse-all controls both need to
// drive expansion from outside the tree. `activePath`/`scrollNonce` also
// request scrolling that row into view once it's expanded (scrollNonce should change on
// every navigation — even to the same path twice — so the effect reliably
// re-fires; ResponseViewer passes the current match index for this).
// How far the json-view root's top edge sits below the scroll container's
// top edge, in the container's scrolled content coordinates. Deliberately
// NOT `root.offsetTop`: that's relative to `root`'s nearest *positioned*
// ancestor (its offsetParent), which is only guaranteed to be the scroll
// container if the container itself has non-static positioning — it
// doesn't here, so offsetTop silently measured against the wrong element
// and both scrolling-to-a-match and (more subtly) the viewport-range math
// were computing garbage off of it. getBoundingClientRect() differences are
// pure viewport geometry and don't depend on any CSS positioning setup at
// all, so this is correct regardless of what ancestors do or don't have
// `position` set.
function rootOffsetWithinContainer(container, root) {
	const containerRect = container.getBoundingClientRect();
	const rootRect = root.getBoundingClientRect();
	return container.scrollTop + (rootRect.top - containerRect.top);
}

export const JsonView = memo(function JsonView({ value, expandedPaths, onToggle, query = "", activePath, scrollContainerRef, scrollNonce }) {
	const flatRows = useMemo(() => flattenTree(value, expandedPaths), [value, expandedPaths]);
	const rootRef = useRef(null);
	const [range, setRange] = useState({ start: 0, end: 80 });

	const recomputeRange = useCallback(() => {
		const container = scrollContainerRef.current;
		const root = rootRef.current;
		if (!container || !root) return;
		const rootOffset = rootOffsetWithinContainer(container, root);
		const relativeScroll = Math.max(0, container.scrollTop - rootOffset);
		const start = Math.max(0, Math.floor(relativeScroll / ROW_HEIGHT) - OVERSCAN);
		const visibleRowCount = Math.ceil(container.clientHeight / ROW_HEIGHT) + OVERSCAN * 2;
		setRange(prev => {
			const end = Math.min(flatRows.length, start + visibleRowCount);
			return prev.start === start && prev.end === end ? prev : { start, end };
		});
	}, [flatRows.length, scrollContainerRef]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		recomputeRange();
		container.addEventListener("scroll", recomputeRange, { passive: true });
		const ro = new ResizeObserver(recomputeRange);
		ro.observe(container);
		return () => { container.removeEventListener("scroll", recomputeRange); ro.disconnect(); };
	}, [recomputeRange, scrollContainerRef]);

	// flatRows changed (data, or a node was expanded/collapsed) — the old
	// range may now be wrong (shorter list, or content shifted under an
	// unchanged scrollTop), so re-derive it.
	useEffect(() => { recomputeRange(); }, [flatRows, recomputeRange]);

	// Scrolls a specific row into view once it exists in flatRows — the
	// caller is expected to have already added its ancestor paths to
	// expandedPaths; this effect only locates and scrolls, it never expands
	// anything itself.
	useEffect(() => {
		if (activePath == null) return;
		const idx = flatRows.findIndex(r => r.path === activePath);
		if (idx === -1) return;
		const container = scrollContainerRef.current;
		const root = rootRef.current;
		if (!container || !root) return;
		const targetTop = rootOffsetWithinContainer(container, root) + idx * ROW_HEIGHT;
		const center = targetTop - container.clientHeight / 2 + ROW_HEIGHT / 2;
		container.scrollTo({ top: Math.max(0, center) });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePath, scrollNonce, flatRows, scrollContainerRef]);

	const visible = flatRows.slice(range.start, range.end);

	return (
		<div className="json-view" ref={rootRef} style={{ position: "relative", height: flatRows.length * ROW_HEIGHT }}>
			<div className="json-view-window" style={{ transform: `translateY(${range.start * ROW_HEIGHT}px)` }}>
				{/* An expanded container contributes both an "open" and a "close" row
				    sharing the same path — key on path+type so React never sees a
				    collision (it did before this fix; see transcripts/claude-session.md). */}
				{visible.map(row => {
					const isMatch = rowMatchesQuery(row, query);
					return (
						<JsonRow
							key={`${row.path}:${row.type}`}
							row={row}
							matchQuery={isMatch ? query : ""}
							isActive={isMatch && row.path === activePath}
							onToggle={onToggle}
						/>
					);
				})}
			</div>
		</div>
	);
});
