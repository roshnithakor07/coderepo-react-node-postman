import axios from "axios";
import { historyService } from "../history/history.service.js";

function substituteVariables(text, variables) {
	if (!text || !variables?.length) return text;
	return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		const variable = variables.find((v) => v.enabled && v.key === key);
		return variable !== undefined ? variable.value : match;
	});
}

function buildAuthHeaders(auth) {
	if (!auth || auth.type === "none") return {};
	if (auth.type === "bearer" && auth.token) return { Authorization: `Bearer ${auth.token}` };
	if (auth.type === "basic" && auth.username) {
		const encoded = Buffer.from(`${auth.username}:${auth.password || ""}`).toString("base64");
		return { Authorization: `Basic ${encoded}` };
	}
	return {};
}

function buildAuthQueryParam(auth) {
	if (auth?.type === "apikey" && auth.apiKeyIn === "query" && auth.apiKeyName && auth.apiKeyValue) {
		return { [auth.apiKeyName]: auth.apiKeyValue };
	}
	return {};
}

function buildAuthHeaderParam(auth) {
	if (auth?.type === "apikey" && auth.apiKeyIn === "header" && auth.apiKeyName && auth.apiKeyValue) {
		return { [auth.apiKeyName]: auth.apiKeyValue };
	}
	return {};
}

export const proxyService = {
	async execute(accountId, requestData, envVariables = []) {
		const substitute = (text) => substituteVariables(text, envVariables);

		const rawUrl = substitute(requestData.url || "");
		const method = requestData.method || "GET";

		const enabledHeaders = (requestData.headers || []).filter((h) => h.enabled && h.key);
		const headerMap = {};
		for (const h of enabledHeaders) {
			headerMap[substitute(h.key)] = substitute(h.value);
		}

		const enabledParams = (requestData.params || []).filter((p) => p.enabled && p.key);
		const queryMap = {};
		for (const p of enabledParams) {
			queryMap[substitute(p.key)] = substitute(p.value);
		}

		Object.assign(headerMap, buildAuthHeaders(requestData.auth));
		Object.assign(headerMap, buildAuthHeaderParam(requestData.auth));
		Object.assign(queryMap, buildAuthQueryParam(requestData.auth));

		let body = undefined;
		const bodyType = requestData.bodyType || "none";
		if (bodyType !== "none" && requestData.body) {
			if (bodyType === "json") {
				body = substitute(requestData.body);
				headerMap["Content-Type"] = headerMap["Content-Type"] || "application/json";
			} else if (bodyType === "form") {
				body = substitute(requestData.body);
				headerMap["Content-Type"] = "application/x-www-form-urlencoded";
			} else {
				body = substitute(requestData.body);
			}
		}

		const startTime = Date.now();
		let historyEntry = {
			method,
			url: rawUrl,
			requestHeaders: headerMap,
			requestBody: requestData.body || "",
		};

		try {
			const axiosResponse = await axios({
				method,
				url: rawUrl,
				headers: headerMap,
				params: queryMap,
				data: body,
				validateStatus: () => true,
				timeout: 30000,
				maxContentLength: 10 * 1024 * 1024,
				decompress: true,
			});

			const responseTime = Date.now() - startTime;
			const responseBody = typeof axiosResponse.data === "object" ? JSON.stringify(axiosResponse.data, null, 2) : String(axiosResponse.data ?? "");
			const responseSize = Buffer.byteLength(responseBody, "utf8");

			const result = {
				status: axiosResponse.status,
				statusText: axiosResponse.statusText,
				headers: axiosResponse.headers,
				body: responseBody,
				responseTime,
				size: responseSize,
				error: null,
			};

			await historyService.record(accountId, {
				...historyEntry,
				status: axiosResponse.status,
				responseTime,
				responseHeaders: axiosResponse.headers,
				responseBody,
				responseSize,
				error: null,
			});

			return result;
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const message = error.code === "ECONNABORTED" ? "Request timed out after 30 seconds." : error.message || "Request failed.";

			await historyService.record(accountId, {
				...historyEntry,
				status: null,
				responseTime,
				responseHeaders: {},
				responseBody: "",
				responseSize: 0,
				error: message,
			});

			return {
				status: null,
				statusText: null,
				headers: {},
				body: "",
				responseTime,
				size: 0,
				error: message,
			};
		}
	},
};
