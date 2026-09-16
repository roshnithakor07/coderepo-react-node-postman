export function statusClass(status) {
	if (!status) return "serr";
	if (status >= 500) return "s5xx";
	if (status >= 400) return "s4xx";
	if (status >= 300) return "s3xx";
	return "s2xx";
}

export function formatSize(bytes) {
	if (!bytes) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(ms) {
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

export function timeAgo(dateString) {
	const diff = Date.now() - new Date(dateString).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

export function getMethodColor(method) {
	return `method-${method}`;
}

export function tryFormatJson(text) {
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
}

export function isJson(text) {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}
