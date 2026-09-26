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
