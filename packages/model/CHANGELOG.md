# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-11-14

### 🎉 Features

- Adds the `WorkItem` type to `@top-right/model`, together with `classifyWorkType`, which maps an item's labels to a work type, and `formatIdLabel`, which builds a circle's id label such as `t.11`. (#18)
- Adds controls to the detail pane that set an item's status and its four scores, with a line under each score that names who set it and when, and adds the `Chart` props `onScoresChange` and `onStatusChange`, through which the chart reports each edit to the host. (#20)
- Score the backlog with an agent and review its scores on the chart (#21)

  Adds a `top-right` CLI through which an agent writes scores for the open issues, and adds a review to the chart that marks each agent score, including one that replaced a score of the author's, until the author keeps or corrects it.

- Makes the chart draw an arrow for each blocker and a line for each sub-issue of the hovered or selected item, draw that item's blocker chain at reduced weight, and fade unrelated circles outside a review, and adds an "All edges" toggle with which the chart draws every edge faintly. (#24)
- Adds the next pick, chosen by the new `findNextPick` from the open, unblocked items that have urgency and impact scores, which the chart marks with a ring and the detail pane shows under "Next pick" while nothing is selected or previewed. (#24)
- Adds the required `createdAt` field to `WorkItem`, which the GitHub adapter fills from each issue's creation date. (#24)
- Exports `STATUS_ORDER`, the order in which work moves through the statuses, and `revealItem`, which returns an `ItemFilter` widened to keep a given item by adding the item's status and dropping a repo selection that excludes it. (#30)
- Edit the work-type mapping and the repo abbreviations in Settings (#31)

  Adds a Settings page to the local host, on which the author edits the labels that assign each work type and each repository's abbreviation, and makes that page the only source of abbreviations in place of the config file's `abbreviation` field. Replaces the host's refusal to start while two repositories share an abbreviation with an alert that links to Settings.

- Show recently closed issues within a configurable window (#33)

  Adds recently closed issues to the local host's chart, limited to the issues closed within the number of days set by `closedWindowDays` in the host's config file (30 by default). Hides them behind a new Done toggle, which is off by default, and adds a ghost, a dashed outline that marks a hidden closed item at the end of an edge drawn from the focused item.

- Add drag-to-rescore and a remaining-scope toggle to the chart (#35)

  Lets the author rescore an item by dragging it on the chart, and adds a "Remaining scope" toggle that sizes each circle by the effort still left rather than by the item's full effort.

- Show the longest blocker chain under a More menu (#37)

  Adds a chart view that fades every item outside the longest blocker chain, which is the longest sequence of open items in which each item blocks the next, and adds a "More" menu to the chart's strip with an item that turns the view on and off.

- Replaces the 1-to-5 urgency and impact scores with four named levels, `low` to `critical` for urgency and `questionable` to `must-have` for value (formerly impact), which the chart draws as a 4×4 matrix and `top-right write-scores` accepts by name. (#56)
- Lets one of an issue's labels, such as `value:must-have`, supply its urgency or value level when the author or an agent has not stored a score for that axis, so that the chart places the issue in a cell rather than in a gutter. (#57)
- Lets an issue's effort label, by default one of `effort:1` through `effort:13`, set the size of its circle until the author or an agent stores an effort for it, with the larger effort applying when the issue has two such labels. (#59)
- Gives an agent score that replaces a label's level a trail from that level, which the score previously lacked. (#61)
- Makes the standalone host show an open GitHub issue labelled `status:in-progress` as In progress, and add or remove that label at GitHub when the author sets In progress or To do in the detail pane, instead of storing the status as an override that only the app can see. (#62)
- Changes the default abbreviation of a repository to the uppercase first letter of its name, so an id reads `T.11` rather than `t.11`, while an abbreviation stored in Settings keeps the case in which it was entered. (#67)
- Adds a Collections section to the Settings page, in which a user creates, renames, edits, and deletes named groups of the configured repositories and chooses a default collection, and saves both per user in the store. (#78)
- Replaces the chart's repo select with a Repos menu of checkable collections and repositories, whose union the chart shows, and starts the chart at the default collection on each load rather than at every repository. (#78)
- Clear a score from the detail pane (#96)

  Adds a clear button to each score control in the detail pane, which returns an item's Urgency, Value, Effort, or Progress to unset and, on a host that writes labels, removes that dimension's score labels from the issue. It also limits the caption under a score row to an agent's score and an unsized Effort.

- Hide labels that the detail pane already shows (#99)

  Leaves out of the detail pane's Labels list each label that decides a displayed urgency, value, or effort, the Type row, or the In progress status, because the pane already shows those values elsewhere. Keeps in the list a label that lost to a stored score or to another label, because the list is then the only place in the pane that shows the conflict.

### 🪦 Removed

- Removes the next pick from the chart: the outer ring around the suggested item, the ", next pick" suffix on its accessible name, its legend entry, and the detail pane's "Next pick" mode, which leaves the pane reading "No item selected" until an item is hovered or selected. (#101)

### 🏗️ Internal features

- Adds `filterItems` and `countByStatus` to `@top-right/model` so that every view filters items by repository and derived status in the same way, with `DEFAULT_ITEM_FILTER` keeping every repository's to-do and in-progress items. (#29)

### 📦 Dependencies

- Upgrades Node.js from 24 to 26 by pinning 26.13.1 in `.tool-versions`, raising the `engines.node` floor to `>=26` in the root and every workspace manifest, and moving `@types/node` in the catalog from 24.19.2 to 26.6.6. (#105)

<!-- Generated by release-kit. Do not edit this file. Use .meta/changelog-overrides.json to override entries. -->
