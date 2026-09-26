import { describe, test, expect } from "bun:test";
import {
	toSavedFields,
	isSavedRequestDirty,
	findSavedRequest,
	replaceSavedRequest,
	removeSavedRequest,
	addSavedRequest,
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
		expect(collections[1].requests).toEqual([]);
	});
});
