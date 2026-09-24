/** @prose
 * Loads one doc page by its `[slug]` param, and tells prerendering which slugs exist —
 * `entries` is how a dynamic route gets fully static output: without it, prerendering has no
 * way to discover `/stack`, `/setup`, etc. from an empty `[slug]` pattern alone.
 */
import { getDoc, docs } from '#lib';
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => docs.map((doc) => ({ slug: doc.slug }));

export const load: PageLoad = ({ params }) => {
	const doc = getDoc(params.slug);
	if (!doc) error(404, 'Not found');

	return { doc };
};
