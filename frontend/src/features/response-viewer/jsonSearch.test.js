import { describe, test, expect } from "bun:test";
import { findJsonMatches, nextMatchIndex, countTextMatches, rowMatchesQuery, normalizeQuery } from "./jsonSearch.js";
import { flattenTree, computeDefaultExpanded } from "./jsonTree.js";

// Run with `bun test` from frontend/ (or any ancestor Bun test picks the
// file up from) — no separate test runner or dependency needed, `bun:test`
// is built in and already used by the backend's own tests.

describe("nextMatchIndex", () => {
	test("moves forward by one", () => {
		expect(nextMatchIndex(0, 1, 5)).toBe(1);
	});
	test("moves backward by one", () => {
		expect(nextMatchIndex(2, -1, 5)).toBe(1);
	});
	test("wraps forward past the last match to the first", () => {
		expect(nextMatchIndex(4, 1, 5)).toBe(0);
	});
	test("wraps backward from the first match to the last", () => {
		expect(nextMatchIndex(0, -1, 5)).toBe(4);
	});
	test("single match stays put in both directions", () => {
		expect(nextMatchIndex(0, 1, 1)).toBe(0);
		expect(nextMatchIndex(0, -1, 1)).toBe(0);
	});
	test("zero matches never divides by zero", () => {
		expect(nextMatchIndex(0, 1, 0)).toBe(0);
		expect(nextMatchIndex(0, -1, 0)).toBe(0);
	});
});

describe("findJsonMatches", () => {
	test("finds a match in a value", () => {
		const { count, matches } = findJsonMatches({ name: "accusamus" }, "accus");
		expect(count).toBe(1);
		expect(matches[0].path).toBe("$.name");
	});

	test("finds a match in an object key", () => {
		const { count, matches } = findJsonMatches({ accusamusField: 1 }, "accus");
		expect(count).toBe(1);
		expect(matches[0].path).toBe("$.accusamusField");
	});

	test("does not treat array indices as matchable keys", () => {
		const { count } = findJsonMatches(["0", "1", "2"], "0");
		// only the string VALUE "0" should match, not the array's own index "0"
		expect(count).toBe(1);
	});

	test("records the full ancestor chain for a deeply nested match", () => {
		const data = { a: { b: [{ c: "findme" }] } };
		const { matches } = findJsonMatches(data, "findme");
		expect(matches).toHaveLength(1);
		expect(matches[0].ancestorPaths).toEqual(["$", "$.a", "$.a.b", "$.a.b.0"]);
	});

	test("preserves document order across multiple matches", () => {
		const data = ["ad-one", "nope", "ad-two", "ad-three"];
		const { matches } = findJsonMatches(data, "ad");
		expect(matches.map((m) => m.path)).toEqual(["$.0", "$.2", "$.3"]);
	});
});

describe("jump-to-match integration (findJsonMatches + flattenTree)", () => {
	test("a match inside a fully collapsed structure becomes locatable once its ancestors are expanded", () => {
		const data = { outer: { middle: { target: "needle-value", other: 1 } } };
		const { matches } = findJsonMatches(data, "needle");
		expect(matches).toHaveLength(1);
		const match = matches[0];

		// Collapsed (nothing expanded): the match's row doesn't exist yet.
		const collapsedRows = flattenTree(data, new Set());
		expect(collapsedRows.find((r) => r.path === match.path)).toBeUndefined();

		// Expand exactly the match's own ancestor chain (what ResponseViewer's
		// jump-to-match effect does) and it becomes a real row, at a stable
		// index — the "target row index" navigation actually scrolls to.
		const expanded = new Set(match.ancestorPaths);
		const rows = flattenTree(data, expanded);
		const idx = rows.findIndex((r) => r.path === match.path);
		expect(idx).toBeGreaterThan(-1);
		expect(rows[idx].value).toBe("needle-value");
	});

	test("matches in a large array are each independently reachable without expanding the whole array", () => {
		const items = Array.from({ length: 2000 }, (_, i) => ({ id: i, tag: i === 1500 ? "findme" : "other" }));
		const { matches } = findJsonMatches(items, "findme");
		expect(matches).toHaveLength(1);
		const match = matches[0];
		expect(match.ancestorPaths).toEqual(["$", "$.1500"]);

		const rows = flattenTree(items, new Set(match.ancestorPaths));
		// The root is one of the ancestors, so every item still contributes
		// its own row (collapsed, "{2 keys}") — that's unavoidable, the array
		// itself is open. What matters is that only item 1500 contributes
		// *its own fields* too; the other 1999 items stay collapsed rather
		// than also expanding, so rows stays close to items.length rather
		// than exploding toward items.length * fieldsPerItem (~10,000+).
		expect(rows.length).toBeGreaterThanOrEqual(items.length);
		expect(rows.length).toBeLessThan(items.length + 20);
		expect(rows.find((r) => r.path === match.path)?.value).toBe("findme");
	});
});

describe("countTextMatches", () => {
	test("counts overlapping-free occurrences", () => {
		expect(countTextMatches("ababab", "ab")).toBe(3);
	});
	test("is case-insensitive", () => {
		expect(countTextMatches("Accusamus", "accusamus")).toBe(1);
	});
	test("empty query or text yields zero", () => {
		expect(countTextMatches("", "x")).toBe(0);
		expect(countTextMatches("x", "")).toBe(0);
	});
});

describe("rowMatchesQuery", () => {
	const rows = flattenTree({ Title: "Accusamus beatae", id: 7, tags: ["x"], nested: { a: 1 } }, new Set(["$", "$.tags"]));
	const byPath = (p, type) => rows.find((r) => r.path === p && (!type || r.type === type));
	test("matches a leaf by value, case-insensitively", () => {
		expect(rowMatchesQuery(byPath("$.Title"), normalizeQuery("ACCUSAMUS"))).toBe(true);
	});
	test("matches an object key, including on a collapsed container row", () => {
		expect(rowMatchesQuery(byPath("$.nested", "collapsed"), normalizeQuery("nest"))).toBe(true);
	});
	test("matches a number leaf by its string form", () => {
		expect(rowMatchesQuery(byPath("$.id"), "7")).toBe(true);
	});
	test("never matches a close row or an empty query", () => {
		expect(rowMatchesQuery(byPath("$.tags", "close"), "tags")).toBe(false);
		expect(rowMatchesQuery(byPath("$.Title"), "")).toBe(false);
	});
	test("agrees with findJsonMatches on which rows match", () => {
		const q = normalizeQuery(" a ");
		const all = flattenTree({ Title: "Accusamus beatae", id: 7, tags: ["xa"], nested: { a: 1 } }, new Set(["$", "$.tags", "$.nested"]));
		const matchingRowPaths = [...new Set(all.filter((r) => rowMatchesQuery(r, q)).map((r) => r.path))];
		const matchPaths = [
			...new Set(findJsonMatches({ Title: "Accusamus beatae", id: 7, tags: ["xa"], nested: { a: 1 } }, q).matches.map((m) => m.path)),
		];
		expect(matchingRowPaths).toEqual(matchPaths);
	});
});

describe("computeDefaultExpanded", () => {
	test("small response: everything expanded", () => {
		expect([...computeDefaultExpanded({ a: { b: [1, 2] } })].sort()).toEqual(["$", "$.a", "$.a.b"]);
	});
	test("small response: a nested container over 100 entries starts collapsed, root still open", () => {
		const big = Array.from({ length: 150 }, (_, i) => i);
		const expanded = computeDefaultExpanded({ big, small: [1] });
		expect(expanded.has("$")).toBe(true);
		expect(expanded.has("$.small")).toBe(true);
		expect(expanded.has("$.big")).toBe(false);
	});
	test("a big root array is still expanded (root is always open)", () => {
		expect([...computeDefaultExpanded(Array.from({ length: 150 }, (_, i) => i))]).toEqual(["$"]);
	});
	test("large array root (the /photos shape): only the root expands", () => {
		const photos = Array.from({ length: 5000 }, (_, i) => ({ id: i, title: "t", url: "u" }));
		expect([...computeDefaultExpanded(photos)]).toEqual(["$"]);
	});
	test("large object root: small first-level containers expand, big ones don't", () => {
		const root = { items: Array.from({ length: 600 }, (_, i) => i), meta: { page: 1 } };
		const expanded = computeDefaultExpanded(root);
		expect([...expanded].sort()).toEqual(["$", "$.meta"]);
	});
});
