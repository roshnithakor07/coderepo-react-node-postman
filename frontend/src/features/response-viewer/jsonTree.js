// Pure helpers that turn a parsed JSON value + a Set of expanded paths into
// a flat array of "rows" — one row per visible line — for JsonView to
// virtualize. None of this touches the DOM or React; it's plain data
// transformation, safe to call from useMemo and safe under React 18
// StrictMode's double-invoke (see transcripts/02-design-decisions.md).

export const DEFAULT_EXPAND_DEPTH = 2; // depths 0 and 1 auto-expand; depth >= 2 auto-collapses
export const MAX_ENTRIES_AUTO_EXPANDED = 100; // a container bigger than this starts collapsed regardless of depth

function containerEntries(value) {
	const isArray = Array.isArray(value);
	const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
	return { isArray, entries };
}

function defaultExpanded(depth, entryCount) {
	return depth < DEFAULT_EXPAND_DEPTH && entryCount <= MAX_ENTRIES_AUTO_EXPANDED;
}

// One-time walk (called once per response, via a lazy useState initializer —
// see JsonView) that decides which containers start expanded. Cost is
// proportional to the number of *containers* in the whole response (~5000
// for the /photos endpoint's array-of-objects shape), not the number of
// DOM nodes ever created — a plain JS walk with no rendering, measured at a
// few milliseconds even for that shape (see transcripts/claude-session.md
// for the measured number).
export function computeDefaultExpanded(root) {
	const expanded = new Set();
	function walk(value, path, depth) {
		if (value === null || typeof value !== "object") return;
		const { isArray, entries } = containerEntries(value);
		if (entries.length === 0) return;
		if (defaultExpanded(depth, entries.length)) {
			expanded.add(path);
			for (const [key, val] of entries) walk(val, `${path}.${key}`, depth + 1);
		}
	}
	walk(root, "$", 0);
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
