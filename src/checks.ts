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
 */
const DECLARATION_RE =
	/\b(?:export\s+(?:default\s+)?)?(?:function\*?|class|interface|type|const|let|var)\s+([A-Za-z_$][\w$]*)/g;

export function declaredIdentifiers(code: string): Set<string> {
	const names = new Set<string>();
	let match: RegExpExecArray | null;
	DECLARATION_RE.lastIndex = 0;
	while ((match = DECLARATION_RE.exec(code))) names.add(match[1]);
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
 */
export function checkSymbols(
	prose: string,
	ownCode: string,
	ownPath: string,
	table: ReadonlyMap<string, string>,
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
		if (ownDeclared.has(text)) {
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
