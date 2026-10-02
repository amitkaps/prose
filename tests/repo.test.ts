/** @prose
 * # Repository and footer tests
 *
 * A GitHub address from every spelling of a remote, and none from any other host; a name from any
 * remote; and the rail's footer: Live locally, a snapshot with its commit and, only when given one, its tag; and a folder's
 * `README.md` row, first in its folder and standing for the folder's page.
 */
import { describe, expect, it } from "vite-plus/test";
import { railFooter, renderRail } from "../src/rail.js";
import { githubUrl, remoteName } from "../src/repo.js";

describe("githubUrl", () => {
  it("reads ssh, scp-style and https remotes, with or without .git", () => {
    for (const remote of [
      "git@github.com:amitkaps/prose.git",
      "ssh://git@github.com/amitkaps/prose.git",
      "https://github.com/amitkaps/prose.git",
      "https://github.com/amitkaps/prose",
      "https://token@github.com/amitkaps/prose.git\n",
    ]) {
      expect(githubUrl(remote)).toBe("https://github.com/amitkaps/prose");
    }
  });

  it("has none for another host", () => {
    expect(githubUrl("git@gitlab.com:amitkaps/prose.git")).toBeUndefined();
    expect(githubUrl("/some/local/path")).toBeUndefined();
  });
});

describe("remoteName", () => {
  it("is the last path segment of any remote, without .git", () => {
    for (const remote of [
      "git@github.com:amitkaps/prose.git",
      "https://github.com/amitkaps/prose\n",
      "git@gitlab.com:group/sub/prose.git",
      "/some/local/prose/",
    ]) {
      expect(remoteName(remote)).toBe("prose");
    }
  });
});

describe("railFooter", () => {
  const repo = "https://github.com/amitkaps/prose";

  it("says Live locally, with the repository mark", () => {
    const html = railFooter({ live: true, repo });
    expect(html).toContain("Live");
    expect(html).toContain(`href="${repo}"`);
    expect(html).not.toContain("Snapshot");
  });

  it("names the commit, and the tag only when there is one", () => {
    const plain = railFooter({ live: false, snapshot: { commit: "abc1234" }, repo });
    expect(plain).toContain(`${repo}/commit/abc1234`);
    expect(plain).not.toContain("releases/tag");
    const tagged = railFooter({
      live: false,
      snapshot: { commit: "abc1234", tag: "v0.2.0" },
      repo,
    });
    expect(tagged).toContain(`${repo}/releases/tag/v0.2.0`);
  });

  it("links nothing without a GitHub remote", () => {
    const html = railFooter({ live: false, snapshot: { commit: "abc1234" } });
    expect(html).toContain("Snapshot · abc1234");
    expect(html).not.toContain("<a ");
  });
});

describe("renderRail: README.md", () => {
  const files = ["README.md", "app.ts", "docs/README.md", "docs/a.md", "docs/z.md"];

  it("lists a folder's README first, linking to the folder's page", () => {
    const html = renderRail(files, "src/x.ts", "demo");
    expect(html).toMatch(/<ul><li><a class="file" style="--depth: 1" href="\/docs\/">README.md</);
    expect(html.indexOf('href="/docs/"')).toBeLessThan(html.indexOf('href="/docs/a.md"'));
    expect(html.indexOf('href="/"')).toBeLessThan(html.indexOf('href="/app.ts"'));
  });

  it("highlights the README, not the folder, on the folder's page", () => {
    const html = renderRail(files, "docs/", "demo");
    expect(html).toContain('href="/docs/" aria-current="page">README.md');
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  it("highlights the project's own row on the root page only when there's no README", () => {
    expect(renderRail(["a.ts"], "", "demo")).toContain(
      'class="rail-project" href="/" aria-current',
    );
    expect(renderRail(files, "", "demo")).toContain('href="/" aria-current="page">README.md');
  });
});
