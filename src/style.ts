/** @prose
 * # The stylesheet as a string
 *
 * Hands [style.css](style.css) to the renderer as text, so every page can inline it.
 */
import css from "./style.css?raw";

/** The stylesheet, inlined into every page by `render.ts`. */
export const STYLE = css;
