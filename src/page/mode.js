/** @prose
 * # The remembered mode
 *
 * Inline in `<head>`, so a page set to **Prose only** never flashes its code first. `page.js`
 * saves the mode when the reader switches it.
 */
try {
  if (localStorage.getItem("prose:mode") === "prose") {
    document.documentElement.classList.add("prose-only");
  }
} catch {}
