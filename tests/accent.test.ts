/** @prose
 * # Accent tests
 *
 * A project's hue and tab icon, and the page's head that carries them. The browser's bar takes
 * the stylesheet's paper colours, so the two can't drift apart.
 */
import { describe, expect, it } from "vite-plus/test";
import { accentHue, favicon, HUES } from "../src/accent.js";
import { STYLE } from "../src/assets.js";
import { page } from "../src/render.js";

describe("accentHue", () => {
  it("gives a name the same hue every time, one of the eight", () => {
    expect(accentHue("prose")).toBe(accentHue("prose"));
    expect(Object.values(HUES)).toContain(accentHue("prose"));
  });

  it("spreads names over every hue", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => accentHue(`project-${i}`)));
    expect(seen.size).toBe(8);
  });
});

describe("favicon", () => {
  const svg = (uri: string) => decodeURIComponent(uri.slice("data:image/svg+xml,".length));

  it("shows the name's first letter or digit as a capital, in the hue", () => {
    expect(svg(favicon("prose", 145))).toContain(">P</text>");
    expect(svg(favicon("@scope/x", 145))).toContain(">S</text>");
    expect(svg(favicon("3d-viewer", 145))).toContain(">3</text>");
    expect(svg(favicon("prose", 145))).toContain("oklch(0.5 0.13 145)");
  });

  it("leaves the square empty for a name with no letter", () => {
    expect(svg(favicon("---", 145))).toContain("></text>");
  });
});

describe("page head", () => {
  const html = page({
    project: "prose",
    path: "src/a.ts",
    rail: "",
    body: "",
    editorLink: null,
    hasCode: false,
    live: false,
  });

  it("sets the project's hue on the page and its icon on the tab", () => {
    expect(html).toContain(`<html lang="en" style="--accent-h: ${accentHue("prose")}">`);
    expect(html).toMatch(/<link rel="icon" href="data:image\/svg\+xml,[^"]+"/);
  });

  it("colours the browser's bar with the stylesheet's paper, in each scheme", () => {
    const colours = [...html.matchAll(/name="theme-color"[^>]*content="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(colours).toHaveLength(2);
    for (const colour of colours) expect(STYLE.body).toContain(`--paper: ${colour};`);
  });
});
