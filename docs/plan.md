# Plan

Where the project is and what comes next, in order. Finished work is a line or two: the detail lives in the code's `@prose` blocks, the tests, `git log`, and [lessons](lessons.md).

## Where it is

The `@prose` convention and the read-only renderer work, and this repository is read with them at [prose.amitkaps.com](https://prose.amitkaps.com). The latest release is 0.3.0, on npm as `@amitkaps/prose` and as a GitHub release tarball.

- **0.1.0**: a dev route with notes, symbol and staleness checks. Used on sitez and markz it went mostly unread, so it was dropped; the parser and the tree walk carried over ([design](design.md#whats-out-and-why), [lessons](lessons.md)).
- **The rewrite**: the convention, and `prose .`, `prose build` and `prose publish` as a renderer that only reads ([reading](reading.md)).
- **0.2.0**: the README around the two things, and the docs in `docs/`.
- **0.3.0**: the reader's layout (text left, file tree right, a popover on narrow screens), a `README.md` in every folder, a README that opens with the problem and links to the docs, links and headings that match how GitHub shows them, `@prose` in shell, Python and `.gitignore`, current dependencies (Node 26 and 24, TypeScript 7), an npm release (the workflow stages each version for approval on npmjs.com), and the site on a Cloudflare Worker connected to the `prose` branch, which is now plain pages with no `CNAME` or `.nojekyll`.

## Next, in order

- [ ] **Republish the site**, so the old `examples/` content goes (`prose publish`, then `git push origin prose`).
- [ ] **Use it.**
  - Look at it in a browser on sitez and markz: typography, folded code, mobile width.
  - base, sitez, markz: install 0.2.0, remove `prose()` from their Vite configs, replace the snippet in `AGENTS.md` with [the agent rules](usage.md#for-agents), and fold sitez's open `@note` (`src/site.ts`) into its prose.
  - `prose/` → `docs/` in sitez and markz ([writing](writing.md#writing-that-spans-the-code)), with their links. sitez reads its content folder by name (`src/check.ts`), so it learns `docs/`. markz's `docs/` is its website (markz.amitkaps.com), not docs: it moves to `site/` first (root scripts, workspace, package name, CI paths), then `prose/` takes `docs/` and the site reads its pages from there.
  - markz: make `@prose` blocks link to `grammar.md` instead of restating its rules ([writing](writing.md#references)).
  - Two weeks of work on sitez and markz, then decide whether the renderer stays ([reading](reading.md#test-cases)).

## Later

- [ ] Accessibility review: keyboard navigation and shortcuts (the file tree, the mode switch, code runs, jumping between pages), focus order, and screen-reader names.
- [ ] A first crumb, **Home**, linking to `/`, so a page reads `Home / tests / repo.test.ts`. Always shown, or only below the root: to decide.
- [ ] `.github/` on a host that refuses it: the published site is on Cloudflare, which serves it, so this only matters for a host like GitHub Pages, which isn't a target. If one is wanted, `prose build` could leave out the folder with a row linking to GitHub; set aside until then.
- [ ] **Open question: a command per host, or `publish` as it is?** `prose publish` leaves plain pages on a branch and a host deploys it, which is host-neutral but leaves the host's setup by hand. On Cloudflare that is a Worker connected to the `prose` branch, a deploy command that writes `wrangler.jsonc` and `.assetsignore` (for the 404 page and the HTML handling), and the domain set in the dashboard; it works, and some of it is a hack. GitHub Pages is the other host: it needs a `CNAME` and a `.nojekyll`, and refuses `.github/`. That is why frameworks ship an adapter per host. Choices: keep `publish` neutral and document each host in [usage](usage.md#publish); or add a deploy step per host (`prose deploy cloudflare`, `prose deploy github`) that writes what the host needs, which brings host files and credentials into the tool, against [design](design.md#whats-out-and-why). To decide after the setup has been used for a while.
- [ ] A screenshot of a rendered file in the README, once the layout is stable.

Open questions are in [reading](reading.md#open-questions).
