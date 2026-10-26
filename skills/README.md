# Skills

The skills prose ships for coding agents, each a folder with a `SKILL.md`. pnpm links a package's skills into each agent's folder, like `.claude/skills`, once a repository approves them ([usage](../docs/usage.md#a-skill-for-agents)).

- [prose/](prose/SKILL.md): when to run `prose rules`, `prose outline`, `prose style` and `prose check`. It names the commands and copies none of the rules, so it never drifts from the version installed.
