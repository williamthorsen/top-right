<!-- readme-type: application -->

# Local host

Serves the Top Right chart of the open issues of a configured set of GitHub repositories from a local process.

<!-- section:release-notes --><!-- /section:release-notes -->

## Run it

```shell
cp apps/local/config.example.json apps/local/config.local.json   # then list the repositories
pnpm --filter @top-right/local start
```

Open <http://localhost:4310/>. Set `PORT` to serve on another port. Each page load reads the issues afresh from GitHub.

## Configure the first run

`config.local.json` is gitignored, and a new worktree receives a copy through `.worktreeinclude`. It lists the repositories to read:

```json
{
  "repos": [
    { "repo": "williamthorsen/top-right" },
    { "repo": "williamthorsen/codeassembly", "abbreviation": "ca" }
  ]
}
```

A circle's id is the repository's abbreviation and the issue number, such as `t.11`. The abbreviation defaults to the first letter of the repository's name. The host refuses to start while two repositories share an abbreviation, so give an `abbreviation` to each repository whose name starts with the same letter as another's.

The GitHub token comes from `GITHUB_TOKEN` or, when it is unset, from `gh auth token`, so `gh auth login` is the only setup that the first run needs.

## Where the scores live

The scores, status overrides, and visits that the page writes are kept per GitHub user in a SQLite file outside the repository, so that every worktree reads the same scores: `$XDG_DATA_HOME/top-right/top-right.sqlite`, or `~/.local/share/top-right/top-right.sqlite` when `XDG_DATA_HOME` is unset. Set `TOP_RIGHT_DB` to keep them in another file, such as a scratch copy for a trial run. The host prints the path when it starts.
