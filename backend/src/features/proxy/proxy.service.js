import axios from "axios";
import { historyService } from "../history/history.service.js";
import {
	substituteVariables,
	substituteAuth,
	buildAuthHeaders,
	buildAuthHeaderParam,
	buildAuthQueryParam,
} from "../../shared/utils/request-transform.js";

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

		const resolvedAuth = substituteAuth(requestData.auth, envVariables);
		Object.assign(headerMap, buildAuthHeaders(resolvedAuth));
		Object.assign(headerMap, buildAuthHeaderParam(resolvedAuth));
		Object.assign(queryMap, buildAuthQueryParam(resolvedAuth));

		const fullUrl = axios.getUri({ url: rawUrl, params: queryMap });

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
			url: fullUrl,
			requestHeaders: headerMap,
			requestBody: requestData.body || "",
		};

		const unresolvedVariable = rawUrl.match(/\{\{(\w+)\}\}/)?.[1];
		if (unresolvedVariable) {
			const responseTime = Date.now() - startTime;
			const message = `Environment variable not resolved: ${unresolvedVariable}. Select an environment or enter a full URL.`;

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
			const responseBody =
				typeof axiosResponse.data === "object" ? JSON.stringify(axiosResponse.data, null, 2) : String(axiosResponse.data ?? "");
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
