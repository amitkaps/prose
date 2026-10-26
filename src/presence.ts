/** @prose
 * # What's missing
 *
 * prose's warnings on prose that isn't there, as [the agent rules](../docs/usage.md#for-agents)
 * ask for it. That's a file with no `@prose`, a folder with no `README.md`, and an export a
 * library ships with no comment. Each is one file or one export, never a share of the whole
 * ([design](../docs/design.md#what-it-isnt)).
 *
 * Only text `prose check` reads is asked. A Markdown file is prose already, and JSON can't hold a
 * comment, so neither is read for `@prose`. Nor is HTML, since a hand-written page is served with
 * its comments ([writing](../docs/writing.md#in-each-language)).
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { lexJs, type Token } from "./lexer.js";
import { extensionOf, fileToNode, isSource } from "./tree.js";
import { position, type Warning } from "./warnings.js";

export const PRESENCE_CODES = ["no-prose", "no-readme", "undocumented-export"] as const;
export type PresenceCode = (typeof PRESENCE_CODES)[number];

/** A source file prose reads that has no prose comment. */
export function noProse(root: string, path: string): Warning<PresenceCode>[] {
  if (!isSource(root, path) || ["md", "html"].includes(extensionOf(path))) return [];
  if ((fileToNode(root, path).comments ?? []).length) return [];
  return [
    {
      code: "no-prose",
      message: "file with no `@prose` comment",
      instead: "its summary in a `@prose` comment at the top",
      path,
      line: 1,
      column: 1,
    },
  ];
}

/** @prose
 * # Folders
 *
 * Every folder that holds a file prose reads, and checks, has a `README.md`, which is its page's
 * prose. A folder of settings in JSON, like `.vscode/`, or of files `.gitattributes` leaves out,
 * isn't asked.
 *
 * `.github/` is the exception at any depth, since GitHub would show its README in place of the
 * root's. So is a skill's folder, whose `SKILL.md` says what it is, and which an agent's tools
 * load whole.
 */
export function noReadme(
  root: string,
  checked: string[],
  files: Set<string>,
): Warning<PresenceCode>[] {
  const folders = new Set<string>();
  for (const path of checked.filter((p) => isSource(root, p))) {
    const parts = path.split("/").slice(0, -1);
    parts.forEach((_, i) => folders.add(parts.slice(0, i + 1).join("/")));
  }
  return [...folders]
    .filter((dir) => !dir.split("/").includes(".github"))
    .filter((dir) => !files.has(`${dir}/README.md`) && !files.has(`${dir}/SKILL.md`))
    .sort()
    .map((dir) => ({
      code: "no-readme",
      message: "folder with no `README.md`",
      instead: "a `README.md` that says what lives there",
      path: `${dir}/`,
    }));
}

/** @prose
 * # A library's exports
 *
 * A package that isn't private and ships types gives each export's comment as its documentation
 * ([writing](../docs/writing.md#in-each-language)). So every export it ships has a doc comment
 * above it.
 *
 * What ships is read from `package.json`. Each `types` path in `exports`, like
 * `./dist/index.d.ts`, is its source in `src/`, like `src/index.ts`. Its exports are followed
 * through `export … from` to where each is declared. A name that can't be followed there, like
 * one imported and exported again, isn't asked about, so a warning is always right.
 */
export function shippedExports(root: string, files: Set<string>): Map<string, Map<string, number>> {
  const shipped = new Map<string, Map<string, number>>();
  let pkg: { private?: boolean; types?: string; exports?: unknown };
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
  } catch {
    return shipped;
  }
  if (pkg.private) return shipped;
  const entries = new Set<string>();
  const collect = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      if (key === "types" || value.endsWith(".d.ts")) entries.add(value);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) collect(v, k);
    }
  };
  collect(pkg.exports);
  if (pkg.types) entries.add(pkg.types);
  const reader = new Modules(root, files);
  for (const entry of entries) {
    const source = sourceOf(entry, files);
    if (source) reader.ship(source, null, shipped, new Set());
  }
  return shipped;
}

/** `./dist/index.d.ts` is `src/index.ts`, if the repository has it. */
function sourceOf(types: string, files: Set<string>): string | null {
  const base = posix
    .normalize(types)
    .replace(/^dist\//, "src/")
    .replace(/\.d\.[mc]?ts$/, "");
  return [".ts", ".mts", ".js", ".mjs"].map((ext) => base + ext).find((p) => files.has(p)) ?? null;
}

const DECLARES = new Set(["function", "class", "const", "let", "var", "interface", "type", "enum"]);
const BEFORE = new Set(["async", "abstract", "declare", "default"]);

interface Export {
  /** The name it's exported as, and the module and name it comes from, if it's passed on. */
  name: string;
  from?: { module: string; name: string };
  /** Where `export` starts, for a declaration in this module, and whether a doc comment is above. */
  start?: number;
  documented?: boolean;
}

/** The exports of each JS or TS module, read once a run from its tokens. */
class Modules {
  #read = new Map<string, { source: string; exports: Export[]; star: string[] }>();
  private root: string;
  private files: Set<string>;
  constructor(root: string, files: Set<string>) {
    this.root = root;
    this.files = files;
  }

  /** Adds `names` of `module`, or all its exports, to `shipped` at their declarations. */
  ship(
    module: string,
    names: Set<string> | null,
    shipped: Map<string, Map<string, number>>,
    seen: Set<string>,
  ): void {
    const key = `${module}:${names ? [...names].join(",") : "*"}`;
    if (seen.has(key)) return;
    seen.add(key);
    const read = this.read(module);
    if (!read) return;
    for (const e of read.exports) {
      if (names && !names.has(e.name)) continue;
      if (e.from) this.ship(e.from.module, new Set([e.from.name]), shipped, seen);
      else if (e.start !== undefined && !e.documented) {
        const found = shipped.get(module) ?? new Map<string, number>();
        found.set(e.name, e.start);
        shipped.set(module, found);
      }
    }
    for (const star of read.star) this.ship(star, names, shipped, seen);
  }

  read(module: string) {
    const cached = this.#read.get(module);
    if (cached) return cached;
    if (!isSource(this.root, module)) return null;
    const source = readFileSync(join(this.root, module), "utf-8");
    const read = { source, ...exportsOf(source, (spec) => this.resolve(module, spec)) };
    this.#read.set(module, read);
    return read;
  }

  /** `./parse.js` from `src/index.ts` is `src/parse.ts`, as TypeScript resolves it. */
  resolve(from: string, spec: string): string | null {
    if (!spec.startsWith(".")) return null;
    const base = posix.join(posix.dirname(from), spec).replace(/\.[mc]?[jt]s$/, "");
    const tries = [".ts", ".mts", ".js", ".mjs", "/index.ts", "/index.js"].map((e) => base + e);
    return tries.find((p) => this.files.has(p)) ?? null;
  }
}

/** A module's `export` statements, from its tokens. */
function exportsOf(
  source: string,
  resolve: (spec: string) => string | null,
): { exports: Export[]; star: string[] } {
  const all = lexJs(source);
  const tokens = all.filter((t) => t.kind !== "comment");
  const text = (t: Token | undefined) => (t ? source.slice(t.start, t.end) : "");
  const unquote = (t: Token | undefined) => text(t).slice(1, -1);
  const exports: Export[] = [];
  const star: string[] = [];
  const local = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const at = tokens[i]!;
    if (text(at) !== "export" || at.kind !== "name") continue;
    if (i > 0 && text(tokens[i - 1]) === ".") continue;
    let j = i + 1;
    if (text(tokens[j]) === "type" && text(tokens[j + 1]) === "{") j++;
    if (text(tokens[j]) === "*") {
      // `export * from "./x"`, or `export * as x from`, which ships x as one name.
      const asName = text(tokens[j + 1]) === "as" ? text(tokens[j + 2]) : null;
      const spec = unquote(tokens[asName ? j + 4 : j + 2]);
      const module = resolve(spec);
      if (module && !asName) star.push(module);
      continue;
    }
    if (text(tokens[j]) === "{") {
      const pairs: [string, string][] = [];
      for (j++; j < tokens.length && text(tokens[j]) !== "}"; j++) {
        if (text(tokens[j]) === "," || text(tokens[j]) === "type") continue;
        const name = text(tokens[j]);
        if (text(tokens[j + 1]) === "as") {
          pairs.push([text(tokens[j + 2]), name]);
          j += 2;
        } else pairs.push([name, name]);
      }
      const passed = text(tokens[j + 1]) === "from";
      const module = passed ? resolve(unquote(tokens[j + 2])) : null;
      // From a package, or a path that isn't here: nothing to follow.
      if (passed && !module) continue;
      for (const [name, original] of pairs) {
        if (module) exports.push({ name, from: { module, name: original } });
        else local.set(original, name);
      }
      continue;
    }
    while (BEFORE.has(text(tokens[j]))) j++;
    if (!DECLARES.has(text(tokens[j]))) continue;
    const name = text(tokens[j + 1]) === "*" ? text(tokens[j + 2]) : text(tokens[j + 1]);
    const exportedAs = text(tokens[i + 1]) === "default" ? "default" : name;
    if (/^[{[]$/.test(name)) continue;
    const documented = docAbove(all, source, at);
    // An overload or a merged declaration shares its name, and one comment documents them all.
    const same = exports.find((e) => e.name === exportedAs && !e.from);
    if (same) same.documented ||= documented;
    else exports.push({ name: exportedAs, start: at.start, documented });
  }
  // `export { a }` names a declaration of this module. It's asked about only when that
  // declaration is found, with no `export` of its own.
  for (const [original, name] of local) {
    const declared = tokens.findIndex(
      (t, k) => text(t) === original && DECLARES.has(text(tokens[k - 1])),
    );
    if (declared < 1) continue;
    let first = declared - 1;
    while (first > 0 && BEFORE.has(text(tokens[first - 1]))) first--;
    const at = tokens[first]!;
    exports.push({ name, start: at.start, documented: docAbove(all, source, at) });
  }
  return { exports, star };
}

/** Whether the token just before `at` is a `/** … *\/` comment, as TypeScript keeps it. */
function docAbove(all: Token[], source: string, at: Token): boolean {
  const k = all.indexOf(at);
  const before = all[k - 1];
  return before?.kind === "comment" && source.startsWith("/**", before.start);
}

/** The warnings for one module's exports with no comment. */
export function undocumentedExports(
  path: string,
  shipped: Map<string, Map<string, number>>,
  root: string,
): Warning<PresenceCode>[] {
  const found = shipped.get(path);
  if (!found) return [];
  const source = readFileSync(join(root, path), "utf-8");
  return [...found].map(([name, start]) => ({
    code: "undocumented-export",
    message: `\`${name}\` ships with no doc comment`,
    instead: "a `/** … */` comment above it, and one line is enough",
    path,
    ...position(source, start),
  }));
}
