/** @prose
 * # Built imports
 *
 * Tells TypeScript that an import ending in `?built` is a file's text, ready to send to the
 * browser. The `built` plugin in [vite.config.ts](../vite.config.ts) does the loading.
 */
declare module "*?built" {
  const text: string;
  export default text;
}
