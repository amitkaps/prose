/** @prose
 * # The rail's place
 *
 * Inline, straight after the rail and before the page paints. So the rail's open folders and its
 * scroll come back on the first frame, instead of jumping after it. If the current file is out of
 * view, it's scrolled to the middle. The rail saves its state as the page is left.
 */
{
  const rail = /** @type {HTMLElement} */ (document.querySelector(".rail"));
  try {
    const saved = JSON.parse(sessionStorage.getItem("prose:rail") || "null");
    if (saved) {
      const folders = /** @type {NodeListOf<HTMLDetailsElement>} */ (
        rail.querySelectorAll("details[data-folder]")
      );
      for (const d of folders) {
        if (saved.open.includes(d.dataset.folder)) d.open = true;
      }
      rail.scrollTop = saved.scroll;
    }
  } catch {}
  // Set by hand, since `scrollIntoView` would also move where the keyboard's Tab starts from.
  const current = rail.querySelector("[aria-current]");
  if (current) {
    const r = current.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) {
      rail.scrollTop +=
        r.top + r.height / 2 - rail.getBoundingClientRect().top - rail.clientHeight / 2;
    }
  }
  addEventListener("pagehide", () => {
    try {
      const opened = /** @type {NodeListOf<HTMLDetailsElement>} */ (
        rail.querySelectorAll("details[data-folder][open]")
      );
      const open = [...opened].map((d) => d.dataset.folder);
      sessionStorage.setItem("prose:rail", JSON.stringify({ open, scroll: rail.scrollTop }));
    } catch {}
  });
}
