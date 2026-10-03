/** @prose
 * # The rail's place
 *
 * Inline, straight after the rail and before the page paints. So the rail's open folders and its
 * scroll come back on the first frame, instead of jumping after it. If the current file is out of
 * view, it's scrolled to the middle. The rail saves its state as the page is left.
 */
{
  const rail = document.querySelector(".rail");
  try {
    const saved = JSON.parse(sessionStorage.getItem("prose:rail") || "null");
    if (saved) {
      for (const d of rail.querySelectorAll("details[data-folder]")) {
        if (saved.open.includes(d.dataset.folder)) d.open = true;
      }
      rail.scrollTop = saved.scroll;
    }
  } catch {}
  const current = rail.querySelector("[aria-current]");
  if (current) {
    const r = current.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) current.scrollIntoView({ block: "center" });
  }
  addEventListener("pagehide", () => {
    try {
      const open = [...rail.querySelectorAll("details[data-folder][open]")].map(
        (d) => d.dataset.folder,
      );
      sessionStorage.setItem("prose:rail", JSON.stringify({ open, scroll: rail.scrollTop }));
    } catch {}
  });
}
