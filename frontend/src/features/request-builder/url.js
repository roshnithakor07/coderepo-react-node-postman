const VARIABLE_PATTERN = /\{\{\w+\}\}/g;

function encodePreservingVariables(text) {
	const source = text ?? "";
	let result = "";
	let lastIndex = 0;
	for (const match of source.matchAll(VARIABLE_PATTERN)) {
		result += encodeURIComponent(source.slice(lastIndex, match.index));
		result += match[0];
		lastIndex = match.index + match[0].length;
	}
	result += encodeURIComponent(source.slice(lastIndex));
	return result;
}

function splitUrl(url) {
	const text = url || "";
	const qIndex = text.indexOf("?");
	return qIndex === -1 ? { base: text, existingQuery: "" } : { base: text.slice(0, qIndex), existingQuery: text.slice(qIndex + 1) };
}

function parseQueryPairs(query) {
	if (!query) return [];
	return query.split("&").filter(Boolean).map((pair) => {
		const eqIndex = pair.indexOf("=");
		return eqIndex === -1 ? [pair, ""] : [pair.slice(0, eqIndex), pair.slice(eqIndex + 1)];
	});
}

// Pure, display-only: mirrors what the backend already sends (url + enabled
// params, merged) without ever writing the merged result back into request
// state. request.url and request.params stay exactly what they are today;
// this only computes what the URL input shows.
export function buildDisplayUrl(url, params) {
	const { base, existingQuery } = splitUrl(url);
	const rows = params || [];
	const managedKeys = new Set(rows.map((row) => row.key).filter(Boolean));

	const preservedPairs = parseQueryPairs(existingQuery)
		.filter(([key]) => !managedKeys.has(key))
		.map(([key, value]) => `${key}=${value}`);

	const paramPairs = rows
		.filter((row) => row.enabled && row.key)
		.map((row) => `${encodePreservingVariables(row.key)}=${encodePreservingVariables(row.value)}`);

	const allPairs = [...preservedPairs, ...paramPairs];
	return allPairs.length ? `${base}?${allPairs.join("&")}` : base;
}

function decodeSafely(text) {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

// Reverse direction: the user edited the URL input directly, which may now
// contain its own query string (e.g. they typed "?user=1" or deleted a
// "&name=roshni" segment). Reconciles those pairs into the params array by
// key — update in place, add new, drop ones no longer present — and returns
// a query-free base. request.url is always stored query-free afterward, so
// query data lives in exactly one place (params) and is never duplicated
// onto the request the backend receives.
//
// Only enabled rows are reconciled against what's currently typed: a row the
// user just disabled isn't part of the displayed query text to begin with,
// so its absence from the typed value must never be read as "deleted".
export function syncParamsFromUrlEdit(typedValue, currentParams) {
	const { base, existingQuery } = splitUrl(typedValue);
	const typedPairs = parseQueryPairs(existingQuery).map(([key, value]) => [decodeSafely(key), decodeSafely(value)]);
	const typedKeys = new Set(typedPairs.map(([key]) => key));

	const rows = (currentParams || []).map((row) => ({ ...row }));
	for (const [key, value] of typedPairs) {
		const index = rows.findIndex((row) => row.key === key);
		if (index === -1) rows.push({ key, value, enabled: true });
		else rows[index] = { ...rows[index], value, enabled: true };
	}

	const params = rows.filter((row) => !row.enabled || !row.key || typedKeys.has(row.key));
	return { base, params };
}
