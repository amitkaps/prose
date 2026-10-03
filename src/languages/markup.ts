/** @prose
 * # HTML and Svelte
 *
 * A tag's name is coloured as a string and its attributes as functions, as shiki's HTML grammar
 * colours them. The body of a `<script>` is coloured as JS and a `<style>` as CSS, so a
 * page's embedded code reads like a file of its own.
 *
 * Svelte adds `{…}`, which is JS wherever it appears, in text or as an attribute's value. A block
 * like `{#if x}` or `{:else}` colours its tag as a keyword.
 */
import { css } from "./css.js";
import { js } from "./js.js";
import { type Span, shift } from "./scan.js";

/** The end of a `{…}` that opens at `from`, past its matching `}`. */
function braceEnd(source: string, from: number): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      const close = source.indexOf(c, i + 1);
      if (close === -1) return source.length;
      i = close;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  return source.length;
}

/** A Svelte expression, `{` and `}` included. */
function expression(source: string, start: number, end: number): Span[] {
  const inner = source.slice(start + 1, end - 1);
  const tag = /^[#:/@][\w-]+/.exec(inner)?.[0] ?? "";
  // The block's word is the keyword. Its `#`, `:` or `/` stays plain, as shiki leaves it.
  const spans: Span[] = tag
    ? [{ colour: "keyword", start: start + 2, end: start + 1 + tag.length }]
    : [];
  return spans.concat(shift(js(inner.slice(tag.length)), start + 1 + tag.length));
}

export function markup(source: string, svelte = false): Span[] {
  const spans: Span[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (source.startsWith("<!--", i)) {
      const close = source.indexOf("-->", i + 4);
      const end = close === -1 ? source.length : close + 3;
      spans.push({ colour: "comment", start: i, end });
      i = end;
    } else if (c === "<" && /[a-zA-Z!/]/.test(source[i + 1] ?? "")) {
      i = tag(source, i, svelte, spans);
    } else if (svelte && c === "{") {
      const end = braceEnd(source, i);
      spans.push(...expression(source, i, end));
      i = end;
    } else {
      i++;
    }
  }
  return spans;
}

/** A script's code. In Svelte, a rune's `$`, as in `$props()`, stays plain, as shiki leaves it. */
function script(code: string, svelte: boolean): Span[] {
  const spans = js(code);
  if (!svelte) return spans;
  return spans.map((s) =>
    s.colour === "function" && code[s.start] === "$" ? { ...s, start: s.start + 1 } : s,
  );
}

/** Colours the tag at `from`, and the script or style it opens. Returns where to go on from. */
function tag(source: string, from: number, svelte: boolean, spans: Span[]): number {
  const name = /^<\/?!?([\w:-]+)/.exec(source.slice(from, from + 100));
  if (!name) return from + 1;
  const nameStart = from + name[0].length - name[1]!.length;
  spans.push({ colour: "string", start: nameStart, end: from + name[0].length });
  let i = from + name[0].length;
  while (i < source.length && source[i] !== ">") {
    const c = source[i]!;
    if (svelte && c === "{") {
      const end = braceEnd(source, i);
      spans.push(...expression(source, i, end));
      i = end;
    } else if (c === '"' || c === "'") {
      const close = source.indexOf(c, i + 1);
      const end = close === -1 ? source.length : close + 1;
      spans.push({ colour: "string", start: i, end });
      i = end;
    } else if (c === "=") {
      spans.push({ colour: "keyword", start: i, end: i + 1 });
      i++;
    } else if (/[^\s/>]/.test(c)) {
      const attr = /^[^\s=>/"']+/.exec(source.slice(i, i + 200))?.[0] ?? c;
      spans.push({ colour: "function", start: i, end: i + attr.length });
      i += attr.length;
    } else {
      i++;
    }
  }
  i++;
  const element = name[1]!.toLowerCase();
  if (name[0][1] !== "/" && (element === "script" || element === "style")) {
    const close = source.indexOf(`</${element}`, i);
    const end = close === -1 ? source.length : close;
    const body = source.slice(i, end);
    spans.push(...shift(element === "script" ? script(body, svelte) : css(body), i));
    return end;
  }
  return i;
}
