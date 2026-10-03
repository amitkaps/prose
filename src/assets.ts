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
 * The files themselves are in [page/](page/). Two scripts stay inline in the page
 * ([render.ts](render.ts)), because each must run before the first paint.
 *
 * The build strips their comments and formats them, but doesn't minify them. Gzip already brings
 * the stylesheet to about 7 KB, and unminified it stays readable in the browser's tools.
 */
import { createHash } from "node:crypto";
import liveScript from "./page/live.js?built";
import pageScript from "./page/page.js?built";
import css from "./page/style.css?built";

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
export const SCRIPT = asset("page", "js", "text/javascript; charset=utf-8", pageScript);
/** Only `prose .` serves this one, so a built page never asks for it. */
export const LIVE = asset("live", "js", "text/javascript; charset=utf-8", liveScript);

/** What `prose build` writes. */
export const BUILT_ASSETS = [STYLE, SCRIPT];
