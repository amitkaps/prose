function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
	let html = escapeHtml(text);
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${href}">${label}</a>`);
	return html;
}

/** A minimal Markdown-to-HTML pass: headings, paragraphs, `code`, **bold**, and [links](…). */
export function renderMarkdown(markdown: string): string {
	if (!markdown.trim()) return "";
	const blocks = markdown.trim().split(/\n\s*\n/);
	return blocks
		.map((block) => {
			const heading = block.match(/^(#{1,6})\s+(.*)$/);
			if (heading) {
				const level = heading[1].length;
				return `<h${level}>${renderInline(heading[2])}</h${level}>`;
			}
			const paragraph = block
				.split("\n")
				.map((line) => renderInline(line))
				.join(" ");
			return `<p>${paragraph}</p>`;
		})
		.join("\n");
}
