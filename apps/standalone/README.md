<!-- readme-type: application -->

# Local host

Serves the Top Right chart of the open and recently closed issues of a configured set of GitHub repositories from a local process.

<!-- section:release-notes --><!-- /section:release-notes -->

## Run it

```shell
cp apps/standalone/config.example.json apps/standalone/config.local.json   # then list the repositories
pnpm --filter @top-right/standalone start
```

Open <http://localhost:4310/>. Set `PORT` to serve on another port. Each page load reads the issues afresh from GitHub.

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

`closedWindowDays` sets how many days back from each page load the host reads closed issues, by the date each was closed. It defaults to 30, and 0 reads none. The chart hides closed items until the Done filter is on, and draws a ghost for one at the end of a shown edge.

A circle's id is the repository's abbreviation and the issue number, such as `t.11`. The abbreviation defaults to the first letter of the repository's name and is changed on the Settings page, which also edits the labels that assign each work type and the labels that supply each urgency and value level. While two repositories share an abbreviation, the chart shows an alert that links to Settings. The host ignores an `abbreviation` field in the config file and names the repositories that still set one when it starts.

The GitHub token comes from `GITHUB_TOKEN` or, when it is unset, from `gh auth token`, so `gh auth login` is the only setup that the first run needs.

## Score the backlog with an agent

An agent writes scores through the `top-right` CLI, and the chart marks each one for the author to keep or correct. [`docs/scoring.md`](docs/scoring.md) states what each score means.

```shell
pnpm --filter @top-right/standalone top-right list-items --json > items.json             # read the open issues and their scores
pnpm --filter @top-right/standalone top-right write-scores --dry-run scores.json         # report what would change
pnpm --filter @top-right/standalone top-right write-scores scores.json                   # write the scores as the agent's
```

An issue whose label maps to an urgency or value level, such as `value:must-have`, is placed at that level until a score is stored for it; [`DEFAULT_SCORE_LABEL_MAPPING`](../../packages/model/src/score-labels.ts) defines the default labels. `list-items` reports such a score with `by: "label"` and the label in its JSON, and with `(label)` after the level in its text.

`scores.json` is a JSON array of `{ "itemKey": "owner/name#number", "scores": { "urgency": "high", "value": "should-have" } }`. `top-right write-scores --help` lists the accepted values. Set `TOP_RIGHT_DB` to trial a run on a copy of the store.

## Where the scores live

The scores, status overrides, visits, and settings that the page writes are kept per GitHub user in a SQLite file outside the repository, so that every worktree reads the same scores: `$XDG_DATA_HOME/top-right/top-right.sqlite`, or `~/.local/share/top-right/top-right.sqlite` when `XDG_DATA_HOME` is unset. Set `TOP_RIGHT_DB` to keep them in another file, such as a scratch copy for a trial run. The host prints the path when it starts.
