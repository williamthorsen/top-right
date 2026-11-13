<!-- readme-type: application -->

# Local host

Serves the Top Right chart of the open and recently closed issues of a configured set of GitHub repositories from a local process.

<!-- section:release-notes --><!-- /section:release-notes -->

## Run it

```shell
cp apps/standalone/config.example.json apps/standalone/config.local.json   # then list the repositories
pnpm --filter @top-right/standalone start
```

Open <http://localhost:4310/>. Set `PORT` to serve on another port. The host reads from GitHub only the repositories that the chart shows: at start and on the first load, the default collection's repositories, or every repository without one, and each other repository when the chart first shows it. It serves each page load from its last reads. When a shown repository's issues are more than a minute old, the page reads them again in the background, and the Refresh button in the strip reads the shown repositories again at once.

## Configure the first run

`config.local.json` is gitignored, and a new worktree receives a copy through `.worktreeinclude`. It lists the repositories to read:

```json
{
  "repos": [
    { "repo": "williamthorsen/top-right" },
    { "repo": "williamthorsen/codeassembly" }
  ]
}
```

The host reads the file when it starts, so a change to it takes effect at the next start. The Settings page lists the repositories and the path of the file that the host read.

`closedWindowDays` sets how many days back from each read the host reads closed issues, by the date each was closed. It defaults to 30, and 0 reads none. The chart hides closed items until the Done filter is on, and draws one at the end of a shown edge as a done circle, which reveals the item when activated.

A circle's id is the repository's abbreviation and the issue number, such as `T.11`. The abbreviation defaults to the uppercase first letter of the repository's name. `top-right seed-abbreviations` sets the abbreviations of repositories that do not have one yet, and the Settings page changes them. The Settings page also edits the labels that assign each work type and the labels that supply each urgency level, value level, and effort. While two repositories share an abbreviation, the chart shows an alert that links to Settings. The host ignores an `abbreviation` field in the config file and names the repositories that still set one when it starts.

The Settings page also defines collections, named groups of the configured repositories, and the default collection. The chart's Repos filter selects collections and repositories and shows their union, and the chart opens with the default collection after each reload, or with every repository without one. [`docs/design.md`](../../docs/design.md#filter-and-fade) states the reasons.

An open issue labelled `status:in-progress` shows as In progress, and setting In progress or To do in the pane adds or removes that label; [`IN_PROGRESS_LABEL`](../../packages/adapter-github/src/status-strategy.ts) names it. The repository must have the label, which release-kit's common label preset defines: The host never creates one, and it refuses the write with a message that names the missing label.

A repository whose entry names a GitHub Project by its URL takes its status from the project's Status field instead, and setting a status in the pane sets the field, adding the issue to the project when it is not yet an item. [`DEFAULT_PROJECT_STATUS_OPTIONS`](../../packages/adapter-github/src/project-status.ts) names the options that read as To do and In progress; `projects` lists a project's own, and a write sets the first of each list:

```json
{
  "projects": {
    "https://github.com/users/LOGIN/projects/1": { "toDo": ["Backlog", "Todo"], "inProgress": ["In Progress"] }
  },
  "repos": [
    { "repo": "williamthorsen/top-right", "project": "https://github.com/users/LOGIN/projects/1" },
    { "repo": "williamthorsen/codeassembly" }
  ]
}
```

A project needs the token's `project` scope, which `gh auth login` does not grant: Run `gh auth refresh --scopes project`. The host refuses to start when it cannot read a configured project or a listed option, and [`docs/design.md`](../../docs/design.md) states how a project's status and the pane's override combine.

The GitHub token comes from `GITHUB_TOKEN` or, when it is unset, from `gh auth token`, so `gh auth login` is the only setup that the first run needs.

## Score the backlog with an agent

An agent writes scores through the `top-right` CLI, and the chart marks each one for the author to keep or correct. [`docs/scoring.md`](docs/scoring.md) states what each score means.

```shell
pnpm --filter @top-right/standalone top-right list-items --json > items.json             # read the open issues and their scores
pnpm --filter @top-right/standalone top-right write-scores --dry-run scores.json         # report what would change
pnpm --filter @top-right/standalone top-right write-scores scores.json                   # write the scores as the agent's
pnpm --filter @top-right/standalone top-right seed-abbreviations owner/name=ABBR ...     # set abbreviations not yet stored
```

An issue whose label maps to an urgency or value level, such as `value:must-have`, is placed at that level until a score is stored for it, and one whose label maps to an effort, such as `effort:5`, is drawn at that size until an effort is stored for it; [`DEFAULT_SCORE_LABEL_MAPPING`](../../packages/model/src/score-labels.ts) defines the default labels. `list-items` reports such a score with `by: "label"` and the label in its JSON, and with `(label)` after the score in its text.

`scores.json` is a JSON array of `{ "itemKey": "owner/name#number", "scores": { "urgency": "high", "value": "should-have" } }`. `top-right write-scores --help` lists the accepted values. `top-right seed-abbreviations --help` states when a seed is refused. Set `TOP_RIGHT_DB` to trial a run on a copy of the store.

## Where the scores live

The scores, status overrides, visits, and settings that the page writes are kept per GitHub user in a SQLite file outside the repository, so that every worktree reads the same scores: `$XDG_DATA_HOME/top-right/top-right.sqlite`, or `~/.local/share/top-right/top-right.sqlite` when `XDG_DATA_HOME` is unset. Set `TOP_RIGHT_DB` to keep them in another file, such as a scratch copy for a trial run. The host prints the path when it starts.
