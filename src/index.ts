/** @prose
 * The package's library surface. The commands are `prose [dir]`, `prose build` and
 * `prose publish` (`cli.ts`, [spec](../docs/spec.md)); the same server, build, publish, parser and tree walk are
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
export { publish } from "./publish.js";
export type { PublishOptions, Published } from "./publish.js";
