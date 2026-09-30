/** @prose
 * The package's library surface: the parser and the tree walk, for the renderer and for anyone
 * who wants the same view of a repository in code. `prose .` (spec §4) will be the package's
 * `bin`.
 */
export { firstParagraph, parseFile } from "./parser.js";
export type { CodeLang, FileParse, ProseChunk, ProseSection } from "./parser.js";
export { buildTree, findNode, projectFiles } from "./tree.js";
export type { TreeNode } from "./tree.js";
