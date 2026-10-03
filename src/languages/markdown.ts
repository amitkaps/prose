/** @prose
 * # Markdown
 *
 * Markdown as code, for a `md` fence in a doc. It's read with markz's own parser, the one that
 * renders the docs, so what's coloured as a heading or a link is exactly what markz reads as one.
 * There's no second, guessing reader of the same dialect.
 *
 * Each node paints its range, and a node inside another paints over it. Headings and bold are
 * bold, emphasis is italic and inline code a string. List markers stay plain, as shiki leaves them. A link is a link, with its text a keyword,
 * as shiki shows them. A fence inside is highlighted in its own language, through `embed`.
 */
import { parse, walk } from "@amitkaps/markz";
import type { Colour, Span } from "./scan.js";

export function markdown(source: string, embed: (code: string, lang: string) => Span[]): Span[] {
  const doc = parse(source);
  const paint = Array.from<Colour | null>({ length: source.length }).fill(null);
  const fill = (start: number, end: number, colour: Colour | null): void => {
    paint.fill(colour, start, end);
  };

  walk(doc, {
    enter(node) {
      const start = doc.start(node);
      const end = doc.end(node);
      switch (doc.type(node)) {
        case "comment":
          fill(start, end, "comment");
          break;
        case "heading":
        case "strong":
          fill(start, end, "strong");
          break;
        case "emphasis":
          fill(start, end, "emphasis");
          break;
        case "inlineCode":
          fill(start, end, "string");
          break;
        case "link":
        case "image":
          fill(start, end, "link");
          for (const child of doc.children(node)) {
            fill(doc.start(child), doc.end(child), "keyword");
          }
          break;
        case "code": {
          const { lang, body } = doc.data(node, "code");
          fill(start, end, "string");
          fill(body.start, body.end, null);
          for (const s of embed(source.slice(body.start, body.end), lang ?? "text")) {
            fill(body.start + s.start, body.start + s.end, s.colour);
          }
          return false;
        }
      }
      return true;
    },
  });

  const spans: Span[] = [];
  for (let i = 0; i < paint.length;) {
    const colour = paint[i];
    let end = i + 1;
    while (end < paint.length && paint[end] === colour) end++;
    if (colour) spans.push({ colour, start: i, end });
    i = end;
  }
  return spans;
}
