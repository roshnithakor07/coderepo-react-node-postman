import { request } from "../../shared/api/client.js";

export const collectionApi = {
	list: () => request("/collections"),
	create: (data) => request("/collections", { method: "POST", body: JSON.stringify(data) }),
	update: (id, data) => request(`/collections/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	remove: (id) => request(`/collections/${id}`, { method: "DELETE" }),
	createRequest: (collectionId, data) => request(`/collections/${collectionId}/requests`, { method: "POST", body: JSON.stringify(data) }),
	updateRequest: (id, data) => request(`/requests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
	removeRequest: (id) => request(`/requests/${id}`, { method: "DELETE" }),
};
