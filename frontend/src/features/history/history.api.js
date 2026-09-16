import { request } from "../../shared/api/client.js";

export const historyApi = {
	list: () => request("/history"),
	remove: (id) => request(`/history/${id}`, { method: "DELETE" }),
	clear: () => request("/history", { method: "DELETE" }),
};
