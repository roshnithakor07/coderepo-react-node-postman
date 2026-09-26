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

export function addSavedRequest(collections, collectionId, created) {
	return (collections || []).map((c) => (c._id === collectionId ? { ...c, requests: [...(c.requests || []), created] } : c));
}

// "<name> Copy", or "<name> Copy 2", "Copy 3"… — the first one not already
// used by another request in the same collection.
export function nextCopyName(name, existingNames) {
	const taken = new Set(existingNames || []);
	const base = `${name} Copy`;
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base} ${n}`)) n += 1;
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

// The server lists a collection's requests by sortOrder (ascending), then
// newest first. Inserting with the same rule keeps the sidebar identical to
// what a reload would show, without refetching every collection.
function compareSavedRequests(a, b) {
	const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
	if (order !== 0) return order;
	return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

export function insertSavedRequestInOrder(collections, collectionId, created) {
	return (collections || []).map((c) =>
		c._id === collectionId ? { ...c, requests: [...(c.requests || []), created].sort(compareSavedRequests) } : c,
	);
}
