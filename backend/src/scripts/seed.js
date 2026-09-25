import dotenv from "dotenv";

dotenv.config({ quiet: true });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { WorkspaceAccount } from "../features/auth/workspace-account.model.js";
import { Collection, SavedRequest } from "../features/collections/collection.model.js";
import { Environment } from "../features/environments/environment.model.js";
import { History } from "../features/history/history.model.js";
import { loadConfig } from "../shared/config/index.js";

const config = loadConfig();
const DEMO_PASSWORD = "password123";
const PASSWORD_ROUNDS = 12;

const accountRows = [
	{ name: "Alex Rivera", email: "alex.rivera@postman.dev" },
	{ name: "Jordan Kim", email: "jordan.kim@postman.dev" },
];

async function clearDatabase() {
	console.log("Clearing existing collections...");
	await Promise.all([
		WorkspaceAccount.deleteMany({}),
		Collection.deleteMany({}),
		SavedRequest.deleteMany({}),
		Environment.deleteMany({}),
		History.deleteMany({}),
	]);
	await Promise.all([
		WorkspaceAccount.syncIndexes(),
		Collection.syncIndexes(),
		SavedRequest.syncIndexes(),
		Environment.syncIndexes(),
		History.syncIndexes(),
	]);
}

async function seedAccounts() {
	console.log("\nSeeding accounts...");
	const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_ROUNDS);
	const accounts = await WorkspaceAccount.create(accountRows.map((row) => ({ ...row, passwordHash })));
	console.log(`  Created ${accounts.length} accounts`);
	return accounts;
}

async function seedEnvironments(account) {
	console.log("\nSeeding environments...");
	const envs = await Environment.create([
		{
			accountId: account._id,
			name: "Development",
			isActive: true,
			variables: [
				{ key: "baseUrl", value: "http://localhost:8000/api/v1/sandbox", enabled: true },
				{ key: "apiKey", value: "dev-api-key-12345", enabled: true },
				{ key: "userId", value: "42", enabled: true },
				{ key: "timeout", value: "5000", enabled: true },
			],
		},
		{
			accountId: account._id,
			name: "Production",
			isActive: false,
			variables: [
				{ key: "baseUrl", value: "http://localhost:8000/api/v1/sandbox", enabled: true },
				{ key: "apiKey", value: "prod-api-key-secret", enabled: true },
				{ key: "userId", value: "1", enabled: true },
				{ key: "timeout", value: "10000", enabled: true },
			],
		},
		{
			accountId: account._id,
			name: "Staging",
			isActive: false,
			variables: [
				{ key: "baseUrl", value: "http://localhost:8000/api/v1/sandbox", enabled: true },
				{ key: "apiKey", value: "staging-api-key-67890", enabled: true },
				{ key: "userId", value: "99", enabled: true },
				{ key: "timeout", value: "7500", enabled: true },
			],
		},
	]);
	console.log(`  Created ${envs.length} environments`);
	return envs;
}

async function seedCollections(account) {
	console.log("\nSeeding collections and requests...");
	const collections = await Collection.create([
		{
			accountId: account._id,
			name: "API Sandbox — HTTP Testing",
			description:
				"A curated set of requests against the bundled local API sandbox for verifying HTTP client behavior, entirely offline.",
			sortOrder: 0,
		},
		{
			accountId: account._id,
			name: "Sandbox REST API — Posts & Users",
			description: "Sample CRUD requests against the bundled local sandbox's posts, comments, and users resources.",
			sortOrder: 1,
		},
		{
			accountId: account._id,
			name: "Auth Playground",
			description: "Requests demonstrating bearer token, basic auth, and API key authentication flows.",
			sortOrder: 2,
		},
	]);

	const [sandboxHttp, sandboxRest, authCollection] = collections;

	await SavedRequest.create([
		// API Sandbox collection
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Inspect request",
			method: "GET",
			url: "{{baseUrl}}/get",
			params: [
				{ key: "env", value: "{{name}}", enabled: false },
				{ key: "user", value: "{{userId}}", enabled: true },
			],
			headers: [{ key: "X-Request-ID", value: "req-001", enabled: true }],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Sends a GET request and returns the full request object, including headers, params, and origin IP.",
			sortOrder: 0,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "POST — Send JSON body",
			method: "POST",
			url: "{{baseUrl}}/post",
			headers: [{ key: "X-Custom-Header", value: "postman-clone", enabled: true }],
			body: JSON.stringify({ name: "Alex", role: "developer", active: true }, null, 2),
			bodyType: "json",
			auth: { type: "none" },
			description: "Sends a POST request with a JSON body and returns the parsed body in the response.",
			sortOrder: 1,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "PUT — Update resource",
			method: "PUT",
			url: "{{baseUrl}}/put",
			body: JSON.stringify({ id: 1, status: "updated", updatedAt: "2026-01-01" }, null, 2),
			bodyType: "json",
			auth: { type: "none" },
			description: "Sends a PUT request demonstrating a full resource replacement.",
			sortOrder: 2,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "DELETE — Remove resource",
			method: "DELETE",
			url: "{{baseUrl}}/delete",
			params: [{ key: "id", value: "{{userId}}", enabled: true }],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Sends a DELETE request with an ID query parameter.",
			sortOrder: 3,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Status code 201",
			method: "GET",
			url: "{{baseUrl}}/status/201",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Returns HTTP 201 Created to test status badge rendering.",
			sortOrder: 4,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Status code 404",
			method: "GET",
			url: "{{baseUrl}}/status/404",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Returns HTTP 404 Not Found to verify 4xx error state display.",
			sortOrder: 5,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Response headers",
			method: "GET",
			url: "{{baseUrl}}/response-headers",
			params: [
				{ key: "X-App-Version", value: "1.0.0", enabled: true },
				{ key: "X-Powered-By", value: "PostmanClone", enabled: true },
			],
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Returns custom response headers specified as query parameters.",
			sortOrder: 6,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Delayed response (1s)",
			method: "GET",
			url: "{{baseUrl}}/delay/1",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Delays the response by 1 second to test timing display.",
			sortOrder: 7,
		},
		{
			accountId: account._id,
			collectionId: sandboxHttp._id,
			name: "GET — Delayed response (5s, for loading/race testing)",
			method: "GET",
			url: "{{baseUrl}}/delay/5",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description:
				"Delays the response by 5 seconds. Send this, then switch to a different request while it's still running to verify the loading indicator clears for the newly selected request and the delayed response is not applied once it arrives.",
			sortOrder: 8,
		},

		// Sandbox REST API collection
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "GET — All posts",
			method: "GET",
			url: "{{baseUrl}}/posts",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Fetches every post from the bundled sandbox's posts resource.",
			sortOrder: 0,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "GET — Single post",
			method: "GET",
			url: "{{baseUrl}}/posts/1",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Fetches a single post by ID.",
			sortOrder: 1,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "POST — Create post",
			method: "POST",
			url: "{{baseUrl}}/posts",
			body: JSON.stringify({ title: "My new post", body: "This is the content of my post.", userId: 1 }, null, 2),
			bodyType: "json",
			auth: { type: "none" },
			description: "Creates a new post resource (simulated — the sandbox echoes it back but does not persist it).",
			sortOrder: 2,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "PUT — Update post",
			method: "PUT",
			url: "{{baseUrl}}/posts/1",
			body: JSON.stringify({ id: 1, title: "Updated title", body: "Updated content.", userId: 1 }, null, 2),
			bodyType: "json",
			auth: { type: "none" },
			description: "Replaces an existing post (simulated — not persisted).",
			sortOrder: 3,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "DELETE — Remove post",
			method: "DELETE",
			url: "{{baseUrl}}/posts/1",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Deletes a post by ID (simulated — returns 200 with an empty body).",
			sortOrder: 4,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "GET — Comments for post",
			method: "GET",
			url: "{{baseUrl}}/posts/1/comments",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Fetches all comments for post with ID 1.",
			sortOrder: 5,
		},
		{
			accountId: account._id,
			collectionId: sandboxRest._id,
			name: "GET — All users",
			method: "GET",
			url: "{{baseUrl}}/users",
			body: "",
			bodyType: "none",
			auth: { type: "none" },
			description: "Fetches all user records from the sandbox.",
			sortOrder: 6,
		},

		// Auth Playground collection
		{
			accountId: account._id,
			collectionId: authCollection._id,
			name: "Bearer token auth",
			method: "GET",
			url: "{{baseUrl}}/bearer",
			body: "",
			bodyType: "none",
			auth: { type: "bearer", token: "{{apiKey}}" },
			description:
				"Sends a request with a Bearer token in the Authorization header. The sandbox verifies the token and echoes it back.",
			sortOrder: 0,
		},
		{
			accountId: account._id,
			collectionId: authCollection._id,
			name: "Basic auth",
			method: "GET",
			url: "{{baseUrl}}/basic-auth/admin/secret",
			body: "",
			bodyType: "none",
			auth: { type: "basic", username: "admin", password: "secret" },
			description: "Authenticates with HTTP Basic Auth. The endpoint expects username 'admin' and password 'secret'.",
			sortOrder: 1,
		},
		{
			accountId: account._id,
			collectionId: authCollection._id,
			name: "API key in header",
			method: "GET",
			url: "{{baseUrl}}/get",
			body: "",
			bodyType: "none",
			auth: { type: "apikey", apiKeyName: "X-API-Key", apiKeyValue: "{{apiKey}}", apiKeyIn: "header" },
			description: "Adds the API key as a custom request header using the {{apiKey}} environment variable.",
			sortOrder: 2,
		},
		{
			accountId: account._id,
			collectionId: authCollection._id,
			name: "API key in query param",
			method: "GET",
			url: "{{baseUrl}}/get",
			body: "",
			bodyType: "none",
			auth: { type: "apikey", apiKeyName: "api_key", apiKeyValue: "{{apiKey}}", apiKeyIn: "query" },
			description: "Appends the API key as a query parameter instead of a header.",
			sortOrder: 3,
		},
	]);

	const requestCount = await SavedRequest.countDocuments({ accountId: account._id });
	console.log(`  Created ${collections.length} collections with ${requestCount} saved requests`);
	return collections;
}

async function seedHistory(account) {
	console.log("\nSeeding request history...");
	const now = Date.now();
	await History.create([
		{
			accountId: account._id,
			method: "GET",
			url: "http://localhost:8000/api/v1/sandbox/get",
			status: 200,
			responseTime: 18,
			requestHeaders: { "X-Request-ID": "seed-001" },
			requestBody: "",
			responseHeaders: { "content-type": "application/json; charset=utf-8" },
			responseBody: JSON.stringify(
				{ method: "GET", url: "http://localhost:8000/api/v1/sandbox/get", headers: { "x-request-id": "seed-001" }, query: {} },
				null,
				2,
			),
			responseSize: 246,
			createdAt: new Date(now - 5 * 60 * 1000),
		},
		{
			accountId: account._id,
			method: "POST",
			url: "http://localhost:8000/api/v1/sandbox/post",
			status: 200,
			responseTime: 21,
			requestHeaders: { "Content-Type": "application/json" },
			requestBody: JSON.stringify({ name: "Alex", role: "developer" }),
			responseHeaders: { "content-type": "application/json; charset=utf-8" },
			responseBody: JSON.stringify({ json: { name: "Alex", role: "developer" } }, null, 2),
			responseSize: 512,
			createdAt: new Date(now - 15 * 60 * 1000),
		},
		{
			accountId: account._id,
			method: "GET",
			url: "http://localhost:8000/api/v1/sandbox/posts/1",
			status: 200,
			responseTime: 14,
			requestHeaders: {},
			requestBody: "",
			responseHeaders: { "content-type": "application/json; charset=utf-8" },
			responseBody: JSON.stringify(
				{
					id: 1,
					userId: 1,
					title: "Getting started with the API sandbox",
					body: "This sandbox mirrors a typical REST resource so you can practice GET, POST, PUT, and DELETE without leaving your machine.",
				},
				null,
				2,
			),
			responseSize: 292,
			createdAt: new Date(now - 30 * 60 * 1000),
		},
		{
			accountId: account._id,
			method: "DELETE",
			url: "http://localhost:8000/api/v1/sandbox/posts/1",
			status: 200,
			responseTime: 12,
			requestHeaders: {},
			requestBody: "",
			responseHeaders: { "content-type": "application/json; charset=utf-8" },
			responseBody: "{}",
			responseSize: 2,
			createdAt: new Date(now - 45 * 60 * 1000),
		},
		{
			accountId: account._id,
			method: "GET",
			url: "http://localhost:8000/api/v1/sandbox/status/404",
			status: 404,
			responseTime: 9,
			requestHeaders: {},
			requestBody: "",
			responseHeaders: { "content-type": "application/json; charset=utf-8" },
			responseBody: JSON.stringify({ status: 404 }, null, 2),
			responseSize: 14,
			createdAt: new Date(now - 60 * 60 * 1000),
		},
	]);
	const count = await History.countDocuments({ accountId: account._id });
	console.log(`  Created ${count} history entries`);
}

async function seed() {
	try {
		console.log("========================================");
		console.log("Database Seeding");
		console.log("========================================\n");

		console.log("Connecting to MongoDB...");
		await mongoose.connect(config.mongodbUri);
		console.log("Connected to MongoDB");

		await clearDatabase();

		const accounts = await seedAccounts();
		const primaryAccount = accounts[0];

		await seedEnvironments(primaryAccount);
		await seedCollections(primaryAccount);
		await seedHistory(primaryAccount);

		// Seed a second account with one collection
		const secondAccount = accounts[1];
		await Collection.create({
			accountId: secondAccount._id,
			name: "My Requests",
			description: "Personal request collection.",
			sortOrder: 0,
		});
		await Environment.create({
			accountId: secondAccount._id,
			name: "Local",
			isActive: true,
			variables: [{ key: "baseUrl", value: "http://localhost:3000", enabled: true }],
		});

		console.log("\n========================================");
		console.log("Seeding completed successfully!");
		console.log("========================================");
		console.log("\nCollection counts:");
		console.log(`  Accounts:      ${await WorkspaceAccount.countDocuments()}`);
		console.log(`  Collections:   ${await Collection.countDocuments()}`);
		console.log(`  Requests:      ${await SavedRequest.countDocuments()}`);
		console.log(`  Environments:  ${await Environment.countDocuments()}`);
		console.log(`  History:       ${await History.countDocuments()}`);
		console.log("\nDemo accounts (password: password123):");
		for (const account of accounts) {
			console.log(`  Email: ${account.email}`);
		}
		console.log("========================================\n");
	} catch (error) {
		console.error("\nSeeding failed:", error.message);
		console.error(error.stack);
		process.exit(1);
	} finally {
		await mongoose.disconnect();
		console.log("Disconnected from MongoDB");
	}
}

seed();
