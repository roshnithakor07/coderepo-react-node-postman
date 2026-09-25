import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// End-to-end HTTP tests for the two HIGH-severity fixes (backend error
// handling and history URL fidelity). Runs against a real, disposable
// MongoDB database (never the seeded postman_db) and the real Express app.

const TEST_DB_NAME = `postman_db_test_${Date.now()}`;
process.env.MONGODB_URI = `mongodb://localhost:27017/${TEST_DB_NAME}`;
process.env.JWT_SECRET = "test-jwt-secret-for-app-test";
process.env.JWT_EXPIRES_IN = "1h";

const { initConfig } = await import("./shared/config/index.js");
const { createApp } = await import("./app.js");
const { WorkspaceAccount } = await import("./features/auth/workspace-account.model.js");

let server;
let baseUrl;
let token;

beforeAll(async () => {
	initConfig();
	await mongoose.connect(process.env.MONGODB_URI);

	const passwordHash = await bcrypt.hash("password123", 4);
	await WorkspaceAccount.create({ name: "Test User", email: "test.user@example.com", passwordHash, active: true });

	const app = createApp();
	server = app.listen(0);
	await new Promise((resolve) => server.once("listening", resolve));
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

	const loginResponse = await fetch(`${baseUrl}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "test.user@example.com", password: "password123" }),
	});
	({
		data: { token },
	} = await loginResponse.json());
});

afterAll(async () => {
	server.close();
	await mongoose.connection.dropDatabase();
	await mongoose.disconnect();
});

function authed(path, options = {}) {
	return fetch(`${baseUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
}

describe("error handling (live HTTP)", () => {
	test("malformed JSON returns 400 INVALID_JSON, not 500", async () => {
		const response = await fetch(`${baseUrl}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: '{"email": "bad json',
		});
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("INVALID_JSON");
	});

	test("an invalid ObjectId in a route param returns 400 INVALID_ID, not 500", async () => {
		const response = await authed("/collections/not-a-valid-id/requests");
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("INVALID_ID");
	});

	test("an invalid environmentId on the proxy endpoint returns 400 INVALID_ID, not 500", async () => {
		const response = await authed("/proxy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				method: "GET",
				url: "http://example.com",
				headers: [],
				params: [],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
				environmentId: "not-a-valid-id",
			}),
		});
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("INVALID_ID");
	});

	test("normal Zod validation errors are unaffected (regression)", async () => {
		const response = await authed("/collections", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "" }),
		});
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("VALIDATION_ERROR");
	});

	test("a valid, well-formed request still succeeds normally (regression)", async () => {
		const response = await authed("/collections");
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(Array.isArray(payload.data)).toBe(true);
	});
});

describe("request history URL fidelity (live HTTP)", () => {
	test("a proxied request with query parameters is recorded in history with the full URL, and reload data matches what was sent", async () => {
		const sandboxGetUrl = `${baseUrl}/sandbox/get`;

		await authed("/proxy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				method: "GET",
				url: sandboxGetUrl,
				headers: [],
				params: [
					{ key: "foo", value: "bar", enabled: true },
					{ key: "skip", value: "me", enabled: false },
				],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
			}),
		});

		const historyResponse = await authed("/history");
		const { data } = await historyResponse.json();
		const latest = data.items[0];

		expect(latest.url).toBe(`${sandboxGetUrl}?foo=bar`);
		expect(latest.url).not.toContain("skip");

		// What a frontend "reopen" does is drop entry.url straight into the URL
		// bar (App.jsx handleSelectHistory) — confirm that field alone already
		// carries the full, accurate request that was actually sent.
		const reloadedUrl = new URL(latest.url);
		expect(reloadedUrl.searchParams.get("foo")).toBe("bar");
	});
});

describe("history list/detail scalability (live HTTP)", () => {
	test("the list endpoint never returns request/response bodies or headers", async () => {
		await authed("/proxy", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				method: "GET",
				url: `${baseUrl}/sandbox/get`,
				headers: [],
				params: [],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
			}),
		});

		const { data } = await (await authed("/history")).json();
		const latest = data.items[0];

		expect(latest.method).toBe("GET");
		expect(latest.url).toContain("/sandbox/get");
		expect(latest.status).toBe(200);
		expect(latest).not.toHaveProperty("requestBody");
		expect(latest).not.toHaveProperty("responseBody");
		expect(latest).not.toHaveProperty("requestHeaders");
		expect(latest).not.toHaveProperty("responseHeaders");
	});

	test("GET /history/:id returns the full entry, including the response body the list endpoint omits", async () => {
		const { data: listData } = await (await authed("/history")).json();
		const summary = listData.items[0];

		const { data: detail } = await (await authed(`/history/${summary._id}`)).json();

		expect(detail._id).toBe(summary._id);
		expect(typeof detail.responseBody).toBe("string");
		expect(detail.responseBody.length).toBeGreaterThan(0);
	});

	test("cursor pagination returns distinct pages in newest-first order with no gaps or repeats, and a null cursor on the last page", async () => {
		for (let i = 0; i < 3; i++) {
			await authed("/proxy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "GET",
					url: `${baseUrl}/sandbox/status/20${i}`,
					headers: [],
					params: [],
					body: "",
					bodyType: "none",
					auth: { type: "none" },
				}),
			});
		}

		const page1 = (await (await authed("/history?limit=2")).json()).data;
		expect(page1.items).toHaveLength(2);
		expect(page1.nextCursor).not.toBeNull();

		const page2 = (await (await authed(`/history?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`)).json()).data;
		expect(page2.items.length).toBeGreaterThan(0);

		const page1Ids = page1.items.map((i) => i._id);
		const page2Ids = page2.items.map((i) => i._id);
		expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);

		// createdAt must be non-increasing across the whole combined sequence.
		const allTimes = [...page1.items, ...page2.items].map((i) => new Date(i.createdAt).getTime());
		for (let i = 1; i < allTimes.length; i++) expect(allTimes[i]).toBeLessThanOrEqual(allTimes[i - 1]);
	});
});

describe("history response-body truncation (direct service call, no HTTP)", () => {
	test("a response body over 1 MB is truncated on write and flagged; a small one is stored whole and unflagged", async () => {
		const { historyService } = await import("./features/history/history.service.js");
		const { historyRepository } = await import("./features/history/history.repository.js");

		const big = "x".repeat(1024 * 1024 + 500);
		const saved = await historyService.record("000000000000000000000001", {
			method: "GET",
			url: "http://example.com/big",
			requestHeaders: {},
			requestBody: "",
			status: 200,
			responseTime: 1,
			responseHeaders: {},
			responseBody: big,
			responseSize: big.length,
			error: null,
		});

		const stored = await historyRepository.findById(saved._id, "000000000000000000000001");
		expect(stored.responseBody.length).toBe(1024 * 1024);
		expect(stored.responseBodyTruncated).toBe(true);
		// responseSize keeps reflecting the real, untruncated size.
		expect(stored.responseSize).toBe(big.length);

		const small = await historyService.record("000000000000000000000001", {
			method: "GET",
			url: "http://example.com/small",
			requestHeaders: {},
			requestBody: "",
			status: 200,
			responseTime: 1,
			responseHeaders: {},
			responseBody: "ok",
			responseSize: 2,
			error: null,
		});
		expect(small.responseBodyTruncated).toBe(false);
		expect(small.responseBody).toBe("ok");
	});
});
