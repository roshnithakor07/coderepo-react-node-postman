import { request } from "../../shared/api/client.js";

export const environmentApi = {
	list: () => request("/environments"),
	create: (data) => request("/environments", { method: "POST", body: JSON.stringify(data) }),
	update: (id, data) => request(`/environments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	activate: (id) => request(`/environments/${id}/activate`, { method: "POST" }),
	remove: (id) => request(`/environments/${id}`, { method: "DELETE" }),
};
