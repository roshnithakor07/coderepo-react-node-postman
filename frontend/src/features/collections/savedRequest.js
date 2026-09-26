// Pure helpers for "the request loaded from a collection": which fields make
// up a saved request, whether the builder has unsaved changes against it, and
// immutable updates of a request inside the sidebar's collections list.

function normalizeRows(rows) {
	return (rows || []).map((row) => {
		const out = { key: row.key ?? "", value: row.value ?? "", enabled: row.enabled !== false };
		if (row.description) out.description = row.description;
		return out;
	});
}

// Exactly the fields a Save writes (the request's name is left to the caller).
export function toSavedFields(request) {
	return {
		method: request.method || "GET",
		url: request.url || "",
		params: normalizeRows(request.params),
		headers: normalizeRows(request.headers),
		body: request.body || "",
		bodyType: request.bodyType || "none",
		auth: request.auth && request.auth.type ? request.auth : { type: "none" },
	};
}

// Compared by value, so editing something and typing it back reads as clean,
// and a stored row missing `enabled`/`description` equals its normalized form.
export function isSavedRequestDirty(request, saved) {
	if (!saved) return false;
	return JSON.stringify(toSavedFields(request)) !== JSON.stringify(toSavedFields(saved));
}

// { request, collection } for the saved request with this id, or null.
export function findSavedRequest(collections, id) {
	if (!id) return null;
	for (const collection of collections || []) {
		const request = (collection.requests || []).find((r) => r._id === id);
		if (request) return { request, collection };
	}
	return null;
}

export function replaceSavedRequest(collections, updated) {
	return (collections || []).map((c) => ({
		...c,
		requests: (c.requests || []).map((r) => (r._id === updated._id ? { ...r, ...updated } : r)),
	}));
}

export function removeSavedRequest(collections, id) {
	return (collections || []).map((c) => ({ ...c, requests: (c.requests || []).filter((r) => r._id !== id) }));
}

// A newly created request (default sortOrder 0, newest) is listed first by
// the server, so it goes first here too.
export function addSavedRequest(collections, collectionId, created) {
	return (collections || []).map((c) => (c._id === collectionId ? { ...c, requests: [created, ...(c.requests || [])] } : c));
}

// Mirrors the server: request names are unique per collection, compared
// trimmed and case-insensitive.
export function normalizeRequestName(name) {
	return String(name ?? "")
		.trim()
		.toLowerCase();
}

// The server's exact 409 message, so instant and server-side errors read the same.
export function duplicateNameMessage(name) {
	return `A request named "${String(name).trim()}" already exists in this collection.`;
}

// True if another request in `requests` (not `exceptId`) already has this name.
export function hasNameConflict(requests, name, exceptId) {
	const key = normalizeRequestName(name);
	return (requests || []).some((r) => r._id !== exceptId && normalizeRequestName(r.name) === key);
}

// "<name> Copy", or "<name> Copy 2", "Copy 3"… — the first one not already
// used by another request in the same collection (compared like the server).
export function nextCopyName(name, existingNames) {
	const taken = new Set((existingNames || []).map(normalizeRequestName));
	const base = `${name} Copy`;
	if (!taken.has(normalizeRequestName(base))) return base;
	let n = 2;
	while (taken.has(normalizeRequestName(`${base} ${n}`))) n += 1;
	return `${base} ${n}`;
}

// The create payload for a duplicate: every saved field of the original
// (disabled rows and descriptions included), a new name, and none of the
// server-owned fields (id, owner, collection, timestamps, ordering).
export function buildDuplicatePayload(saved, name) {
	const copyRows = (rows) => (rows || []).map((row) => ({ ...row }));
	return {
		name,
		method: saved.method || "GET",
		url: saved.url || "",
		params: copyRows(saved.params),
		headers: copyRows(saved.headers),
		body: saved.body || "",
		bodyType: saved.bodyType || "none",
		auth: saved.auth ? { ...saved.auth } : { type: "none" },
		description: saved.description || "",
	};
}

// A clone created with afterRequestId: the server places it directly after
// the original (renumbering the collection), so it goes there here too.
export function insertSavedRequestAfter(collections, collectionId, afterId, created) {
	return (collections || []).map((c) => {
		if (c._id !== collectionId) return c;
		const requests = [...(c.requests || [])];
		const index = requests.findIndex((r) => r._id === afterId);
		requests.splice(index === -1 ? requests.length : index + 1, 0, created);
		return { ...c, requests };
	});
}
