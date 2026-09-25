# Review

A review of `spec.md`, `plan.md` and `lessons.md` against the code, as of 2026-09-25 (after #2). It is a work list, not a permanent doc: each item is resolved by a decision, then folded into `spec.md`, `plan.md`, `lessons.md` or the code, and removed from here. When this file is empty, delete it.

Items are numbered so decisions can cite them (`review 1b`). Findings in §1 were checked against the code; 1a was reproduced with a throwaway test.

## Decisions

Every item is decided and written into the spec and plan. What's left is code; this file is deleted once plan steps 1–3 land.

| Item | Decision | Where it lives now |
| ---- | -------- | ------------------ |
| 1a | Escape note text; validate paths; writes only on loopback; refuse cross-origin WebSocket | spec §6 "Trust boundary", §6.2; plan step 1; pending chunk in `src/notes.ts` |
| 1b | Anchor = first declared name, then heading slug, then position; writes carry a block content hash | spec §3.2 "Anchors", §6.3; plan step 2; pending chunk in `src/parser.ts` |
| 1c | Git-aware walk (tracked + untracked-not-ignored); skip `prose/` only at the root | spec §3.4; plan step 1; pending chunk in `src/tree.ts` |
| 1d | Same content-hash guard as 1b | spec §6.3; plan step 1 |
| 2a | Hybrid: single-file work is a pending chunk in its file; `plan.md` keeps ordering and cross-file items | spec §1, §8; `plan.md` intro |
| 2b | Checklist item rewritten: a note asks for the feature, the agent adds the pending chunk | spec §9.2 |
| 2c | `prose check` removed from §8 until it exists | spec §8; plan step 6 |
| 2d | `tree` described as shared state | spec §6.3 |
| 2e | §6.4 names `@note` too, and states the SvelteKit `app.html` limit | spec §6.4 |
| 2f | Import graph from `oxc-parser` | spec §4; plan step 6 |
| 2g | Drifted references fixed in code prose; `§N` checking moved to the front of the `prose/` sync | `src/`; plan step 7a |
| 2h | Personal use, small repos: up to ~500 files; no timing budget | spec §2; plan "Testing" |
| 3.1–3.3 | New *since* view (vs `HEAD`, a ref, or last visit) answers "what changed"; staleness is secondary, uses `blame -w` + ignore-revs, and its limits are stated | spec §1, §5.2, §6.5; plan step 4 |
| 3.4 | One freeform `@note` annotating an issue, mainly written from the view; the agent may leave one too; no author marker, no `@question`. Notes in Markdown later | spec §6.2, §8, §10 |
| 3.5 | Resolved notes shown by the *since* view, which works before anything is committed | spec §6.2, §6.5 |
| 3.6 | Blocks below depth 0 become a warning | spec §3.1; plan step 3 |
| 3.7 | JS/TS comments from `oxc-parser`; scanner kept for CSS/HTML/YAML/TOML | spec §3.1; plan step 3 |
| 3.8 | One line in §6.4 on sourcemaps; no stripping, no CI check | spec §6.4 |
| §4 | Property tests on writes first (step 1); the rest listed under testing | plan step 1, "Testing" |
| 5a | Done list in landing order, no phase numbers | `plan.md` |
| 5b | §6 intro trimmed to the route and its trust boundary; Devframe wiring rationale moved to `src/plugin.ts` | spec §6; `src/plugin.ts` |
| 5c | Order: safe writes, anchors, parser, then the rest | `plan.md` |

## 1. Real bugs the docs don't mention

**1a. Note text can inject code into your source files.** `formatNote` in `src/notes.ts` doesn't escape anything. Adding a note with the text `is this safe? */ export const pwned = 1; /*` wrote this to disk:

```js
/** @note
 * is this safe? */ export const pwned = 1; /*
 */
```

The note closes its own comment, and `export const pwned = 1;` becomes live code. HMR then runs it. The same thing happens with `-->` in HTML, and in YAML/TOML a note line starting with `@prose` becomes a new block. Put that together with `auth: false` and there's no path check in `findChunk` (`join(root, "../../x.ts#file")` works), and the write RPC can write outside the project root and inject code. That's acceptable only while the dev server is bound to loopback. With `vite --host` it isn't. The spec also never asks whether Devframe's WebSocket checks the `Origin` header, which is a known class of Vite dev-server bug.

**1b. Chunk anchors aren't stable, but the spec says they are.** §3.4, §5.3 and §6.1 all promise `src/store.ts#addTodo`. The code (`src/parser.ts`, the `chunkSlug` assignment) builds anchors from heading slugs, and unheaded chunks get positional ones: `top-chunk-0`, `top-chunk-1`, …. That causes three problems:

- If the agent inserts a block above, every later anchor moves. Links and URLs then point at a **different** chunk without any warning.
- Suppose you're typing a note on `top-chunk-2` while the agent adds a chunk. `add-note` re-parses the file correctly, then attaches your note to the **wrong block**. "The file on disk is the only truth" doesn't help when the address itself depends on position.
- Two identical headings in one file produce the same anchor, and writes go to the first one.

This is the base the whole of Phase 6 (§5.3 anchor references) would sit on. Settle it before starting Phase 6. Two options:

- Anchor on the first declared identifier in the chunk's code, which is what the spec implies.
- Send a content hash with each write and reject the write if it no longer matches.

**1c. `SKIP_DIRS` includes `"prose"` at every depth** (`src/tree.ts`). A user's `src/prose/` folder disappears from the tree. The walker also ignores `.gitignore`, so `coverage/`, `.wrangler/`, `build/` and similar folders get walked.

**1d. No lost-update protection.** `addNote` reads, modifies and writes with no mtime or hash check. If an agent or your editor writes the same file between the read and the write, one of the two changes is silently lost. That race is exactly what happens with an agent working alongside you.

## 2. Places where the spec disagrees with itself or with the code

- **2a. §1 vs `plan.md`:** the thesis says there's "no separate plan file to drift", yet the project is run from checkboxes in `plan.md`. §10 admits this. Either dogfood pending chunks now, or soften §1. Right now this project is the counter-example.
- **2b. §9.2 checklist:** it says "A pending chunk added in the view appears in the source". §6.2 says the view's only write is a note, so this item can't pass as written.
- **2c. §8:** it still promises `prose check`. `plan.md` says the snippet "must not promise it", and the CLI doesn't exist.
- **2d. §6.3:** it lists `tree` as a `query`. It's a `SharedState` now.
- **2e. §6.4:** it says the strip only covers `@prose`. The regex also strips `@note`, which is good, but the spec should say so. The spec also presents the strip as working everywhere, but `lessons.md` says SvelteKit never runs `transformIndexHtml`. A limitation that affects the main real-world host belongs in the spec, not only in `lessons.md`.
- **2f. §4:** the diagram is planned on `es-module-lexer`, but `oxc-parser` is already a dependency and returns imports. That's one dependency not needed.
- **2g. Section references have already drifted.** `src/notes.ts` says "(spec §6.3-equivalent)" and `src/server/routes.ts` cites §6.4 for the RPC handlers, which are §6.3. This is exactly what §5.3 item 3 is meant to catch. It argues for moving Phase 6b up.
- **2h. §1 vs §2:** §1 names "a real, nontrivial app" as the sweet spot, while §2 says "small apps, audience of one". Every file save triggers a full re-walk, a `git blame` subprocess for every file, and a push of the whole tree, including all code, over WebSocket. That won't scale to the app §1 describes, and no budget has been set.

## 3. Pushback on the thesis

1. **The staleness check can't see the thing that matters most.** The agent contract (§8) tells the agent to update prose in the same diff as the code. Once it does, its prose lines are always as new as its code, so staleness **never fires on agent work**. It mostly fires on the human's hand edits. It says nothing about what actually goes wrong: prose that has been updated but is **semantically wrong**. None of the mechanical checks catch confident, fresh, incorrect prose.
2. **The warning is easy to game.** "Editing the prose (even to confirm it) clears it" (§5.2), and §8 says "resolve warnings before finishing". Together, those teach the agent to touch the prose to clear the flag. Formatting also skews the signal. An oxfmt reflow of prose clears every flag in the file, and a code reformat or rename flags everything. At minimum, use `git blame -w` plus `--ignore-revs-file`.
3. **The five-minute test asks "what changed", but the view has no time dimension.** It shows a snapshot, not a diff. The most important thing missing is a "since I last looked / since commit X" mode: changed blocks highlighted and new pending chunks listed. Git makes this cheap, and it's the most direct way to meet §1's success test.
4. **"What's still uncertain" has no convention.** Notes only go from the human to the agent. Nothing gives the agent a way to flag doubt back (an agent-authored `@note`, or `@question`).
5. **Deleting on resolve removes the audit trail.** When a note disappears, you can't tell "addressed" apart from "the agent rewrote the block and dropped it". Two possible fixes:
   - A commit-message convention (`Resolves note: src/x.ts#…`).
   - Showing "notes resolved since last visit" in the view, derived from git.
6. **The depth-0 rule fails silently.** It's the first entry in the parser section of `lessons.md`. The fix is a warning: "`@prose` at depth > 0, ignored". That's cheap and removes the whole bug class.
7. **The hand-written JS tokenizer is still the riskiest code.** `return /x/` is a known misread. `oxc-parser` already returns `program.comments` with byte spans for JS and TS, so use it for comment extraction and keep the scanner only for CSS, HTML, YAML and TOML. The two can also be diffed as an oracle (see 4.1).
8. **Sourcemaps and SSR output.** §6.4 assumes minified output. SSR bundles aren't minified by default, and sourcemaps with `sourcesContent` carry every `@prose` and `@note` verbatim. Notes are candid ("this is a hack"), so publishing sourcemaps publishes them.

## 4. Testing beyond the curated examples

The theme of `lessons.md` is that curated examples don't find bugs, and real code and real browsers do. So test in those places:

1. **Corpus and differential tests.** Run the parser over a few large real repos (vite, svelte, kit, and so on) and check:
   - It never throws.
   - For JS and TS, its comment spans match oxc's `program.comments`.
   - Reassembling blocks, code and notes reproduces the original bytes exactly.
2. **Property tests (fast-check) on the write path.** For any file and any note text, including `*/`, `-->`, `@prose`, CRLF, tabs, unicode and empty strings:
   - Adding then resolving a note gives back byte-identical source.
   - Adding twice leaves exactly one note.
   - Every other block's text and anchor stay unchanged.
   - The file still parses to the same blocks.

   This test would have found 1a.
3. **Metamorphic anchor tests.** Insert a block at a random top-level position and assert that no existing anchor now resolves to a different block. This one fails today (1b), which is the point.
4. **Git fixture repos for staleness.** Build temp repos with scripted commits, using `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` to control times. Cover: code-only change, prose-only, both, uncommitted, reformat-only, rename, rebase or cherry-pick (author-time vs commit-time), and squash-merge.
5. **Automate the §9.2 build check.** Build `examples/*` with the plugin on and off, and diff `dist/`. Then grep the output, SSR bundles and `.map` files for `@prose` and `@note`. Put this in CI.
6. **Playwright end-to-end tests** against `dev:prose` and `examples/base`:
   - Load a page, navigate, add a note, and assert the file on disk changed.
   - Edit a file on disk and assert the view updates live.
   - Hit `/__prose` without the trailing slash.

   The browser-only bugs in `lessons.md` show this is where regressions surface.
7. **Formatter idempotence.** After each note write, running `oxfmt` should produce no diff, as §9.2 claims. Assert that.
8. **Performance budget.** Generate synthetic repos with 200, 1,000 and 5,000 files, and record `buildTree` time and tree payload size in CI. Then decide what "nontrivial" means in numbers.
9. **Security tests.** Traversal paths and hostile note text sent to `add-note`, and a WebSocket connection with a foreign `Origin`.
10. **Warning precision.** Label the ~20 symbol-check warnings on this repo as true or false and track the false-positive rate over time. If people learn to ignore the warnings, the checks are worthless.
11. **Test the thesis, not just the code.** Have an agent make about 30 changes to `examples/base`. Then spend five minutes in `/__prose/` answering the four §1 questions, and do the same with only `git log -p`. Compare. An agent-comprehension version: a fresh agent given only the `node` RPC/MCP output versus the raw repo. This is the only test that shows whether the product works.

## 5. Other points

- **5a. The phase order in `plan.md` is confusing.** "Phase 2.5" is listed after Phase 4, and "File as the leaf" has no number. Order the Done section by date, or drop the numbers.
- **5b. The spec is long.** §6's intro paragraph is mostly Devframe plumbing and alternatives that were rejected. That belongs in `lessons.md` or in `src/plugin.ts`'s own `@prose`, following the rule that prose goes next to what it explains.
- **5c. Suggested order before Phase 5:** fix note escaping and path validation (1a), then anchor stability (1b), then the property and fixture tests (4.2–4.4). Phase 6 depends on all of them.
