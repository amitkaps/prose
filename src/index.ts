/** @prose
 * The package's only public export is `prose()`, the Vite plugin factory (spec §6). The parser
 * and tree types are exported alongside it so a consumer can type against the shape of `tree`/
 * `node` RPC results without reaching into the package's internals.
 */
export { prose } from "./plugin.js";
export type { FileParse, ProseChunk, ProseSection } from "./parser.js";
export type { TreeNode } from "./tree.js";
