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
	const query = rawQuery.trim().toLowerCase();
	if (!query) return { count: 0, matches: [] };

	const matches = [];

	function walk(value, path, ancestorPaths) {
		if (value !== null && typeof value === "object") {
			const isArray = Array.isArray(value);
			const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
			const nextAncestors = [...ancestorPaths, path];
			for (const [key, val] of entries) {
				const childPath = `${path}.${key}`;
				if (!isArray && key.toLowerCase().includes(query)) matches.push({ path: childPath, ancestorPaths: nextAncestors });
				walk(val, childPath, nextAncestors);
			}
			return;
		}
		if (valueMatches(value, query)) matches.push({ path, ancestorPaths });
	}

	walk(root, "$", []);
	return { count: matches.length, matches };
}

// Same query semantics, applied to flat text (the Raw tab, or a non-JSON
// Pretty body) instead of a parsed tree — just an occurrence count, no
// paths to expand.
export function countTextMatches(text, rawQuery) {
	const query = rawQuery.trim().toLowerCase();
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
