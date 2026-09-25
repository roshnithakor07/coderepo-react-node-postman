// Pure helpers that turn a parsed JSON value + a Set of expanded paths into
// a flat array of "rows" — one row per visible line — for JsonView to
// virtualize. None of this touches the DOM or React; it's plain data
// transformation, safe to call from useMemo and safe under React 18
// StrictMode's double-invoke (see transcripts/02-design-decisions.md).

export const SMALL_RESPONSE_NODE_THRESHOLD = 500; // below this many total nodes, expand everything (like Postman)
export const MAX_ENTRIES_AUTO_EXPANDED = 100; // below the root, a container bigger than this starts collapsed

// Keys of a container, without materializing [key, value] pairs — the
// walks below run over every node of a large response, so they avoid the
// per-container array copies `value.map(...)`/`Object.entries` would make.
// Arrays use their numeric indices directly (see forEachChild).
function isContainer(value) {
	return value !== null && typeof value === "object";
}

function childCount(value) {
	return Array.isArray(value) ? value.length : Object.keys(value).length;
}

// Calls fn(key, child, index, count) for each child in document order; `key`
// is the path segment (the index as a string for arrays).
function forEachChild(value, fn) {
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) fn(String(i), value[i], i, value.length);
		return;
	}
	const keys = Object.keys(value);
	for (let i = 0; i < keys.length; i++) fn(keys[i], value[keys[i]], i, keys.length);
}

// "Does this response have at least `limit` nodes?" — the small-vs-large
// test. Stops counting the moment it reaches `limit`, so a 5000-item
// response costs ~`limit` steps here instead of a full walk of every node.
function hasAtLeastNodes(root, limit) {
	let count = 0;
	function walk(value) {
		if (++count >= limit) return true;
		if (!isContainer(value)) return false;
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) if (walk(value[i])) return true;
			return false;
		}
		for (const key in value) if (Object.hasOwn(value, key) && walk(value[key])) return true;
		return false;
	}
	return walk(root);
}

// Decides which containers start expanded for a brand new response — called
// once per response (see ResponseViewer's render-phase state adjustment,
// not a useEffect, so a new response never paints one frame with the
// *previous* response's expansion first). Rules, in order:
//   1. The root always starts expanded, regardless of size — the user
//      should never be dead-ended behind a single collapsed summary line.
//   2. Below the root, any container with more than
//      MAX_ENTRIES_AUTO_EXPANDED entries starts collapsed, in any response.
//   3. A small response (< SMALL_RESPONSE_NODE_THRESHOLD total nodes) starts
//      otherwise fully expanded, matching Postman's own default.
//   4. Otherwise ("large"): root plus, for an *object* root, each first-
//      level property that is itself a (non-big) container. For an *array*
//      root (e.g. the 5000-item /photos shape), only the root itself
//      expands — auto-expanding every item would make "large" responses as
//      expanded as small ones, defeating the size threshold. Root being open
//      is what matters: the user sees "[" immediately and expands items from
//      there rather than starting behind one opaque "5000 items" line.
export function computeDefaultExpanded(root) {
	if (!isContainer(root) || childCount(root) === 0) return new Set();

	if (!hasAtLeastNodes(root, SMALL_RESPONSE_NODE_THRESHOLD)) {
		return collectAllContainerPaths(root, { maxEntriesBelowRoot: MAX_ENTRIES_AUTO_EXPANDED });
	}

	const expanded = new Set(["$"]);
	if (!Array.isArray(root)) {
		forEachChild(root, (key, val) => {
			if (!isContainer(val)) return;
			const n = childCount(val);
			if (n > 0 && n <= MAX_ENTRIES_AUTO_EXPANDED) expanded.add(`$.${key}`);
		});
	}
	return expanded;
}

// Every container path in the tree — for "Expand all" (no limit), and for a
// small response's default expansion (with `maxEntriesBelowRoot`, which
// leaves big non-root containers — and so everything inside them —
// collapsed). A plain walk; only ever run once per response or per click.
export function collectAllContainerPaths(root, { maxEntriesBelowRoot = Infinity } = {}) {
	const all = new Set();
	function walk(value, path, isRoot) {
		if (!isContainer(value)) return;
		const n = childCount(value);
		if (n === 0 || (!isRoot && n > maxEntriesBelowRoot)) return;
		all.add(path);
		forEachChild(value, (key, val) => walk(val, `${path}.${key}`, false));
	}
	walk(root, "$", true);
	return all;
}

// The core of the fix: flattens the tree into an ordered array of rows,
// recursing into a container ONLY when expandedPaths has it — a collapsed
// subtree is never visited, so cost scales with what's expanded, not with
// total response size. Each row already carries everything JsonView needs
// to render that one line with no further tree lookups.
export function flattenTree(root, expandedPaths) {
	const rows = [];
	function walk(value, path, depth, key, needsComma) {
		if (!isContainer(value)) {
			rows.push({ type: "leaf", path, depth, key, value, needsComma });
			return;
		}
		const isArray = Array.isArray(value);
		const n = childCount(value);
		if (n === 0) {
			rows.push({ type: "empty", path, depth, key, isArray, needsComma });
			return;
		}
		if (!expandedPaths.has(path)) {
			rows.push({ type: "collapsed", path, depth, key, isArray, entryCount: n, needsComma });
			return;
		}
		rows.push({ type: "open", path, depth, key, isArray });
		forEachChild(value, (k, v, i, count) => walk(v, `${path}.${k}`, depth + 1, isArray ? null : k, i < count - 1));
		rows.push({ type: "close", path, depth, isArray, needsComma });
	}
	walk(root, "$", 0, null, false);
	return rows;
}
