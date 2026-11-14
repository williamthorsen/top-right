# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-11-14

### 🎉 Features

- Fit the matrix to the chart area by default (#55)

  Makes the chart open in Fit, which scales the matrix to the chart area, and refit the matrix each time that area changes size until a manual zoom turns Fit off, and changes the zoom readout to show "Fit" while Fit is on.

- Replaces the 1-to-5 urgency and impact scores with four named levels, `low` to `critical` for urgency and `questionable` to `must-have` for value (formerly impact), which the chart draws as a 4×4 matrix and `top-right write-scores` accepts by name. (#56)
- Lets one of an issue's labels, such as `value:must-have`, supply its urgency or value level when the author or an agent has not stored a score for that axis, so that the chart places the issue in a cell rather than in a gutter. (#57)
- Adds a section to the Settings page that edits the labels that supply each urgency and value level, and refuses a label listed under two levels. (#57)
- Adds the scores that labels supply to the output of `top-right list-items`, marked by `by: "label"` and the label in the JSON and by `(label)` after the level in the text. (#57)
- Adds an Effort section to the score-label form on the Settings page, which maps the user's own labels to each point value from 1 to 13. (#59)
- Makes the local host read the GitHub issues at startup and serve each load of the chart from that read rather than reading every configured repository first, and has the page read the issues again in the background once they are more than a minute old. (#60)
- Makes the local host write the urgency, value, and effort that the author sets or keeps on the chart to the issue's GitHub labels, and refuse a level whose label the repository lacks rather than create the label. (#61)
- Makes `top-right write-scores` skip a score equal to the one that the item already has, from the store or from a label, and report each change from that score. (#61)
- Makes the standalone host show an open GitHub issue labelled `status:in-progress` as In progress, and add or remove that label at GitHub when the author sets In progress or To do in the detail pane, instead of storing the status as an override that only the app can see. (#62)
- Adds a `project` key to a repository's entry in `config.local.json`, which makes the standalone host read the repository's status from that GitHub Project's Status field and write a status set in the pane there, adding the issue to the project when it is not yet an item. (#63)
- Adds a top-level `projects` map to `config.local.json`, which lists a project's To do and In progress Status options when they differ from GitHub's `Todo` and `In Progress`, and from which a write sets the first option of each list. (#63)
- Adds a startup warning when a classic GitHub token lacks a scope that the pane's writes need: `project` for a repository that names a project, or `repo` or `public_repo` for a repository that tracks status by label. (#63)
- Default to an uppercase repo prefix and unhyphenated level names (#67)

  Uppercases the default repository abbreviation, so a circle's id reads `T.11` rather than `t.11`, and removes the hyphens from the names that the chart shows for the value levels.

- Adds a header to the chart and Settings pages of the standalone host, shown also while a page loads or fails to load, with the product's name and Chart and Settings links that keep the selected item, replacing the Settings link in the chart strip and the Chart link on the Settings page. (#68)
- Adds a read-only Repositories section to the Settings page, which lists the configured repositories and names the config file in which to edit `repos` before restarting the host. (#68)
- Changes the standalone host to save the chart's magnification in the browser's local storage and restore it on reload, falling back to 100 % when the stored value is not one of the zoom steps. (#71)
- Adds the `top-right seed-abbreviations [--dry-run] <owner/name=ABBR>...` command, which sets the abbreviation of each named repository that does not have a stored one, keeps each stored one, and exits with code 2 without writing anything when a pair is malformed, a repository appears twice, a repository is not configured, an abbreviation is invalid, or an abbreviation that it sets would match another configured repository's. (#72)
- Adds a Collections section to the Settings page, in which a user creates, renames, edits, and deletes named groups of the configured repositories and chooses a default collection, and saves both per user in the store. (#78)
- Replaces the chart's repo select with a Repos menu of checkable collections and repositories, whose union the chart shows, and starts the chart at the default collection on each load rather than at every repository. (#78)
- Makes the standalone host read a repository from GitHub only once the chart shows it, so that the first load waits only for the default collection's repositories and the repository of the item that the URL selects, and the background refresh and the Refresh button read only the shown repositories. (#85)
- Adds a clear button (×) to each score control in the detail pane, which returns that score to unset and, on a host that writes labels, removes the dimension's score labels from the issue. (#96)
- Hide labels that the detail pane already shows (#99)

  Leaves out of the detail pane's Labels list each label that decides a displayed urgency, value, or effort, the Type row, or the In progress status, because the pane already shows those values elsewhere. Keeps in the list a label that lost to a stored score or to another label, because the list is then the only place in the pane that shows the conflict.

- Draw a hidden done item as a done circle (#103)

  Draws a hidden done item at the end of a shown edge as a done circle, with the done fill and its work-type border, rather than as the dashed grey outline that the chart drew before; the circle still reveals the item when activated.

### ♻️ Refactoring

- Renames `apps/local` to `apps/standalone` and its package to `@top-right/standalone`, and removes the `eslint.config.ts` exception that kept the shared `**/local/**` ignore from skipping the app. (#39)
- Moves the item and settings routes of `createApiHandler`, with their `/api/` path constants and the helpers that they share, out of `api.ts` into `item-routes.ts` and `settings-routes.ts`, which share the `Route` and `RouteTable` types declared in `route-table.ts`. (#81)
- Splits the SQLite store's `MIGRATIONS` array into `sqlite-migrations.ts` and its setting names and zod schemas into `sqlite-settings.ts`, which leaves `sqlite-store.ts` with only the store logic and under the 300-line `max-lines` limit enforced by `nmr lint:strict`. (#82)
- Replaces the inline `error instanceof Error ? error.message : String(error)` checks and the two local `describeError` helpers in the server and CLI of `apps/standalone` with `describeError` from `@williamthorsen/toolbelt.errors`, which returns `String(error)` for an `Error` whose message is empty, and renames the client's helper to `describeRequestError`, which still returns "the host did not respond" for a `TypeError`. (#107)

### 📦 Dependencies

- Upgrades Node.js from 24 to 26 by pinning 26.13.1 in `.tool-versions`, raising the `engines.node` floor to `>=26` in the root and every workspace manifest, and moving `@types/node` in the catalog from 24.19.2 to 26.6.6. (#105)

### 📚 Documentation

- Defines each urgency and value level for a scorer in `apps/standalone/docs/scoring.md`, and records in `docs/design.md` why the axes use four named levels. (#56)

<!-- Generated by release-kit. Do not edit this file. Use .meta/changelog-overrides.json to override entries. -->
