# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-11-14

### 🎉 Features

- Adds the `Chart` React component to `@top-right/chart`, which lists unscored items in the matrix's gutter cells, scrolls a list that is taller than its cell, shows an item's details in a side pane on hover or selection, and renders the work-type legend. (#18)
- Makes the chart place each scored item in the cell of its urgency and impact, size its circle by effort, and fill it by status, with an in-progress item shown as a pie of the remaining work, and adds a legend for the status fills and for the floor mark of an unsized item. (#20)
- Adds controls to the detail pane that set an item's status and its four scores, with a line under each score that names who set it and when, and adds the `Chart` props `onScoresChange` and `onStatusChange`, through which the chart reports each edit to the host. (#20)
- Adds a review of agent scores to the chart: Each agent-scored item shows a halo, an item that the agent moved shows a dashed trail from its previous cell, a strip at the chart's top edge steps through the Agent-scored and Unscored queues, and Keep, Enter, or a correction turns the selected item's agent scores into the author's. (#21)
- Makes the chart draw an arrow for each blocker and a line for each sub-issue of the hovered or selected item, draw that item's blocker chain at reduced weight, and fade unrelated circles outside a review, and adds an "All edges" toggle with which the chart draws every edge faintly. (#24)
- Adds a dashed red ring that the chart draws around each blocked item in its cell and its gutter row, and adds ", blocked" to the end of that item's accessible name. (#24)
- Adds the next pick, chosen by the new `findNextPick` from the open, unblocked items that have urgency and impact scores, which the chart marks with a ring and the detail pane shows under "Next pick" while nothing is selected or previewed. (#24)
- Makes the chart ring the related circle while a relation row in the detail pane is hovered or focused, so that the row can be matched to its circle. (#24)
- Adds a "Relations" strip to the legend that names the blocker arrow, the sub-issue line, the blocked ring, and the next-pick ring. (#24)
- Adds a Filter group to the chart's top strip, with a repo select and To do and In progress toggles that each show their count within the selected repo, and limits the matrix, the gutters, the next pick, and both review queues to the items that the filter keeps. (#29)
- Shows the issue number alone on circles and gutter rows while one repo is filtered, and keeps the abbreviated id in the detail pane, whose relation rows can name items of other repos. (#29)
- Adds a table of the filtered items below the chart, which sorts by any column and shares the chart's selection: Clicking a row selects its circle, and hovering a row rings it. (#30)
- Splits the height of the `Chart` container between the chart and the table with a divider that a drag or the arrow, Home, and End keys move, and stacks the two panes without a divider at 760 px wide or narrower. (#30)
- Adds the `selectedKey` and `onSelectedKeyChange` props to `Chart`, through which a host holds the selection and receives each change with `push: true` when the author made it and `push: false` when the chart made it, such as a review step, and widens the filter to show an item that a host-supplied key names. (#30)
- Adds a Settings page at `/settings` to the local host for editing the labels that assign each work type and each repository's abbreviation, which the host saves per GitHub user and applies to the chart's borders and ids, with a saved mapping replacing the default mapping whole and Settings refusing a label that two work types list. (#31)
- Adds a Mapping button to the chart's legend, which opens a popover that lists the labels assigned to each work type and links to Settings. (#31)
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
- Adds an Effort section to the score-label form on the Settings page, which maps the user's own labels to each point value from 1 to 13. (#59)
- Adds an optional `refresh` prop of type `ChartRefresh` to `Chart`, which ends the strip with the time at which the items were read and a Refresh button that calls the prop's `onRefresh`. (#60)
- Read and write In progress as the status:in-progress label (#62)

  Moves In progress for an open GitHub issue from an override that only the app could see to the `status:in-progress` label, which the standalone host now reads when it loads issues and writes when the author sets the status in the detail pane. The repository must already have the label, because the host refuses the write rather than create it, and an override stored before this change keeps applying until the author next sets the item's status.

- Renames the displayed value levels to "Must have", "Should have", and "Nice to have" on the axis, in the table, in the pane, and in Settings, while the level keys `must-have`, `should-have`, and `nice-to-have` keep their hyphens. (#67)
- Adds a header to the chart and Settings pages of the standalone host, shown also while a page loads or fails to load, with the product's name and Chart and Settings links that keep the selected item, replacing the Settings link in the chart strip and the Chart link on the Settings page. (#68)
- Changes the chart to size the matrix's cells to fill the chart area down to a minimum cell size and to have the zoom control scale only the cells' contents, and removes the Fit entry from the zoom menu. (#71)
- Adds the optional `magnification` and `onMagnificationChange` props to `Chart`, which let a host hold the magnification, and exports `NATURAL_SCALE` and `ZOOM_STEPS` for validating a stored value. (#71)
- Adds a Collections section to the Settings page, in which a user creates, renames, edits, and deletes named groups of the configured repositories and chooses a default collection, and saves both per user in the store. (#78)
- Replaces the chart's repo select with a Repos menu of checkable collections and repositories, whose union the chart shows, and starts the chart at the default collection on each load rather than at every repository. (#78)
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

- Removes the next pick from the chart: the outer ring around the suggested item, the ", next pick" suffix on its accessible name, its legend entry, and the detail pane's "Next pick" mode, which leaves the pane reading "No item selected" until an item is hovered or selected. (#101)

### 🐛 Bug fixes

- Fixes the issue that a screen reader announced a pressed toggle, such as "All edges" or a status filter, as "✓ All edges" rather than by its label alone, although `aria-pressed` already reports the pressed state. (#32)
- Fixes the issue that hovering a pressed toggle did not change its border or fill. (#32)
- Fixes the issue that a mouse click on a row in the chart's gutter, the list of unscored items, often selected nothing or the wrong item in WebKit browsers such as Safari, because WebKit drew the rows away from where the chart had laid them out. (#36)
- Fixes the issue that the table's Progress column printed the stored fraction, such as "0.35 %", rather than the percentage. (#56)
- Fixes the issue that the chart drew a done work item with the to-do fill, by giving it a grey fill in the light and dark themes and adding a Done entry to the legend's status list. (#98)

### ♻️ Refactoring

- Extracts the chart's scrolling drawing surface from `Chart.tsx` into a `ChartCanvas` component, which brings `Chart.tsx` within the `max-lines` limit that `nmr lint:strict` enforces. (#83)
- Extracts `AbbreviationsForm`, `ScoreLabelMappingForm`, and `WorkTypeMappingForm` from `Settings.tsx` into modules of their own, with the shared `parseLabels` helper in `parse-labels.ts`, so that `Settings.tsx` falls below the `max-lines` limit. (#84)

### 📦 Dependencies

- Upgrades Node.js from 24 to 26 by pinning 26.13.1 in `.tool-versions`, raising the `engines.node` floor to `>=26` in the root and every workspace manifest, and moving `@types/node` in the catalog from 24.19.2 to 26.6.6. (#105)

<!-- Generated by release-kit. Do not edit this file. Use .meta/changelog-overrides.json to override entries. -->
