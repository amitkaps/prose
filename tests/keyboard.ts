/** @prose
 * # The keyboard check
 *
 * Reads a few pages of this repository's site with the keyboard alone, at a desktop and a phone
 * width. It prints each thing that fails, with where, and exits non-zero if any does. Run it with
 * `pnpm run keyboard` before a release ([development](../docs/development.md#release)).
 *
 * axe sees a page as it stands ([axe.ts](axe.ts)). This presses keys, so it finds what only shows
 * in use. Every Tab stop must be visible and show a focus ring. The stops go in the page's order,
 * and Tab never gets stuck. Each control must also work from the keyboard, and each menu must give
 * focus back when Esc closes it. It checks one page of each kind, since every page shares the frame.
 *
 * A screen reader isn't checked here, and nothing checks it yet.
 */
import type { Page } from "playwright-core";
import { openSite } from "./site.ts";

/** One page of each kind: a folder with a README, one without, a doc, a source file and a file
 *  with no prose. */
const PAGES = ["/", "/.github/workflows/", "/docs/plan.md", "/src/render.ts", "/package.json"];
const DESKTOP = 1280;
const PHONE = 390;
/** More than any page here has, so a walk that reaches it is stuck. */
const MOST_STOPS = 1500;

/** Where a stop is, in the order Tab should meet them. */
const REGIONS = [".skip", ".bar", "main", ".rail"];

interface Stop {
  name: string;
  region: number;
  visible: boolean;
  ring: boolean;
}

/** What's focused, where it is on the page, and whether a reader can see it and its ring. */
function focused(page: Page): Promise<Stop | null> {
  return page.evaluate((regions) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    // The dock's checkbox is hidden, and its label shows its focus.
    const shown = el.id === "dock" ? document.querySelector<HTMLElement>("label.dock")! : el;
    const box = shown.getBoundingClientRect();
    const style = getComputedStyle(shown);
    const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30);
    return {
      name: `${el.tagName.toLowerCase()}${el.className ? `.${el.className.split(" ")[0]}` : ""} "${text}"`,
      region: regions.findIndex((selector) => el.closest(selector)),
      visible:
        shown.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.right > 0 &&
        box.top < innerHeight &&
        box.left < innerWidth,
      ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
    };
  }, REGIONS);
}

/** Tabs from the top of the page until focus comes back round, and says what went wrong. */
async function walk(page: Page): Promise<string[]> {
  const problems: string[] = [];
  let last = 0;
  for (let step = 0; step < MOST_STOPS; step++) {
    await page.keyboard.press("Tab");
    const stop = await focused(page);
    if (!stop) return problems;
    if (step === 0 && stop.region !== 0)
      problems.push(`the first stop is ${stop.name}, not the skip link`);
    if (step > 0 && stop.region === 0) return problems;
    if (!stop.visible) problems.push(`${stop.name} has focus but can't be seen`);
    else if (!stop.ring) problems.push(`${stop.name} has focus but no ring`);
    if (stop.region < last) problems.push(`${stop.name} comes after a later part of the page`);
    last = Math.max(last, stop.region);
  }
  return [...problems, `Tab is stuck after ${MOST_STOPS} stops`];
}

/** Each control, worked from the keyboard. Each returns what failed, or `""` when nothing did or
 *  the control isn't on the page. */
const CHECKS: Record<string, (page: Page, width: number) => Promise<string>> = {
  async "skip link"(page) {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const inMain = await page.evaluate(() => Boolean(document.activeElement?.closest("main")));
    return inMain ? "" : "Skip to the text doesn't move focus to the text";
  },

  async "code run"(page) {
    const head = page.locator(".code-head").first();
    if (!(await head.count())) return "";
    await head.focus();
    await page.keyboard.press("Enter");
    if ((await head.getAttribute("aria-expanded")) !== "false") return "Enter doesn't fold a run";
    await page.keyboard.press("Space");
    const open = (await head.getAttribute("aria-expanded")) === "true";
    return open ? "" : "Space doesn't open a run";
  },

  async "mode switch"(page) {
    const prose = page.locator('[data-mode="prose"]');
    if (await prose.isDisabled()) return "";
    await prose.focus();
    await page.keyboard.press("Enter");
    const on = await page.evaluate(() => document.documentElement.classList.contains("prose-only"));
    await page.locator('[data-mode="code"]').focus();
    await page.keyboard.press("Enter");
    return on ? "" : "Enter doesn't switch to Prose only";
  },

  async folder(page, width) {
    if (width !== DESKTOP) return "";
    // A handle, since a locator for a closed folder would find another once this one opens.
    const folder = await page.$(".rail details:not([open]) > summary");
    if (!folder) return "";
    const before = page.url();
    await folder.focus();
    await page.keyboard.press("Enter");
    const opened = await folder.evaluate((el) => (el.parentElement as HTMLDetailsElement).open);
    await page.keyboard.press("Enter");
    if (!opened) return "Enter doesn't open a folder in the tree";
    return page.url() === before ? "" : "a folder's row left the page";
  },

  async "dock the tree"(page, width) {
    if (width !== DESKTOP) return "";
    await page.locator("#dock").focus();
    await page.keyboard.press("Space");
    // The tree slides away, then hides.
    const hidden = await page
      .locator(".rail")
      .waitFor({ state: "hidden", timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Space");
    return hidden ? "" : "Space on the tree's toggle doesn't hide the tree";
  },

  async "docs menu"(page, width) {
    if (width !== PHONE) return "";
    return menu(page, ".docs-toggle", "#docs");
  },

  async "tree menu"(page, width) {
    if (width !== PHONE) return "";
    return menu(page, ".rail-toggle.pop", "#rail");
  },
};

/** A popover from the bar: Enter opens it, Tab goes into it, and Esc closes it and gives focus
 *  back to its button. */
async function menu(page: Page, button: string, popover: string): Promise<string> {
  await page.locator(button).focus();
  await page.keyboard.press("Enter");
  if (!(await page.locator(`${popover}:popover-open`).count())) return "Enter doesn't open it";
  await page.keyboard.press("Tab");
  const inside = await page.evaluate((selector) => {
    return Boolean(document.activeElement?.closest(selector));
  }, popover);
  if (!inside) return "Tab doesn't go into it";
  await page.keyboard.press("Escape");
  if (await page.locator(`${popover}:popover-open`).count()) return "Esc doesn't close it";
  const back = await page.evaluate((selector) => document.activeElement?.matches(selector), button);
  return back ? "" : "Esc doesn't give focus back to its button";
}

const site = await openSite();
const problems: string[] = [];
for (const path of PAGES) {
  if (!site.pages.includes(path)) {
    problems.push(`${path} isn't in the site`);
    continue;
  }
  for (const width of [DESKTOP, PHONE]) {
    const page = await site.newPage();
    await page.setViewportSize({ width, height: 900 });
    const where = `${path} (${width}px)`;
    await page.goto(`http://site${path}`);
    for (const problem of await walk(page)) problems.push(`${where}: ${problem}`);
    for (const [name, check] of Object.entries(CHECKS)) {
      await page.goto(`http://site${path}`);
      const problem = await check(page, width);
      if (problem) problems.push(`${where}: ${name}: ${problem}`);
    }
    await page.close();
  }
}
await site.close();

for (const problem of problems) console.log(problem);
console.log(problems.length ? `${problems.length} problems` : "Every check passes");
process.exitCode = problems.length ? 1 : 0;
