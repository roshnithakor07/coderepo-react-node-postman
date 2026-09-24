// Pure, side-effect-free search over a parsed JSON value. Deliberately
// decoupled from rendering: computing "does this match, and where" must
// never depend on what's currently mounted, or on a counter mutated during
// render (see transcripts/02-design-decisions.md — that was a real bug
// under React 18 StrictMode in the first version of this feature).
//
// EXPAND_CAP bounds how many distinct matches get auto-revealed. Without it,
// a broad query against a huge response (e.g. a single common letter against
// 5000 rows) would force nearly everything open and reproduce the exact
// freeze this module exists to avoid. The reported total count is always
// exact; only how many of those matches get auto-revealed is capped.
const EXPAND_CAP = 300;

function valueMatches(value, query) {
	if (value === null) return "null".includes(query);
	if (typeof value === "boolean") return String(value).includes(query);
	if (typeof value === "number") return String(value).includes(query);
	return String(value).toLowerCase().includes(query);
}

// Returns { count, expandPaths: Set<string>, matchedIndices: Map<arrayPath, Set<number>> }.
//
// matchedIndices deliberately records *which specific indices* matched
// inside each array, not "how far in the array the furthest match sits."
// An earlier version tracked the latter (a single "visible up to index N"
// number) — correct, but a match at index 4991 of a 5000-item array meant
// rendering practically the whole array just to reach it, which reproduced
// the original freeze under a query broad enough to have late matches. This
// module knows nothing about chunk windows or what's currently rendered —
// JsonView is the one that unions these specific indices with whatever
// contiguous window it's already showing.
export function findJsonMatches(root, rawQuery) {
	const query = rawQuery.trim().toLowerCase();
	if (!query) return { count: 0, expandPaths: new Set(), matchedIndices: new Map() };

	let count = 0;
	const expandPaths = new Set();
	const matchedIndices = new Map();
	let revealed = 0;

	function reveal(ancestors) {
		if (revealed >= EXPAND_CAP) return;
		revealed++;
		for (const { path, arrayIndex, arrayPath } of ancestors) {
			expandPaths.add(path);
			if (arrayIndex != null) {
				if (!matchedIndices.has(arrayPath)) matchedIndices.set(arrayPath, new Set());
				matchedIndices.get(arrayPath).add(arrayIndex);
			}
		}
	}

	function walk(value, path, ancestors) {
		if (value !== null && typeof value === "object") {
			const isArray = Array.isArray(value);
			const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
			for (let i = 0; i < entries.length; i++) {
				const [key, val] = entries[i];
				const childPath = `${path}.${key}`;
				const nextAncestors = [...ancestors, { path, arrayIndex: isArray ? i : null, arrayPath: isArray ? path : null }];
				if (!isArray && query && key.toLowerCase().includes(query)) {
					count++;
					reveal(nextAncestors);
				}
				walk(val, childPath, nextAncestors);
			}
			return;
		}
		if (valueMatches(value, query)) {
			count++;
			reveal(ancestors);
		}
	}

	walk(root, "$", []);
	return { count, expandPaths, matchedIndices };
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
