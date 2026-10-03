# Languages

A small tokenizer for each language prose highlights. Each one turns source into coloured spans, and [highlight.ts](../highlight.ts) turns the spans into lines of HTML.

They colour code as shiki's CSS-variables theme did, in the same few colours, since prose used shiki until they replaced it. A script compared the two on this repository's files, and they agree on about 99% of characters. The rest is where only a full grammar can tell, like whether a name is a type or a value. [tests/highlight.test.ts](../../tests/highlight.test.ts) keeps cases from that comparison, with the colours shiki gave them, so the match holds without shiki.

- [scan.ts](scan.ts) has the colours, and a scanner that colours text by a list of regex rules.
- [js.ts](js.ts) colours JS, TS and JSON from the tokens of [lexer.ts](../lexer.ts), the lexer the parser uses.
- [css.ts](css.ts) reads CSS a statement at a time, and [markup.ts](markup.ts) reads HTML and Svelte, with their scripts and styles.
- [markdown.ts](markdown.ts) walks markz's own parse.
- [config.ts](config.ts) has YAML, TOML and `.gitignore`, [shell.ts](shell.ts) shell, and [ebnf.ts](ebnf.ts) the W3C's EBNF.
