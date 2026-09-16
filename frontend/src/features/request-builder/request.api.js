import { request } from "../../shared/api/client.js";

export const proxyApi = {
	send: (data) => request("/proxy", { method: "POST", body: JSON.stringify(data) }),
};

export const snippetApi = {
	generate: (data) => request("/snippets", { method: "POST", body: JSON.stringify(data) }),
};
