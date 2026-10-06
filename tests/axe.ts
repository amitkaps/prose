/** @prose
 * # The accessibility audit
 *
 * Runs axe on every page of this repository's site, in light and dark, at a desktop and a phone
 * width. It prints each rule that fails, with where, and exits non-zero if any does. Run it with
 * `pnpm run axe` before a release ([development](../docs/development.md#release)).
 *
 * It isn't a `.test.ts` file, so `pnpm run test` and CI leave it out, since CI has no browser. It
 * drives the Chrome installed on the machine, so nothing is downloaded. The site is built from
 * `HEAD` by the renderer in `dist/`, so it checks the current stylesheet and HTML on the committed
 * pages.
 *
 * axe checks what a machine can, like contrast, names and roles. A keyboard and screen reader
 * pass is still done by hand.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { chromium, type Page } from "playwright-core";

const SCHEMES = ["light", "dark"] as const;
const WIDTHS = [1280, 390];
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];
const PARALLEL = 8;

/** @prose
 * # What's accepted
 *
 * A task list's checkbox has no label, and axe's `label` rule flags it. markz writes it as GFM
 * and GitHub do, unlabelled and disabled. It's skipped by Tab, and a screen reader reads the
 * item's text right after it. A label like _Done_ would repeat the state without naming the task,
 * and one naming the task would need ids that can clash with headings. So the finding is accepted,
 * and only these checkboxes are left out of that one rule. Any other missing label still fails.
 */
const ACCEPTED: Record<string, string> = {
  label: ':is(li, li > p) > input[type="checkbox"][disabled]',
};

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

/** Every page in the site, as the path a reader would ask for. A redirect, like a folder's
 *  `README.md` to the folder, isn't a page, and its target is audited anyway. */
function pages(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "assets" ? [] : pages(path, root);
    if (!name.endsWith(".html") || name === "404.html") return [];
    if (readFileSync(path, "utf8").includes('http-equiv="refresh"')) return [];
    return [
      "/" +
        relative(root, path)
          .replace(/(^|\/)index\.html$/, "$1")
          .replace(/\.html$/, ""),
    ];
  });
}

/** The site's file for a request, as a static host would find it. */
function fileFor(site: string, pathname: string): string | undefined {
  const base = join(site, decodeURIComponent(pathname));
  return [base, `${base}.html`, join(base, "index.html")].find(
    (file) => existsSync(file) && statSync(file).isFile(),
  );
}

const site = mkdtempSync(join(tmpdir(), "prose-axe-"));
execFileSync("node", ["dist/cli.js", "build", ".", "--out", site], { stdio: "ignore" });
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ channel: "chrome" });

const found = new Map<string, { violation: Violation; where: Set<string>; count: number }>();
const jobs = pages(site).flatMap((path) =>
  SCHEMES.flatMap((scheme) => WIDTHS.map((width) => ({ path, scheme, width }))),
);

async function audit(page: Page, { path, scheme, width }: (typeof jobs)[number]): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://site${path}`);
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(
    async ({ tags, accepted }) => {
      // The page's own document. This file is typed without the DOM, as Node code.
      const { document } = globalThis as unknown as {
        document: {
          querySelector(selector: string): { matches(selector: string): boolean } | null;
        };
      };
      // @ts-expect-error: axe is the script just added to the page.
      const { violations } = (await axe.run(document, { runOnly: tags })) as {
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
    { tags: TAGS, accepted: ACCEPTED },
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
    const page = await browser.newPage();
    await page.route("http://site/**", (route) => {
      const file = fileFor(site, new URL(route.request().url()).pathname);
      return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
    });
    for (let job = jobs.shift(); job; job = jobs.shift()) await audit(page, job);
  }),
);
await browser.close();
rmSync(site, { recursive: true, force: true });

for (const { violation, where, count } of found.values()) {
  const first = violation.nodes[0]?.target.join(" ");
  console.log(`${violation.impact}: ${violation.id}, ${violation.help}`);
  console.log(`  ${count} elements on ${where.size} views, like ${first} on ${[...where][0]}`);
}
console.log(found.size ? `${found.size} rules fail` : "No rule fails");
process.exitCode = found.size ? 1 : 0;
