# Changelog

All notable changes to this project will be documented in this file.

## 1.4.0 — 2026-11-07

### 🎉 Features

- Add initialize-node-monorepo skill to scrub template residue (#31)

  Adds `/initialize-node-monorepo`, a skill that ships in every clone of the `templates.node-monorepo` template. Run it once in a freshly-derived repo and it interactively strips the inherited template residue — identity fields, starter packages, drift-detection scaffolding, placeholder labels, and changelog — then rewrites the README and `.agents/PROJECT.md` to describe the repo.

- Detect the v7 code-quality workflow migration in the drift kit (#78)

  The drift kit now reports where a repo stands on the migration to v7 of the shared code-quality workflow, judged against the version the repo actually pins. This repo has completed the migration itself.

- Accept either ESLint config extension in the drift kit (#81)

  The drift report's code-style checks accept an ESLint config under any of the config file names ESLint resolves, including TypeScript extensions `.ts` and `.mts`.

  A repo that pairs a TypeScript ESLint config with a strict-lint version older than 8 now fails a check that links to the strict-lint 8 migration guide. Those versions cannot load a TypeScript config, and in a monorepo a workspace holding one is linted against an ancestor's JavaScript config and exits clean.

- Add dependabot config for GitHub Actions and its drift check (#83)

  Repos generated from this template now arrive with GitHub Actions version updates already automated, gathered into a single pull request each month. For repos generated earlier, `nmr drift:sweep` now reports whether that automation is missing or differs from the template's.

- Make `nmr fmt` the canonical pre-commit formatter (#105)

  Modifies the drift sweep to expect `nmr fmt` as the standard formatter in `lefthook.yml`.
  A hook that calls `prettier` directly is flagged as a warning.

  This repo also adopts `nmr fmt` as the formatting command, which avoids the previous behavior where the commit hook formatted files that the formatting command would not.

- Report kit-publishing packages the readyup config omits (#119)

  Adds a `dependencies` check to the drift kit that reports any installed package publishing ReadyUp kits which `.config/readyup.config.ts` neither names nor excludes. A repo that omits one deliberately records it in the kit's `EXCLUDED_KIT_PACKAGES`.

- Add JetBrains visual guides to the standard editorconfig (#134)

  - Add JetBrains visual column guides to the standard `.editorconfig`
  - Updates the `.editorconfig` digest in the drift kit, whose `.editorconfig matches template` check compares the whole file, so a derived repo warns until it copies the new `.editorconfig`.

### 🪦 Removed

- Removes the `svelte` starter package (`packages/svelte`), a Vite and Tailwind CSS app template that no project uses any longer, together with its `scope:svelte` label. (#168)
- Removes the `astro` starter package, together with its references in `AGENTS.md`, `README.md`, and the ESLint and Git ignore lists, and archives the `scope:astro` label instead of deleting it. (#169)
- Removes `scripts/node-runtime-doctor.sh`, which diagnosed a pnpm tied to a node install and asdf node shims stranded by a node-version switch, together with the `docs/migrations/pnpm-standalone.md` guide that depends on it. (#192)

### 🐛 Bug fixes

- Ship the api package's runtime module and type declarations (#44)

  Fixes an issue where a package published from the `api` template failed on import and carried no type declarations for consumers.

- Delete readyup kit tests by glob and guard the manifest reset (#70)

  Fixes an issue where a repo freshly initialized from this template failed its first strict check.

- Detect broken agent-guidance imports in the drift kit (#77)

  Fixes an inverted check in the template-drift kit: repos whose project guide silently never loaded into agent sessions were reported as aligned, while correctly configured repos were flagged as drifted. Repos the kit previously cleared should be swept again. The kit now also checks that a repo's project guide pulls in the nmr runner guidance, and a failing check reports where the configured import actually points. The template itself no longer ships the broken import.

- Fix the drift kit's ticket-prefix check and extend the migration guide (#103)

  Fixes the ticket-prefix check in the drift kit. Revises `docs/migrations/agents-md.md` to correct errors and omission surfaced by the second migration (`williamthorsen/toolbelt#108`).

  **Corrections**

  - **Step 10 asserted an outcome only a two-harness machine produces.** It said to confirm _both_ `CLAUDE.local.md` and `AGENTS.local.md` carry the ambient region; targeting resolves from harness-home detection, so a single-harness developer correctly gets one file. The step now states the outcome in terms of the harnesses step 8 targets and names the run's own `Targeting …` line as the check.
  - **Step 8 named the lever without the mechanics that make it usable.** It now gives the detection rule (presence of `~/.claude` / `~/.rovodev`), the user-global declaration that retires it for every repository at once, the additive project tier, and the fact that narrowing takes an explicit `drop:` because `root: true` deliberately will not cross the domain boundary.
  - **The `agent-tooling` checklist asserts two things, not one.** The verify section now names the `.agents/preferences.yaml` requirement alongside the `.agents/PROJECT.md` one, so a migration that clears the first and leaves the second short does not read as a mystery failure.

  **Additions**

  - Dropping a harness after a sync leaves an orphaned `.local.md`. `sync` retires ambient regions from the legacy hosts but never from a `.local.md` whose harness has stopped being targeted, so the orphan persists silently.
  - The repo-root `AGENTS.md` is itself a legacy ambient host whose `<!-- rulebook:… -->` regions `sync` strips. The guide's central act is authoring that file and never said so.
  - Step 2's warning that `update-project-guidance` drafts from exploration now carries a resolution: the two-commit recipe that lands the relocation as a rename and the content update as a diff of its own.

  Minor: the verify section gives the command that scopes a shared drift sweep to `agent-tooling` (`pnpm exec rdy run --from ~/repos/templates/node-monorepo --checklists agent-tooling`), since an unscoped run reports every checklist and unrelated drift is the norm; and step 9 names `pnpm run postinstall` as the way to exercise a script that `pnpm install` skips when the tree is already up to date.

  **Drift kit**

  The `agent-tooling` check's label and fix message both named `project.ticket_prefix` while the check itself tested `project.ticket_ref_prefix`: the key codeassembly reads, and the one this repository's `.agents/preferences.yaml` carries. A repository failing that check followed the fix message, added `ticket_prefix`, and stayed red with nothing further to go on. Both strings now name `project.ticket_ref_prefix`, with `.readyup/kits/default.js` and the manifest hashes recompiled. The kit sweeps every repository in `.readyup/fleet.json`, so the wrong message was reaching all of them.

- Stop recommending the retired version-alignment guard test (#115)

  Fixes an issue where the drift kit told a repo to add `__tests__/version-alignment.unit.test.ts`, a guard that `williamthorsen/.github@v7` retired by reading `.tool-versions` directly. The misadvice reached every repo state, including a repo carrying no `code-quality.yaml` at all, so the check is deleted rather than gated.

- Add an eslint-config-typescript delegation floor to the drift kit (#117)

  Fixes a gap where the drift kit reported nothing about `@williamthorsen/eslint-config-typescript`. In a fleet repo whose version predates the package's own ReadyUp kit, the checks delegated to that kit silently did not run. The `dependencies` checklist now carries a floor at 8.7.0, the first version publishing the kit.

- Requires readyup 0.38.0 for the drift kit (`.readyup/kits/default.ts`), whose two `.config/wt.toml` checks threw `pattern.test is not a function` on an older runner and reported their fix text as a finding; an older runner now refuses to load the kit and names the required version. (#142)
- Stops the drift kit's worktree copy check from passing a `.config/wt.toml` whose `copy-ignored` step omits `--require-include`, the flag that turns a missing `.worktreeinclude` allowlist into a no-op rather than a copy of every gitignored file. (#142)

### ♻️ Refactoring

- Remove unused @types/eslint; modernize the Linter type (#67)

  Removes the unused `@types/eslint` dev dependency. The template's ESLint config now uses ESLint's current config type rather than an alias that ESLint 10 deprecates.

- Migrate ESLint config files to TypeScript (#86)

  Every ESLint config in the monorepo is now written in TypeScript. The drift kit now guides template-derived repos through the same migration: It warns when an ESLint config is still JavaScript, and errors when a JavaScript config would shadow its TypeScript replacement. Its config checks are also no longer tied to a specific filename. The shared Vitest configs get the same TypeScript-first treatment.

- Remove the unreachable cdk ignore patterns

  Removes two unreachable ignore patterns from the root ESLint config, `'packages/cdk/.*/**/*'` and its commented-out companion. ESLint 10 resolves a config file per linted file, so `packages/cdk/eslint.config.ts` and its own `.cdk.out/**` entry govern everything under that directory, and the root patterns matched nothing from either the package directory or the repo root.

- Retire devDependencyMeetsFloor for readyup's hasMinDevDependencyVersion (#120)

  Deletes `devDependencyMeetsFloor` and its pnpm-catalog parser from the drift kit, routing every dependency version floor through `hasMinDevDependencyVersion` from `readyup/check-utils`.

- Delegate the last package-owned drift checks and anchor the delegations (#123)

  Removes the last three checks in the template's drift kit that asserted contracts owned by `@williamthorsen/nmr` and `@williamthorsen/release-kit`: the `@williamthorsen/strict-lint` version floor, the Vite/Vitest config pairing, and the absence of `@changesets/cli`. Each is now asserted by the owning package's kit.

  Anchors the two delegations with version floors for `@williamthorsen/nmr` and `@williamthorsen/release-kit`, replacing the kit's release-kit presence check, so a repo installing a version too old to publish a delegated check is still reported.

- Replaces the `src/index.ts` barrel with an empty module and removes `src/types.ts`, which nothing imported once the package stopped publishing an entry point. (#159)
- Replaces the `~src/*` alias in the tsconfig `paths` of `packages/chrome` with a `#src/*` subpath import in the `imports` field of its `package.json`, which Node, Vite, Vitest, and ESLint resolve without further configuration, where the old alias resolved only for the typechecker. (#163)
- Routes the DevTools panel and sidebar messages in `packages/chrome` through the shared `createShowMessage` logger, which prefixes each line with a timestamp, the extension name, and the script name. (#163)
- Declares `#src/*` in the `package.json` `imports` of every package, `_workspace` included so that a package copied from the scaffold starts with it, and replaces the `@/` alias in `nextjs` together with its tsconfig `paths` entry, Vitest `resolve.alias`, and `import-x/extensions` override. (#164)
- Removes the `cdk` bin from `packages/cdk/package.json`, which pointed at `src/bin/AppStack.cdk.js`, a file that has not existed since the package began running its `.ts` source under Node's type stripping. (#165)
- Moves the api, cdk, chrome, nextjs, and react starters from `packages/` to `apps/`, which `pnpm-workspace.yaml` now declares alongside `packages/*`, and keeps `packages/` for the `_workspace` library scaffold. (#180)
- Moves the drift kit's helpers from `.readyup/kits/default.ts` into `.readyup/kits/lib/helpers.ts` to bring each file under `max-lines`, and sets `compile.exclude` to `lib/**` in `.config/readyup.config.ts` so that `rdy compile` inlines the module into the `default` bundle rather than building it as a kit. (#194)

### 🧪 Tests

- Prevent flaky post-teardown scheduler error in unit test (#69)

  Fixes an issue where the `nextjs` package's unit-test suite failed intermittently in CI with a spurious `ReferenceError: window is not defined`.

- Makes `template.unit.test.ts` in `_workspace` and `chrome` fail on a copy that keeps its template's package name or README title, where it previously compared the name with `workspace-template`, which no package uses, and passed on an unrenamed copy. (#150)
- Replaces `__tests__/test-tier-infixes.app.unit.test.ts` with `__tests__/test-file-conventions.app.unit.test.ts`, which calls nmr's `checkTestFileConventions()` to fail the test run on a test file outside `__tests__/` as well as on one whose tier segment is missing or misspelt. (#165)

### ⚙️ Tooling

- Prefix build log messages with package directory name (#20)

  Prefixes the build script's "changes detected" and "no changes detected" log messages with the package directory name and a visual icon (📦 for building, ⚪ for skipped), making multi-package builds and CI logs easier to scan.

- Create preflight collection for template drift detection (#22)

  Replaces the placeholder preflight collection with three checklists (`code-quality`, `repo-setup`, `test-migration`) that detect drift from template conventions. Adds tests for custom logic (compound boolean expressions, regex patterns, and helper functions). Configures eslint and preflight compilation to handle generated `.js` files and test file exclusion.

- Install and configure release-kit (#24)

  Replace `@changesets/cli` with `@williamthorsen/release-kit` for version management, changelog generation, and npm publishing. Scaffold release, publish, and sync-labels workflows via `release-kit init --with-config` and `release-kit sync-labels init`, all delegating to NMR reusable workflows.

  Replace the old `set-repo-labels.yaml` workflow and static `labels.yml` with release-kit's config-driven label management (`sync-labels`), which auto-discovers workspace packages for scope labels.

  Add preflight checks verifying `@williamthorsen/release-kit` is installed and `@changesets/cli` is not.

- Silence console output of successful tests

  Sets `test.silent: 'passed-only'` in the base Vitest configuration to silence a test's output unless the test fails.

- Regenerate label map with updated labels & schema ref
- Add readyup check and docs for AWS SAM CLI dependency (#36)

  Adds a readyup check that fails early with a clear message when the AWS SAM CLI, an external dependency required by the `cdk` package, is missing.

- Add a branch-protection CLI to require up-to-date status checks on main (#38)

  Adds a way to turn on branch protection for `main` from the command line in a repo created from this template. The protection requires a branch's checks to pass and the branch to be current with `main` before it can merge, and it holds admins to the same gate — closing the gap where two pull requests that each passed independently could both merge and leave `main` broken. The tool also reports which checks are required and shows the protection currently in effect, and it offers a dry run that prints exactly what it would change before anything is applied. It is safe to rerun and adds no new dependencies.

- Migrate the api build to nmr-compile (#41)

  Repos generated from this template now build their API package through a centralized, managed build instead of a build script copied into each repo — so a generated repo has no local build script to maintain and picks up build fixes by bumping its `@williamthorsen/nmr` version.

- Migrate to pnpm 11 with publish carve-outs and drift-kit signal (#49)

  Migrates the template monorepo to pnpm 11. Newly published first-party packages -- the `@williamthorsen/*` scope plus `readyup` and `v11y-check` -- now install immediately, while third-party packages must clear pnpm 11's default 24-hour hold, which guards against supply-chain attacks. The template's drift kit now flags repos built from it to make the same upgrade once they reach pnpm 11's Node floor, and to add the first-party carve-out once they are on pnpm 11.

- Add an on-demand pnpm-runtime doctor for corepack-shim bypass (#50)

  Adds an on-demand `pnpm-runtime-doctor.sh` script that reports whether `pnpm` in a repo actually runs through corepack — using the version pinned for the repo — or is being silently shadowed by a leftover asdf pnpm plugin. Running it with `--fix` repairs that shadowing across the machine so the pinned pnpm wins again, and the repair is safe to re-run. It catches machine-level shadowing that committed file-level checks cannot see.

- Replace npm-check-updates with taze for capped dependency upgrades (#57)

  Replaces npm-check-updates with taze as the repository's dependency-upgrade tool. Routine upgrades now run through `pnpm run taze`, which stays within the workspace's required version ceilings, and a deliberate major-version pass runs through `pnpm run taze:major`; both hold the Node type definitions and the TypeScript compiler at their required versions. Brand-new third-party releases are now held back for a seven-day supply-chain soak before being proposed for upgrade, while first-party packages are exempt.

- Add a reusable readyup checklist verifying projectService migration (#58)

  Adds a drift-kit check that lets repos on `@williamthorsen/eslint-config-typescript` v6 or later confirm they have finished the projectService migration. The check runs in the default `rdy` sweep or on its own via `rdy default:projectservice`, reporting whether the migration is complete and what still needs doing when it isn't. Repos not yet on v6 are left untouched.

- Generalize the runtime doctor to diagnose stranded asdf node shims (#66)

  Broadens the runtime doctor to check for global commands unavailable under the active node version. For each such command it says whether to remove a stale duplicate or reinstall, and prints the fix. The script is renamed from `pnpm-runtime-doctor.sh` to `node-runtime-doctor.sh`.

- Extend the drift kit with toolchain checks, migration guides, and a fleet sweep (#68)

  A new fleet sweep, `nmr drift:sweep`, reports in a single pass which repos derived from this template have drifted and on what, instead of checking each one by hand. Running the drift kit against a single repo now also flags an outdated TypeScript or ESLint config where it previously stayed silent, and each such warning links to a migration guide with the actual upgrade steps instead of a one-line summary. Repos freshly initialized from the template no longer inherit the maintainer's fleet tooling or a dead command.

- Migrate Vitest configs to the nmr projects model (#91)

  `nmr test:integration` now runs only the integration tests, and `nmr test` runs everything else; previously, the integration command silently ran every test. A package that carries its own Vite config but no Vitest config now fails a drift check. The repo root now requires Node 24.16.0.

- Upgrade to nmr v0.24 (#95)

  Upgrades several dependencies, notably `nmr` to 0.24. That upgrade changes Vitest configuration so that test suites are selected by a tier ("unit", "tool", "localhost", and "remote") corresponding to the services they use. `nmr test:unit` and `nmr test:tool` each run one of these; `nmr test:all` runs every suite. A test verifies that all test file names include the tier infix. `nmr test:integration` no longer exists, and no tests carry the `.int.` infix. The upgraded `nmr` includes a caching feature that skips checks that already succeeded against an identical working tree.

  Checks now bundled with `@williamthorsen/nmr` have been removed from the template repo's drift checks. The fleet-wide sweep now shows the number of errors and warnings for each repo in the fleet.

- Adopt in-house TS config for the ES2025 language level (#97)

  Every package now typechecks at ES2025, matching the repo's Node 24 floor.
  Two new strictness checks are added: Reading a property through an index signature now requires bracket notation or a type that declares the property, and unused parameters are now reported.

- Enable no-html-link-for-pages under repo-root lint runs (#113)

  Fixes `@next/next/no-html-link-for-pages`, which had silently stopped checking anything in `packages/nextjs`. The rule is set to `error`, but it reported no problems and the lint step passed, so nothing showed that it was broken.

  The cause was a relative path. `packages/nextjs/eslint.config.ts` set `settings.next.rootDir` to `'.'`, which the plugin resolves against the directory ESLint was started from. CI starts ESLint at the repo root, where there is no Next.js app to find, so the rule gave up. It now uses an absolute path and works from anywhere.

  Separately, the `chrome`, `nextjs`, and `react` ESLint configs read the React version from the installed package instead of a hardcoded number. All three numbers were out of date.

- Rewrite the node-runtime doctor for a standalone pnpm (#132)

  - Replaces the doctor's corepack assertions in `scripts/node-runtime-doctor.sh` with a classification of the `pnpm` that `PATH` resolves as `missing`, `corepack`, `asdf-pnpm`, `node-bin`, or `standalone`, each failing case printing its own remediation.
  - Extends `--fix` to delete the corepack-written `pnpm` and `pnpx` shims from the active node's `bin` and from every asdf nodejs install, restricted to symlinks resolving under `*/node_modules/corepack/*` so that a real `pnpm` binary beside them survives.
  - Adds a guard that skips the removal when the corepack shim is the machine's only `pnpm`, which the removal would otherwise delete, and a closing report that prints the standalone installer when a run ends with no `pnpm` on `PATH`.
  - Rewrites the pnpm prose in `README.md`, `scripts/README.md`, and `docs/migrations/pnpm-11.md` around the standalone installer and the `packageManager` pin, and adds `docs/migrations/pnpm-standalone.md`, linked from `scripts/README.md`, for moving a machine off corepack.

- Copy gitignored local files into new worktrees (#135)

  - Adds a `wt step copy-ignored` line to `.config/wt.toml`, in a `[[pre-start]]` block that blocks worktree creation and runs ahead of the dependency install, so that a new worktree starts with the machine-local agent and environment files that `.worktreeinclude` allowlists.
  - Bounds that copy with `--require-include`, which reduces the missing-allowlist case to a no-op instead of a copy of every gitignored path, and raises the worktrunk floor to 0.62.0.
  - Extends the drift kit with checks for the copy step, the allowlist, and a `[pre-start]` hook table, since worktrunk accepts `[post-create]` again as a silent alias for the background `post-start` hook.
  - Names `@williamthorsen/toolbelt.objects` in `.config/readyup.config.ts`, the one installed kit-publishing package that the config omitted from `rdy run --packages`.

- Drop eslint-plugin-import and enforce aliased-import extensions (#137)

  - Enforces the `@/**` alias convention in `packages/nextjs` with an override of the shared `import-x/extensions` rule, placed ahead of the shared config's `*/**` ignore, so that lint reports an aliased import that omits its extension.
  - Removes `eslint-plugin-import` and all uses of it.

- Adopt the published commonIgnores and toolIgnores lists (#138)

  - Replaces six hand-written ignore entries in `eslint.config.ts` with the `commonIgnores` and `toolIgnores` lists published by `@williamthorsen/eslint-config-typescript`.
  - Deletes the `**/*.js` override that switched `eslint-comments/no-unlimited-disable` and `unicorn/no-abusive-eslint-disable` off, which now covers no blanket disable and had exempted `.prettierrc.js`, `packages/nextjs/postcss.config.js`, and `packages/nextjs/scripts/run-dev-server.js` from both rules.

- Sweep the fleet from the repo registry rather than a committed manifest (#139)

  - Resolves the drift sweep's default fleet from the machine's repo registry, through `list-repos --tag nmr --json`, and deletes `.readyup/fleet.json`, the hand-kept manifest that had drifted from it.
  - Fixes `nmr drift:sweep`, which left the reason blank instead of reporting `no output` when a spawned command failed without writing to stderr.

- Adds a `typecheck:pre` hook to `packages/nextjs` that runs `next typegen`, and drops the tsconfig `exclude` entry that removed `.next/types`, so that `nmr typecheck` checks page and layout exports against the generated route types on a clean checkout. (#148)
- Removes the `webpack` hook, the `turbopack.resolveAlias` entry, the `--turbopack` dev flag, and `tailwind.config.ts` from `packages/nextjs`, each of which Next.js 16 or Tailwind 4 either ignores or makes redundant. (#148)
- Deletes `src/globals.d.ts` from `packages/nextjs`, because the file duplicated the stylesheet module declarations that Next.js provides and gave a `*.css` import a default export that a global stylesheet does not have. (#148)
- Regenerates `.github/labels.yaml` and `.meta/label-map.json` from their generators, which brings in the `common` preset's revised label descriptions and maps `deprecate` to `deprecation`, the label that `labels.yaml` defines. (#150)
- Replaces `tsx` with `node` in the `app` command of `cdk.json`, because the agent sandbox denies the IPC socket that `tsx` opens, and keeps the synthesized template identical. (#154)
- Enables `erasableSyntaxOnly` in `packages/cdk/tsconfig.json` so that syntax that Node cannot strip, such as an enum, fails `typecheck` rather than synth. (#154)
- Removes `tsc --build` from the package's `build` script, because it only repeated under `noEmit` the type check that `nmr typecheck` already performs. (#154)
- Declares in `packages/nextjs/package.json` the five ESLint plugins that the package's lint config loads, together with `@testing-library/dom`, which two of its dependencies take as a peer, and removes from the root `package.json` the four plugin declarations that root code does not load. (#156)
- Moves the `**/.next/**` ignore from the root `eslint.config.ts` into `packages/nextjs/eslint.config.ts`, so that a copy of the package does not lint its `next build` output when the copy's root config lacks the entry. (#156)
- Stops `pnpm install` from failing in a checkout whose `.git/hooks` is read-only by having the root `prepare` script run `lefthook check-install` first and call `lefthook install` only when the hooks are missing or stale. (#157)
- Runs `packages/api` from `src/index.ts` under Node's type stripping through `pnpm run start`, overriding `build` to a no-op and dropping the manifest's `exports`, `files`, and `prepare` compile, since nothing reads compiled output from a private application. (#159)
- Enables `erasableSyntaxOnly` and `verbatimModuleSyntax` in `packages/api/tsconfig.json`, as `packages/cdk` does, so that the typecheck rejects an `enum` or a value import of a type before Node's type stripping fails on it. (#159)
- Adds `scripts/repo-settings.ts`, a read-only report that prints, for every repo in the machine's registry, its visibility and whether the dependency graph, Dependabot alerts, Dependabot security updates, secret scanning, and push protection are on. (#160)
- Adds a repeatable `--repo <owner/name>` option to `scripts/repo-settings.ts`, which reports the named repos in place of the registry, including repos that the registry does not list. (#160)
- Turns off `rewriteRelativeImportExtensions` in the root `tsconfig.json` in place of the local overrides in `chrome` and `nextjs`, so that the typecheck in every package accepts the `.ts` extension on a `#src/` import. (#164)
- Points the `$schema` of `.meta/label-map.json` at the schema published by `@williamthorsen/change-grammar` at `change-grammar-v0.1.0`, replacing the `release-kit-v12.0.0` copy, which release-kit no longer publishes. (#169)
- Removes the `globalIgnores` entries for `.cdk.out/` and `.dist/` from `packages/cdk/eslint.config.ts` and for `.next/` from `packages/nextjs/eslint.config.ts`, which repeated what each package's `.gitignore` lists and what the root config already ignores. (#170)
- Removes the `code-quality` checklist from the drift kit, because the kit published by `williamthorsen/.github` now checks the callers of that repo's reusable code-quality workflow. (#173)
- Makes `nmr drift:sweep` run `williamthorsen/.github`'s kit, fetched from GitHub on every run, against each repo as well as the drift kit, summing both kits' results into the repo's row and reporting an `error` row that names the kit when either kit fails to run or to load. (#173)
- Declares a project release with `paths: ['**']` in `.config/release-kit.config.ts`, so that `release-kit` also versions, tags (`v<version>`), and writes a changelog for the repo root, including commits that touch only root files. (#178)
- Switches `scripts/drift-sweep.ts` and `scripts/repo-settings.ts` from the retired `list-repos` command to `thor-repo list`, which they run from the newly declared `@williamthorsen/repo-tools` devDependency rather than from the `PATH`. (#181)
- Changes `nmr drift:sweep` to sweep every registry repo whose detected stack contains `nmr`, in place of every repo tagged `nmr`. (#181)
- Upgrades `readyup` to 0.42.0 and makes the drift-kit check "readyup config names every installed kit-publishing package" read the `npm:` entries of the `sources` list in `.config/readyup.config.ts`, which replaced the `packages` list at readyup 0.40. (#183)
- Adds the drift-kit floor check "readyup 0.40.0+ is installed" and makes the kit skip its completeness check below that version, because an older readyup reads the config's `packages` list rather than its `sources` list. (#183)
- Upgrades `@williamthorsen/release-kit` to 14.2.4 and resolves the warnings from its readyup kit by regenerating the release and label-sync workflows and `.github/labels.yaml`, which adds the `confidence:high`, `confidence:medium`, and `confidence:low` labels, and by removing the scope labels' descriptions. (#183)
- Pins awscli 2.38.4, Node.js 24.22.1, and Python 3.15.1 in `.tool-versions`. (#183)
- Changes the default of `protect --checks` from `code-quality / Code quality`, which the code-quality workflow no longer reports, to the four leg contexts `code-quality / build`, `/ lint`, `/ static`, and `/ test`, so that `protect` run without `--checks` resolves its default again. (#184)
- Adds a unit test that compares the default checks with the legs declared in `.github/workflows/code-quality.yaml`, so that adding, renaming, or removing a leg fails the test run until the default follows. (#184)
- Adds a root `nmr lint:shell` command, which runs `shellcheck` over every tracked `*.sh` file, and a `shell` leg in `.github/workflows/code-quality.yaml` that runs it. (#186)
- Adds `code-quality / shell` to the checks that `protect` requires by default. (#186)
- Fixes the SC2181 finding in `apps/cdk/scripts/build-sam.sh` and the SC2015 finding in `scripts/node-runtime-doctor.sh`. (#186)
- Sets `trustPolicy: no-downgrade` in `pnpm-workspace.yaml`, so that pnpm refuses to install a release whose provenance is weaker than that of an earlier release of the same package, and exempts `semver@6.3.1`, which `@babel/core` and `eslint-plugin-react` require. (#188)
- Moves `build:sam` from the cdk `build` script to the `dev` script, so that `nmr build`, `nmr ci`, and `nmr prepush` no longer require the AWS SAM CLI. (#195)
- Lowers the severity of the `sam` check in the readyup `cdk` kit from `error` to `warn`, because only the local API scripts use the SAM CLI now. (#195)
- Upgrades `@williamthorsen/nmr` from 0.54.0 to 0.55.0 and deletes the `lint:shell` entry from `.config/nmr.config.ts`, so that `nmr lint:shell` runs nmr's built-in command, which lints every tracked `*.sh` file with nmr's pinned shellcheck and passes when the repo tracks none. (#197)

### 👷 CI

- Adopt code-quality workflow v6 and extend the drift kit for consumer migration (#47)

  Adopts the latest shared code-quality workflow (v6). Because v6 makes run concurrency the caller's responsibility rather than the workflow's, the template now sets its own concurrency policy so superseded runs are still cancelled. Repos scaffolded from this template are now warned by their drift check to do the same -- adopt v6 if still behind, or add the concurrency policy if already on it.

- Splits the `nmr ci` run in `.github/workflows/code-quality.yaml` into four parallel jobs (`build`, `lint`, `static` for the typecheck and format check, and `test`), and gives `build` a job of its own because no other job reads its output and it is the longest check. (#175)
- Adopts the actionlint step of the `@v8` reusable workflow, which fails a pull request on a workflow file that GitHub would reject. (#175)
- Adds a `workflows` leg to `.github/workflows/code-quality.yaml` that runs `nmr lint:workflows`, and adds `code-quality / workflows` to the checks that `protect` requires by default. (#188)

### 📦 Dependencies

- Upgrade all dependencies and patch security vulnerabilities (#19)

  Upgrades all monorepo dependencies to their latest minor/patch versions and patches known security vulnerabilities in dev dependencies. Updates the audit-ci allowlist to reflect the current vulnerability landscape, removing resolved advisories and adding one new transitive advisory. Includes minor lint fixes in the React package to remove redundant type annotations.

- Upgrade all dependencies to latest, adopt eslint-config v6, and drop Node 18/20 (#54)

  Refreshes the template toolchain: Every dependency moves to its latest version, apart from deliberate holds on typescript, @types/node, and pnpm. Linting moves to ESLint 10 and @williamthorsen/eslint-config-typescript v6.

  Two changes are breaking for template consumers. The template now requires Node ^22.13.0 || >=24, dropping the end-of-life Node 18 and 20 lines. And consumers who maintain their own ESLint setup must add @eslint/js as a dev dependency and remove both their parserOptions.project setting and their tsconfig.eslint.json file, since v6 no longer needs a separate lint-only tsconfig per package.

- Bump Node.js to v24 (#73)

  Repos derived from this template now require Node 24 or later; Node 22 is no longer supported. The drift kit now flags a derived repo still on an earlier Node and points it to a new migration guide.

- Upgrade eslint-config-typescript to v10 and give each package its own dependencies (#107)

  Upgrades `@williamthorsen/eslint-config-typescript` to v10 and fixes lint violations surfaced by newly activated rules. Removes the root `package.json`'s `workspaces` field, which had been preventing detection of extraneous imports, and replaces inheritance from the root with explicit declarations and a pnpm catalog to pin multiple consumers to the version.

  Separately, `.readyup/kits/default.ts` retires the `projectservice` checklist and the eslint-config checks that v10's own kit ships, and resolves `catalog:` specifiers so its remaining version floors still read a catalogued dependency.

- Upgrade vite to 8.3.0 and collapse the duplicate resolution (#131)

  - Moves the `vite` catalog entry in `pnpm-workspace.yaml` from 8.2.2 to 8.3.0 and runs `pnpm dedupe`, which re-resolves `astro@7.3.2` onto 8.3.0 instead of leaving the 8.2.2 copy that astro's non-peer `vite` dependency kept alive.
  - Clears the ts(2379) error that `nmr typecheck` reported in `packages/astro/vitest.config.ts`, where astro's `getViteConfig`, typed against 8.2.2, received a config typed against 8.3.0.

- Removes `tsx` from the root manifest and `source-map-support` from `packages/cdk`, which the app no longer uses once it runs under Node's type stripping. (#154)
- Removes the `eslint-plugin-jest-dom>eslint` peer rule from `pnpm-workspace.yaml`, because `eslint-plugin-jest-dom` 5.10.1 already accepts `eslint` 10. (#156)
- Upgrades `@williamthorsen/nmr` from 0.43.0 to 0.44.0 and `codeassembly` from 0.16.0 to 0.17.0, whose root lint commands and `generate label-map` find the workspaces through the `pnpm-workspace.yaml` globs rather than through the `packages/` name. (#180)
- Upgrades the dependencies to their latest releases, including pnpm 12.14.0, `@williamthorsen/nmr` 0.50.0, and `@williamthorsen/tsconfig` 0.12.0, and holds `lefthook` at 2.2.1 because 2.2.2 was published from a maintainer's account without provenance. (#183)
- Upgrades `@williamthorsen/eslint-config-typescript` from 18.0.0 to 20.1.2, rewrites the code that its new eslint-plugin-unicorn 78 rules report, and adds `.config/strict-lint.config.ts` to keep the advisory `max-lines` rule a warning rather than a gate failure. (#183)
- Upgrades `@williamthorsen/repo-tools` from 0.1.0 to 0.2.1 and adds `--clone all` to the `thor-repo list` call in `scripts/repo-settings.ts`, because `thor-repo list` 0.2 lists only the repos cloned on the current machine by default. (#183)
- Upgrades `@williamthorsen/nmr` to 0.52.0, `@williamthorsen/release-kit` to 15.0.2, `next` to 16.4.2, and the other dependencies to their latest releases, and keeps `lefthook` at 2.2.1 because 2.2.2 was published without provenance. (#188)
- Upgrades `vitest` and `@vitest/coverage-v8` from 4.1.12 to 5.0.5 and removes the hold in `taze.config.ts` that kept them at v4. (#188)
- Deduplicates `pnpm-lock.yaml` to move the `zod` used by `apps/nextjs` onto 4.6.7, which resolves GHSA-mrhx-c7xc-m3w5, and removes the `braces` entry from the dev allowlist in `.config/v11y-check.config.json`, which the audit no longer needs. (#188)
- Upgrades `readyup` from 0.44.0 to 0.45.0, the version that compiled the kit in nmr 0.55.0, which warns when an older readyup runs it. (#197)
- Upgrades all dependencies to their latest versions. (#200)
- Replaces `jsdom` 30.1.3 with `happy-dom` 21.0.4 in the catalog and in the `react` and `nextjs` apps, whose Vitest configs and `@vitest-environment` control comments now select `happy-dom` as the test environment. (#201)
- Removes `jsdom` from the dev dependencies of `chrome` without adding `happy-dom` in its place. (#201)

### 🤖 Agentic support

- Make initialize-node-monorepo skill agent-agnostic (#34)

  Relocates the `initialize-node-monorepo` skill from `.claude/skills/` to `.agents/skills/` so it is discoverable by any coding agent, not only Claude. The README now directs developers to invoke the skill by its explicit path instead of the prior `/initialize-node-monorepo` slash command. The skill no longer removes itself at the end of initialization; it now reports completion and leaves deletion of the skill directory to the developer.

- Add package-keyed residue cleanup to initialize-node-monorepo (#63)

  The `initialize-node-monorepo` skill now instructs agents to clean up configuration entries keyed to packages removed during initialization: pruning workspace build and dependency-version rules no longer backed by the lockfile, regenerating the vulnerability allowlist, and reporting orphaned root development dependencies as removal candidates for the user to confirm. The skill's closing residue audit is now also directed to sweep for path references to removed packages, which previously survived initialization.

- Migrate the template off `.agents/PROJECT.md` (#101)

  Project guidance moves from `.agents/PROJECT.md` to `AGENTS.md` at the repository root, where both supported coding harnesses find it. Repositories still holding guidance at the old location are now named by the fleet drift sweep, which links a step-by-step migration guide.

- Drop the nmr restatement from AGENTS.md's Testing section (#111)

  Cuts the passages of `AGENTS.md`'s Testing section that restate `@williamthorsen/nmr`'s test-tier convention, which nmr's own ambient rulebook and README carry, and names nmr as the convention's owner. What survives is this repo's own: the inventory of its seven Vitest configs and the rule for when a package needs one.

- Drop the nmr restatement from AGENTS.md's Commands section (#112)

  Cuts the passages of `AGENTS.md`'s Commands section that restate `@williamthorsen/nmr`'s invocation rules. These are contained in nmr's own ambient rulebook and available in the terminal (bare `nmr` command).

  Also corrects the description of `.github/workflows/audit.yaml`. That workflow runs on every pull request to `main` or `next` as well as on its daily schedule. It performs the audit through a reusable workflow, and not through `nmr audit`.

- Branch the initialize skill on host and owner, and widen its config cleanup (#116)

  Revises the `initialize-node-monorepo` skill to treat a repo differently if its host or owner differ from the template's. If the host is other than GitHub, all GitHub workflows and the `gh`-dependent branch-protection CLI are deleted. If the owner differs from the template's, the derived repo takes its own `author` across every manifest and CODEOWNERS.

  The package-keyed config cleanup is extended to clean three additional surfaces: `pnpm-workspace.yaml`'s `catalog:`, `tsconfig.json`'s `include`, and `eslint.config.ts`'s `globalIgnores`.

- Changes the label step of the `initialize-node-monorepo` skill to regenerate `.meta/label-map.json` with `codeassembly generate label-map --force` rather than edit it by hand, and names `release-kit sync-labels generate` as the command for `.github/labels.yaml`. (#150)
- Sets `agentRules: false` in `packages/nextjs/next.config.ts` to stop `next dev` from writing `AGENTS.md` and `CLAUDE.md` into the package when an AI coding agent runs it, so that the root `AGENTS.md` remains the only source of agent guidance. (#152)
- Directs step 4 of `initialize-node-monorepo` to rewrite the references to the removed drift kit and `docs/migrations/` in `scripts/README.md` and, when the cdk package is kept, in `.readyup/kits/cdk.ts`, and to point the `pnpm-standalone.md` link at the guide in the template repository. (#158)
- Adds a sweep to step 9 of `initialize-node-monorepo` that reports surviving references to `docs/migrations`, `kits/default`, the drift kit, and the drift sweep, none of which the template-string grep matches. (#158)
- Describes `api` and `cdk` in `AGENTS.md` as running their `.ts` sources under Node's type stripping, and `nmr compile` as the build for a package that publishes a library rather than for `api`. (#159)
- Adds an "Intra-package imports" section to `AGENTS.md` that states the `#src/*` convention: A package declares it in `package.json` `imports`, or in tsconfig `paths` if it is a compiled library, and an import of a file under `src/` uses `#src/` rather than climbing with `..`. (#163)
- Changes the template-residue check in the `initialize-node-monorepo` skill to look for a `## 1.3.0` section in `CHANGELOG.md` instead of a `# node-monorepo` header, which the first project release replaces. (#178)
- Updates the `initialize-node-monorepo` skill to offer the directories under both `apps/` and `packages/` for removal and to keep both globs in `pnpm-workspace.yaml` even when a directory is left empty. (#180)
- Declares the project's stage as `maturity: early`, `sensitivity: low`, and `audience: team` in `.agents/preferences.yaml`. (#183)

### 📚 Documentation

- Update documentation to reflect nmr adoption (#30)

  Rewrites the README files to document `nmr` as the workspace script runner, replacing instructions for `pnpm run` commands that no longer exist. Every package now has a README, including the `api` and `react` packages, which previously had none.

- Adds `docs/new-package.md`, which lists every file and field that a copied package must change in its own directory and in the repo, and links to it from the root README and every package README. (#150)
- Describes `api` in the root README and in `packages/api/README.md` as running from its sources, with `pnpm run start` as its run command and `build` dropped from the package's listed workspace scripts. (#159)
- Rewrites `docs/new-package.md` as a guide to starting an app from a starter under `apps/` or a library from `packages/_workspace`, with a copy step that copies only the template's committed files, leaves out its `CHANGELOG.md`, and writes into an existing target directory without nesting a second one. (#180)
- Replaces readyup's removed `rdy run --packages` flag with `rdy run --sources` in the README, `AGENTS.md`, the migration guides, and the `initialize-node-monorepo` skill. (#183)
- Corrects `apps/cdk/scripts/notes.md`, which named a nonexistent `build:cdk:sam` script and the input directory `cdk.out/`, to name `build:sam` and `.cdk.out/`. (#195)
- Adds a "Publish the library" section to `docs/new-package.md`, which lists the `package.json` changes that a library copied from the private `packages/_workspace` scaffold needs before `release-kit prepare` accepts its first release, and points to `pnpm exec rdy run --sources` for the remaining shipping requirements. (#200)

## 1.3.0

### Refactoring

- Aligned tooling & conventions with latest projects

## 1.2.6

### Dependencies

- Upgraded all dependencies to latest version

## 1.2.5

### Dependencies

- Upgraded all dependencies to latest version

## 1.2.4

### Dependencies

- Upgraded all dependencies to latest version

## 1.2.3

### Tooling

- Automated the resolution of TypeScript aliases in Vitest by adding `vite-config-paths` to the Vitest config.

### Dependencies

- Upgraded all deps to latest version

## 1.2.1

### Dependencies

- Upgraded all dependencies to latest version
- Updated all runtimes to latest minor version

## 1.2.0

### Tooling

- Added a `chrome` workspace to the monorepo

## 1.1.0

### Dependencies

- Upgraded all dependencies to the latest version

### Refactoring

- Fixed lint in scripts caused by stricter linting rules and dependency upgrades

## 1.0.9

### Tooling

- Removed shebang from `scripts/run-workspace-script`; it is now run through `tsx`

### Dependencies

- Upgraded all dependencies to latest version

## 1.0.6

### Tooling

Removed unneeded type guards from Vitest configuration files.

### Dependencies

Upgraded all dependencies to latest minor version.

Upgraded all runtimes to latest version but downgraded Node.js runtime to latest v18.x.x, because AWS CDK does not yet support v20.

## 1.0.2

### Dependencies

- Upgraded all dependencies to latest version
- Replaced `c8` with Vitest's `v8` coverage engine

### Utility

- Added a `strict-lint.ts` script to treat all linter warnings as errors

### Tooling

- Added an audit wrapper to allow whitelisting of vulnerabilities
- Simplified Vitest configs
- Added `lint:strict` manifest script
- Added strict linting and coverage checking to the `check` manifest script

## 1.0.1

### Dependencies

- Upgraded all deps to latest version

<!-- Generated by release-kit. Do not edit this file. Use .meta/changelog-overrides.json to override entries. -->
