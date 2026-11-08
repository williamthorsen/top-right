# Top Right design

This document records the product's idea, the decisions taken so far, and the reason for each. It is revised as the product moves through its stages, so that a new session knows the vision without being told.

## Purpose

Top Right plots work items as circles on a chart. Urgency runs along the x-axis and impact along the y-axis, so that the work that matters most collects in the top-right corner. A circle's area shows the item's scope.

A session's job is to choose the next item to work on and to review the scores that changed since the last session. A feature belongs in the MVP when the product cannot do that job without it.

The chart names the next pick itself: the open, scored item nearest the top-right corner that an open item does not block. The session's second job is a review: the chart marks every score that an agent wrote since the last visit, and the author keeps or corrects each one.

Each circle links to the item's source of truth. Hovering a circle previews its detail; selecting it, by click, by tap, or by keyboard, keeps the detail open in a side pane and keeps the item's arrows shown. Done items are hidden by default.

The primary user is the author, who runs Top Right locally as a personal tool. Agents and an editing UI both write scores. Later hosts serve developers at work, Jira customers, and small-scale users through skypilot.dev.

Revised after the product manager and interaction designer evaluations: The purpose described the chart and not the session's job, which the MVP boundary needs as its test, and it named hover as the one path to detail, which keyboard and touch do not have. Revised after the prototype round: The round showed that a computed pick and a review queue are what make a session short, and "importance" became "impact", which carries less argument than importance or value.

## Non-goals

- Replacing the tracker. GitHub and Jira remain the source of truth for an item's title, description, and state; Top Right stores only what the sources do not hold.
- Writing an item's state to the tracker. Done is read from the source, never set in the chart, until an adapter declares that it can set status; the prototype round settled this as read-only for now.
- Planning by dependency. Relationships are shown on the chart but never position a circle.
- A hosted service before there is demand for one.

## Stage

The product has passed the idea, opinions, and prototype stages of the product-development workflow. Issue #6 ran the round: four prototypes on one brief, judged on the index page, with a decision on every one of the round's 38 ideas, and the winner refined into the baseline. The records are in the ticket's artifact directory, `~/ai-artifacts/projects/top-right/tickets/6/`:

- the brief, `20261107-234323Z_prototype-brief-and-round_brief.md`
- the comparison, `20261108-004133Z_prototype-brief-and-round_comparison.md`
- the idea decisions, `20261108-061338Z_prototype-brief-and-round_idea-decisions.md`
- the refinement log, `20261108-080655Z_prototype-brief-and-round_refinement-log.md`

The baseline is prototype 4.2 Blocker edges, in the set under `prototypes/`, published at the index <https://claude.ai/artifact/NYmN2qYakPcnFduu8Upuzz>. It is the floor on quality and feel against which the finished product is judged, and the reference for what the product does, not its specification: The MVP improves on it.

This document is the end vision. The next stage is the MVP.

The project declares its maturity, sensitivity, and audience in [`.agents/preferences.yaml`](../.agents/preferences.yaml). The values settle these decisions:

- Maturity and audience: The first host is a local process with a SQLite file, and it does not add access control beyond the tokens of the source platforms.
- Sensitivity: The data is the author's own GitHub issues. A host that reads an employer's Jira site raises it.

## Decisions

Each decision below records the idea that the round decided, with the decision's reason. A decision taken at the opinions stage keeps its "Revised after" note; one taken at the prototype round says so.

### Three hosts on one core

A local process comes first, a Forge app second, and a hosted web app last, only on demand. The core is the model, scoring, layout, chart, adapters, and store interface; a host supplies auth, storage, and a place to run.

The order follows the users: The author is the first user and needs only a local process. A Forge app reaches Jira customers inside the platform that they already use. A hosted app costs infrastructure to run, so it waits until someone needs it.

### Seams fixed at MVP time

- The chart is pure browser code that takes props and never fetches, so that it renders unchanged inside a Forge Custom UI iframe and on a web page.
- The Jira adapter takes an HTTP client rather than a token. Forge supplies `requestJira`, which runs as the user, so that the chart shows only the issues that the viewer may read; the local host supplies a client that holds a token.
- The store is an interface with SQLite behind it, so that Forge storage or a hosted database can replace SQLite without a change to the core.
- Scores are keyed by user from the first release, so that a host with several users does not need a migration.

Revised after the Jira site admin evaluation: The seam did not say whether the Forge client runs as the user or as the app, and a client that runs as the app reads every issue that the app can see and bypasses issue security.

### Scores live in the app's store

Urgency, impact, effort, and progress live in the app's store, because the sources do not have fields for them. A score is keyed by the item's source identity and by user, so that it survives a refresh of the source. Writing scores through to Jira issue entity properties waits for a Forge release after the first, so that the first Forge manifest requests read scopes only.

Revised after the Jira site admin and developer evaluations: The decision offered the entity-property write-through as optional from the start, and a Forge manifest declares its scopes for every user at install, so an unused write scope still costs the admin a write approval; the decision also did not say how a score keeps its item across refreshes.

The local host keys a score by the item's `owner/name#number` and by `github:<login>`, the user whom the GitHub token authenticates, and keeps the store in one SQLite file outside the repository, so that every worktree reads the same scores. Renaming or transferring a repository orphans its items' scores. Decided at the second MVP iteration (#12).

### Ordinal axes and the cell as the tie

Urgency and impact are integers 1 to 5. A hand-scored backlog does not hold finer differences, and an integer scale makes a cell a guarantee: A drag snaps to a cell, a nudge inside the cell never reads as the neighbouring score, and every item in a cell has the same true point, so a tie is a cell. Tied circles pack inside their cell, and the cell's gridlines are the anchor; the chart draws neither spokes nor a centre dot, which would mark what the gridlines already show.

Decided at the prototype round: All four prototypes converged on the integer scale, and the developer observed that on integer axes the true point is the cell itself (idea rows 4, 6, and 8).

### Unscored items in a gutter row and column

An item that lacks a score for one axis sits in an unscored column or row inside the matrix, at the coordinate that it does have; one that lacks both sits in the corner cell. The gutters share the matrix's background, so that they do not read as an inset or a legend, and each gutter cell lists its circles with their ids. A gutter cell whose list is taller than the cell scrolls within the cell, with scroll shadows at each edge past which the list continues; circles never shrink below the floor to fit. Scoring an item moves it one cell in. A score is absent until an agent or the author writes it, never defaulted. A missing effort renders at the marked floor, and a missing progress leaves remaining scope equal to original scope.

The first session's scores come from an agent that reads the backlog and scores it, and the author corrects them on the chart. An agent writes through the same store interface as the editing UI.

Added after the product manager, interaction designer, and developer evaluations: A real backlog arrives without scores, and a defaulted score misstates the item's position. Revised at the prototype round: The gutters come from 2.1 Dense backlog, adapted so that they are part of the matrix (row 9); 3.1's tray of chips above the chart and 4.1's dock below it were dropped, because they ate space and did not read (row 18). Revised after the first MVP iteration (#11): A real backlog put every open issue, close to a hundred, in the corner cell, and the doc did not say what a cell does when its list does not fit. Shrinking the circles would break the marked floor and the touch targets, and the platform's overlay scrollbars stay hidden until a scroll, so the shadows are the cue.

### The next pick and the review

The chart computes the next pick, rings it, and shows its detail in the pane while nothing is selected. The pick is the open, scored item with the highest urgency plus impact, then impact, then in progress before to do, then the least remaining scope, then the oldest; an item that an open item blocks is never the pick.

A review is a queue: Agent-scored, the items whose scores an agent wrote since the last visit, and Unscored, the items that lack a placing score. Starting a queue selects its first item and fades the rest; Enter or a Keep button keeps the selected item's scores and advances; Skip advances without keeping. Keeping, or correcting any score, turns an agent score into the author's, clears the item's agent mark, and clears its trail. An agent-scored item wears a halo, and a circle that the agent moved shows a dashed trail from its previous cell while the review is on or while it is hovered or selected, so that the resting chart stays calm. "Since the last visit" means since the end of the previous session, stored per user.

Decided at the prototype round: The pick and the queue come from 1.1 Next item (rows 1, 2, 3, 25); Keep answers the developer's question of how an agent score becomes a user score without re-entering the value (row 5). Open: The Review controls do not behave like the Filter controls, and the developer found their behaviour hard to infer; the controls are redesigned in a later session, and the refinement log records the item.

### GitHub adapter first, Jira adapter second

The GitHub adapter comes first, because using the tool on real data on the development machine is what keeps it from staying an idea. The local host reads its GitHub token from `GITHUB_TOKEN` or from `gh auth token`, so that the first run needs nothing beyond `gh auth login`. The Jira adapter comes second. It is built against a personal Atlassian site seeded by a script, and it depends on `@williamthorsen/atlassian-tools` for auth and transport.

Revised after the developer evaluation: The decision did not say where the local host gets its GitHub token, and whether it is a pasted personal access token or the one that `gh` already holds decides the first hour.

### Status is a derived category with an override, and Done is read-only

Each adapter derives an item's status category from its source, and the app stores an override. GitHub issues do not have a native "in progress" state, so the override is how an item gets one; Jira gives every status a status category, To Do, In Progress, or Done, so the Jira adapter reads the category without any per-project mapping. The source's done state outranks the override, and a change of the source's state clears the override, so that an item closed at the source does not reappear as in progress after a refresh.

The detail pane shows status as one segmented control, To do, In progress, Done, because status is an enum and a checkbox beside a chip said the same thing twice. Done is read-only: It is the issue's state on the tracker. Writing status waits for an adapter that declares it can, which an in-app item always can, a GitHub adapter may, and a Jira adapter cannot until it can find the transition that lands in a category.

Revised after the developer evaluation: The decision had no precedence rule between the source and the override. Revised at the prototype round: The checkbox became an enum, and the developer settled status writes as read-only for now.

### Custom tasks

A custom task is a store record whose remote link is empty. It needs neither a tracker nor an adapter. It is the one kind of item whose status the app may set.

### The core publishes to npm

The core publishes to npm with provenance, because the Forge host lives in a work repository and the web host in `skypilot-site`, and each consumes the core as versioned packages. The local host stays in this repository.

### Relationships

A blocker is an arrow from the blocking item to the blocked one. GitHub's blocked-by relations and Jira's "blocks" links are blockers; sub-issues and other links are plain relations, which render the same way without an arrowhead. Arrows appear while a circle is hovered and stay while it is selected, and a toggle shows all of them. Focus shows the item's direct edges at full weight and its transitive chain at reduced weight, and fades every unrelated circle.

An item that an open item blocks wears a red ring, and the arrow into it is red; a blocking item carries no mark of its own, because the arrow out of it says enough. A hidden done item keeps a ghost at its true point while an edge reaches it, and a click on the ghost reveals that one item. The longest blocker chain is an advanced view under a More menu, not a top-level control.

Edges never move circles, because a circle's position states the item's urgency and impact, and moving it would misstate them.

Revised after the developer and interaction designer evaluations: The decision did not name which source relations are blockers, and it used hover and selection interchangeably. Revised at the prototype round: 4.1 Blocker edges won the round on these edges (rows 19, 21, 22); the red ring replaces red on both ends, which the developer found confusing.

### Original and remaining scope

A toggle switches a circle's area between original scope and remaining scope. Remaining scope is effort × (1 − progress). Area is proportional to scope on one scale across both modes, so that an item changes size only when its data does, and a circle whose scope falls below the smallest legible area takes a minimum radius that is marked as a floor.

Revised after the data-visualization evaluation: Remaining scope reaches zero, and a circle without area vanishes or takes an unmarked minimum that breaks the area-to-scope ratio.

### Visual channels

Fill carries status: A to-do circle is translucent, an in-progress circle shows a solid pie for its remaining fraction, with a floor width so that a nearly finished item still reads as in progress, and a done circle is grey. At remaining scope the in-progress circle is wholly solid, because size then carries the remainder and a pie on top would discount it twice. Done circles carry no checkmark.

The border carries work type, from a classifier over the item's labels: feature from feat, feature, and enhancement; bug from bug, fix, and defect; task from chore, task, refactoring, and the other code-change labels; ops from ops, operations, and admin, because a non-code to-do is qualitatively different from the rest and the distinction is worth keeping. A user whose labels follow another scheme edits the mapping in Settings. An unmapped item has a neutral border. The chart carries a legend, and the legend opens the mapping as a popover with a link to Settings.

Added after the data-visualization evaluation: The doc assigned no channel to status or category. Revised at the prototype round: The developer chose the pie over the arc (row 32) and the four-type classifier over a border per label (rows 11, 12); 2.1's text codes with legend chips (rows 10, 13), 4.1's dash patterns (row 12), the checkmark (row 38), and 3.1's diamond mark (row 37) were dropped.

### Circle labels and repo abbreviations

A circle shows its id as the repo's abbreviation and the number, `n.382`, because a bare number is not helpful across repos. With one repo filtered, the number alone. A Jira key stacks over its number in a smaller font. Abbreviations default to the repo's first letter and are mapped per repo in Settings, because two repos can share a letter. Until Settings exists, the local host's config file sets them, and the host refuses to start while two repos share an abbreviation, compared case-insensitively. Larger circles add the title at higher zoom.

Decided at the prototype round (row 26). Revised after the first MVP iteration (#11): The author's own repos share first letters (`codeassembly`, `codeassembly-guidance`, `configs.macos`), so ambiguous ids appeared from the first run, before Settings.

### Detail in a side pane

Detail lives in a side pane on desktop and a bottom sheet on a phone, never in a tooltip, because a tooltip jumps and cannot carry the pane's structure. The pane shows the id with an external-link icon to the source, the title, the status control, the four scores as compact segmented controls with one provenance line each (who set it and when), the points in Effort's line, and the relations as lists of rows with the id in monospace and the title, each row tagged closed or blocked where that holds. Hovering a relation row rings its circle on the chart. A segmented control is one tab stop, and arrow keys move within it. The pane takes the room that a wide window offers and is resizable. While an item is selected, the pane shows a Close button that clears the selection, because touch has no Escape key; on a phone, the page leaves room to scroll the chart above the sheet.

Decided at the prototype round: The relations list comes from 1.1 (row 30), and 4.1's pane won on feel (row 29); the "Open" state chip (row 34), the "Open on GitHub" button (row 36), and 3.1's tall rating buttons (row 24) were dropped. Revised after the first MVP iteration (#11): On a phone, the sheet covered the corner cell and offered no way to dismiss it. Revised at the second MVP iteration (#12): Progress is a range in steps of 5 % with a readout rather than a segmented control, because twenty-one segments do not fit the pane; Status, Urgency, Impact, and Effort stay segmented. The points move to Effort's line, because under Progress one line would join two scores' provenance.

### Filter and fade

Two behaviours are kept distinct. A filter removes items from the board: the repo filter, and the status filter of To do, In progress, and Done, each a toggle, with Done off by default. A fade keeps every item in place and dims the unrelated ones: focus on an item, the longest chain, a review queue, "Changed since the last visit", and a hovered cell. A faded circle stays selectable, and the selected circle never fades.

Decided at the prototype round (rows 22, 27): The developer asked for the distinction, and found that 4.1 disabled faded circles.

### Zoom and navigation

At 1× the whole matrix fits the chart area wherever the area keeps the chart's text at its 12 px floor, and zoom is continuous above that, with a fit step. A narrower area, such as a phone's, shows the matrix at its floor scale and scrolls. A Top right control, with a quadrant icon, jumps to the top-right quadrant. When zoomed, a drag on the background pans, with a grab cursor. Hovering an empty spot in a cell shows a one-line callout for every circle in the cell, over faded neighbours, so that a crowded cell can be read without zooming.

Each click selection is a history entry, so Back returns to the previous circle, and a selected item's URL can be shared. Hover and keyboard moves push nothing.

Decided at the prototype round: The callouts (row 31), drag to pan (row 35), and deep links (row 33) are the developer's ideas; the Top right control comes from 3.1 and 4.1 (row 23). 2.1's chart that scrolls at 1× so that the densest cell fits was adapted into fit-at-1× with zoom (row 7), because a chart that scrolls at 1× loses the whole-board view. Revised after the first MVP iteration (#11): At 390 px, a matrix fitted to the width scales its 12 px labels to about 6 px, so the phone keeps the floor and scrolls.

### Pointer model

A drag moves only the already-selected circle; a drag on anything else pans. On touch that is the only way a tap, a pan, and a drag coexist, and on a mouse the one extra click prevents an accidental rescore. Larger circles draw first, so the smallest circle under a tap is the one that takes it. Keyboard navigation between circles, arrow keys that step a score, and Escape that reverts a move are deferred: welcome, but not a premium for the first user, and built after the pointer and touch model is settled.

Decided at the prototype round: From 3.1 Thumb and arrow keys (rows 14, 16); row 15 deferred.

### The table

The table below the chart is a second view of the same items and the same selection: Columns sort, status sorts by its enum order, a row click selects the row's circle with the same deep link, the selected circle's row highlights, and an external-link icon opens the source. The chart and the table sit in panes separated by a resizable divider, and the table scrolls within its pane. The legend is a strip pinned under the chart.

Decided at the prototype round, from the developer's comments on the baseline; not rendered in the prototype.

## Rejected alternatives

- Separate apps for GitHub and Jira: Each app would duplicate the model, scoring, layout, and chart. One core with an adapter per source keeps a single copy.
- Scores as Jira custom fields: A custom field needs a site admin to create it and changes the issue schema for every user of the site. It also holds one value per issue, which cannot key a score by user.
- Labels as score carriers: Labels are free text shared by everyone who reads the source, and they cannot hold a number cleanly. They also cannot key a score by user.
- A default score for an unscored item: A default position states an urgency and an impact that nobody assigned, which is the misstatement that the chart exists to avoid. Added after the interaction designer evaluation.
- Spokes from a displaced circle to its true point (2.1, 4.1): On integer axes the cell is the true point, so the spokes marked what the gridlines show. Prototype round, row 6.
- An unscored tray above the chart (3.1) or a dock below it (4.1): Both ate space and did not read; the gutters inside the matrix replace them. Rows 9 and 18.
- A border per work type with dash patterns (4.1), text codes with legend chips (2.1), a checkmark on a done circle, and a diamond on an agent-scored circle (3.1): Rows 12, 13, 38, and 37.
- A progress arc: A shrinking pie reads as work remaining; an arc that fills reads as the opposite of the remaining-scope toggle. Row 32.
- Detail in a tooltip: It jumps and cannot carry the pane's structure. Row 29.
- Moving focus to the most recently closed item when done items are revealed (3.1): The status filter answers the question, and a filter change that moves focus is a surprise. Row 17.
- A chart that scrolls at 1× so that the densest cell fits (2.1): It loses the whole-board view that a quadrant chart exists for. Row 7.
- Red on both the blocking and the blocked end of an edge (4.1): Confusing; the blocked item alone wears the ring. Row 21.
- Setting Done from the chart: Jira's transitions are per workflow, and GitHub has only open and closed; read-only until an adapter declares a status write. Prototype round, question on status.

## Evaluations

Five roles evaluated the idea at the opinions stage. Each subsection records the role's concerns, what the evaluation changed, and the questions that it left to the prototype round. The round answered every question; the answers are in the decisions above, and the idea-decisions artifact records each one by row.

### Product manager

- The purpose described the chart and not the session's job, so the MVP boundary had no test to apply.
- A real backlog arrives unscored, so the first session is an empty chart or a pile at the origin.
- Personal scores over a shared tracker, written by agents, is what a priority field or a project board cannot copy, and it had no decision of its own.
- Nothing shows what changed since the last visit, which is what brings a user back.

What it would change: The session's job is now stated in Purpose, and "Unscored items" and "The next pick and the review" are decisions.

Questions for the round, answered: The halos, trails, and the "Changed since" fade show what changed; the review queue with Enter-to-keep is the re-scoring habit.

### Interaction designer

- Four scores per item make a hundred items cost four hundred entries, and nothing stated a scoring flow, and an unscored item had no coordinates.
- The score scale, continuous or a small ordinal set, decides whether dragging a circle is a precise edit.
- Hover, focus, and selection were used interchangeably, and keyboard and touch have no hover.
- An agent can rescore a circle while the author is dragging it.

What it would change: Hover now previews and selection persists; an unscored dimension is absent rather than defaulted; a default score is a rejected alternative.

Questions for the round, answered: Unscored items render in the gutters and are scored through the Unscored queue; drag sets urgency and impact alone and works only on the selected circle; keyboard focus and Escape are deferred with the keyboard model; a rescored circle shows a trail from its previous cell during review; the smallest circles carry their id beside them in the gutters and none inside the matrix until zoom.

### Data-visualization specialist

- The crowding decision claimed no misstatement while it moves circles off their coordinates.
- Coarse hand-scored axes make ties the rule, and the chart implies a precision that the scores lack.
- Remaining scope reaches zero, and an unmarked minimum radius breaks the area ratio.
- Status layering is draw order, so a large circle can hide a small one.
- The doc assigned no channel to status or category.

What it would change: "Ordinal axes and the cell as the tie" states that a tie is a cell; "Original and remaining scope" states one area scale with a marked floor; "Visual channels" is a decision.

Questions for the round, answered: The scale is discrete and a tie packs inside its cell; the cell is the anchor, so an anchor mark is not needed; the backlog carries four work types plus unmapped, on the border, which survives layering; larger circles draw first so that the smallest is on top.

### Jira site admin

- An optional write-through still costs a write scope at install, because a Forge manifest declares its scopes for every user.
- The seam did not say whether `requestJira` runs as the user or as the app.
- Forge storage is scoped to the app, so the admin needs a statement of what the Forge host stores and how it is keyed.
- The sensitivity raise that a Jira host causes must be settled before the Forge host is designed, because it decides scopes and storage.

What it would change: The write-through waits for a Forge release after the first; the Forge client runs as the user.

Questions for the round, answered: The detail pane shows the id, title, labels, state and status category, and relations, which fixes the read scopes; it writes nothing to the source.

### Developer running it on their own backlog

- The token's source decides the first hour, and unscored items, refresh, and a score's survival across a refresh were unstated.
- The source of a blocker edge was unnamed.
- The status override had no precedence against the source.
- Done hidden by default still means fetching years of closed issues on every refresh unless the adapter bounds them.

What it would change: The token comes from `GITHUB_TOKEN` or `gh auth token`; the source's done state outranks the override; blocker sources are named; a score is keyed by source identity. Refresh timing and the bound on closed issues are settled when the MVP is specified, because the round did not prototype adapters.

Questions for the round, answered: A recently closed item is reached through the Done filter or through the ghost at the end of an edge; the pane shows the source's state beside the status control, as a read-only Done.

## Structure

The package split is settled for the MVP, whose epic is #10. It follows the baseline, and the chart is built as a React component from the start rather than trimmed from the baseline page, because the page is a reference and a trimmed copy would be rewritten in the second iteration. React, not a framework-free web component, because the next two hosts, a Forge Custom UI app and `skypilot-site`, are React. The packages are named under the `@top-right` npm scope, which the product owns, and stay private, read as source by the workspaces, until a consumer outside this repository needs a published version.

- `packages/model`: work items, scores keyed by user, status categories and the override, relationships, the work-type classifier and its mapping, the next pick, and the review queues
- `packages/chart`: the browser chart and its detail pane, which take props only, with the cell packing and the gutters inside it
- `packages/adapter-github`: the GitHub adapter
- `packages/store`: the store interface, with scores, status overrides, and the last visit per user, and the conformance tests that every store runs; settings (the type mapping, repo abbreviations) join it with Settings (#15)
- `apps/local`: the local host, which implements the store on SQLite and serves the page with the toolbar and the table

The Jira adapter, `packages/adapter-jira`, is added after the MVP, when its iteration starts. Every package under `packages/` is part of the published core. `apps/local` stays in this repository and is not published.
