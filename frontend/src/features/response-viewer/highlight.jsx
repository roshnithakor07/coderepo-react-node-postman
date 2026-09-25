// Wraps every case-insensitive occurrence of `query` (already normalized,
// see jsonSearch.js#normalizeQuery) inside `text` in a <mark>. Pure — no
// counting or numbering happens here; `isCurrent` only picks the stronger
// "current match" style. Returns the plain string when nothing matches, so
// callers render no extra elements for non-matching text.
export function highlightText(text, query, isCurrent = false) {
	const source = String(text);
	if (!query) return source;
	const lower = source.toLowerCase();
	if (!lower.includes(query)) return source;
	const className = `search-match${isCurrent ? " search-match-current" : ""}`;
	const parts = [];
	let i = 0;
	while (i < source.length) {
		const idx = lower.indexOf(query, i);
		if (idx === -1) { parts.push(source.slice(i)); break; }
		if (idx > i) parts.push(source.slice(i, idx));
		parts.push(<mark key={idx} className={className}>{source.slice(idx, idx + query.length)}</mark>);
		i = idx + query.length;
	}
	return parts;
}
