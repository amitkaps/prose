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
 * has passed a line a little under the bar. The breadcrumb ends with that section's name, once
 * the reader has reached one.
 *
 * The section's name opens the contents in the rail. That's the popover on a narrow screen, or the
 * docked tree if it's closed. Choosing a heading from the popover closes it, so the text shows.
 */
{
  const links = [...document.querySelectorAll(".toc a")];
  const section = document.querySelector(".where .section");
  const rail = document.getElementById("rail");
  const pane = rail.querySelector(".toc-rail");
  let shown;
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
    // The rail's contents scroll on their own, so its mark is kept in view there, not the page's.
    const marked = pane?.querySelector("a.here");
    if (marked && current !== shown) {
      shown = current;
      const { offsetTop: top, offsetHeight: height } = marked;
      if (top < pane.scrollTop || top + height > pane.scrollTop + pane.clientHeight) {
        pane.scrollTop = top - pane.clientHeight / 2;
      }
    }
    if (section) {
      const reached = targets[0].getBoundingClientRect().top <= line;
      section.hidden = !reached;
      const named = links.find((a) => idOf(a) === current);
      if (reached && named) section.querySelector("button").textContent = named.textContent;
    }
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
  section?.querySelector("button").addEventListener("click", () => {
    if (matchMedia("(max-width: 62rem)").matches) rail.showPopover();
    else document.getElementById("dock").checked = false;
    (pane.querySelector("a.here") ?? pane.querySelector("a")).focus();
  });
  for (const a of rail.querySelectorAll(".toc-rail a")) {
    a.addEventListener("click", () => {
      if (rail.matches(":popover-open")) rail.hidePopover();
    });
  }
}
