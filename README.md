<!-- readme-type: monorepo-root -->

# top-right

Work items as sized bubbles on urgency and importance axes, with adapters for GitHub and Jira. A [pnpm](https://pnpm.io/) monorepo whose workspace scripts are run with [`nmr`](https://www.npmjs.com/package/@williamthorsen/nmr).

## Getting started

Prerequisites: The tool versions pinned in `.tool-versions`, and [pnpm](https://pnpm.io/), installed [standalone](https://pnpm.io/installation); the `packageManager` field pins the version that pnpm then activates.

Install dependencies — this has the same effect regardless of where in the project it is run:

```shell
pnpm install
```

Scripts are run with `nmr`, a workspace bin. For the bare `nmr` command to resolve, either:

- Use [direnv](https://direnv.net/) — the repo's `.envrc` adds `node_modules/.bin` to your `PATH`, so `nmr` works from any directory.
- Or prefix commands with `pnpm exec` (for example, `pnpm exec nmr check`), which works without setup.

## Workspaces

`packages/` contains libraries that other workspaces or the public import:

- `_workspace`: scaffold for creating new libraries
- `adapter-github`: reads GitHub issues as work items
- `chart`: the chart as a React component
- `model`: work items, relations, scores and status, and the work-type classifier
- `store`: the store interface for scores, status overrides, and visits

`apps/` contains runnable apps that nothing imports:

- `local`: the local host, which serves the chart of the author's GitHub issues

To start a workspace, follow [Starting an app or a library from a template](docs/new-package.md).

## Running scripts

[`nmr`](https://www.npmjs.com/package/@williamthorsen/nmr) is the script runner. It is **context-aware**: Run from the repo root it uses the root script registry; run from a package directory it uses that package's registry.

Run `nmr` with no command to list every available script — that output is authoritative, so the full set is not duplicated here.

Common commands:

```shell
nmr check      # typecheck, format check, lint check, and tests
nmr typecheck  # type-check only
nmr lint       # lint and apply automatic fixes
nmr lint:check # lint without fixing
nmr test       # run tests
nmr build      # build packages
```

Useful flags:

- `-R`, `--recursive` — run the command in every package
- `-F <pattern>`, `--filter <pattern>` — run the command in matching packages
- `-w`, `--workspace-root` — force the root registry from inside a package directory

Per-package scripts such as `dev`, `preview`, and `start` are not `nmr` commands — they are `package.json` scripts. Run them with `pnpm run <script>` from the package directory.

## Readyup checks

`pnpm exec rdy run --sources` runs the kits published by the sources that `.config/readyup.config.ts` lists. Run it after a dependency upgrade.
