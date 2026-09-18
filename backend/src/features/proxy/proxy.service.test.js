import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";

// The proxy talks to a real HTTP target so the assertions compare the URL we
// record against the URL the target actually received — not just against our
// own computation. The target is the app's own local sandbox (no DB access at
// mount time), started on an ephemeral port. historyService.record is mocked
// so this test needs no MongoDB connection.

const recorded = [];
mock.module("../history/history.service.js", () => ({
	historyService: {
		record: async (accountId, entry) => {
			recorded.push(entry);
		},
	},
}));

const { proxyService } = await import("./proxy.service.js");
const { createApp } = await import("../../app.js");

let server;
let sandboxUrl;

beforeAll(async () => {
	const app = createApp();
	server = app.listen(0);
	await new Promise((resolve) => server.once("listening", resolve));
	sandboxUrl = `http://127.0.0.1:${server.address().port}/api/v1/sandbox`;
});

afterAll(() => {
	server.close();
});

function lastRecordedUrl() {
	return recorded[recorded.length - 1].url;
}

function lastEchoedUrl() {
	// The sandbox echoes back request.originalUrl in its JSON body — the ground
	// truth for what the target actually received.
	const entry = recorded[recorded.length - 1];
	return JSON.parse(entry.responseBody).url;
}

describe("proxyService history URL fidelity", () => {
	test("a request with query parameters stores the full URL including the query string", async () => {
		recorded.length = 0;
		await proxyService.execute("acct1", {
			method: "GET",
			url: `${sandboxUrl}/get`,
			params: [{ key: "foo", value: "bar", enabled: true }],
			headers: [],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
		});

		expect(lastRecordedUrl()).toContain("?foo=bar");
		// Direct parity check: the recorded URL must match what the target actually saw.
		expect(lastRecordedUrl()).toBe(lastEchoedUrl());
	});

	test("a request without query parameters still records a plain URL (no trailing '?')", async () => {
		recorded.length = 0;
		await proxyService.execute("acct1", {
			method: "GET",
			url: `${sandboxUrl}/get`,
			params: [],
			headers: [],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
		});

		expect(lastRecordedUrl()).toBe(`${sandboxUrl}/get`);
	});

	test("query parameters already present in the URL are preserved and merged, not lost or duplicated", async () => {
		recorded.length = 0;
		await proxyService.execute("acct1", {
			method: "GET",
			url: `${sandboxUrl}/get?existing=1`,
			params: [{ key: "extra", value: "2", enabled: true }],
			headers: [],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
		});

		const recordedUrl = lastRecordedUrl();
		expect(recordedUrl).toContain("existing=1");
		expect(recordedUrl).toContain("extra=2");
		expect((recordedUrl.match(/existing=1/g) || []).length).toBe(1);
		expect((recordedUrl.match(/extra=2/g) || []).length).toBe(1);
		expect(recordedUrl).toBe(lastEchoedUrl());
	});

	test("environment-variable-substituted query parameters are stored resolved, matching what was sent", async () => {
		recorded.length = 0;
		await proxyService.execute(
			"acct1",
			{
				method: "GET",
				url: `${sandboxUrl}/get`,
				params: [{ key: "user", value: "{{userId}}", enabled: true }],
				headers: [],
				body: "",
				bodyType: "none",
				auth: { type: "apikey", apiKeyName: "api_key", apiKeyValue: "{{apiKey}}", apiKeyIn: "query" },
			},
			[
				{ key: "userId", value: "42", enabled: true },
				{ key: "apiKey", value: "secret-123", enabled: true },
			],
		);

		const recordedUrl = lastRecordedUrl();
		expect(recordedUrl).toContain("user=42");
		expect(recordedUrl).toContain("api_key=secret-123");
		expect(recordedUrl).not.toContain("{{");
		expect(recordedUrl).toBe(lastEchoedUrl());
	});

	test("outbound request behavior is unchanged: the target still receives the same query params as before the fix", async () => {
		recorded.length = 0;
		const result = await proxyService.execute("acct1", {
			method: "GET",
			url: `${sandboxUrl}/get`,
			params: [{ key: "a", value: "1", enabled: true }],
			headers: [],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
		});

		expect(result.status).toBe(200);
		expect(JSON.parse(result.body).query).toEqual({ a: "1" });
	});
});

describe("proxyService unresolved-variable error message", () => {
	test("no environment selected: an unresolved {{variable}} in the URL produces a named, actionable error instead of a generic axios failure", async () => {
		recorded.length = 0;
		const result = await proxyService.execute(
			"acct1",
			{
				method: "GET",
				url: "{{baseUrl}}/response-headers",
				params: [],
				headers: [],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
			},
			[], // no environment selected -> no variables at all
		);

		expect(result.status).toBeNull();
		expect(result.error).toBe("Environment variable not resolved: baseUrl. Select an environment or enter a full URL.");
		expect(recorded[recorded.length - 1].error).toBe(result.error);
	});

	test("environment selected but missing the specific variable: same actionable message, naming the right key", async () => {
		recorded.length = 0;
		const result = await proxyService.execute(
			"acct1",
			{
				method: "GET",
				url: "{{baseUrl}}/get",
				params: [],
				headers: [],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
			},
			[{ key: "someOtherVar", value: "x", enabled: true }], // environment IS selected, just doesn't define baseUrl
		);

		expect(result.status).toBeNull();
		expect(result.error).toBe("Environment variable not resolved: baseUrl. Select an environment or enter a full URL.");
	});

	test("a resolved {{variable}} (environment selected and defines it) still sends the request normally (regression)", async () => {
		recorded.length = 0;
		const result = await proxyService.execute(
			"acct1",
			{
				method: "GET",
				url: "{{baseUrl}}/get",
				params: [],
				headers: [],
				body: "",
				bodyType: "none",
				auth: { type: "none" },
			},
			[{ key: "baseUrl", value: sandboxUrl, enabled: true }],
		);

		expect(result.status).toBe(200);
		expect(result.error).toBeNull();
	});

	test("a genuinely malformed URL (no {{variable}} placeholder at all) is unaffected: still the original generic failure", async () => {
		recorded.length = 0;
		const result = await proxyService.execute("acct1", {
			method: "GET",
			url: "not-a-valid-url",
			params: [],
			headers: [],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
		});

		expect(result.status).toBeNull();
		expect(result.error).not.toContain("Environment variable not resolved");
		expect(result.error).toBe("Invalid URL");
	});
});
