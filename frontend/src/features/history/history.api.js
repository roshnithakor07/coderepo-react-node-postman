import { request } from "../../shared/api/client.js";

export const historyApi = {
	// Returns { items, nextCursor } — items are lightweight summaries only
	// (no request/response bodies or headers). nextCursor is null once the
	// last page has been reached; pass it back in as `cursor` to load more.
	list: ({ cursor } = {}) => request(`/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
	getById: (id) => request(`/history/${id}`),
	remove: (id) => request(`/history/${id}`, { method: "DELETE" }),
	clear: () => request("/history", { method: "DELETE" }),
};
