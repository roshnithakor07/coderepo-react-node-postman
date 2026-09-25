import { SANDBOX_POSTS, SANDBOX_COMMENTS, SANDBOX_USERS } from "./sandbox.fixtures.js";

function requestSnapshot(request) {
	return {
		method: request.method,
		url: `${request.protocol}://${request.get("host")}${request.originalUrl}`,
		headers: request.headers,
		query: request.query,
		origin: request.ip,
	};
}

export function echoGet(request, response) {
	response.json(requestSnapshot(request));
}

export function echoWrite(request, response) {
	const contentType = request.get("content-type") || "";
	const isJson = contentType.includes("json");
	response.json({
		...requestSnapshot(request),
		json: isJson ? request.body : null,
		data: isJson ? JSON.stringify(request.body) : request.body || "",
	});
}

export function echoDelete(request, response) {
	response.json(requestSnapshot(request));
}

export function statusCode(request, response) {
	const code = Number(request.params.code);
	if (!Number.isInteger(code) || code < 100 || code > 599)
		return response.status(400).json({ error: "Status code must be between 100 and 599." });
	response.status(code).json({ status: code });
}

export function responseHeaders(request, response) {
	for (const [key, value] of Object.entries(request.query)) response.set(key, String(value));
	response.json({ ...request.query });
}

export async function delay(request, response) {
	const seconds = Math.min(Math.max(Number(request.params.seconds) || 0, 0), 5);
	await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
	response.json({ ...requestSnapshot(request), delaySeconds: seconds });
}

export function bearerAuth(request, response) {
	const authorization = request.get("authorization") || "";
	const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
	if (!token) return response.status(401).json({ authenticated: false, error: "Bearer token required." });
	response.json({ authenticated: true, token });
}

export function basicAuth(request, response) {
	const { user, pass } = request.params;
	const authorization = request.get("authorization") || "";
	const decoded = authorization.startsWith("Basic ") ? Buffer.from(authorization.slice(6), "base64").toString("utf8") : "";
	const [providedUser, providedPass] = decoded.split(":");
	if (providedUser !== user || providedPass !== pass) {
		response.set("WWW-Authenticate", "Basic");
		return response.status(401).json({ authenticated: false });
	}
	response.json({ authenticated: true, user: providedUser });
}

export function listPosts(request, response) {
	response.json(SANDBOX_POSTS);
}

export function getPost(request, response) {
	const post = SANDBOX_POSTS.find((p) => p.id === Number(request.params.id));
	if (!post) return response.status(404).json({ error: "Post not found." });
	response.json(post);
}

export function createPost(request, response) {
	response.status(201).json({ id: SANDBOX_POSTS.length + 1, ...request.body });
}

export function updatePost(request, response) {
	response.json({ id: Number(request.params.id), ...request.body });
}

export function deletePost(request, response) {
	response.json({});
}

export function postComments(request, response) {
	const comments = SANDBOX_COMMENTS.filter((c) => c.postId === Number(request.params.id));
	response.json(comments);
}

export function listUsers(request, response) {
	response.json(SANDBOX_USERS);
}
