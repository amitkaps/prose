/** @prose
 * # Declared names
 *
 * The names a chunk of JS or TS declares at its top level, which is what a chunk's anchor is
 * made from ([convention](../docs/convention.md#anchors)): `export function addTodo` anchors as `#addTodo`. The names come from
 * `oxc-parser`'s AST, not a regex: the regex versions this replaced each missed the next shape a
 * real file used (imports, then destructuring), which is the predictable failure of matching
 * text instead of parsing it (`docs/lessons.md`).
 */
import { parseSync } from "oxc-parser";

type AstNode = Record<string, unknown>;

/** @prose
 * Every name a binding pattern binds: a plain identifier, each property of an object pattern,
 * each element of an array pattern, the left side of a default, and a rest element. A default
 * value itself binds nothing.
 */
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

/** @prose
 * Top-level declarations only: `function foo() { const bar = 1; }` declares `foo`, not `bar`.
 * Functions, classes, interfaces, type aliases, enums, variables (destructuring included) and
 * every import form count, in source order, so the first is the chunk's anchor. Code in any
 * other language, or code oxc can't parse, declares nothing; oxc doesn't throw on CSS, it
 * returns an empty body, but the language is checked first anyway.
 */
export function declaredIdentifiers(
  code: string,
  codeLang: "js" | "css" | "html" | "yaml" | "toml" = "js",
): Set<string> {
  const names = new Set<string>();
  if (codeLang !== "js") return names;
  let body: AstNode[];
  try {
    body = parseSync("chunk.ts", code).program.body as unknown as AstNode[];
  } catch {
    return names;
  }
  for (const raw of body) {
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
 * A block inside a class or a function has no top level to read: its code, `metadata(start)
 * { … }`, isn't a program on its own. So its name comes from the whole file's AST instead: the
 * first declaration or member that starts after the block, at any depth. A method, a class field,
 * an object property, a function, a class, a variable, a type. A computed key (`[Symbol.iterator]`)
 * has no name to give, and a private `#field` gives `field`, since `#` starts the anchor.
 */
export function declaredAfter(program: unknown): (index: number) => DeclaredName | null {
  const found: DeclaredName[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    const ast = node as AstNode;
    if (typeof ast.type === "string") {
      const name = nameOf(ast);
      if (name) found.push({ name, start: ast.start as number });
    }
    for (const key in ast) if (key !== "type") visit(ast[key]);
  };
  visit(program);
  found.sort((a, b) => a.start - b.start);
  return (index) => found.find((d) => d.start >= index) ?? null;
}

export interface DeclaredName {
  name: string;
  start: number;
}

function nameOf(node: AstNode): string | null {
  const key = (node.computed ? null : (node.key ?? node.id)) as AstNode | null | undefined;
  switch (node.type) {
    case "MethodDefinition":
    case "PropertyDefinition":
    case "AccessorProperty":
    case "TSAbstractMethodDefinition":
    case "TSAbstractPropertyDefinition":
    case "Property":
    case "FunctionDeclaration":
    case "ClassDeclaration":
    case "VariableDeclarator":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSEnumDeclaration":
      return key && (key.type === "Identifier" || key.type === "PrivateIdentifier")
        ? (key.name as string)
        : null;
  }
  return null;
}
