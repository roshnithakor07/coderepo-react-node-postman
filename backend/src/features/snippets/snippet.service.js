import {
	substituteVariables,
	substituteAuth,
	buildAuthHeaders,
	buildAuthHeaderParam,
	buildAuthQueryParam,
} from "../../shared/utils/request-transform.js";

function buildHeaders(requestData, resolvedAuth, envVars) {
	const sub = (t) => substituteVariables(t, envVars);
	const headers = {};
	for (const h of (requestData.headers || []).filter((h) => h.enabled && h.key)) {
		headers[sub(h.key)] = sub(h.value);
	}
	Object.assign(headers, buildAuthHeaders(resolvedAuth));
	Object.assign(headers, buildAuthHeaderParam(resolvedAuth));
	if (requestData.bodyType === "json" && requestData.body) headers["Content-Type"] = headers["Content-Type"] || "application/json";
	return headers;
}

function buildQueryString(requestData, resolvedAuth, envVars) {
	const sub = (t) => substituteVariables(t, envVars);
	const params = (requestData.params || []).filter((p) => p.enabled && p.key);
	const queryAuth = buildAuthQueryParam(resolvedAuth);
	for (const [key, value] of Object.entries(queryAuth)) {
		params.push({ key, value });
	}
	if (!params.length) return "";
	return "?" + params.map((p) => `${encodeURIComponent(sub(p.key))}=${encodeURIComponent(sub(p.value))}`).join("&");
}

export const snippetService = {
	generate(requestData, envVariables, language) {
		const sub = (t) => substituteVariables(t, envVariables);
		const resolvedAuth = substituteAuth(requestData.auth, envVariables);
		const url = sub(requestData.url || "") + buildQueryString(requestData, resolvedAuth, envVariables);
		const method = requestData.method || "GET";
		const headers = buildHeaders(requestData, resolvedAuth, envVariables);
		const body = requestData.bodyType !== "none" ? sub(requestData.body) : null;

		switch (language) {
			case "curl":
				return generateCurl(method, url, headers, body);
			case "fetch":
				return generateFetch(method, url, headers, body);
			case "axios":
				return generateAxios(method, url, headers, body);
			case "python":
				return generatePython(method, url, headers, body);
			default:
				return generateCurl(method, url, headers, body);
		}
	},
};

function generateCurl(method, url, headers, body) {
	const lines = [`curl -X ${method} '${url}'`];
	for (const [key, value] of Object.entries(headers)) {
		lines.push(`  -H '${key}: ${value}'`);
	}
	if (body) lines.push(`  -d '${body.replace(/'/g, "\\'")}'`);
	return lines.join(" \\\n");
}

function generateFetch(method, url, headers, body) {
	const opts = { method };
	if (Object.keys(headers).length) opts.headers = headers;
	if (body) opts.body = body;
	const optsStr = JSON.stringify(opts, null, 2);
	return `const response = await fetch('${url}', ${optsStr});\nconst data = await response.json();\nconsole.log(data);`;
}

function generateAxios(method, url, headers, body) {
	const config = { method: method.toLowerCase(), url };
	if (Object.keys(headers).length) config.headers = headers;
	if (body) config.data = body;
	const configStr = JSON.stringify(config, null, 2);
	return `import axios from 'axios';\n\nconst response = await axios(${configStr});\nconsole.log(response.data);`;
}

function generatePython(method, url, headers, body) {
	const lines = [`import requests`, ``, `response = requests.${method.toLowerCase()}(`];
	lines.push(`    '${url}',`);
	if (Object.keys(headers).length) lines.push(`    headers=${JSON.stringify(headers, null, 4).replace(/\n/g, "\n    ")},`);
	if (body) lines.push(`    data='''${body}''',`);
	lines.push(`)`);
	lines.push(`print(response.json())`);
	return lines.join("\n");
}
