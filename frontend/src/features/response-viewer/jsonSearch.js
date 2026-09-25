// Pure, side-effect-free search over a parsed JSON value. Deliberately
// decoupled from rendering: computing "does this match, and where" must
// never depend on what's currently mounted, or on a counter mutated during
// render (see transcripts/02-design-decisions.md — that was a real bug
// under React 18 StrictMode in the first version of this feature).
//
// Returns matches as an ordered list of {path, ancestorPaths}, not as a set
// of "paths to force-expand." An earlier version expanded every matching
// path's ancestors at once (then, when that still proved too broad, capped
// how many); with virtualization there's a simpler and genuinely unbounded
// answer — only the *current* match needs its ancestors expanded, one at a
// time, exactly when the user navigates to it. See ResponseViewer.jsx's
// jump-to-match effect.

// The one place a raw search-box string becomes the query every matcher
// and highlighter uses, so counting and highlighting can never disagree.
export function normalizeQuery(rawQuery) {
	return (rawQuery ?? "").trim().toLowerCase();
}

function valueMatches(value, query) {
	if (value === null) return "null".includes(query);
	if (typeof value === "boolean") return String(value).includes(query);
	if (typeof value === "number") return String(value).includes(query);
	return String(value).toLowerCase().includes(query);
}

// Returns { count, matches: [{ path, ancestorPaths }] }, in document order
// (the same pre-order a flatten() walk visits, so "next match" reads top to
// bottom the way the user would scroll).
export function findJsonMatches(root, rawQuery) {
	const query = normalizeQuery(rawQuery);
	if (!query) return { count: 0, matches: [] };

	const matches = [];
	// One shared stack of the current node's ancestor paths, copied only
	// when a match is recorded — this walk visits every node of a large
	// response, so it avoids per-container allocations (entries arrays,
	// ancestor-list copies) on the far more common no-match path.
	const ancestors = [];

	function visitChild(key, val, path, isArray) {
		const childPath = `${path}.${key}`;
		if (!isArray && key.toLowerCase().includes(query)) matches.push({ path: childPath, ancestorPaths: ancestors.slice() });
		walk(val, childPath);
	}

	function walk(value, path) {
		if (value === null || typeof value !== "object") {
			if (valueMatches(value, query)) matches.push({ path, ancestorPaths: ancestors.slice() });
			return;
		}
		ancestors.push(path);
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) visitChild(String(i), value[i], path, true);
		} else {
			for (const key of Object.keys(value)) visitChild(key, value[key], path, false);
		}
		ancestors.pop();
	}

	walk(root, "$");
	return { count: matches.length, matches };
}

// Whether one flattened row (see jsonTree.js) contains a match — by the
// same rules findJsonMatches counts with: an object key, or a leaf's value.
// `query` must already be normalized. JsonView uses this to hand the query
// only to matching rows, so rows without a match keep identical props and
// their memoized render is skipped when the query changes.
export function rowMatchesQuery(row, query) {
	if (!query) return false;
	if (row.key != null && row.key.toLowerCase().includes(query)) return true;
	return row.type === "leaf" && valueMatches(row.value, query);
}

// Pure next/prev-with-wrap index math for search navigation — extracted so
// it's independently testable (see jsonSearch.test.js) rather than only
// exercised indirectly through the UI. `total === 0` returns 0 rather than
// dividing by zero (there's nothing to navigate to).
export function nextMatchIndex(current, delta, total) {
	if (total <= 0) return 0;
	return (current + delta + total) % total;
}

// Same query semantics, applied to flat text (the Raw tab, or a non-JSON
// Pretty body) instead of a parsed tree — just an occurrence count, no
// paths to expand.
export function countTextMatches(text, rawQuery) {
	const query = normalizeQuery(rawQuery);
	if (!query || !text) return 0;
	const lower = text.toLowerCase();
	let count = 0;
	let i = 0;
	while (true) {
		const idx = lower.indexOf(query, i);
		if (idx === -1) break;
		count++;
		i = idx + query.length;
	}
	return count;
}
