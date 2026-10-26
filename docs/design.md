# Design

A repository that agents work on needs a durable model of its design, for the human and the agents alike. Prose keeps that model in short prose beside the code, held in shape by a convention and mechanical checks. This page says what each part does, why it's built that way, and what the evidence shows so far.

## The problem

**Coding agents change a repository faster than one person can keep a reliable model of its design.** Decisions happen in the chat, a change spreads across files, and the reasoning behind the code gets lost. The human still has to judge each change against the whole: what the project promises, how it fits together, and why.

**The human holds the model, and prose keeps its durable parts.** In the same change, the agent updates the code, the `@prose` next to it and any doc the change affects. So what was decided in the chat lands beside the code it explains. The human reads it to keep the model current, and the agent reads it to work within it. The human still has context and judgment the prose doesn't hold.

**Short prose is what makes it work.** A short doc of what the project promises fits in the human's head. It gives a design discussion a shared starting point, in what the project promises, what it assumes and why. Long prose stops being read, and prose that isn't read stops being kept.

## What it is

Prose is a convention and a read-only command with five jobs. Each part below says what it does and why, and ends with its evidence. It's meant for one person's repositories, up to about 500 files. That's the scope it's built for, and the renderer's file tree is the first thing that would strain past it.

### The convention

A comment whose first token is `@prose` explains the code below it, in Markdown. It works in the languages [writing.md](writing.md#in-each-language) lists, and every Markdown file in the repository is prose too.

- **Beside the code.** The explanation sits in the code it explains, so a diff that changes one without the other shows it.
- **Summaries first.** A summary is the first paragraph of a file, folder, prose block or doc, after its title. `prose check` warns when a file's summary has no title, and `prose style` when it runs past about three lines. Together the summaries are the map of the project. Three plain lines are a map, but three packed sentences are a chore, so the [agent rules](usage.md#for-agents) limit both length and density.
- **One marker.** The convention has `@prose` and nothing else, and a Markdown heading is all the structure a comment needs. A `@todo`, `@decision` or `@note` marker would be one more thing to keep in sync. Decisions go into the prose they change.

**Evidence.** In a sample of 40 sections across four repositories, no claim that could be checked had drifted ([lessons](lessons.md#keeping-prose-true)). That's encouraging, but too small a sample to show prose reliably stays true. Agents are told to keep it current, so it shows the habit holds, not that the prose helps them.

### Checks

[`prose check`](usage.md#check) warns about form a machine can be sure of. That's a file with no summary, a folder with no README, a link or an anchor that reaches nothing, or an export with no comment. It fails on any warning, so it runs in CI, where nobody has to remember it. It doesn't check meaning ([below](#what-it-isnt)).

**Evidence.** Each warning ran on real repositories before it landed, and found real gaps there ([lessons](lessons.md#checks-and-advice)). A warning is never a matter of taste. That shows the checks find what they look for, not that what they look for is enough.

### Rules as code

A rule is a list item in a doc that opens with its id, like [`summary-first`](usage.md#summary-first). Each warning names the rule it serves. [`prose rules`](usage.md#rules) prints the rules, and `prose rules <code>` prints one. So the doc is also the help, a warning points into it, and a renamed id breaks a link.

**Evidence.** A rule stated in three places drifted, and a rule in a doc that drives its check didn't ([lessons](lessons.md#where-decisions-live)). Linking each code to its rule found five rules nobody had written. craftz, markz and pagez now print their rules the same way.

### Advice on style

[`prose style`](usage.md#style) gives advice on sentences that are long, summaries that run on, and semicolons, colons and parentheses that join two ideas. It always passes, so it's advice, not a check. Each suggestion is tried on real repositories and narrowed until it's rarely wrong, since wrong advice teaches agents to ignore all of it.

**Evidence.** The colon advice first flagged every colon, and most of those read fine. It now fires only when a clause follows ([lessons](lessons.md#checks-and-advice)).

### The outline

[`prose outline`](usage.md#outline) writes `outline.md`, every file in the repository with its summary. `verify` writes it, and git ignores it. `AGENTS.md` imports it, so it's in every agent's context from the start.

**Evidence.** None yet. Agents never ran the map grep the rules told them to, so a map has to be in context already, not found ([plan](plan.md)). It works if agents search less before their first edit, and open the right file sooner, than in the sessions before it.

### The renderer

`prose .` shows a repository in the browser, each source file as one document, with its prose in order and its code between. [`prose build`](usage.md#build) writes the same pages as a static site ([reading.md](reading.md)). The repository is the source of truth, so the renderer edits nothing and keeps no state. Every page carries the whole file tree, so its open folders show before the first paint. That makes a site grow with the square of its file count, and the [plan](plan.md#later) says what changes if it grows too large.

**Evidence.** Its published pages are the docs for prose and markz, with nothing written twice ([lessons](lessons.md#what-gets-read)). Nothing measures whether anyone reads them.

### What's shown, and what isn't

The checks, the rules and the docs have shown their worth in use. That agents find their way better, and that the human's model stays more reliable, is still the hypothesis. The outline is the first test of it.

## The trade-offs

- **Meaning goes unchecked.** Prose can go stale silently, since nothing checks that it's true. When prose and code disagree, neither wins by default. The chat settles which is right, and the change fixes the other.
- **It holds only while agents keep the rules.** So `AGENTS.md` says when to read them, and the checks run in `verify` and CI.
- **It serves one reader, not a team.**

The items below follow from these costs.

## What it isn't

Prose leaves some jobs to other tools. Each item names one, says why in a line, and links to what use taught about it.

- **Not an editor.** The human's editor and the agent change the repository. So prose has no editing, no notes in the source and no review of changes. Discussion happens in the chat, and the prose says what the code means now ([lessons](lessons.md#where-decisions-live)).
- **Not a checker of meaning.** The one real drift found in use was about meaning, which no mechanical check catches. So there are no staleness checks, coverage percentages or LLM summaries ([lessons](lessons.md#keeping-prose-true), [usage](usage.md#warnings)).
- **Not something agents look up.** Agents don't go looking for a map or a skill. So the outline and the rules reach them through `AGENTS.md`, and pnpm's agent skills were ruled out ([lessons](lessons.md#checks-and-advice)).
- **Not a new file format or a toolchain.** No `.ts.md`, no tangling and no compiler, which would break `tsc`, the language server, formatters and linters. `@prose` is a comment, like JSDoc, and the outline is plain Markdown, so every standard tool keeps working.
- **Not a site generator or a host.** Navigation stops at the bar's links to the docs. A site with its own navigation and design needs a static site generator ([writing.md](writing.md#folders-and-docs)). Deploying, and each host's config, belong to the project ([lessons](lessons.md#publishing), [usage.md](usage.md#build)).
- **Not part of the app.** No dev route in the app's server, no build plugin and no custom dev tools. The renderer reads any repository without the app running ([lessons](lessons.md#what-gets-read)).
