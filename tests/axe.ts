/** @prose
 * # The accessibility audit
 *
 * Runs axe on every page of this repository's site, in light and dark, at a desktop and a phone
 * width. It prints each rule that fails, with where, and exits non-zero if any does. Run it with
 * `pnpm run test:e2e`, which the `e2e` workflow runs on every pull request ([development](../docs/development.md#browser-checks)).
 *
 * It isn't a `.test.ts` file, so `pnpm run test` leaves it out, since a browser makes it slow. It
 * checks the committed pages, built and served as [site.ts](site.ts) says.
 *
 * axe checks what a machine can see in a page, like contrast, names and roles. What a keyboard
 * can do is [keyboard.ts](keyboard.ts).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright-core";
import { openSite } from "./site.ts";

const SCHEMES = ["light", "dark"] as const;
const WIDTHS = [1280, 390];
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];
const PARALLEL = 8;
// Contrast is most of axe's time on a page, and it comes out the same at each width, since the
// colours follow the scheme and the content. So it runs at the first width only.
// axe is served as a file the browser caches, since adding its text to each page costs more.
const AXE_URL = "http://site/__axe.js";
const SLOW = { "color-contrast": { enabled: false } };

/** @prose
 * # What's accepted
 *
 * A task list's checkbox has no label, and axe's `label` rule flags it. That finding is accepted
 * for these checkboxes alone, and any other missing label still fails.
 *
 * markz writes the checkbox as GFM and GitHub do, unlabelled and disabled. It's skipped by Tab,
 * and a screen reader reads the item's text right after it. A label like _Done_ would repeat the
 * state without naming the task, and one naming the task would need ids that can clash with
 * headings.
 *
 * A file in the rail is accepted for `target-size` too. The "On this page" box above it is sticky,
 * so rows scroll under it by design, and a row left under its last link when the rail's scroll is
 * restored overlaps it for a moment. A row is 26px tall, so it's the overlap alone that axe sees,
 * and it ends at the first scroll.
 */
const ACCEPTED: Record<string, string> = {
  label: ':is(li, li > p) > input[type="checkbox"][disabled]',
  "target-size": ".rail a.file",
};

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

const site = await openSite();
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const found = new Map<string, { violation: Violation; where: Set<string>; count: number }>();
const jobs = site.pages.flatMap((path) =>
  SCHEMES.flatMap((scheme) => WIDTHS.map((width) => ({ path, scheme, width }))),
);

async function audit(page: Page, { path, scheme, width }: (typeof jobs)[number]): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://site${path}`);
  await page.addScriptTag({ url: AXE_URL });
  const violations = await page.evaluate(
    async ({ tags, accepted, rules }) => {
      // @ts-expect-error: axe is the script just added to the page.
      const { violations } = (await axe.run(document, { runOnly: tags, rules })) as {
        violations: Violation[];
      };
      return violations
        .map((violation) => ({
          ...violation,
          nodes: violation.nodes.filter(
            ({ target }) =>
              !accepted[violation.id] ||
              !document.querySelector(target.join(" "))?.matches(accepted[violation.id]!),
          ),
        }))
        .filter(({ nodes }) => nodes.length);
    },
    { tags: TAGS, accepted: ACCEPTED, rules: width === WIDTHS[0] ? {} : SLOW },
  );
  for (const violation of violations) {
    const entry = found.get(violation.id) ?? { violation, where: new Set(), count: 0 };
    entry.where.add(`${path} (${scheme}, ${width}px)`);
    entry.count += violation.nodes.length;
    found.set(violation.id, entry);
  }
}

await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    const page = await site.newPage();
    await page.route(AXE_URL, (route) =>
      route.fulfill({
        body: axe,
        contentType: "text/javascript",
        headers: { "cache-control": "max-age=3600" },
      }),
    );
    // Each page as it first loads. A tab keeps the rail's scroll from the page before, so a tree
    // link could sit half under the contents, as any scroll can leave it.
    await page.addInitScript(() => sessionStorage.removeItem("prose:rail"));
    for (let job = jobs.shift(); job; job = jobs.shift()) await audit(page, job);
  }),
);
await site.close();

for (const { violation, where, count } of found.values()) {
  const first = violation.nodes[0]?.target.join(" ");
  console.log(`${violation.impact}: ${violation.id}, ${violation.help}`);
  console.log(`  ${count} elements on ${where.size} views, like ${first} on ${[...where][0]}`);
}
console.log(found.size ? `${found.size} rules fail` : "No rule fails");
process.exitCode = found.size ? 1 : 0;
