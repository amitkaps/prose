/** @prose
 * # Content loading
 *
 * Reads every Markdown file under `src/content/`, validates its frontmatter, and renders it to
 * HTML — all at build time, so the rendered site never ships a Markdown parser or YAML parser to
 * the client or the Worker. Each exported [`Doc`](#doc) is one page: adding a page is adding a
 * file, since the slug comes from the filename and everything else comes from frontmatter.
 */
import { parse as parseYaml } from 'yaml';
import { Marked, type RendererObject, type Tokens } from 'marked';
import { z } from 'zod';

/** @prose
 * Every `.md` file is read and rendered eagerly (not lazily per-request), so the pages
 * stay prerenderable — `import.meta.glob`'s `eager: true` inlines the raw text at build time.
 */
const files = import.meta.glob('/src/content/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** @prose
 * ## Frontmatter schema
 *
 * Extend this schema as pages need more fields (date, image, tags...). A file that does not
 * match fails the build with its path and the offending key — frontmatter errors are a build
 * failure, not a runtime one.
 */
const frontmatterSchema = z.object({
	title: z.string().min(1),
	summary: z.string().min(1),
	/** Position in the nav and on the home page, ascending. */
	order: z.number().int()
});

export type Doc = z.infer<typeof frontmatterSchema> & {
	slug: string;
	html: string;
};

/** @prose
 * ## Heading ids
 *
 * Slugifies a heading's *rendered* HTML, not its raw Markdown, into an id, GitHub-style. The
 * `html` argument has already been through Marked's own inline rendering (see `headingRenderer`
 * below), so it can contain real markup — `<code>`, `<a>`, `&amp;` — which is why the first two
 * steps strip tags and entities before anything else runs. After that: lowercase, punctuation
 * dropped, whitespace runs turned into hyphens. Letters, combining marks and digits in any
 * script are kept, so non-English headings get readable ids. `marked` adds no ids of its own,
 * so without this `#section` links fail silently.
 */
function headingId(html: string): string {
	return (
		html
			.replace(/<[^>]+>/g, '')
			.replace(/&[a-z]+;|&#\d+;/gi, '')
			.toLowerCase()
			.replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
			.trim()
			.replace(/\s+/g, '-') || 'section'
	);
}

/** @prose
 * A heading renderer that gives every heading a page-unique id — `marked`'s renderer
 * hook runs once per parsed heading, so a `Set` closed over here is enough to dedupe within
 * one page without threading state through `parse()`.
 */
function headingRenderer(): RendererObject {
	const used = new Set<string>();
	return {
		heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token) {
			const { depth, tokens } = token as Tokens.Heading;
			const inner = this.parser.parseInline(tokens);
			// Slug the rendered text, so a link's URL never leaks into the id.
			const base = headingId(inner);
			let id = base;
			// Probe until free: a heading that naturally slugs to `foo-1` must not
			// collide with the suffix generated for a second `foo`.
			for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
			used.add(id);
			return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
		}
	};
}

/** @prose
 * A fresh `Marked` instance per doc keeps heading-id uniqueness scoped to one page —
 * reusing one instance across docs would let a heading in doc B collide with, and get
 * renumbered against, one already seen in doc A.
 */
function markdown(): Marked {
	// `Marked` is a top-level export — `new marked.Marked()` is not a constructor.
	const instance = new Marked({ async: false, gfm: true });
	instance.use({ renderer: headingRenderer() });
	return instance;
}

/** @prose
 * ## Rendering a page
 *
 * Splits a raw file into its YAML frontmatter and Markdown body, validates the frontmatter,
 * and renders the body — one function, called once per file at module load.
 */
function render(path: string, source: string): Doc {
	const slug = path.slice('/src/content/'.length, -'.md'.length);

	const match = FRONTMATTER.exec(source);
	if (!match) throw new Error(`${path}: missing YAML frontmatter`);

	// A key with nothing after it (`image:`) parses to null, which Zod's
	// .optional() rejects. Treat it as absent.
	const raw = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
	for (const [key, value] of Object.entries(raw)) {
		if (value === null || value === '') delete raw[key];
	}

	const parsed = frontmatterSchema.safeParse(raw);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
			.join('; ');
		throw new Error(`${path}: invalid frontmatter — ${issues}`);
	}

	const body = source.slice(match[0].length);
	return { ...parsed.data, slug, html: renderMarkdown(body) };
}

/** Render a markdown body to HTML with page-scoped heading ids. */
export const renderMarkdown = (body: string): string =>
	markdown().parse(body, { async: false }) as string;

/** @prose
 * ## Public exports
 *
 * `docs` is every page, rendered and sorted once at module load — routes read from this array
 * instead of re-rendering per request, since every route here is prerendered anyway. `getDoc`
 * looks a single page up by slug for the `[slug]` route.
 */
export const docs: Doc[] = Object.entries(files)
	.map(([path, source]) => render(path, source))
	.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

export const getDoc = (slug: string): Doc | undefined => docs.find((doc) => doc.slug === slug);
