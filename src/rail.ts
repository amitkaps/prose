/** @prose
 * # The file tree
 *
 * The rail on the left of every page: the repository's folders and files, as an editor's
 * explorer shows them, folders first. It's built from the walk's file list alone, with no file
 * read, so it costs nothing per page beyond its HTML. Each folder is a `<details>`, open when the
 * current page is inside it, so the tree works without script; the page's script remembers which
 * folders a reader opened, and where the rail was scrolled, across pages (`render.ts`).
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
 * Each row carries its depth, and indents itself by it, rather than nesting padding in the
 * lists: so a row's highlight spans the rail's full width, as an editor's explorer does, while
 * its chevron and name sit at their depth.
 */
function renderDir(dir: Dir, prefix: string, current: string, depth: number): string {
	const rows: string[] = [];
	for (const name of [...dir.dirs.keys()].sort()) {
		const path = prefix ? `${prefix}/${name}` : name;
		const here = current === `${path}/`;
		const open = current.startsWith(`${path}/`);
		rows.push(
			`<li><details data-folder="${escapeHtml(path)}"${open ? " open" : ""}><summary style="--depth: ${depth}"${
				here ? ` aria-current="page"` : ""
			}><a href="${escapeHtml(href(path, true))}">${escapeHtml(name)}</a></summary><ul>${renderDir(dir.dirs.get(name)!, path, current, depth + 1)}</ul></details></li>`,
		);
	}
	for (const name of [...dir.files].sort()) {
		if (name === "README.md") continue;
		const path = prefix ? `${prefix}/${name}` : name;
		rows.push(
			`<li><a class="file" style="--depth: ${depth}" href="${escapeHtml(href(path, false))}"${
				current === path ? ` aria-current="page"` : ""
			}>${escapeHtml(name)}</a></li>`,
		);
	}
	return rows.join("");
}

/** The rail for a page at `current` (`""`, `src/`, or `src/store.ts`). A folder's `README.md` isn't
 *  listed: it's that folder's own page. */
export function renderRail(files: string[], current: string, project: string): string {
	return `<nav class="rail" aria-label="Files"><a class="rail-project" href="/"${
		current === "" ? ` aria-current="page"` : ""
	}>${escapeHtml(project)}</a><ul>${renderDir(index(files), "", current, 0)}</ul></nav>`;
}
