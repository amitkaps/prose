# GitHub

Two workflows: `ci` checks every change, and `release` turns a version tag into a GitHub Release. GitHub Pages never publishes this folder, so it isn't on the published site.

- [`ci.yml`](workflows/ci.yml): format, lint and types, the tests and the build, on every pull request and push to `main`. Branch protection requires the `ci` check by that name.
- [`release.yml`](workflows/release.yml): on a `v*` tag, checks the tag matches `package.json`, runs the checks and tests, builds, and attaches the `.tgz` to a Release. How to cut one is in [development](../docs/development.md).
