// Pure conversion between key/value rows ({ key, value, enabled, description })
// and the bulk-edit text format: one "key:value" per line, a leading "//"
// marks a disabled row. Self-written, no dependency.
//
// The conversion is lossless for every row that carries data:
// parseBulkText(rowsToBulkText(rows), rows) returns the same rows.
//  - Text is taken exactly as typed (no trimming), so values keep their spaces.
//  - Backslash escapes cover what the plain format can't express:
//    "\n" / "\r" (line breaks inside a key or value), "\:" (a colon inside a
//    key, since the first unescaped colon separates key from value), "\/"
//    (a "/", used so an enabled key that starts with "//" isn't read as
//    disabled) and "\\" (a literal backslash in front of one of those).
//    Any other backslash is literal, so "C:\path" reads naturally.
//  - Descriptions aren't part of the text; they're carried over from the
//    rows the text was made from, matched by key in order.
//  - Blank rows (empty key, value and description) hold no data and are
//    dropped; empty or whitespace-only lines are ignored, and a trailing
//    raw "\r" (pasted Windows line endings) is stripped.

const ESCAPABLE = new Set(["n", "r", ":", "/", "\\"]);

function escapeField(text, { isKey }) {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];
		if (ch === "\n") out += "\\n";
		else if (ch === "\r") out += "\\r";
		else if (ch === ":" && isKey) out += "\\:";
		// A literal backslash only needs escaping where the parser would
		// otherwise read it as the start of an escape: before an escapable
		// character, before a line break (which is itself written as "\n" or
		// "\r"), or at the end of a key (where the separator colon follows).
		else if (ch === "\\" && (ESCAPABLE.has(next) || next === "\n" || next === "\r" || (isKey && next === undefined))) out += "\\\\";
		else out += ch;
	}
	return out;
}

function unescapeField(text) {
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];
		if (ch === "\\" && ESCAPABLE.has(next)) {
			out += next === "n" ? "\n" : next === "r" ? "\r" : next;
			i++;
		} else out += ch;
	}
	return out;
}

function isBlankRow(row) {
	return !row.key && !row.value && !row.description;
}

export function rowsToBulkText(rows) {
	return (rows || [])
		.filter((row) => !isBlankRow(row))
		.map((row) => {
			let key = escapeField(row.key ?? "", { isKey: true });
			// An enabled key starting with "//" would read back as disabled.
			if (row.enabled !== false && key.startsWith("//")) key = `\\${key}`;
			return `${row.enabled === false ? "//" : ""}${key}:${escapeField(row.value ?? "", { isKey: false })}`;
		})
		.join("\n");
}

// Index of the first colon that isn't escaped, or -1.
function separatorIndex(line) {
	for (let i = 0; i < line.length; i++) {
		if (line[i] === "\\" && ESCAPABLE.has(line[i + 1])) i++;
		else if (line[i] === ":") return i;
	}
	return -1;
}

// `previousRows` supplies descriptions: each parsed row takes the
// description of the first not-yet-used previous row with the same key.
export function parseBulkText(text, previousRows = []) {
	const descriptionPool = (previousRows || [])
		.filter((row) => row.description)
		.map((row) => ({ key: row.key ?? "", description: row.description }));
	return (
		(text ?? "")
			.split("\n")
			// A raw "\r" can only come from pasted Windows line endings (real
			// ones inside a field are written as "\r"), and a whitespace-only
			// line is never written (every row has a colon).
			.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
			.filter((line) => line.trim().length > 0)
			.map((line) => {
				const enabled = !line.startsWith("//");
				const body = enabled ? line : line.slice(2);
				const sep = separatorIndex(body);
				const key = unescapeField(sep === -1 ? body : body.slice(0, sep));
				const value = sep === -1 ? "" : unescapeField(body.slice(sep + 1));
				const row = { key, value, enabled };
				const matchIndex = descriptionPool.findIndex((entry) => entry.key === key);
				if (matchIndex !== -1) row.description = descriptionPool.splice(matchIndex, 1)[0].description;
				return row;
			})
	);
}
