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
	| { kind: "stale"; message: string }
	| { kind: "misplaced-block"; message: string };

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
	// Browser globals, for projects (and this tool's own client) whose prose names them.
	"window",
	"document",
	"location",
	"navigator",
	"localStorage",
	"sessionStorage",
	"HTMLElement",
	"setTimeout",
	"clearTimeout",
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
 * # A real parser, not a regex — and why
 *
 * This used to be two regex heuristics (one for `function`/`class`/`const`/`interface`/`type`
 * declarations, one bolted on later for imports), and both were wrong in the same way: each
 * covered the shapes whoever wrote it happened to think of, and missed the next one a real bug
 * report found (imports, then function parameters — see `declaredParameters` below). That's not
 * a coincidence, it's the predictable failure mode of reimplementing scope analysis by pattern-
 * matching text instead of using a real parser.
 *
 * `oxc-parser` is that real parser — the same Rust/WASM engine `oxlint`/`oxfmt`/`tsdown` already
 * use elsewhere in this project's own toolchain, exposed here as a plain, fast, dependency-light
 * API. (TypeScript itself was the first thing tried: this project deliberately runs TypeScript 7,
 * the new native/Go-ported compiler, and *its* package has no `ts.createSourceFile`-style JS API
 * at all through the normal entry point — confirmed directly, not assumed, before reaching for
 * oxc-parser instead. TypeScript 7.1 is expected to add a WASM-exposed API of its own; worth
 * revisiting this choice then, not before — see `prose/lessons.md`.) Crucially, fed something
 * that isn't JS/TS at all (a CSS rule, say, from a `.svelte` file's `<style>` block), it doesn't
 * throw — confirmed directly too: it returns an empty `program.body` and an `errors` array,
 * which is exactly the "found nothing" behavior this needs, for the right reason instead of by
 * regex-just-not-matching accident.
 */
import { parseSync } from "oxc-parser";

/** @prose
 * Recursively collects every name a binding *pattern* binds — plain `Identifier`, `ObjectPattern`
 * (each property's value, or a `RestElement`'s own argument), `ArrayPattern` (each element, holes
 * skipped), `AssignmentPattern` (its `left` side only — a default value itself isn't a binding),
 * and `RestElement`. This is what the old regex could never do (`const { foo } = ...`, a
 * destructured parameter): a real parser hands back the actual pattern shape, so recursing it
 * correctly is direct, not a reimplementation of destructuring syntax by hand.
 */
type AstNode = Record<string, unknown>;

function bindingNames(pattern: AstNode | null | undefined, names: Set<string>): void {
	if (!pattern) return;
	switch (pattern.type) {
		case "Identifier": {
			const name = pattern.name as string;
			if (name !== "this") names.add(name);
			return;
		}
		case "ObjectPattern":
			for (const prop of pattern.properties as AstNode[]) {
				if (prop.type === "RestElement") bindingNames(prop.argument as AstNode, names);
				else bindingNames(prop.value as AstNode, names);
			}
			return;
		case "ArrayPattern":
			for (const el of pattern.elements as (AstNode | null)[]) bindingNames(el, names);
			return;
		case "AssignmentPattern":
			bindingNames(pattern.left as AstNode, names);
			return;
		case "RestElement":
			bindingNames(pattern.argument as AstNode, names);
			return;
	}
}

/** A generic deep walk over every node in the AST (arrays and plain objects alike), calling
 *  `visit` on each node that has a `.type`. Used by `declaredParameters` to find every function-
 *  like node regardless of nesting — a chunk's own code isn't just its top-level statements. */
function walk(node: unknown, visit: (node: AstNode) => void): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) walk(item, visit);
		return;
	}
	const obj = node as AstNode;
	if (typeof obj.type === "string") visit(obj);
	for (const key in obj) {
		if (key === "type") continue;
		const value = obj[key];
		if (value && typeof value === "object") walk(value, visit);
	}
}

/** Parses `code` as JS/TS via `oxc-parser`; returns `null` for non-`"js"` `codeLang` (CSS/HTML
 *  chunks aren't attempted at all, not even fed through the parser to see what happens) or if
 *  parsing throws (defensive — the empirical behavior is that it doesn't, but this is an external
 *  tool, not this project's own code, so the same caution `git.ts`'s `blameFile` uses applies). */
function tryParse(code: string, codeLang: "js" | "css" | "html" | "yaml" | "toml"): AstNode | null {
	if (codeLang !== "js") return null;
	try {
		return parseSync("chunk.ts", code).program as unknown as AstNode;
	} catch {
		return null;
	}
}

/** @prose
 * # Declared identifiers
 *
 * Top-level declarations only — `program.body`'s own statements, not walked into nested function
 * bodies — matching spec §5.1's "declared in this chunk's own code" at the level a chunk's code
 * actually operates: `function foo() { const bar = 1; }` declares `foo`, not `bar`, as something
 * the rest of the project could plausibly reference. Handles `function`/`class`/`interface`/
 * `type` declarations, `const`/`let`/`var` (destructuring included, via `bindingNames`), and every
 * import form (default/namespace/named, aliased or not — `import { marked } from "marked"` binds
 * `marked` here as directly as any local `const` would, since spec §5.1's "declared" is about
 * where a name is bound, not where its implementation lives).
 */
export function declaredIdentifiers(
	code: string,
	codeLang: "js" | "css" | "html" | "yaml" | "toml" = "js",
): Set<string> {
	const names = new Set<string>();
	const program = tryParse(code, codeLang);
	if (!program) return names;

	for (const raw of program.body as AstNode[]) {
		const node =
			raw.type === "ExportNamedDeclaration" || raw.type === "ExportDefaultDeclaration"
				? ((raw.declaration as AstNode | null) ?? raw)
				: raw;
		switch (node.type) {
			case "VariableDeclaration":
				for (const d of node.declarations as AstNode[]) bindingNames(d.id as AstNode, names);
				break;
			case "FunctionDeclaration":
			case "ClassDeclaration":
			case "TSInterfaceDeclaration":
			case "TSTypeAliasDeclaration":
			case "TSEnumDeclaration": {
				const id = node.id as AstNode | null;
				if (id) names.add(id.name as string);
				break;
			}
			case "ImportDeclaration":
				for (const spec of node.specifiers as AstNode[]) {
					names.add((spec.local as AstNode).name as string);
				}
				break;
		}
	}
	return names;
}

/** @prose
 * # Declared parameters
 *
 * Found by a real bug report, not speculatively: `docs.ts`'s `headingId(html: string)` writes
 * prose naming `` `html` ``, its own parameter — but `declaredIdentifiers` only ever recognized
 * *declarations*, never a parameter name, so it came back "unresolved" despite being about as
 * "declared in this chunk's own code" as a name can be.
 *
 * Deliberately **not** folded into `declaredIdentifiers`: parameters are local-only.
 * `tree.ts`'s global symbol table is built from `declaredIdentifiers` alone, and a parameter
 * named `path` or `value` in one function has no business resolving prose in some unrelated
 * chunk that happens to name the same thing — unlike an exported function or a project-wide
 * import, a parameter's name means nothing outside the one function it belongs to. Walks the
 * *whole* AST (`walk`, not just `program.body`), since a chunk's own function can itself contain
 * nested functions/callbacks with their own parameters, all still "local to this chunk."
 */
export function declaredParameters(
	code: string,
	codeLang: "js" | "css" | "html" | "yaml" | "toml" = "js",
): Set<string> {
	const names = new Set<string>();
	const program = tryParse(code, codeLang);
	if (!program) return names;

	walk(program, (node) => {
		if (
			node.type === "FunctionDeclaration" ||
			node.type === "FunctionExpression" ||
			node.type === "ArrowFunctionExpression"
		) {
			for (const param of node.params as AstNode[]) bindingNames(param, names);
		}
	});
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
	codeLang: "js" | "css" | "html" | "yaml" | "toml" = "js",
): { symbols: Symbol[]; warnings: Warning[] } {
	const spans = extractCodeSpans(prose);
	if (spans.length === 0) return { symbols: [], warnings: [] };

	const ownDeclared = declaredIdentifiers(ownCode, codeLang);
	const ownParameters = declaredParameters(ownCode, codeLang);
	const symbols: Symbol[] = [];
	const warnings: Warning[] = [];
	const seen = new Set<string>();
	for (const text of spans) {
		if (seen.has(text)) continue;
		seen.add(text);
		if (knownPackages.has(text)) continue;
		if (ownDeclared.has(text) || ownParameters.has(text) || fileScope.has(text)) {
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
