// Pure helpers that turn a parsed JSON value + a Set of expanded paths into
// a flat array of "rows" — one row per visible line — for JsonView to
// virtualize. None of this touches the DOM or React; it's plain data
// transformation, safe to call from useMemo and safe under React 18
// StrictMode's double-invoke (see transcripts/02-design-decisions.md).

export const SMALL_RESPONSE_NODE_THRESHOLD = 500; // below this many total nodes, expand everything (like Postman)
export const MAX_ENTRIES_AUTO_EXPANDED = 100; // a first-level container bigger than this starts collapsed anyway

function containerEntries(value) {
	const isArray = Array.isArray(value);
	const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
	return { isArray, entries };
}

// How many rows flattenTree would produce if *everything* were expanded —
// the "is this response small or large" measure. A plain counting walk, no
// row objects allocated, no DOM — cheap even for a huge response (see
// transcripts/claude-session.md for the measured cost on the /photos shape).
function countTotalNodes(value) {
	if (value === null || typeof value !== "object") return 1;
	const { entries } = containerEntries(value);
	if (entries.length === 0) return 1;
	let count = 1;
	for (const [, v] of entries) count += countTotalNodes(v);
	return count;
}

// Decides which containers start expanded for a brand new response — called
// once per response (see ResponseViewer's render-phase state adjustment,
// not a useEffect, so a new response never paints one frame with the
// *previous* response's expansion first). Rules, in order:
//   1. The root always starts expanded, regardless of size — the user
//      should never be dead-ended behind a single collapsed summary line.
//   2. A genuinely small response (< SMALL_RESPONSE_NODE_THRESHOLD total
//      nodes) starts fully expanded, matching Postman's own default.
//   3. Otherwise ("large"): root plus, for an *object* root, each first-
//      level property that is itself a container also starts expanded,
//      unless that property is itself "big" (> MAX_ENTRIES_AUTO_EXPANDED
//      entries), which stays collapsed. For an *array* root (e.g. the
//      5000-item /photos shape), only the root itself expands — auto-
//      expanding every individual item would mean "large" responses end up
//      exactly as expanded as "small" ones by default, which defeats the
//      distinction the size threshold exists to draw. Root being open is
//      what actually matters: the user sees "[" immediately and can expand
//      individual items from there, rather than starting behind one opaque
//      "5000 items" line.
export function computeDefaultExpanded(root) {
	if (root === null || typeof root !== "object") return new Set();
	const { isArray, entries } = containerEntries(root);
	if (entries.length === 0) return new Set();

	if (countTotalNodes(root) < SMALL_RESPONSE_NODE_THRESHOLD) return collectAllContainerPaths(root);

	const expanded = new Set(["$"]);
	if (!isArray) {
		for (const [key, val] of entries) {
			if (val === null || typeof val !== "object") continue;
			const { entries: childEntries } = containerEntries(val);
			if (childEntries.length > 0 && childEntries.length <= MAX_ENTRIES_AUTO_EXPANDED) expanded.add(`$.${key}`);
		}
	}
	return expanded;
}

// Every container path in the whole tree, regardless of size or depth — for
// "Expand all." A plain walk, same cost class as computeDefaultExpanded;
// only ever called from an explicit button click, never automatically.
export function collectAllContainerPaths(root) {
	const all = new Set();
	function walk(value, path) {
		if (value === null || typeof value !== "object") return;
		const { entries } = containerEntries(value);
		if (entries.length === 0) return;
		all.add(path);
		for (const [key, val] of entries) walk(val, `${path}.${key}`);
	}
	walk(root, "$");
	return all;
}

// The core of the fix: flattens the tree into an ordered array of rows,
// recursing into a container ONLY when expandedPaths has it — a collapsed
// subtree is never visited, so cost scales with what's expanded, not with
// total response size. Each row already carries everything JsonView needs
// to render that one line with no further tree lookups.
export function flattenTree(root, expandedPaths) {
	const rows = [];
	function pushLeaf(value, path, depth, key, needsComma) {
		rows.push({ type: "leaf", path, depth, key, value, needsComma });
	}
	function walk(value, path, depth, key, needsComma) {
		if (value === null || typeof value !== "object") {
			pushLeaf(value, path, depth, key, needsComma);
			return;
		}
		const { isArray, entries } = containerEntries(value);
		if (entries.length === 0) {
			rows.push({ type: "empty", path, depth, key, isArray, needsComma });
			return;
		}
		if (!expandedPaths.has(path)) {
			rows.push({ type: "collapsed", path, depth, key, isArray, entryCount: entries.length, needsComma });
			return;
		}
		rows.push({ type: "open", path, depth, key, isArray });
		entries.forEach(([k, v], i) => walk(v, `${path}.${k}`, depth + 1, isArray ? null : k, i < entries.length - 1));
		rows.push({ type: "close", path, depth, isArray, needsComma });
	}
	walk(root, "$", 0, null, false);
	return rows;
}
