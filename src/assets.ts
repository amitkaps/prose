/** @prose
 * # The files every page shares
 *
 * The stylesheet and the page's script, sent once and cached, so each page carries only its own
 * HTML. A file's name holds a hash of its text, so a new release gets new names and a host can
 * cache them forever.
 *
 * `prose .` and `prose build` both serve them under `/assets/`. A page's file is its path plus
 * `.html`, so an asset can't clash with a page, even in a repository with its own `assets/`. The
 * folder isn't hidden, because some static hosts, like GitHub Pages under Jekyll, leave out a
 * folder whose name starts with a dot. A page there would lose its stylesheet.
 *
 * Two scripts stay inline in the page ([render.ts](render.ts)), because each must run before the
 * first paint. Nothing is minified. Gzip already brings the stylesheet to about 7 KB, and
 * unminified it stays readable in the browser's tools.
 */
import { createHash } from "node:crypto";
import css from "./style.css?raw";

/** @prose
 * # The section being read
 *
 * The contents mark the section being read as the page scrolls. That's the last heading whose top
 * has passed a line a little under the bar. Choosing a heading from the folded contents folds
 * them again, so the text it goes to isn't pushed down.
 */
const TOC_SCRIPT = `
{
	const links = [...document.querySelectorAll(".toc a")];
	const idOf = (a) => decodeURIComponent(a.hash.slice(1));
	const targets = [...new Set(links.map(idOf))].map((id) => document.getElementById(id)).filter(Boolean);
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
		addEventListener("scroll", () => { frame ||= requestAnimationFrame(mark); }, { passive: true });
		mark();
	}
	for (const a of document.querySelectorAll(".toc-top a")) {
		a.addEventListener("click", () => { a.closest("details").open = false; });
	}
}
`;

const PAGE_SCRIPT =
  `
const root = document.documentElement;
const runs = [...document.querySelectorAll(".code")];
const isOpen = (run) =>
	root.classList.contains("prose-only") ? run.classList.contains("opened") : !run.classList.contains("closed");
const sync = () => {
	const proseOnly = root.classList.contains("prose-only");
	for (const b of document.querySelectorAll("[data-mode]")) {
		b.setAttribute("aria-pressed", String((b.dataset.mode === "prose") === proseOnly));
	}
	for (const run of runs) run.querySelector(".code-head").setAttribute("aria-expanded", String(isOpen(run)));
};
for (const b of document.querySelectorAll("[data-mode]")) {
	b.addEventListener("click", () => {
		const proseOnly = b.dataset.mode === "prose";
		root.classList.toggle("prose-only", proseOnly);
		for (const run of runs) run.classList.remove("opened", "closed");
		try { localStorage.setItem("prose:mode", proseOnly ? "prose" : "code"); } catch {}
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
const key = "prose:scroll:" + location.pathname;
try {
	const y = sessionStorage.getItem(key);
	if (y !== null) { sessionStorage.removeItem(key); scrollTo(0, Number(y)); }
} catch {}
` + TOC_SCRIPT;

/** Live reload, on a page `prose .` serves. It runs after the page's script, and `key` is that
 *  script's, since classic scripts share their top-level names. */
const LIVE_SCRIPT = `
const here = document.body.dataset.path;
const since = document.body.dataset.rendered;
let events = null;
const connect = () => {
	if (events || document.hidden || document.prerendering) return;
	events = new EventSource("/.prose/events?path=" + encodeURIComponent(here) + "&since=" + since);
	events.onopen = () => document.body.classList.remove("offline");
	events.onerror = () => document.body.classList.add("offline");
	events.onmessage = () => {
		try { sessionStorage.setItem(key, String(scrollY)); } catch {}
		location.reload();
	};
};
const disconnect = () => { events?.close(); events = null; };
document.addEventListener("visibilitychange", () => (document.hidden ? disconnect() : connect()));
document.addEventListener("prerenderingchange", connect);
addEventListener("pagehide", disconnect);
addEventListener("pageshow", connect);
connect();
`;

export interface Asset {
  /** The address a page links to, like `/assets/style.3f9a2c1b.css`. */
  url: string;
  type: string;
  body: string;
}

function asset(name: string, extension: string, type: string, body: string): Asset {
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8);
  return { url: `/assets/${name}.${hash}.${extension}`, type, body };
}

export const STYLE = asset("style", "css", "text/css; charset=utf-8", css);
export const SCRIPT = asset("page", "js", "text/javascript; charset=utf-8", PAGE_SCRIPT);
/** Only `prose .` serves this one, so a built page never asks for it. */
export const LIVE = asset("live", "js", "text/javascript; charset=utf-8", LIVE_SCRIPT);

/** What `prose build` writes. */
export const BUILT_ASSETS = [STYLE, SCRIPT];
