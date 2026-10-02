/** @prose
 * # Raw imports
 *
 * Tells TypeScript that an import ending in `?raw` is a file's text. The build's `raw` plugin in
 * [vite.config.ts](../vite.config.ts) does the loading.
 */
declare module "*?raw" {
  const text: string;
  export default text;
}
