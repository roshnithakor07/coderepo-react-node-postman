import { describe, test, expect } from "bun:test";
import {
	toSavedFields,
	isSavedRequestDirty,
	findSavedRequest,
	replaceSavedRequest,
	removeSavedRequest,
	addSavedRequest,
	nextCopyName,
	buildDuplicatePayload,
	insertSavedRequestAfter,
	normalizeRequestName,
	hasNameConflict,
	duplicateNameMessage,
} from "./savedRequest.js";

const saved = {
	_id: "r1",
	name: "Users",
	method: "GET",
	url: "http://localhost/users",
	params: [{ key: "page", value: "1" }],
	headers: [],
	body: "",
	bodyType: "none",
	auth: { type: "none" },
};
const builderFrom = (s) => ({
	method: s.method,
	url: s.url,
	params: s.params.map((p) => ({ ...p, enabled: true })),
	headers: [],
	body: "",
	bodyType: "none",
	auth: { type: "none" },
});

describe("isSavedRequestDirty", () => {
	test("a request just loaded from its saved version is clean (stored rows may omit enabled)", () => {
		expect(isSavedRequestDirty(builderFrom(saved), saved)).toBe(false);
	});
	test("any edited field makes it dirty", () => {
		for (const change of [
			{ method: "POST" },
			{ url: "http://localhost/u2" },
			{ body: "x" },
			{ bodyType: "json" },
			{ auth: { type: "bearer", token: "t" } },
		]) {
			expect(isSavedRequestDirty({ ...builderFrom(saved), ...change }, saved)).toBe(true);
		}
		expect(isSavedRequestDirty({ ...builderFrom(saved), params: [{ key: "page", value: "2", enabled: true }] }, saved)).toBe(true);
		expect(isSavedRequestDirty({ ...builderFrom(saved), params: [{ key: "page", value: "1", enabled: false }] }, saved)).toBe(true);
		expect(
			isSavedRequestDirty({ ...builderFrom(saved), params: [{ key: "page", value: "1", enabled: true, description: "n" }] }, saved),
		).toBe(true);
	});
	test("editing and typing the original value back reads as clean again", () => {
		const edited = { ...builderFrom(saved), url: "http://localhost/users2" };
		expect(isSavedRequestDirty(edited, saved)).toBe(true);
		expect(isSavedRequestDirty({ ...edited, url: "http://localhost/users" }, saved)).toBe(false);
	});
	test("no saved request loaded → never dirty", () => {
		expect(isSavedRequestDirty(builderFrom(saved), null)).toBe(false);
	});
});

describe("toSavedFields", () => {
	test("carries exactly the saveable fields, never the name or ids", () => {
		const fields = toSavedFields({ ...saved, _id: "x", name: "n", extra: 1 });
		expect(Object.keys(fields).sort()).toEqual(["auth", "body", "bodyType", "headers", "method", "params", "url"]);
	});
});

describe("collection list helpers", () => {
	const collections = [
		{ _id: "c1", name: "One", requests: [saved, { _id: "r2", name: "Other" }] },
		{ _id: "c2", name: "Two", requests: [] },
	];
	test("findSavedRequest returns the request and its collection", () => {
		expect(findSavedRequest(collections, "r2")).toEqual({ request: collections[0].requests[1], collection: collections[0] });
		expect(findSavedRequest(collections, "nope")).toBeNull();
		expect(findSavedRequest(collections, null)).toBeNull();
	});
	test("replace / remove / add update immutably", () => {
		const renamed = replaceSavedRequest(collections, { _id: "r1", name: "Renamed" });
		expect(renamed[0].requests[0]).toMatchObject({ _id: "r1", name: "Renamed", url: saved.url });
		expect(collections[0].requests[0].name).toBe("Users");
		expect(removeSavedRequest(collections, "r1")[0].requests.map((r) => r._id)).toEqual(["r2"]);
		expect(addSavedRequest(collections, "c2", { _id: "r3" })[1].requests).toEqual([{ _id: "r3" }]);
		expect(addSavedRequest(collections, "c1", { _id: "r0" })[0].requests.map((r) => r._id)).toEqual(["r0", "r1", "r2"]);
		expect(collections[1].requests).toEqual([]);
	});
});

describe("nextCopyName", () => {
	test('first duplicate is "<name> Copy"', () => {
		expect(nextCopyName("Users", ["Users"])).toBe("Users Copy");
	});
	test('then "Copy 2", "Copy 3"… skipping names already taken', () => {
		expect(nextCopyName("Users", ["Users", "Users Copy"])).toBe("Users Copy 2");
		expect(nextCopyName("Users", ["Users", "Users Copy", "Users Copy 2", "Users Copy 3"])).toBe("Users Copy 4");
		expect(nextCopyName("Users", ["Users", "Users Copy", "Users Copy 3"])).toBe("Users Copy 2");
	});
	test("only exact names count (no false matches on prefixes)", () => {
		expect(nextCopyName("Users", ["Users", "Users Copyright"])).toBe("Users Copy");
	});
});

describe("buildDuplicatePayload", () => {
	const original = {
		_id: "r1",
		accountId: "a1",
		collectionId: "c1",
		createdAt: "2026-09-26T00:00:00Z",
		updatedAt: "2026-09-26T00:00:00Z",
		sortOrder: 3,
		name: "Users",
		description: "Lists users",
		method: "POST",
		url: "http://localhost/users",
		params: [
			{ key: "page", value: "1", enabled: true, description: "1-based" },
			{ key: "debug", value: "1", enabled: false },
		],
		headers: [{ key: "X-Trace", value: "abc", enabled: false, description: "logs" }],
		body: '{"a":1}',
		bodyType: "json",
		auth: { type: "bearer", token: "{{token}}" },
	};
	test("copies every saved field, including disabled rows and descriptions", () => {
		const payload = buildDuplicatePayload(original, "Users Copy");
		expect(payload).toEqual({
			name: "Users Copy",
			description: "Lists users",
			method: "POST",
			url: "http://localhost/users",
			params: original.params,
			headers: original.headers,
			body: '{"a":1}',
			bodyType: "json",
			auth: { type: "bearer", token: "{{token}}" },
		});
	});
	test("leaves out server-owned fields and doesn't share row objects with the original", () => {
		const payload = buildDuplicatePayload(original, "Users Copy");
		for (const key of ["_id", "accountId", "collectionId", "createdAt", "updatedAt", "sortOrder"])
			expect(payload).not.toHaveProperty(key);
		payload.params[0].value = "changed";
		payload.auth.token = "changed";
		expect(original.params[0].value).toBe("1");
		expect(original.auth.token).toBe("{{token}}");
	});
});

describe("insertSavedRequestAfter", () => {
	test("places the clone directly after the original, leaving the others in order", () => {
		const collections = [
			{ _id: "c1", requests: [{ _id: "a" }, { _id: "b" }, { _id: "c" }] },
			{ _id: "c2", requests: [{ _id: "z" }] },
		];
		const next = insertSavedRequestAfter(collections, "c1", "b", { _id: "b-copy" });
		expect(next[0].requests.map((r) => r._id)).toEqual(["a", "b", "b-copy", "c"]);
		expect(next[1]).toBe(collections[1]);
		expect(collections[0].requests).toHaveLength(3);
		expect(insertSavedRequestAfter(collections, "c1", "c", { _id: "c-copy" })[0].requests.map((r) => r._id)).toEqual([
			"a",
			"b",
			"c",
			"c-copy",
		]);
	});
});

describe("request name uniqueness (mirrors the server)", () => {
	const requests = [
		{ _id: "a", name: "Get Users" },
		{ _id: "b", name: "Get Posts" },
	];
	test("trimmed, case-insensitive comparison", () => {
		expect(normalizeRequestName("  Get USERS ")).toBe("get users");
		expect(hasNameConflict(requests, "get users ", "b")).toBe(true);
		expect(hasNameConflict(requests, "Get Comments", "b")).toBe(false);
	});
	test("a request never conflicts with itself (keeping or re-casing its own name)", () => {
		expect(hasNameConflict(requests, "Get Users", "a")).toBe(false);
		expect(hasNameConflict(requests, "GET USERS", "a")).toBe(false);
		expect(hasNameConflict(requests, "Get Users", undefined)).toBe(true);
	});
	test("message matches the server's 409 text", () => {
		expect(duplicateNameMessage(" Get Users ")).toBe('A request named "Get Users" already exists in this collection.');
	});
	test("clone names skip case/whitespace variants of taken names", () => {
		expect(nextCopyName("Target", ["Target", "target copy "])).toBe("Target Copy 2");
		expect(nextCopyName("Target", ["Target", "TARGET COPY", "target copy 2"])).toBe("Target Copy 3");
	});
});
