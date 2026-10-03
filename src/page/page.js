/** @prose
 * # The page's script
 *
 * One script for every page, sent as a shared file. It runs the mode switch and each code run's
 * fold, brings back the scroll position after a live reload, and marks the section being read.
 *
 * It's a classic script, deferred, so it runs once the page is parsed. Each part sits in its own
 * block, since classic scripts on one page share their top-level names. Browser storage can be
 * unavailable, so it only ever tries it.
 */

/** @prose
 * # The mode and the code runs
 *
 * **Prose & Code** shows every code run open, and **Prose only** shows every one folded. Opening
 * or closing a run marks it as an exception to the mode, and switching the mode clears the
 * exceptions. The mode is remembered across pages. `mode.js` applies it before the first paint.
 */
{
  const root = document.documentElement;
  const runs = [...document.querySelectorAll(".code")];
  const isOpen = (run) =>
    root.classList.contains("prose-only")
      ? run.classList.contains("opened")
      : !run.classList.contains("closed");
  const sync = () => {
    const proseOnly = root.classList.contains("prose-only");
    for (const b of document.querySelectorAll("[data-mode]")) {
      b.setAttribute("aria-pressed", String((b.dataset.mode === "prose") === proseOnly));
    }
    for (const run of runs) {
      run.querySelector(".code-head").setAttribute("aria-expanded", String(isOpen(run)));
    }
  };
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.addEventListener("click", () => {
      const proseOnly = b.dataset.mode === "prose";
      root.classList.toggle("prose-only", proseOnly);
      for (const run of runs) run.classList.remove("opened", "closed");
      try {
        localStorage.setItem("prose:mode", proseOnly ? "prose" : "code");
      } catch {}
      sync();
    });
  }
  for (const run of runs) {
    run.querySelector(".code-head").addEventListener("click", () => {
      run.classList.toggle(root.classList.contains("prose-only") ? "opened" : "closed");
      sync();
    });
  }
  sync();
}

// `live.js` saves the scroll position under this key before it reloads the page.
{
  const key = "prose:scroll:" + location.pathname;
  try {
    const y = sessionStorage.getItem(key);
    if (y !== null) {
      sessionStorage.removeItem(key);
      scrollTo(0, Number(y));
    }
  } catch {}
}

/** @prose
 * # The section being read
 *
 * The contents mark the section being read as the page scrolls. That's the last heading whose top
 * has passed a line a little under the bar. Choosing a heading from the folded contents folds
 * them again, so the text it goes to isn't pushed down.
 */
{
  const links = [...document.querySelectorAll(".toc a")];
  const idOf = (a) => decodeURIComponent(a.hash.slice(1));
  const targets = [...new Set(links.map(idOf))]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  let frame = 0;
  const mark = () => {
    frame = 0;
    const line = document.querySelector(".bar").offsetHeight + innerHeight * 0.15;
    let current = targets[0]?.id;
    for (const t of targets) {
      if (t.getBoundingClientRect().top > line) break;
      current = t.id;
    }
    for (const a of links) a.classList.toggle("here", idOf(a) === current);
  };
  if (targets.length) {
    addEventListener(
      "scroll",
      () => {
        frame ||= requestAnimationFrame(mark);
      },
      { passive: true },
    );
    mark();
  }
  for (const a of document.querySelectorAll(".toc-top a")) {
    a.addEventListener("click", () => {
      a.closest("details").open = false;
    });
  }
}
