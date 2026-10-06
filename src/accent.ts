/** @prose
 * # The accent
 *
 * Each project gets its own colour, picked from eight hues by a hash of its name. So two projects
 * open side by side look different, and one project looks the same on every machine, with no
 * config. The colour marks links, focus and the reader's place ([style.css](page/style.css)), and
 * fills the tab's icon.
 *
 * The page sets only the hue. Lightness and chroma are fixed in the stylesheet, so every hue
 * reads alike and passes AA in both modes. A setting to choose the hue could come later, beside
 * the bar's links in the docs' metadata ([nav.ts](nav.ts)).
 */

/** The hues a project can get, as OKLCH angles. Amber is the stylesheet's default. */
export const HUES = {
  amber: 75,
  rust: 40,
  rose: 10,
  plum: 330,
  indigo: 280,
  blue: 245,
  teal: 195,
  green: 145,
} as const;

/** The project's hue: an FNV-1a hash of its name, over the eight in `HUES`. */
export function accentHue(project: string): number {
  let hash = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(project)) {
    hash = Math.imul(hash ^ unit, 0x01000193);
  }
  const hues = Object.values(HUES);
  return hues[(hash >>> 0) % hues.length]!;
}

/** @prose
 * # The tab's icon
 *
 * A rounded square in the accent, with the project's first letter or digit as a capital. It's an
 * SVG data URI, so it needs no file and no request. Its colours follow the reader's scheme, as the
 * page's do. They repeat the accent's and the paper's values from the stylesheet.
 */
export function favicon(project: string, hue: number): string {
  const letter = /[\p{L}\p{N}]/u.exec(project)?.[0]?.toUpperCase() ?? "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>` +
    `rect{fill:oklch(0.5 0.13 ${hue})}text{fill:#fff}` +
    `@media (prefers-color-scheme:dark){rect{fill:oklch(0.78 0.1 ${hue})}text{fill:oklch(0.215 0.006 70)}}` +
    `</style><rect width="32" height="32" rx="7"/>` +
    `<text x="16" y="16.5" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,sans-serif" font-size="20" font-weight="600">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
