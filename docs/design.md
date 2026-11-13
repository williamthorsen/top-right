# Top Right design

This document records the product's idea, the decisions taken so far, and the reason for each. It is revised as the product moves through its stages, so that a new session knows the vision without being told.

## Purpose

Top Right plots work items as circles on a chart. Urgency runs along the x-axis and value along the y-axis, so that the work that matters most collects in the top-right corner. A circle's area shows the item's scope.

A session's job is to choose the next item to work on and to review the scores that changed since the last session. A feature belongs in the MVP when the product cannot do that job without it.

The author reads the next item from the top-right corner; the chart does not name one. The session's second job is a review: the chart marks every agent score until the author keeps or corrects it.

Each circle links to the item's source of truth. Hovering a circle previews its detail; selecting it, by click, by tap, or by keyboard, keeps the detail open in a side pane and keeps the item's arrows shown. Done items are hidden by default.

The primary user is the author, who runs Top Right locally as a personal tool. Agents and an editing UI both write scores. Later hosts serve developers at work, Jira customers, and small-scale users through skypilot.dev.

Revised after the product manager and interaction designer evaluations: The purpose described the chart and not the session's job, which the MVP boundary needs as its test, and it named hover as the one path to detail, which keyboard and touch do not have. Revised after the prototype round: The round showed that a computed pick and a review queue are what make a session short, and "importance" became "impact", which carries less argument than importance or value. Revised at #44: The y-axis became "Value"; "Ordinal axes and the cell as the tie" gives the reasons.

## Non-goals

- Replacing the tracker. GitHub and Jira remain the source of truth for an item's title, description, and state; Top Right stores only what the sources do not hold.
- Writing an item's open or closed state to the tracker. Done is read from the source and never set in the chart. The standalone host writes In progress to a GitHub issue's label or to its Project's Status field, which leaves the issue open.
- Planning by dependency. Relationships are shown on the chart but never position a circle.
- A hosted service before there is demand for one.

## Stage

The product has passed the idea, opinions, and prototype stages of the product-development workflow. Issue #6 ran the round: four prototypes on one brief, judged on the index page, with a decision on every one of the round's 38 ideas, and the winner refined into the baseline. The records are in the ticket's artifact directory, `~/ai-artifacts/projects/top-right/tickets/6/`:

- the brief, `20261107-234323Z_prototype-brief-and-round_brief.md`
- the comparison, `20261108-004133Z_prototype-brief-and-round_comparison.md`
- the idea decisions, `20261108-061338Z_prototype-brief-and-round_idea-decisions.md`
- the refinement log, `20261108-080655Z_prototype-brief-and-round_refinement-log.md`

The baseline is prototype 4.2 Blocker edges, in the set under `prototypes/`, published at the index <https://claude.ai/artifact/NYmN2qYakPcnFduu8Upuzz>. It is the floor on quality and feel against which the finished product is judged, and the reference for what the product does, not its specification: The MVP improves on it.

This document is the end vision. The MVP, epic #10, is complete, and the next stage is increments.

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

Urgency, value, effort, and progress live in the app's store, because the sources do not have fields for them, except where a host writes labels, as the last paragraph of this decision states. A score is keyed by the item's source identity and by user, so that it survives a refresh of the source. Writing scores through to Jira issue entity properties waits for a Forge release after the first, so that the first Forge manifest requests read scopes only.

Revised after the Jira site admin and developer evaluations: The decision offered the entity-property write-through as optional from the start, and a Forge manifest declares its scopes for every user at install, so an unused write scope still costs the admin a write approval; the decision also did not say how a score keeps its item across refreshes.

The local host keys a score by the item's `owner/name#number` and by `github:<login>`, the user whom the GitHub token authenticates, and keeps the store in one SQLite file outside the repository, so that every worktree reads the same scores. Renaming or transferring a repository orphans its items' scores. Decided at the second MVP iteration (#12).

An agent writes scores through the local host's `top-right` CLI, which writes through the store interface as the agent and refuses a batch that names an item that is not open at its source. An agent may write over the author's scores, because the review is how the author sees a change; an agent's write records the value that the author last held, which the trail reads, and an author write to any of an item's scores makes every agent score on the item the author's. Decided at the third MVP iteration (#13): A CLI needs no running host and leaves the host without a route on which any local page could claim to be the agent.

On a host that supplies a label writer from its adapter, the author's urgency, value, and effort live in the issue's labels, and the store keeps progress and an agent's unreviewed levels. An author write or a Keep writes the item's resulting levels to its labels first, so that a refused write leaves the store untouched, and the store then drops the item's urgency, value, and effort entries, an agent's and an older author entry alike; `planLabelChange` in `packages/model` states which labels a write adds and removes. A level for which the mapping lists no label, or whose label the repository lacks, is refused, because the host never creates a label and release-kit's preset defines them. A host without a label writer keeps every score in the store. An agent's write through the CLI changes no label: It stays in the store as a proposal that outranks the label until the author keeps or corrects it, so that GitHub shows only reviewed scores and an agent's batch does not add a timeline event to each issue under the author's account. Revised at #49: A level set in the app stayed in the app while the issue kept its old label, and the rule that a stored score outranks a label hid the disagreement.

Clearing a score is an author operation of its own: It removes the stored entry, an agent's proposal included, and on a host with a label writer first removes every label that the mapping lists under the dimension, per `planLabelChange`, so that a refused write leaves the store untouched. A clear does not act as Keep, so the item's other agent scores stay pending review and the host writes no other label. Decided at #86.

### Ordinal axes and the cell as the tie

Urgency and value each take one of four named levels: urgency critical, high, medium, or low, and value must-have, should-have, nice-to-have, or questionable. A level's rank is its position on its axis, from 1 for the lowest to 4 for the highest, and the matrix has a row or column per level. A hand-scored backlog does not hold finer differences, and an ordinal scale makes a cell a guarantee: A drag snaps to a cell, a nudge inside the cell never reads as the neighbouring score, and every item in a cell has the same true point, so a tie is a cell. Tied circles pack inside their cell, and the cell's gridlines are the anchor; the chart draws neither spokes nor a centre dot, which would mark what the gridlines already show.

Decided at the prototype round: All four prototypes converged on the integer scale, and the developer observed that on integer axes the true point is the cell itself (idea rows 4, 6, and 8). Revised at #44: The author rates work in words, on four levels per dimension, and five numbered levels asked for a finer distinction than a hand-scored backlog holds; an even count also puts the quadrant lines on gridlines, where an odd one put a middle row and column across them. The y-axis is "Value", because the levels grade worth. Urgency keeps its name rather than becoming "Priority", because priority combines both axes. The store, the API, and the CLI carry the level names rather than ranks, so that an agent writes the author's words and a stored score keeps its meaning if the levels change. Decided at #64: The chart names the value levels "Must have", "Should have", and "Nice to have", without the hyphens of their keys, because they stand as names rather than as modifiers. Revised at #86: The pane's Value control shows "Questionable", "Nice", "Should", and "Must" only where the full names would wrap beside its clear button.

### Labels as a source of a score

An issue's label can supply its urgency, its value, or its effort: `urgency:critical`, `urgency:high`, `urgency:medium`, and `urgency:low`, `value:must-have`, `value:should-have`, `value:nice-to-have`, and `value:questionable`, and `effort:1`, `effort:2`, `effort:3`, `effort:5`, `effort:8`, and `effort:13`, whose names equal the level names and the points of the effort scale, so that the default mapping needs no configuration. Effort labels name points rather than T-shirt sizes, one per value of the scale. release-kit's `common` label preset defines the three families (williamthorsen/node-monorepo-tools#1276 adds `effort:*`), so that every repo that syncs its labels from the preset has them. A user whose labels follow another scheme edits the mapping in Settings, as the work-type mapping is edited: Each level and each effort lists its labels, a saved mapping replaces the default whole, labels compare case-insensitively, and Settings refuses a label listed under two entries, in any dimension. A mapping saved before effort was mappable reads with the default effort labels, because its author never chose any.

A score that the author or an agent stored outranks a label. When an item has labels for two levels of one dimension, the higher level applies; with labels for two efforts, the larger applies, because an unknown spread is not assumed small. A label score is resolved each time the scores are read and never written to the store, so that removing the label removes the score at the next refresh; a stored copy would outrank every later change to the label. A label score places an item for the Unscored queue as a stored score does, never enters the Agent-scored queue, and stays a label score through Keep and author writes. A label effort also sizes the item's circle. A label's level is the score that the author holds, so an agent score that replaces it trails from that level, and an agent write equal to it changes nothing. `list-items` reports a label score as one, so that an agent sees which items labels already place. Decided at #45; effort added at #46. Revised at #49: Once the host writes the author's levels to labels, a label holds the author's score, and an agent score over it without a trail would hide what the agent changed. Revised at #86: The pane no longer names the applied label, because the line named only the winning label and so did not show a conflict; the selected segment shows the level. Decided at #89: Because the pane's Labels list repeated what the controls show, it leaves out each label that decides a value that the pane shows elsewhere: the label that supplies a displayed score, the label that decides the Type row, and the label from which the source read In progress while the Status control shows it. It keeps a label that lost to a stored score or to another label, because the list is then the only place where the pane shows the conflict.

### Unscored items in a gutter row and column

An item that lacks a score for one axis sits in an unscored column or row inside the matrix, at the coordinate that it does have; one that lacks both sits in the corner cell. The gutters share the matrix's background, so that they do not read as an inset or a legend, and each gutter cell lists its circles with their ids. A gutter cell whose list is taller than the cell scrolls within the cell, with scroll shadows at each edge past which the list continues; circles never shrink below the floor to fit. Scoring an item moves it one cell in. A score is absent until an agent or the author writes it or a mapped label supplies it, never defaulted. A missing effort renders at the marked floor, and a missing progress leaves remaining scope equal to original scope.

The first session's scores come from an agent that reads the backlog and scores it, and the author corrects them on the chart. An agent writes through the same store interface as the editing UI.

Added after the product manager, interaction designer, and developer evaluations: A real backlog arrives without scores, and a defaulted score misstates the item's position. Revised at the prototype round: The gutters come from 2.1 Dense backlog, adapted so that they are part of the matrix (row 9); 3.1's tray of chips above the chart and 4.1's dock below it were dropped, because they ate space and did not read (row 18). Revised after the first MVP iteration (#11): A real backlog put every open issue, close to a hundred, in the corner cell, and the doc did not say what a cell does when its list does not fit. Shrinking the circles would break the marked floor and the touch targets, and the platform's overlay scrollbars stay hidden until a scroll, so the shadows are the cue.

### The review

A review is a queue: Agent-scored, the items with an agent score that the author has not yet kept or corrected, and Unscored, the items that lack a placing score. Starting a queue selects its first item and fades the rest; Enter or a Keep button keeps the selected item's scores and advances; Skip advances without keeping. Keeping, or correcting any score, turns an agent score into the author's, clears the item's agent mark, and clears its trail. An agent-scored item wears a halo, and a circle that the agent moved within the matrix shows a dashed trail from its previous cell while the Agent-scored review is on or while it is hovered or selected, so that the resting chart stays calm. An item that the agent moved out of a gutter has no trail. "Since the last visit", which the "Changed since the last visit" fade reads, means since the end of the previous session, stored per user.

Decided at the prototype round: The pick and the queue come from 1.1 Next item (rows 1, 2, 3, 25); Keep answers the developer's question of how an agent score becomes a user score without re-entering the value (row 5). Revised at the third MVP iteration (#13): An agent score stays marked until the author keeps or corrects it, rather than only when written since the last visit, so that a skipped item keeps its mark. The Review controls, which the developer found hard to infer as toggles beside the Filter controls, follow a find bar: a strip at the chart's top edge with a start button per queue, labelled with its count, and, while a queue runs, the queue's name and position, Skip, and End review; Escape ends a review before it clears the selection. Revised at #91: The chart no longer computes a next pick, rings it, or shows it in the pane while nothing is selected, because the author did not use the suggestion, and its ring and the pane's Next pick mode presented an item that the author did not ask about. While nothing is hovered or selected, the pane reads "No item selected".

### GitHub adapter first, Jira adapter second

The GitHub adapter comes first, because using the tool on real data on the development machine is what keeps it from staying an idea. The local host reads its GitHub token from `GITHUB_TOKEN` or from `gh auth token`, so that the first run needs nothing beyond `gh auth login`. The Jira adapter comes second. It is built against a personal Atlassian site seeded by a script, and it depends on `@williamthorsen/atlassian-tools` for auth and transport.

The local host reads closed issues only within a window, `closedWindowDays` in its config file, measured back from each read by the date each issue was closed, because Done is hidden by default and an unbounded read would fetch years of closed issues on every read. The window is in the config file rather than in Settings, because it bounds the adapter's read as the repository list does, rather than being the user's state. The adapter narrows the read with the API's `since` filter, which compares the update time, and drops the issues closed before the window. Decided at the closed-items iteration (#16).

Revised after the developer evaluation: The decision did not say where the local host gets its GitHub token, and whether it is a pasted personal access token or the one that `gh` already holds decides the first hour.

### When the host reads GitHub

The local host reads a repository's issues only once the chart shows the repository, and keeps each repository's last successful read in memory with its own read time. The first load reads the repositories that the chart opens with, the default collection's or every configured repository's, plus the repository of the item that the URL selects; the host starts that read when it starts. A load is served from the kept reads at once, and waits only for a repository that has not been read. When the chart shows another repository, the page asks the host for it, and the host reads it unless it has read it already. When a shown repository's read is more than a minute old, the page asks the host for a fresh read of it in the background and replaces that repository's issues when it arrives; concurrent requests share one read of a repository. The strip shows the oldest read among the shown repositories, with a Refresh button that reads the shown repositories again at once. A failed read keeps the last issues on the chart, and the page says that the read failed. An override of an item in a repository that a read does not include is kept, because the read says nothing about that item.

Only the issues are kept in memory. Scores, status overrides, the last visit, and settings are the app's own data, so every load reads them from the store, and a refresh leaves the page's copies alone so that it cannot overwrite a write in progress. The CLI is a separate process and reads GitHub on each run. Moving between the chart and Settings stays a page load, because the cache also covers a reload. Decided at #47: Every load read every repository before it drew, so returning from Settings showed "Loading issues" for seconds although the issues had rarely changed. Revised at #73: The host read every configured repository, whatever the chart showed, so an author who configured all their repositories waited for all of them.

### Status is a derived category with an override, and Done is read-only

Each adapter derives an item's status category from its source, and the app stores an override. Jira gives every status a status category, To Do, In Progress, or Done, so the Jira adapter reads the category without any per-project mapping. GitHub issues do not have a native "in progress" state, so each repository has a status strategy, which reads an open item's status at its source into the work item's `sourceStatus` and writes a status change there. The label strategy, the first, reads and writes the label that [`IN_PROGRESS_LABEL`](../packages/adapter-github/src/status-strategy.ts) names, which release-kit's common label preset defines; it matches the label case-insensitively, and reports the label that it read, as written, in the work item's `sourceStatusLabel`. The Project strategy, the second, reads the option of a GitHub Project's Status field: An open issue is In progress when its option is one of the project's In progress options, and To do otherwise, including an issue that is not an item of the project and one whose option is Done, because Done follows only from the closed state and an open issue in the Done column is still open work. Its write adds the issue to the project when it is not yet an item, then sets the first option listed for the status. A strategy reads inside the adapter's issues query, which asks for project items only for a repository that names a project, so that only those repositories need the token's `project` scope. Adding the strategy changed neither the chart nor the store. On the standalone host, a repository whose config entry names a project uses the Project strategy, and every other repository uses the label strategy; the config file lists a project's options when they differ from GitHub's defaults, which [`DEFAULT_PROJECT_STATUS_OPTIONS`](../packages/adapter-github/src/project-status.ts) names. The host refuses to start when it cannot read a configured project or its single-select Status field, or when the field lacks a listed option, because the config then does not describe the project; it warns when a classic token's scopes allow the read but not the strategy's writes. The source's done state outranks the override, an override that still applies outranks the source's status, and the source's status outranks the To do default. A change of the source's state clears the override, so that an item closed at the source does not reappear as in progress after a refresh.

The detail pane shows status as one segmented control, To do, In progress, Done, because status is an enum and a checkbox beside a chip said the same thing twice. Done is read-only: It is the issue's state on the tracker. Setting In progress or To do on an item whose repository has a strategy writes the status at the source first and then deletes the item's stored override, so that a write that the source refuses, such as one to a repository that lacks the label, leaves the status, the labels, and the store as they were. The host never creates an override for such an item, and an override stored before the strategy keeps applying until the author next sets the item's status. An item without a strategy, such as an in-app item, keeps its status as an override. A Jira adapter cannot write status until it can find the transition that lands in a category.

Revised after the developer evaluation: The decision had no precedence rule between the source and the override. Revised at the prototype round: The checkbox became an enum, and the developer settled status writes as read-only for now. Revised at #50: An In progress that only the app stored was invisible at GitHub, and a label shows it there and to every tool that reads labels. Revised at #52: A GitHub Project's Status field shows status on a board at GitHub and is set to Done when an issue closes, so a repository can track status there in place of the label; the label stays the default.

### Custom tasks

A custom task is a store record whose remote link is empty. It needs neither a tracker nor an adapter. It is the one kind of item whose status the app may set.

### The core publishes to npm

The core publishes to npm with provenance, because the Forge host lives in a work repository and the web host in `skypilot-site`, and each consumes the core as versioned packages. The local host stays in this repository.

### Relationships

A blocker is an arrow from the blocking item to the blocked one. GitHub's blocked-by relations and Jira's "blocks" links are blockers; sub-issues and other links are plain relations, which render the same way without an arrowhead. Arrows appear while a circle is hovered and stay while it is selected, and a switch shows all of them. Focus shows the item's direct edges at full weight and its transitive chain at reduced weight, and fades every unrelated circle.

An item that an open item blocks wears a red ring, and the arrow into it is red; a blocking item carries no mark of its own, because the arrow out of it says enough. A hidden done item keeps a ghost at its true point while an edge reaches it, and a click on the ghost reveals that one item. The longest blocker chain is an advanced view under a More menu, not a top-level control.

Edges never move circles, because a circle's position states the item's urgency and value, and moving it would misstate them.

An edge joins two circles in the matrix only. A gutter cell's list scrolls within the cell, so an edge cannot anchor on its rows, and the pane's relation list covers an item that the gutter holds or that the chart does not load. A sub-issue edge has no arrowhead, as the decision above states. While a review runs, the review's fade governs and the focus fade is off, so that the queue stays legible as the review steps; the edges still follow the hovered or selected item. Decided at the fourth MVP iteration (#14).

The longest chain is the longest path of blocker edges among the open items that the filter shows, counted in items, because an item without effort would count as zero in a sum of remaining scope and shorten a real chain. A chain has at least two items; a tie goes to the chain whose keys sort first, and an edge that would close a cycle in the source data is ignored. A More menu button at the end of the strip's view controls holds it as a checkable item, following the menu button pattern, because More is an overflow menu that later advanced views join; the item is disabled while the filtered items contain no chain. While the view is on, the chain's fade governs as a review's does, its edges draw at full weight, and the strip shows the chain's length with an End chain view button, because the menu hides the item's checked state while it is closed. The view and a review exclude each other, since two fades cannot both govern. A filter change recomputes the chain, because the view is not a queue that the change would replace, and a filter that leaves no chain turns the view off. The view resets on reload, like the other view controls. Decided at the longest-chain iteration (#22).

A ghost is the dashed outline of a hidden, scored done item in a shown repository at the end of a shown edge. It is packed in the item's cell after the visible circles, so that a ghost that appears on hover never moves a circle; an unscored done item has none, because its edge would end in a gutter. Activating a ghost selects the item and reveals it alone, rather than turning on Done, which would bring back every closed item; the item stays revealed until the next change in the Filter group or a reload, and the reveal ends a running review, as a filter change does. Decided at the closed-items iteration (#16).

What the chart draws depends on the filter alone, never on which repositories the host has read, so that the chart looks the same whatever the author showed earlier. An item in a repository that the filter hides, read or not, has neither a circle, an edge, nor a ghost unless a relation row reveals it alone; the pane lists it from the relation, and an item that it blocks keeps its red ring, because the ring follows from the blocked item's own relations. Decided at #73. Revised at #87: A revealed item is drawn whatever its repository.

Revised after the developer and interaction designer evaluations: The decision did not name which source relations are blockers, and it used hover and selection interchangeably. Revised at the prototype round: 4.1 Blocker edges won the round on these edges (rows 19, 21, 22); the red ring replaces red on both ends, which the developer found confusing.

### Original and remaining scope

The Scope control switches a circle's area between original scope and remaining scope. Remaining scope is effort × (1 − progress). Area is proportional to scope on one scale across both modes, so that an item changes size only when its data does, and a circle whose scope falls below the smallest legible area takes a minimum radius that is marked as a floor.

Revised after the data-visualization evaluation: Remaining scope reaches zero, and a circle without area vanishes or takes an unmarked minimum that breaks the area-to-scope ratio.

The control is "Scope" in the strip, a segmented control with an Original and a Remaining segment, and it resets to Original on reload like the filter. A ghost follows the Scope control, so that it and its circle never use two scales. A done item's remaining scope follows the formula, because its fill already marks it done. Decided at the drag-and-scope iteration (#19). Revised at #41: The scope was a toggle, which hid that it is a choice between two modes rather than an on/off setting.

### Visual channels

Fill carries status: A to-do circle is translucent, an in-progress circle shows a solid pie for its remaining fraction, with a floor width so that a nearly finished item still reads as in progress, and a done circle is grey. At remaining scope the in-progress circle is wholly solid, because size then carries the remainder and a pie on top would discount it twice. Done circles carry no checkmark.

The border carries work type, from a classifier over the item's labels: feature from feat, feature, and enhancement; bug from bug, fix, and defect; task from chore, task, refactoring, and the other code-change labels; ops from ops, operations, and admin, because a non-code to-do is qualitatively different from the rest and the distinction is worth keeping. A user whose labels follow another scheme edits the mapping in Settings; a saved mapping replaces the default whole, so that a default label can be removed, and Settings refuses a label in two types, because the classifier's order would otherwise decide silently. An unmapped item has a neutral border. The chart carries a legend, and the legend opens the mapping as a popover with a link to Settings.

Added after the data-visualization evaluation: The doc assigned no channel to status or category. Revised at the prototype round: The developer chose the pie over the arc (row 32) and the four-type classifier over a border per label (rows 11, 12); 2.1's text codes with legend chips (rows 10, 13), 4.1's dash patterns (row 12), the checkmark (row 38), and 3.1's diamond mark (row 37) were dropped. Decided at the Settings iteration (#27): the whole-mapping replacement and the refusal of a label in two types.

### Circle labels and repo abbreviations

A circle shows its id as the repo's abbreviation and the number, `N.382`, because a bare number is not helpful across repos. While the filter shows one repo, the number alone. A Jira key stacks over its number in a smaller font. Abbreviations default to the repo's first letter, uppercased, and are mapped per repo in Settings, because two repos can share a letter. Settings is the only place that changes a stored abbreviation; the CLI's `seed-abbreviations` sets only those of repos that do not have one, and refuses a seed that would leave a repo that it sets sharing an abbreviation. Settings refuses a save that leaves two repos sharing an abbreviation, compared case-insensitively, and while a clash remains the page shows an alert that links to Settings. The host does not refuse to start over a clash, because the refusal would lock the author out of the page that fixes it. Larger circles add the title at higher zoom.

Decided at the prototype round (row 26). Revised after the first MVP iteration (#11): The author's own repos share first letters (`codeassembly`, `codeassembly-guidance`, `configs.macos`), so ambiguous ids appeared from the first run, before Settings. Revised at the Settings iteration (#27): The config file's `abbreviation` field and the startup refusal were retired in favour of Settings and the alert. Decided at #64: The default is uppercase, because `T.11` is easier to tell apart from its number than `t.11`; a stored abbreviation keeps the case in which it was entered. Decided at #70: The CLI seeds abbreviations that are not yet stored, so that a user with many repos, or with prefixes kept elsewhere, does not enter each one in Settings; it never changes a stored one, so that Settings stays their only editor.

### Detail in a side pane

Detail lives in a side pane on desktop and a bottom sheet on a phone, never in a tooltip, because a tooltip jumps and cannot carry the pane's structure. The pane shows the id with an external-link icon to the source, the title, the status control, the four scores as compact segmented controls, each with a clear button and with a caption only where the caption states what the control cannot, and the relations as lists of rows with the id in monospace and the title, each row tagged closed or blocked where that holds, in the colour that the chart gives the state: the grey of a done circle and the red of the blocked ring. Hovering a relation row rings its circle on the chart. Activating a relation row whose item the chart was given selects that item, as a history entry, and moves focus to its title; when the filter hides the item, by status or by repository, the row reveals it alone, as a ghost does, rather than showing it in the pane alone, because a Back or Forward to a pane-only selection would widen the filter under the rule for a key that arrives from the host. A row whose item the chart was not given, such as one in a repository that the host has not read, links to the source in a new tab with the external-link icon. Decided at #87. A segmented control is one tab stop, and arrow keys move within it. The pane takes the room that a wide window offers and is resizable. While an item is selected, the pane shows a Close button that clears the selection, because touch has no Escape key; on a phone, the page leaves room to scroll the chart above the sheet.

Decided at the prototype round: The relations list comes from 1.1 (row 30), and 4.1's pane won on feel (row 29); the "Open" state chip (row 34), the "Open on GitHub" button (row 36), and 3.1's tall rating buttons (row 24) were dropped. Revised after the first MVP iteration (#11): On a phone, the sheet covered the corner cell and offered no way to dismiss it. Revised at the second MVP iteration (#12): Progress is a range in steps of 5 % with a readout rather than a segmented control, because twenty-one segments do not fit the pane; Status, Urgency, Value, and Effort stay segmented. The points move to Effort's line, because under Progress one line would join two scores' provenance. Revised at #86: Each score control has a clear button (×) joined to its end, following a search input's clear button; it hides while the row is unscored and keeps its space, so that the row does not shift. A None segment was rejected, because the arrow keys choose as they move, so a stray keystroke would remove a label at GitHub, and a separate Clear button per row took too much space at the mockup round. A row's caption reads only `Agent · {date}` under an agent's unreviewed score and `Unsized, drawn at the floor` under an empty Effort, because the label, author, points, and Unscored captions restated the control or the normal case.

### Filter and fade

Two behaviours are kept distinct. A filter removes items from the board: the Repos filter of collections and repositories, and the status filter of To do, In progress, and Done, each a filter chip, with Done off by default. A fade keeps every item in place and dims the unrelated ones: focus on an item, the longest chain, a review queue, "Changed since the last visit", and a hovered cell. A faded circle stays selectable, and the selected circle never fades.

Decided at the prototype round (rows 22, 27): The developer asked for the distinction, and found that 4.1 disabled faded circles.

Each kind of control in the strip takes the standard form for its behaviour, so that its appearance says what a press does. A filter is a filter chip: a pill with its count, which shows a check on a tinted fill while it is on. A drawing behaviour that turns on or off at once, such as "All edges", is a switch. A choice between modes, such as Scope, is a segmented control. More is a menu button with a caret, and while its menu is open it does not look like a control that is on. Decided at #41: The strip drew filters, view settings, and the menu button in one style, and an open menu looked like a pressed toggle.

The filter is not persisted: On every load it resets to the user's default collection, or to every repo without one, because a narrowed board that survives a restart hides items without saying so. A reset to a collection still makes the narrowing visible, because the Repos button's label names the collection. A filter change ends a running review, because the change would replace the queue under it. Both review queues run over the filtered items, so that narrowing the board also narrows what the author is asked to do next. While the filter shows one repo, selected alone or through a collection of one, circles and gutter rows show the number alone, because the abbreviation would repeat on every item; the pane keeps the abbreviated id, because its relation rows can name items of other repos. Decided at the fifth MVP iteration (#25). Revised at #69: The reset to every repo cost an author who works on a few repos at a time the selection on every reload.

A collection is a named group of configured repos that each user defines in Settings, and one of them can be the default. Collections belong to Top Right rather than to the config file: They narrow within the config's repository list, which still bounds what the host reads. The Repos filter is a menu button, as More is, whose checkable items are All repos, then the collections and the repos in two labelled groups. The chart shows the union of the selected entries, and All repos, checked while nothing is selected, clears the selection. The menu stays open while entries are toggled, because a selection of several entries would otherwise cost a reopen per entry. The button's label names what the chart shows: All repos, or the selected collections and repos. Revealing an item outside the selection, through a link or Back, adds its repo to the selection rather than selecting every repo. Decided at #69.

### Zoom and navigation

The chart area sets the size of the matrix's cells, and the magnification sets the size of everything drawn in them: text, circles, strokes, and gutter rows. The matrix always fills the chart area with square cells, and the dimension with spare room stays empty, so a larger window or pane gives a crowded cell more room rather than larger circles. A cell is never smaller than its natural size at the current magnification; a narrower area, such as a phone's, keeps that size and scrolls. The magnification takes fixed steps: 50, 75, 100, 125, 150, 200, 300, and 400 %, where 100 % puts the chart's text at its 12 px floor. It is a reading preference that the host keeps, so it survives a reload; the local host keeps it per device, because a phone and a wide monitor want different magnifications, and the chart opens at 100 % without a kept value.

The zoom control follows a document editor's: a zoom-out button, a readout of the magnification that opens a menu of the steps, and a zoom-in button, among the strip's view controls. Ctrl or Cmd with the wheel, a trackpad pinch, and a two-finger touch pinch over the chart also step the magnification, and the browser's page zoom does not fire there; so do `+`, `-`, and `0`, which returns to 100 %, while focus is in the chart or on nothing, but not in a text field or a slider. The control and the keys keep the centre of the visible area in place, and the wheel and the pinch keep the point under the pointer.

While the matrix is larger than the chart area, a mouse or pen drag pans it, with a grab cursor, as "Pointer model" states. A Top right control, with a quadrant icon, jumps to the top-right quadrant. Hovering an empty spot in a cell shows a one-line callout for every circle in the cell, over faded neighbours, so that a crowded cell can be read without zooming.

Each click selection is a history entry, so Back returns to the previous circle, and a selected item's URL can be shared. Hover and keyboard moves push nothing.

The host owns the URL, because a Forge Custom UI iframe does not own the page's: The chart takes the selected key and reports each change with whether it is a history entry. A selection that the author makes, by a click or a key on a circle, a gutter id, or a table row, or by Close or Escape, is one; a selection that the chart makes itself, such as a review step or a filter that hides the selected item, replaces the current entry. A key that arrives from the host while the filter hides its item widens the filter to show it, so that a link or a Back never lands on nothing; a key that names none of the loaded items selects nothing. The local host keeps the key in the `item` query parameter. Decided at the sixth MVP iteration (#26).

Decided at the prototype round: The callouts (row 31), drag to pan (row 35), and deep links (row 33) are the developer's ideas; the Top right control comes from 3.1 and 4.1 (row 23). 2.1's chart that scrolls at 1× so that the densest cell fits was adapted into fit-at-1× with zoom (row 7), because a chart that scrolls at 1× loses the whole-board view. Revised after the first MVP iteration (#11): At 390 px, a matrix fitted to the width scales its 12 px labels to about 6 px, so the phone keeps the floor and scrolls. Revised at #42: Fixed steps replace continuous zoom, and the 50 and 75 % steps take the matrix below the floor when the author chooses them. Revised at #43: The page opens at Fit, which follows the chart area's size, because a matrix that opens at 100 % leaves most of a wide window empty. Revised at #66: The chart area sizes the cells and the magnification sizes their contents, which replaces Fit, because one scale for both magnified every label and circle up to four times on a wide window rather than giving crowded cells more room.

### Pointer model

A drag moves only the already-selected circle; a drag on anything else pans. On touch that is the only way a tap, a pan, and a drag coexist, and on a mouse the one extra click prevents an accidental rescore. Larger circles draw first, so the smallest circle under a tap is the one that takes it. Keyboard navigation between circles, arrow keys that step a score, and Escape that reverts a move are deferred: welcome, but not a premium for the first user, and built after the pointer and touch model is settled.

Decided at the prototype round: From 3.1 Thumb and arrow keys (rows 14, 16); row 15 deferred.

A drag starts once the pointer moves more than 4 px from the press, so that a slightly moving click still clicks, and only from a press on the selected item, so that the press that selects never drags. The item stays dimmed in place while a proxy follows the pointer, and only a scored cell other than the item's own highlights. A drop there writes urgency and value in one write; a drop on the item's own cell writes nothing, because an author write would turn every agent score on the item into the author's and act as Keep. The chart does not scroll by itself near its edge during a drag, because on a phone the author scrolls to the target cell first. The pane's segmented controls are the single-pointer alternative to the drag. Decided at the drag-and-scope iteration (#19).

A mouse or pen drag on anything other than the selected circle pans a matrix that is larger than the chart area, once it passes the same 4 px threshold, so that a click still selects; the click that ends a pan selects nothing. Touch keeps the browser's own scrolling, which already pans. Decided at #42.

### The table

The table below the chart is a second view of the same items and the same selection: Columns sort, status sorts by its enum order, a row click selects the row's circle with the same deep link, the selected circle's row highlights, and an external-link icon opens the source. The chart and the table sit in panes separated by a resizable divider, and the table scrolls within its pane. The legend is a strip pinned under the chart.

Decided at the prototype round, from the developer's comments on the baseline; not rendered in the prototype.

Revised at the sixth MVP iteration (#26): At 760 px wide or narrower, the panes stack without a divider and the page scrolls, because a scrolling table inside a scrolling page fails on touch. Hovering a row rings its circle without previewing the pane, as a relation row does. Rows do not fade, since the fade belongs to the chart, and neither the sort nor the split survives a reload, like the filter.

### The host owns the shell

The local host shows a header on every page, the chart and Settings alike, and while a page loads or has failed to load: the product's name, which links to the chart, and a link to each page, with the current page marked. The header's links carry the selected item, so that a round trip through Settings restores the selection. The host owns the header rather than the chart package, so that an embedding host, such as a Forge Custom UI app, keeps its own chrome; the chart and Settings components therefore do not link to the host's pages, except the legend's mapping popover, which links to Settings in context. Settings takes the host's own sections after its forms, and the local host adds a read-only Repositories section that lists the repositories and the path of the config file that it read; the list stays in the config file for the reason that "GitHub adapter first, Jira adapter second" gives for the closed window. Decided at #65: Neither page named the product, the links between the pages were small and placed apart, and only the README said where the repositories are configured.

## Rejected alternatives

- Separate apps for GitHub and Jira: Each app would duplicate the model, scoring, layout, and chart. One core with an adapter per source keeps a single copy.
- Scores as Jira custom fields: A custom field needs a site admin to create it and changes the issue schema for every user of the site. It also holds one value per issue, which cannot key a score by user.
- Labels as the store of scores: Labels are free text shared by everyone who reads the source, and they cannot hold a number cleanly. They also cannot key a score by user. Revised at #45: The app reads a label as one source of a score, ranked below a stored score, and still stores every score that it writes in its own store; "Labels as a source of a score" states the rule.
- A default score for an unscored item: A default position states an urgency and a value that nobody assigned, which is the misstatement that the chart exists to avoid. Added after the interaction designer evaluation.
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

Questions for the round, answered: Unscored items render in the gutters and are scored through the Unscored queue; drag sets urgency and value alone and works only on the selected circle; keyboard focus and Escape are deferred with the keyboard model; a rescored circle shows a trail from its previous cell during review; the smallest circles carry their id beside them in the gutters and none inside the matrix until zoom.

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

- `packages/model`: work items, scores keyed by user, status categories and the override, relationships and the longest blocker chain, the work-type classifier and its mapping, the score-label mapping and the resolution of label scores, collections and the repos that a filter's selection resolves to, and the review queues
- `packages/chart`: the browser chart, its detail pane, the table, the Repos filter, and the Settings forms, collections among them, which take props only, with the cell packing and the gutters inside it, and the selection that the chart and the table share
- `packages/adapter-github`: the GitHub adapter, which reads issues, writes their labels, and provides the status strategies
- `packages/store`: the store interface, with scores, status overrides, the last visit, and the settings that Settings edits (the type mapping, the score-label mapping, the repo abbreviations, and the collections with the default collection), each per user, and the conformance tests that every store runs
- `apps/standalone`: the local host, which implements the store on SQLite, keeps the last read of the issues in memory, writes the author's levels to labels through the adapter, serves the page with its header and the Repositories section of Settings, and keeps the selection in the page's URL

The Jira adapter, `packages/adapter-jira`, is added after the MVP, when its iteration starts. Every package under `packages/` is part of the published core. `apps/standalone` stays in this repository and is not published.
