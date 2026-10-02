/** @prose
 * # The library
 *
 * What the package exports for use in code. The commands are `prose [dir]` and `prose build`
 * ([cli.ts](cli.ts)). The same server, build, parser and tree walk are here for anyone who wants
 * that view of a repository in code.
 */
export { firstParagraph, parseFile } from "./parser.js";
export type { ProseComment } from "./parser.js";
export { buildTree, findNode, projectFiles } from "./tree.js";
export type { TreeNode } from "./tree.js";
export { serve } from "./server.js";
export type { ServeOptions, Served } from "./server.js";
export { build } from "./build.js";
export type { BuildOptions, Built } from "./build.js";
