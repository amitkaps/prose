/** @prose
 * A small subsequence matcher for the quick-jump palette: every query character must appear in
 * order in the text (case-insensitive). The score rewards runs of consecutive characters and
 * matches at the start of a word (after `/`, `.`, `-`, `_`, `#` or a space), and lightly
 * penalizes long targets, so `tree` prefers `tree.ts` over `a-truly-extended-entry.ts`.
 */
const WORD_START = new Set(["/", ".", "-", "_", "#", " "]);

/** Higher is better; `null` when the query isn't a subsequence of the text. */
export function score(query: string, text: string): number | null {
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	let total = 0;
	let from = 0;
	let previous = -2;
	for (const ch of q) {
		const at = t.indexOf(ch, from);
		if (at === -1) return null;
		total += 1;
		if (at === previous + 1) total += 3;
		if (at === 0 || WORD_START.has(t[at - 1]!)) total += 2;
		previous = at;
		from = at + 1;
	}
	return total - t.length * 0.01;
}

export function rank<T>(query: string, items: T[], text: (item: T) => string, limit = 12): T[] {
	if (!query.trim()) return items.slice(0, limit);
	const scored: { item: T; value: number }[] = [];
	for (const item of items) {
		const value = score(query, text(item));
		if (value !== null) scored.push({ item, value });
	}
	scored.sort((a, b) => b.value - a.value);
	return scored.slice(0, limit).map((s) => s.item);
}
