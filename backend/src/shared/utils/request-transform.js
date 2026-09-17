export function substituteVariables(text, variables) {
	if (!text || !variables?.length) return text;
	return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		const variable = variables.find((v) => v.enabled && v.key === key);
		return variable !== undefined ? variable.value : match;
	});
}

export function substituteAuth(auth, variables) {
	if (!auth) return auth;
	const substitute = (text) => substituteVariables(text, variables);
	return {
		...auth,
		token: auth.token != null ? substitute(auth.token) : auth.token,
		username: auth.username != null ? substitute(auth.username) : auth.username,
		password: auth.password != null ? substitute(auth.password) : auth.password,
		apiKeyValue: auth.apiKeyValue != null ? substitute(auth.apiKeyValue) : auth.apiKeyValue,
	};
}

export function buildAuthHeaders(auth) {
	if (!auth || auth.type === "none") return {};
	if (auth.type === "bearer" && auth.token) return { Authorization: `Bearer ${auth.token}` };
	if (auth.type === "basic" && auth.username) {
		const encoded = Buffer.from(`${auth.username}:${auth.password || ""}`).toString("base64");
		return { Authorization: `Basic ${encoded}` };
	}
	return {};
}

export function buildAuthHeaderParam(auth) {
	if (auth?.type === "apikey" && auth.apiKeyIn === "header" && auth.apiKeyName && auth.apiKeyValue) {
		return { [auth.apiKeyName]: auth.apiKeyValue };
	}
	return {};
}

export function buildAuthQueryParam(auth) {
	if (auth?.type === "apikey" && auth.apiKeyIn === "query" && auth.apiKeyName && auth.apiKeyValue) {
		return { [auth.apiKeyName]: auth.apiKeyValue };
	}
	return {};
}
