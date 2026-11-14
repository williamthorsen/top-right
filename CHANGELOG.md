# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-11-14

### 🎉 Features

- Adds the `@top-right/local` host, which reads the repositories listed in a gitignored `config.local.json`, fetches their open issues from GitHub with a token from `GITHUB_TOKEN` or `gh auth token`, and serves the chart at `http://localhost:4310/`. (#18)
- Adds the `Chart` React component to `@top-right/chart`, which lists unscored items in the matrix's gutter cells, scrolls a list that is taller than its cell, shows an item's details in a side pane on hover or selection, and renders the work-type legend. (#18)
- Adds `fetchOpenIssues` and `fetchOpenIssuesOfRepos` to `@top-right/adapter-github`, which read open issues as work items with their labels and their blocked-by, blocking, parent, and sub-issue relations, through a GraphQL request function supplied by the host. (#18)
- Adds the `WorkItem` type to `@top-right/model`, together with `classifyWorkType`, which maps an item's labels to a work type, and `formatIdLabel`, which builds a circle's id label such as `t.11`. (#18)
- Makes the chart place each scored item in the cell of its urgency and impact, size its circle by effort, and fill it by status, with an in-progress item shown as a pie of the remaining work, and adds a legend for the status fills and for the floor mark of an unsized item. (#20)
- Adds controls to the detail pane that set an item's status and its four scores, with a line under each score that names who set it and when, and adds the `Chart` props `onScoresChange` and `onStatusChange`, through which the chart reports each edit to the host. (#20)
- Makes the local host keep each GitHub user's scores, status overrides, and last visit in `$XDG_DATA_HOME/top-right/top-right.sqlite` (or `~/.local/share/top-right/top-right.sqlite`), a path that `TOP_RIGHT_DB` overrides. (#20)
- Makes the local page apply each score and status change at once and, when the host fails to write it, restore the previous value and show a dismissible alert. (#20)
- Adds the `@top-right/store` package, which declares the async `Store` interface for scores, status overrides, and visits and exports from `@top-right/store/testing` a conformance suite that each implementation runs against itself. (#20)
- Adds the `top-right` CLI, whose `list-items` command prints the open issues with their current scores and whose `write-scores` command writes a batch of agent scores and refuses the whole batch if any entry names an item that is not an open issue or contains a value outside the score's scale. (#21)
- Adds a review of agent scores to the chart: Each agent-scored item shows a halo, an item that the agent moved shows a dashed trail from its previous cell, a strip at the chart's top edge steps through the Agent-scored and Unscored queues, and Keep, Enter, or a correction turns the selected item's agent scores into the author's. (#21)
- Makes the chart draw an arrow for each blocker and a line for each sub-issue of the hovered or selected item, draw that item's blocker chain at reduced weight, and fade unrelated circles outside a review, and adds an "All edges" toggle with which the chart draws every edge faintly. (#24)
- Adds a dashed red ring that the chart draws around each blocked item in its cell and its gutter row, and adds ", blocked" to the end of that item's accessible name. (#24)
- Adds the next pick, chosen by the new `findNextPick` from the open, unblocked items that have urgency and impact scores, which the chart marks with a ring and the detail pane shows under "Next pick" while nothing is selected or previewed. (#24)
- Makes the chart ring the related circle while a relation row in the detail pane is hovered or focused, so that the row can be matched to its circle. (#24)
- Adds a "Relations" strip to the legend that names the blocker arrow, the sub-issue line, the blocked ring, and the next-pick ring. (#24)
- Adds the required `createdAt` field to `WorkItem`, which the GitHub adapter fills from each issue's creation date. (#24)
- Adds a Filter group to the chart's top strip, with a repo select and To do and In progress toggles that each show their count within the selected repo, and limits the matrix, the gutters, the next pick, and both review queues to the items that the filter keeps. (#29)
- Shows the issue number alone on circles and gutter rows while one repo is filtered, and keeps the abbreviated id in the detail pane, whose relation rows can name items of other repos. (#29)
- Adds a table of the filtered items below the chart, which sorts by any column and shares the chart's selection: Clicking a row selects its circle, and hovering a row rings it. (#30)
- Splits the height of the `Chart` container between the chart and the table with a divider that a drag or the arrow, Home, and End keys move, and stacks the two panes without a divider at 760 px wide or narrower. (#30)
- Adds the `selectedKey` and `onSelectedKeyChange` props to `Chart`, through which a host holds the selection and receives each change with `push: true` when the author made it and `push: false` when the chart made it, such as a review step, and widens the filter to show an item that a host-supplied key names. (#30)
- Keeps the selected item in the page URL's `item` parameter, so that a link to an item opens with the item selected and Back and Forward move between selected items. (#30)
- Exports `STATUS_ORDER`, the order in which work moves through the statuses, and `revealItem`, which returns an `ItemFilter` widened to keep a given item by adding the item's status and dropping a repo selection that excludes it. (#30)
- Adds a Settings page at `/settings` to the local host for editing the labels that assign each work type and each repository's abbreviation, which the host saves per GitHub user and applies to the chart's borders and ids, with a saved mapping replacing the default mapping whole and Settings refusing a label that two work types list. (#31)
- Adds a Mapping button to the chart's legend, which opens a popover that lists the labels assigned to each work type and links to Settings. (#31)
- Replaces the host's refusal to start while two repositories share an abbreviation with an alert above the chart that names the repositories and links to Settings, which refuses to save an abbreviation that clashes. (#31)
- Makes the local host read, on each refresh, the issues closed within the last `closedWindowDays` days, a setting in its config file that defaults to 30 and reads none at 0, and refuse to start when that value is negative or fractional. (#33)
- Adds a Done toggle to the chart's Filter group, which shows closed items and their count. (#33)
- Draws a ghost, a dashed outline, for a scored done item that the filter hides when it is at the end of a shown edge, and activating the ghost selects that item and shows it alone until the next filter change. (#33)
- Lets the author drag the selected circle or gutter row onto a scored cell, which sets the item's urgency and impact to that cell's and highlights the cell while the pointer is over it. (#35)
- Adds a "Remaining scope" toggle, off by default, to the strip above the chart; when it is on, the chart sizes each circle and its ghost by effort × (1 − progress) and fills an in-progress circle solid. (#35)
- Adds a "More" menu to the strip, whose "Longest blocker chain" item turns on a view that fades every item outside the longest chain of open blockers, draws the chain's edges at full weight, and shows the chain's length beside an "End chain view" button. (#37)
- Shows the To do, In progress, and Done status filters as filter chips: pills that show a check on an accent-tinted fill while on. (#53)
- Renders "All edges" as a switch, drawn as a track and thumb before its label, in place of a pressed-state button. (#53)
- Replaces the "Remaining scope" toggle with a "Scope" segmented control whose Original and Remaining segments are both visible and directly selectable. (#53)
- Adds a caret to the More button that points up while the menu is open, and stops the open button from taking the dark fill of a control that is switched on. (#53)
- Adds zoom to the chart in fixed steps from 50 % to 400 %, plus a Fit option that scales the matrix to the chart area, set through a zoom control in the strip, Ctrl or Cmd with the wheel, a trackpad or two-finger touch pinch, and the `+`, `-`, and `0` keys. (#54)
- Lets a mouse or pen drag on anything other than the selected circle pan the matrix while it is larger than the chart area, with a grab cursor, and leaves touch to the browser's own scrolling. (#54)
- Makes the chart open in Fit, which scales the matrix to the chart area, and makes Fit refit the matrix each time the window, the pane, or the chart and table divider changes the area's size, until a manual zoom turns Fit off. (#55)
- Changes the zoom readout to show "Fit" while Fit is on and the scale otherwise, and keeps the scale in the control's accessible name. (#55)
- Replaces the 1-to-5 urgency and impact scores with four named levels, `low` to `critical` for urgency and `questionable` to `must-have` for value (formerly impact), which the chart draws as a 4×4 matrix and `top-right write-scores` accepts by name. (#56)
- Lets one of an issue's labels, such as `value:must-have`, supply its urgency or value level when the author or an agent has not stored a score for that axis, so that the chart places the issue in a cell rather than in a gutter. (#57)
- Adds a section to the Settings page that edits the labels that supply each urgency and value level, and refuses a label listed under two levels. (#57)
- Adds the scores that labels supply to the output of `top-right list-items`, marked by `by: "label"` and the label in the JSON and by `(label)` after the level in the text. (#57)
- Lets an issue's effort label, by default one of `effort:1` through `effort:13`, set the size of its circle until the author or an agent stores an effort for it, with the larger effort applying when the issue has two such labels. (#59)
- Adds an Effort section to the score-label form on the Settings page, which maps the user's own labels to each point value from 1 to 13. (#59)
- Makes the local host read the GitHub issues at startup and serve each load of the chart from that read rather than reading every configured repository first, and has the page read the issues again in the background once they are more than a minute old. (#60)
- Adds an optional `refresh` prop of type `ChartRefresh` to `Chart`, which ends the strip with the time at which the items were read and a Refresh button that calls the prop's `onRefresh`. (#60)
- Makes the local host write the urgency, value, and effort that the author sets or keeps on the chart to the issue's GitHub labels, and refuse a level whose label the repository lacks rather than create the label. (#61)
- Makes `top-right write-scores` skip a score equal to the one that the item already has, from the store or from a label, and report each change from that score. (#61)
- Gives an agent score that replaces a label's level a trail from that level, which the score previously lacked. (#61)
- Makes the standalone host show an open GitHub issue labelled `status:in-progress` as In progress, and add or remove that label at GitHub when the author sets In progress or To do in the detail pane, instead of storing the status as an override that only the app can see. (#62)
- Adds a `project` key to a repository's entry in `config.local.json`, which makes the standalone host read the repository's status from that GitHub Project's Status field and write a status set in the pane there, adding the issue to the project when it is not yet an item. (#63)
- Adds a top-level `projects` map to `config.local.json`, which lists a project's To do and In progress Status options when they differ from GitHub's `Todo` and `In Progress`, and from which a write sets the first option of each list. (#63)
- Adds a startup warning when a classic GitHub token lacks a scope that the pane's writes need: `project` for a repository that names a project, or `repo` or `public_repo` for a repository that tracks status by label. (#63)
- Changes the default abbreviation of a repository to the uppercase first letter of its name, so an id reads `T.11` rather than `t.11`, while an abbreviation stored in Settings keeps the case in which it was entered. (#67)
- Renames the displayed value levels to "Must have", "Should have", and "Nice to have" on the axis, in the table, in the pane, and in Settings, while the level keys `must-have`, `should-have`, and `nice-to-have` keep their hyphens. (#67)
- Adds a header to the chart and Settings pages of the standalone host, shown also while a page loads or fails to load, with the product's name and Chart and Settings links that keep the selected item, replacing the Settings link in the chart strip and the Chart link on the Settings page. (#68)
- Adds a read-only Repositories section to the Settings page, which lists the configured repositories and names the config file in which to edit `repos` before restarting the host. (#68)
- Changes the chart to size the matrix's cells to fill the chart area down to a minimum cell size and to have the zoom control scale only the cells' contents, and removes the Fit entry from the zoom menu. (#71)
- Adds the optional `magnification` and `onMagnificationChange` props to `Chart`, which let a host hold the magnification, and exports `NATURAL_SCALE` and `ZOOM_STEPS` for validating a stored value. (#71)
- Changes the standalone host to save the chart's magnification in the browser's local storage and restore it on reload, falling back to 100 % when the stored value is not one of the zoom steps. (#71)
- Adds the `top-right seed-abbreviations [--dry-run] <owner/name=ABBR>...` command, which sets the abbreviation of each named repository that does not have a stored one, keeps each stored one, and exits with code 2 without writing anything when a pair is malformed, a repository appears twice, a repository is not configured, an abbreviation is invalid, or an abbreviation that it sets would match another configured repository's. (#72)
- Adds a Collections section to the Settings page, in which a user creates, renames, edits, and deletes named groups of the configured repositories and chooses a default collection, and saves both per user in the store. (#78)
- Replaces the chart's repo select with a Repos menu of checkable collections and repositories, whose union the chart shows, and starts the chart at the default collection on each load rather than at every repository. (#78)
- Makes the standalone host read a repository from GitHub only once the chart shows it, so that the first load waits only for the default collection's repositories and the repository of the item that the URL selects, and the background refresh and the Refresh button read only the shown repositories. (#85)
- Adds the `onShownReposChange` prop to `Chart`, which `Chart` calls on mount and whenever the set changes with the repositories that its filter shows, or with `undefined` when the filter shows every repository. (#85)
- Limits the ghosts that `Chart` draws, the dashed outlines of hidden done items at the ends of shown edges, to items in the repositories that its filter shows, so that what the chart draws depends on the filter alone and not on which repositories the host has read. (#85)
- Adds a clear button (×) to each score control in the detail pane, which returns that score to unset and, on a host that writes labels, removes the dimension's score labels from the issue. (#96)
- Limits the caption under a score row to an agent's score, with its date, and an unsized Effort, and removes the author, label, and points lines that the pane showed under the other rows. (#96)
- Makes a relation row in the detail pane select its item in the chart as a history entry and move focus to that item's title, and when the filter hides the item by status or by repository, the row reveals that item alone, as activating a ghost does. (#97)
- Marks a relation row whose item the chart was not given, such as one in a repository that the host has not read, with the external-link icon and a screen-reader note that it opens in a new tab. (#97)
- Fills the closed tag on a detail-pane relation row with the grey of a done circle and the blocked tag with the red of the blocked ring, so that the two tags no longer differ only in their text. (#98)
- Leaves out of the detail pane's Labels list each label that supplies a displayed urgency, value, or effort, decides the Type row, or marks the item In progress while the Status control shows In progress, and keeps each label that lost to a stored score or to another label. (#99)
- Adds a 150 ms fade to the detail pane's content each time the pane shows a different item, so that a change between similar items is visible; `DetailPane` skips the fade when the reader's system requests reduced motion. (#100)
- Lightens the fade on unrelated items while an item is hovered or selected from 25 % to 80 % opacity, so that the faded items no longer look disabled, and keeps the 25 % fade for a running review and the longest-chain view. (#102)
- Stops hovering or selecting an item from fading the board when the board doesn't show any of that item's related items as a circle, a gutter row, or a ghost. (#102)
- Draws a hidden done item at the end of a shown edge as a done circle, with the done fill, the item's work-type border, and the floor mark when the item is at the floor, in place of the dashed grey outline, which did not look like the item that it represented. (#103)
- Draws an item without an effort at the radius of 1 point with a border of round dots, in the matrix, the gutters, the ghosts, and the legend, and removes the inner ring that marked every circle raised to the minimum radius, so a small circle that has an effort is no longer marked. (#104)
- Removes the halo that marked an item with an agent score that the author has not reviewed, which the Agent-scored queue, the trail, and the detail pane's "Moved by the agent" note already show. (#104)
- Changes the Effort caption in the detail pane from "Unsized, drawn at the floor" and the legend entry for an unsized item from "Unsized, at the floor" to "Not sized, drawn as 1 point", which avoids "floor", a term that the interface never explained. (#104)

### 🪦 Removed

- Stops the host from reading the `abbreviation` field of its config file, and prints a startup notice that names each repository whose entry still sets it. (#31)
- Removes the next pick from the chart: the outer ring around the suggested item, the ", next pick" suffix on its accessible name, its legend entry, and the detail pane's "Next pick" mode, which leaves the pane reading "No item selected" until an item is hovered or selected. (#101)

### 🐛 Bug fixes

- Fixes the issue that a screen reader announced a pressed toggle, such as "All edges" or a status filter, as "✓ All edges" rather than by its label alone, although `aria-pressed` already reports the pressed state. (#32)
- Fixes the issue that hovering a pressed toggle did not change its border or fill. (#32)
- Fixes the issue that a mouse click on a row in the chart's gutter, the list of unscored items, often selected nothing or the wrong item in WebKit browsers such as Safari, because WebKit drew the rows away from where the chart had laid them out. (#36)
- Fixes the issue that the table's Progress column printed the stored fraction, such as "0.35 %", rather than the percentage. (#56)
- Fixes the issue that the chart drew a done work item with the to-do fill, by giving it a grey fill in the light and dark themes and adding a Done entry to the legend's status list. (#98)

### 🏗️ Internal features

- Removes the starter apps `apps/api`, `apps/cdk`, `apps/chrome`, `apps/nextjs`, and `apps/react`, together with the dependencies, catalog entries, and `scope:*` labels that only they used. (#3)
- Removes the template drift kit under `.readyup/`, its `nmr drift:sweep` command, and the migration guides under `docs/migrations/` that its fix messages linked to. (#3)
- Renames the root package to `top-right` and the scaffold to `top-right-workspace-template`, sets the project slug in `.agents/preferences.yaml` to `top-right`, and resets both packages to `0.0.0` with the template's release history cleared from their changelogs. (#3)
- Adds `filterItems` and `countByStatus` to `@top-right/model` so that every view filters items by repository and derived status in the same way, with `DEFAULT_ITEM_FILTER` keeping every repository's to-do and in-progress items. (#29)

### ♻️ Refactoring

- Renames `apps/local` to `apps/standalone` and its package to `@top-right/standalone`, and removes the `eslint.config.ts` exception that kept the shared `**/local/**` ignore from skipping the app. (#39)
- Moves the item and settings routes of `createApiHandler`, with their `/api/` path constants and the helpers that they share, out of `api.ts` into `item-routes.ts` and `settings-routes.ts`, which share the `Route` and `RouteTable` types declared in `route-table.ts`. (#81)
- Splits the SQLite store's `MIGRATIONS` array into `sqlite-migrations.ts` and its setting names and zod schemas into `sqlite-settings.ts`, which leaves `sqlite-store.ts` with only the store logic and under the 300-line `max-lines` limit enforced by `nmr lint:strict`. (#82)
- Extracts the chart's scrolling drawing surface from `Chart.tsx` into a `ChartCanvas` component, which brings `Chart.tsx` within the `max-lines` limit that `nmr lint:strict` enforces. (#83)
- Extracts `AbbreviationsForm`, `ScoreLabelMappingForm`, and `WorkTypeMappingForm` from `Settings.tsx` into modules of their own, with the shared `parseLabels` helper in `parse-labels.ts`, so that `Settings.tsx` falls below the `max-lines` limit. (#84)
- Replaces the inline `error instanceof Error ? error.message : String(error)` checks and the two local `describeError` helpers in the server and CLI of `apps/standalone` with `describeError` from `@williamthorsen/toolbelt.errors`, which returns `String(error)` for an `Error` whose message is empty, and renames the client's helper to `describeRequestError`, which still returns "the host did not respond" for a `TypeError`. (#107)

### ⚙️ Tooling

- Enables the React and jsx-a11y ESLint configs for `.tsx` files, and the Testing Library config for `.tsx` test files. (#18)
- Renames the `scope:local` label to `scope:standalone` in `.config/release-kit.config.ts` and `.github/labels.yaml`, listing `scope:local` as an alias so that the label sync renames the existing label in place. (#39)
- Removes the descriptions from the scope labels in `.config/release-kit.config.ts` and `.github/labels.yaml` so that GitHub groups the labels compactly, and updates `docs/new-package.md` to add a new scope label without a description. (#80)

### 📦 Dependencies

- Upgrades Node.js from 24 to 26 by pinning 26.13.1 in `.tool-versions`, raising the `engines.node` floor to `>=26` in the root and every workspace manifest, and moving `@types/node` in the catalog from 24.19.2 to 26.6.6. (#105)
- Upgrades `@williamthorsen/eslint-config-typescript` from 20.2.0 to 22.0.0, whose `no-restricted-syntax` rule reports `error instanceof Error ? error.message : String(error)` and points to `describeError` from `@williamthorsen/toolbelt.errors`. (#107)

### 🤖 Agentic support

- Removes the one-time `initialize-node-monorepo` skill and rewrites `AGENTS.md` to describe top-right instead of the template's starter apps and drift kit. (#3)
- Changes the project stage declared in `.agents/preferences.yaml` from `maturity: early` and `audience: team` to `maturity: hobby` and `audience: owner`. (#4)

### 📚 Documentation

- Rewrites `README.md` to describe top-right, and changes `docs/new-package.md` to start every new app or library from `packages/_workspace`. (#3)
- Adds `docs/design.md`, which records the product's purpose, non-goals, idea stage, decisions with their reasons, rejected alternatives, and rough package structure, and links to it from `AGENTS.md`. (#4)
- Adds an "Evaluations" section to `docs/design.md` that records the concerns of a product manager, an interaction designer, a data-visualization specialist, a Jira site admin, and a developer, with the questions that each leaves to the prototype round. (#8)
- Revises the design decisions that the evaluations changed, each with a note naming the evaluation that caused it, and adds the "Unscored items and agent-written scores" decision, which leaves a score absent until it is written, and the "Visual channels" decision. (#8)
- Rewrites `docs/design.md` as the end vision, recording the decisions that the prototype round settled, the questions that the opinions-stage evaluations left to the round with their answers, and the baseline, prototype 4.2 Blocker edges, against which the MVP is judged. (#9)
- Renames the importance axis to impact throughout `docs/design.md`, because impact is a less disputed term than importance or value. (#9)
- Settles the package split in `docs/design.md` for the MVP, which folds `packages/layout` into `packages/chart`, defers `packages/adapter-jira` until its iteration starts, and builds the chart as a component from the start rather than trimming it from the baseline page. (#17)
- Revises `docs/design.md` to record what the first MVP iteration showed about gutter overflow, repository abbreviations, closing the detail pane, and zoom on a phone, and to state why the chart is a React component. (#18)
- Records in `docs/design.md` how the next pick treats agent scores, missing effort, and item age, and that an edge joins only circles in the matrix. (#24)
- Records in `docs/design.md` that the host owns the URL of the selected item, which selections become history entries, and how the table behaves on a narrow screen. (#30)
- Records in `docs/design.md` why the closed-issue window is set in the config file rather than in Settings, and how ghosts are placed and revealed. (#33)
- Records in `docs/design.md` how the longest blocker chain is computed and how its view interacts with a review, the filter, and a reload. (#37)
- Records in the Stage section of `docs/design.md` that the MVP, epic #10, is complete and that the next stage is increments. (#39)
- Defines each urgency and value level for a scorer in `apps/standalone/docs/scoring.md`, and records in `docs/design.md` why the axes use four named levels. (#56)

<!-- Generated by release-kit. Do not edit this file. Use .meta/changelog-overrides.json to override entries. -->
