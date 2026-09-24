/** @prose
 * # Checks (spec §5)
 *
 * Two mechanical, on-demand checks — nothing generated, nothing stored, so neither can hallucinate
 * and neither fails a build (§5's own framing). Both produce `Warning`s that `tree.ts` attaches to
 * chunk nodes and rolls up to ancestors so a badge can surface at any level without the client
 * walking the whole subtree itself.
 */
import { type BlameLine, newestTime } from "./git.js";

export type Warning =
	| { kind: "unresolved-symbol"; message: string; symbol: string }
	| { kind: "stale"; message: string };

export interface Symbol {
	text: string;
	status: "local" | "linked" | "unresolved";
	/** Set only when `status === "linked"` — the declaring chunk's stable path. */
	target?: string;
}

// Spec §5.1 names value literals as its example ("true, null, undefined"); reserved words that
// can't ever be a declaration site (`import`, `return`, `interface`, ...) are the same idea, just
// a longer list — flagging `` `return` `` as "not declared anywhere" would be noise, not signal.
const KEYWORDS_AND_LITERALS = new Set([
	"true",
	"false",
	"null",
	"undefined",
	"this",
	"super",
	"void",
	"typeof",
	"NaN",
	"import",
	"export",
	"default",
	"return",
	"function",
	"class",
	"const",
	"let",
	"var",
	"interface",
	"type",
	"if",
	"else",
	"for",
	"while",
	"new",
	"delete",
	"in",
	"of",
	"await",
	"async",
]);

// A source file's own name (`README.md`, `parser.ts`) is identifier-shaped by this regex — it's a
// dotted chain too — but it's a cross-reference to a file, not a symbol to resolve as one.
const FILENAME_RE = /\.(md|ts|tsx|js|jsx|css|html|svelte|json)$/i;

// The standard library, not this project's — `Set`/`Promise`/`console` are never "declared" by
// any project, so judging them against "declared anywhere in this project" is category error, not
// signal. A fixed list, not exhaustive: same "known, bounded exceptions" shape as keywords above,
// not an attempt to enumerate every global every runtime provides.
const BUILTIN_GLOBALS = new Set([
	"Array",
	"Object",
	"Function",
	"Boolean",
	"Number",
	"String",
	"Symbol",
	"BigInt",
	"Map",
	"Set",
	"WeakMap",
	"WeakSet",
	"Promise",
	"Proxy",
	"Reflect",
	"Error",
	"TypeError",
	"RangeError",
	"SyntaxError",
	"ReferenceError",
	"JSON",
	"Math",
	"Date",
	"RegExp",
	"ArrayBuffer",
	"Uint8Array",
	"Int32Array",
	"Float64Array",
	"DataView",
	"console",
	"globalThis",
	"URL",
	"URLSearchParams",
	"Intl",
	"Infinity",
	"structuredClone",
	"fetch",
	"Response",
	"Request",
	"Headers",
]);

// An identifier, or a dotted chain of them (`store.subscribe`) — spec §5.1's "looks like an
// identifier." Anything else (`completed: false`, a whole expression) is skipped, not flagged.
// `import.meta.url`/`import.meta.glob` are syntax, not a declaration site, so they're excluded
// even though they parse as a dotted chain.
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** @prose
 * Inline code spans in Markdown prose — `` `text` `` — are the only place spec §5.1 looks for
 * symbols. A fenced code block (```` ``` ````) is not a span; this regex only matches single
 * backticks, so it can't match across a fence's content by accident.
 */
export function extractCodeSpans(prose: string): string[] {
	const spans: string[] = [];
	const re = /`([^`\n]+)`/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(prose))) {
		const text = match[1];
		if (
			IDENTIFIER_RE.test(text) &&
			!KEYWORDS_AND_LITERALS.has(text) &&
			!BUILTIN_GLOBALS.has(text) &&
			!FILENAME_RE.test(text) &&
			text !== "import.meta" &&
			!text.startsWith("import.meta.")
		) {
			spans.push(text);
		}
	}
	return spans;
}

/** @prose
 * # Declared identifiers
 *
 * A regex heuristic, not a parser: it catches the common declaration shapes (`function foo`,
 * `class Foo`, `const/let/var foo`, `interface`/`type Foo`, each optionally `export`ed) but not
 * destructuring (`const { foo } = ...`) or class members. Good enough for a symbol check whose
 * failure mode is "occasionally too quiet," not wrong — spec §5.1 only promises JS/TS for now.
 *
 * An imported binding counts too — `import { marked } from "marked"` makes `marked` a name this
 * project's code declares and uses, even though it's not *defined* here (spec §5.1's "declared"
 * is about where a name is bound, not where its implementation lives). Missing this was a real
 * bug, not a hypothetical: a chunk's own imports live in its file's preamble, which sits above
 * every chunk's own code, and the first version of this function only looked at
 * `function`/`class`/`const`/... declarations — every imported name in a real file (`marked`,
 * `RendererObject`, `Tokens`) came back "unresolved" purely because *how* it entered scope wasn't
 * one of the forms this regex knew about, not because it was actually undeclared.
 */
const DECLARATION_RE =
	/\b(?:export\s+(?:default\s+)?)?(?:function\*?|class|interface|type|const|let|var)\s+([A-Za-z_$][\w$]*)/g;

const IMPORT_DEFAULT_RE = /\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,|from\b)/g;
const IMPORT_NAMESPACE_RE = /\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\b/g;
const IMPORT_NAMED_RE = /\bimport\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\b/g;

export function declaredIdentifiers(code: string): Set<string> {
	const names = new Set<string>();
	let match: RegExpExecArray | null;

	DECLARATION_RE.lastIndex = 0;
	while ((match = DECLARATION_RE.exec(code))) names.add(match[1]);

	IMPORT_DEFAULT_RE.lastIndex = 0;
	while ((match = IMPORT_DEFAULT_RE.exec(code))) names.add(match[1]);

	IMPORT_NAMESPACE_RE.lastIndex = 0;
	while ((match = IMPORT_NAMESPACE_RE.exec(code))) names.add(match[1]);

	IMPORT_NAMED_RE.lastIndex = 0;
	while ((match = IMPORT_NAMED_RE.exec(code))) {
		for (const spec of match[1].split(",")) {
			const name = spec
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/)
				.pop();
			if (name) names.add(name.trim());
		}
	}

	return names;
}

/** @prose
 * # Resolving symbols in one chunk
 *
 * Spec §5.1's three cases, in order: declared in this chunk's own code (`local`, no warning — the
 * client just highlights it); declared in some *other* chunk project-wide (`linked`, rendered as a
 * link, no warning either); declared nowhere (`unresolved`, the one case that becomes a `Warning`).
 * `table` maps every identifier this project declares to the chunk path that declares it, built
 * once for the whole tree (`tree.ts`) since "elsewhere in the project" is inherently cross-file.
 *
 * `fileScope` is the containing file's *preamble* — its imports and any module-level declarations
 * above the file's first `@prose` block. A chunk's own code alone doesn't see those (they're not
 * repeated in every chunk), but every chunk in that file can still use them, so they count as
 * `local` too, not `unresolved` and not a same-file `linked` link to nowhere.
 *
 * `knownPackages` is `package.json`'s own dependency names (`tree.ts` reads it once). Prose often
 * names a *library*, not the specific binding imported from it — `examples/base`'s own docs.ts
 * imports `Marked` but its prose says "`marked`'s renderer hook," meaning the npm package, a
 * proper noun with no binding of its own to resolve. A declared dependency name is exactly the
 * project's own record of "this external thing is a real part of this project," so it's excluded
 * the same way a keyword or builtin global is — not flagged, not linked, just left alone.
 */
export function checkSymbols(
	prose: string,
	ownCode: string,
	ownPath: string,
	table: ReadonlyMap<string, string>,
	fileScope: ReadonlySet<string> = new Set(),
	knownPackages: ReadonlySet<string> = new Set(),
): { symbols: Symbol[]; warnings: Warning[] } {
	const spans = extractCodeSpans(prose);
	if (spans.length === 0) return { symbols: [], warnings: [] };

	const ownDeclared = declaredIdentifiers(ownCode);
	const symbols: Symbol[] = [];
	const warnings: Warning[] = [];
	const seen = new Set<string>();
	for (const text of spans) {
		if (seen.has(text)) continue;
		seen.add(text);
		if (knownPackages.has(text)) continue;
		if (ownDeclared.has(text) || fileScope.has(text)) {
			symbols.push({ text, status: "local" });
			continue;
		}
		const target = table.get(text);
		if (target && target !== ownPath) {
			symbols.push({ text, status: "linked", target });
			continue;
		}
		symbols.push({ text, status: "unresolved" });
		warnings.push({
			kind: "unresolved-symbol",
			symbol: text,
			message: `\`${text}\` isn't declared anywhere in this project.`,
		});
	}
	return { symbols, warnings };
}

/** @prose
 * # Staleness (spec §5.2)
 *
 * `blame` is the whole file's blame, already read once by `tree.ts`; this just takes the newest
 * timestamp in the prose block's own line range and the newest in the code's, and compares them.
 * A pending chunk (no code yet) or a file with no blame data (untracked, or no git repo at all)
 * has nothing to compare, so it's never flagged — spec §5.2 is a heuristic signal, and "can't
 * tell" should never look the same as "confirmed fresh."
 */
export function checkStaleness(
	blame: BlameLine[] | null,
	proseStartLine: number,
	proseEndLine: number,
	codeStartLine: number,
	codeEndLine: number,
): Warning[] {
	if (!blame || codeEndLine < codeStartLine) return [];
	const proseTime = newestTime(blame, proseStartLine, proseEndLine);
	const codeTime = newestTime(blame, codeStartLine, codeEndLine);
	if (proseTime === 0 || codeTime === 0) return [];
	if (codeTime <= proseTime) return [];
	return [{ kind: "stale", message: "The code changed more recently than its prose." }];
}
