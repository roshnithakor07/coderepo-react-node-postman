import { describe, test, expect } from "bun:test";
import { rowsToBulkText, parseBulkText } from "./kvBulk.js";

const row = (key, value, enabled = true, description) => (description ? { key, value, enabled, description } : { key, value, enabled });

describe("parseBulkText", () => {
	test("parses one key:value per line", () => {
		expect(parseBulkText("page:2\nlimit:10")).toEqual([row("page", "2"), row("limit", "10")]);
	});
	test('a leading "//" marks the row disabled', () => {
		expect(parseBulkText("//debug:true")).toEqual([row("debug", "true", false)]);
	});
	test("splits on the first colon only, so values keep theirs", () => {
		expect(parseBulkText("redirect:https://example.com:8080/a")).toEqual([row("redirect", "https://example.com:8080/a")]);
	});
	test("a line without a colon is a key with an empty value", () => {
		expect(parseBulkText("flag")).toEqual([row("flag", "")]);
	});
	test("text is taken as typed: spaces around the colon are kept", () => {
		expect(parseBulkText("Accept: text/html")).toEqual([row("Accept", " text/html")]);
	});
	test("ignores empty and whitespace-only lines and strips Windows line endings", () => {
		expect(parseBulkText("a:1\r\n\r\n   \nb:2\r\n")).toEqual([row("a", "1"), row("b", "2")]);
	});
	test("unescapes \\n, \\r, \\:, \\/ and \\\\; other backslashes are literal", () => {
		expect(parseBulkText("a\\:b:line1\\nline2\\r\nC:\\path:x\\\\n")).toEqual([row("a:b", "line1\nline2\r"), row("C", "\\path:x\\n")]);
	});
	test("an escaped slash lets an enabled key start with //", () => {
		expect(parseBulkText("\\//comment:1")).toEqual([row("//comment", "1")]);
	});
	test("carries descriptions over from the previous rows by key, in order", () => {
		const previous = [row("id", "1", true, "first id"), row("id", "2", true, "second id"), row("q", "x", true, "search")];
		expect(parseBulkText("id:9\nq:y\nid:8\nnew:1", previous)).toEqual([
			row("id", "9", true, "first id"),
			row("q", "y", true, "search"),
			row("id", "8", true, "second id"),
			row("new", "1"),
		]);
	});
});

describe("rowsToBulkText", () => {
	test("writes key:value lines and // for disabled rows", () => {
		expect(rowsToBulkText([row("a", "1"), row("b", "2", false)])).toBe("a:1\n//b:2");
	});
	test("drops blank rows but keeps rows with only a value or only a description", () => {
		expect(rowsToBulkText([row("", ""), row("", "orphan"), row("", "", true, "note"), row("", "", false)])).toBe(":orphan\n:");
	});
	test("escapes only what the format needs, so ordinary text stays readable", () => {
		expect(rowsToBulkText([row("path", "C:\\Users\\me")])).toBe("path:C:\\Users\\me");
	});
});

describe("round trip (table → text → table)", () => {
	const cases = {
		"plain rows": [row("page", "2"), row("limit", "10", false)],
		"colons in keys and values": [row("a:b", "c:d"), row("x", "::")],
		"keys starting with //, enabled and disabled": [row("//x", "1"), row("//y", "2", false), row("/", "/")],
		"backslashes everywhere": [row("k\\", "v\\"), row("\\n", "\\:"), row("\\", "\\\\")],
		"line breaks inside fields": [row("multi\nline", "a\r\nb"), row("", "\n")],
		"leading and trailing spaces": [row(" key ", "  value  ")],
		"empty values and duplicate keys": [row("id", ""), row("id", "2"), row("id", "")],
		descriptions: [row("q", "1", true, "search term"), row("q", "2", false, "second"), row("", "", true, "just a note")],
		"unicode and emoji": [row("naïve", "✓ 🚀"), row("ключ", "значение")],
		// Found by the seeded random test: a backslash right before a line break.
		"backslash before a line break": [row("\\\n", "a\\\r"), row("x\\\ny", "")],
	};
	for (const [name, rows] of Object.entries(cases)) {
		test(name, () => {
			// Every row here carries data, so all of them must come back unchanged.
			expect(parseBulkText(rowsToBulkText(rows), rows)).toEqual(rows);
		});
	}

	test("text → table → text is stable for canonical text", () => {
		const text = "a:1\n//b:2\nc\\:d:e\\nf\n\\//g:h";
		expect(rowsToBulkText(parseBulkText(text))).toBe(text);
	});

	test.each([12345, 777, 2026])("seeded random rows survive the round trip (seed %i)", (initialSeed) => {
		// Deterministic LCG so a failure is reproducible.
		let seed = initialSeed;
		const rand = (n) => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed % n;
		};
		const alphabet = ["a", "b", ":", "/", "\\", "n", "r", " ", "\n", "\r", "=", "é", "{", "}"];
		const field = () => Array.from({ length: rand(7) }, () => alphabet[rand(alphabet.length)]).join("");
		for (let i = 0; i < 2000; i++) {
			const rows = Array.from({ length: 1 + rand(5) }, () => {
				const r = { key: field(), value: field(), enabled: rand(3) !== 0 };
				if (rand(4) === 0) r.description = `d${rand(9)}`;
				return r;
			}).filter((r) => r.key || r.value || r.description);
			const back = parseBulkText(rowsToBulkText(rows), rows);
			expect({ case: i, back }).toEqual({ case: i, back: rows });
		}
	});
});
