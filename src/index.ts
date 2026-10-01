/** @prose
 * The package's library surface. The commands are `prose [dir]` and `prose build`
 * (`cli.ts`, [reading](../docs/reading.md)); the same server, build, parser and tree walk are
 * exported for anyone who wants that view of a repository in code.
 */
export { firstParagraph, parseFile } from "./parser.js";
export type { CodeLang, FileParse, ProseChunk, ProseSection } from "./parser.js";
export { buildTree, findNode, projectFiles } from "./tree.js";
export type { TreeNode } from "./tree.js";
export { serve } from "./server.js";
export type { ServeOptions, Served } from "./server.js";
export { build } from "./build.js";
export type { BuildOptions, Built } from "./build.js";
