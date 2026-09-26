// Request names are unique within a collection, compared trimmed and
// case-insensitive: "Get Users" and "get users " are the same name.
export function normalizeRequestName(name) {
	return String(name ?? "")
		.trim()
		.toLowerCase();
}
