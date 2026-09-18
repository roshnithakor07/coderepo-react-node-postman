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
	({ data: { token } } = await loginResponse.json());
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
			body: JSON.stringify({ method: "GET", url: "http://example.com", headers: [], params: [], body: "", bodyType: "none", auth: { type: "none" }, environmentId: "not-a-valid-id" }),
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
		const { data: history } = await historyResponse.json();
		const latest = history[0];

		expect(latest.url).toBe(`${sandboxGetUrl}?foo=bar`);
		expect(latest.url).not.toContain("skip");

		// What a frontend "reopen" does is drop entry.url straight into the URL
		// bar (App.jsx handleSelectHistory) — confirm that field alone already
		// carries the full, accurate request that was actually sent.
		const reloadedUrl = new URL(latest.url);
		expect(reloadedUrl.searchParams.get("foo")).toBe("bar");
	});
});
