const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
let sessionToken = localStorage.getItem("postman-session-token") || "";

export function setSessionToken(token) {
	sessionToken = token || "";
	if (sessionToken) localStorage.setItem("postman-session-token", sessionToken);
	else localStorage.removeItem("postman-session-token");
}

export const hasSessionToken = () => Boolean(sessionToken);

export async function request(path, options = {}) {
	const response = await fetch(`${baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
			...options.headers,
		},
	});
	if (response.status === 204) {
		// Read the empty body anyway: an unread body makes Chrome report the
		// request as net::ERR_ABORTED even though it succeeded.
		await response.text();
		return null;
	}
	const contentType = response.headers?.get?.("content-type") || "";
	const payload = contentType.includes("application/json") || !response.headers ? await response.json() : null;
	if (!response.ok) {
		const code = payload?.error?.code;
		const message = payload?.error?.message || `Service returned ${response.status}.`;
		if (response.status === 401 && ["AUTH_REQUIRED", "INVALID_TOKEN", "ACCOUNT_UNAVAILABLE"].includes(code)) {
			setSessionToken("");
			window.dispatchEvent(new CustomEvent("postman-session-expired", { detail: message }));
		}
		const error = new Error(message);
		// Callers that need to react to a specific failure (e.g. a 409
		// DUPLICATE_NAME) can read these; everything else keeps using .message.
		error.status = response.status;
		error.code = code;
		throw error;
	}
	if (!payload || !("data" in payload)) throw new Error("Service returned an invalid response.");
	return payload.data;
}
