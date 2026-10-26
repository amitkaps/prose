/** @prose
 * # Skill tests
 *
 * The skills prose ships load in an agent's tools, and name only commands prose has, so a renamed
 * command can't leave a skill pointing at nothing.
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { proseCommands } from "../src/rules.js";

const skills = readdirSync("skills", { withFileTypes: true }).filter((d) => d.isDirectory());
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { files: string[] };

describe("skills", () => {
  it("ship with the package", () => {
    expect(pkg.files).toContain("skills");
    expect(skills.map((d) => d.name)).toEqual(["prose"]);
  });

  it.each(skills.map((d) => d.name))("%s has its name and when to use it", (name) => {
    const text = readFileSync(`skills/${name}/SKILL.md`, "utf8");
    const meta = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    expect(meta).toMatch(new RegExp(`^name: ${name}$`, "m"));
    expect(meta).toMatch(/^description: .{40,}$/m);
  });

  it.each(skills.map((d) => d.name))("%s names only commands prose has", (name) => {
    const text = readFileSync(`skills/${name}/SKILL.md`, "utf8");
    const named = [...text.matchAll(/`pnpm prose ([a-z]+)/g)].map((m) => m[1]);
    const commands = proseCommands().commands.map((c) => c.id);
    expect(named.length).toBeGreaterThan(0);
    for (const command of named) expect(commands).toContain(command);
  });
});
