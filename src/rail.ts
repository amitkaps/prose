/** @prose
 * # The file tree
 *
 * The rail on the right of every page shows the repository's folders and files, as an editor's
 * explorer does. Folders come first. In each folder, its `README.md` comes ahead of the rest.
 *
 * It's built from the walk's list of files, and reads none of them, so it costs a page only its
 * HTML. Each folder is a `<details>`, open when the current page is inside it, so the tree works
 * without script. The page's script remembers which folders a reader opened, and where the rail
 * was scrolled ([render.ts](render.ts)).
 */
import { escapeHtml } from "./highlight.js";

interface Dir {
  dirs: Map<string, Dir>;
  files: string[];
}

function index(files: string[]): Dir {
  const top: Dir = { dirs: new Map(), files: [] };
  for (const path of files) {
    const segments = path.split("/");
    let dir = top;
    for (const segment of segments.slice(0, -1)) {
      let next = dir.dirs.get(segment);
      if (!next) {
        next = { dirs: new Map(), files: [] };
        dir.dirs.set(segment, next);
      }
      dir = next;
    }
    dir.files.push(segments.at(-1)!);
  }
  return top;
}

function href(path: string, folder: boolean): string {
  return `/${path.split("/").map(encodeURIComponent).join("/")}${folder ? "/" : ""}`;
}

/** @prose
 * # Rows and depth
 *
 * Each row carries its depth and indents itself by it. The lists don't nest padding. So a row's
 * highlight spans the rail's full width, as in an editor, while its chevron and name sit at
 * their depth. A folder's list carries the folder's depth too, for the guide drawn down from its
 * chevron.
 */
function renderDir(dir: Dir, prefix: string, current: string, depth: number): string {
  const rows: string[] = [];
  for (const name of [...dir.dirs.keys()].sort()) {
    const path = prefix ? `${prefix}/${name}` : name;
    const here = current === `${path}/`;
    const open = current.startsWith(`${path}/`);
    const sub = dir.dirs.get(name)!;
    rows.push(
      `<li><details data-folder="${escapeHtml(path)}"${open ? " open" : ""}><summary style="--depth: ${depth}"${
        here && !sub.files.includes("README.md") ? ` aria-current="page"` : ""
      }><a href="${escapeHtml(href(path, true))}">${escapeHtml(name)}</a></summary><ul style="--depth: ${depth}">${renderDir(sub, path, current, depth + 1)}</ul></details></li>`,
    );
  }
  // A folder's `README.md` is its page, so its row goes to the folder and is first in it.
  const files = [...dir.files].sort(
    (a, b) => Number(b === "README.md") - Number(a === "README.md"),
  );
  for (const name of files) {
    if (name === "README.md") {
      const here = current === (prefix ? `${prefix}/` : "");
      rows.push(
        `<li><a class="file" style="--depth: ${depth}" href="${escapeHtml(href(prefix, !!prefix))}"${
          here ? ` aria-current="page"` : ""
        }>README.md</a></li>`,
      );
      continue;
    }
    const path = prefix ? `${prefix}/${name}` : name;
    rows.push(
      `<li><a class="file" style="--depth: ${depth}" href="${escapeHtml(href(path, false))}"${
        current === path ? ` aria-current="page"` : ""
      }>${escapeHtml(name)}</a></li>`,
    );
  }
  return rows.join("");
}

/** The rail for a page at `current` (`""`, `src/`, or `src/store.ts`). A folder's `README.md` is
 *  listed first in it and links to the folder's page, where it is highlighted instead of the
 *  folder's own row. */
export function renderRail(files: string[], current: string, project: string, footer = ""): string {
  const top = index(files);
  return `<nav class="rail" id="rail" popover aria-label="Files"><a class="rail-project" href="/"${
    current === "" && !top.files.includes("README.md") ? ` aria-current="page"` : ""
  }>${escapeHtml(project)}</a><ul class="rail-tree">${renderDir(top, "", current, 0)}</ul>${footer}</nav>`;
}

/** What a built page was made from: the short commit, and the tag only when `HEAD` is that tag. */
export interface Snapshot {
  commit: string;
  tag?: string;
}

const GITHUB_MARK = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.66 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>`;

/** @prose
 * # The rail's footer
 *
 * The bottom of the rail says what the page is. A page served locally says **Live**, with a dot
 * that dims when the page loses the server. A built page says **Snapshot**, with the commit it
 * was built from. It names a tag only when that commit is the tag. The nearest earlier tag would
 * name a release the page isn't. When `origin` is on GitHub, a GitHub mark links to the
 * repository, and the commit and tag link to their pages.
 */
export function railFooter(options: { live: boolean; snapshot?: Snapshot; repo?: string }): string {
  const { live, snapshot, repo } = options;
  let stamp = "";
  if (live) {
    stamp = `<span class="live" title="Reloads when a file changes"><span class="dot"></span>Live</span>`;
  } else if (snapshot) {
    const link = (text: string, path: string) =>
      repo
        ? `<a href="${escapeHtml(`${repo}/${path}`)}">${escapeHtml(text)}</a>`
        : escapeHtml(text);
    const parts = [
      ...(snapshot.tag
        ? [link(snapshot.tag, `releases/tag/${encodeURIComponent(snapshot.tag)}`)]
        : []),
      link(snapshot.commit, `commit/${snapshot.commit}`),
    ];
    stamp = `<span class="snapshot" title="A snapshot of one commit">Snapshot · ${parts.join(" · ")}</span>`;
  }
  const mark = repo
    ? `<a class="repo" href="${escapeHtml(repo)}" aria-label="Repository on GitHub" title="Repository on GitHub">${GITHUB_MARK}</a>`
    : "";
  return stamp || mark ? `<div class="rail-foot">${stamp}${mark}</div>` : "";
}
