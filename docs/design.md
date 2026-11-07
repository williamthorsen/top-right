# Top Right design

This document records the product's idea, the decisions taken so far, and the reason for each. It is revised as the product moves through its stages, so that a new session knows the vision without being told.

## Purpose

Top Right plots work items as circles on a chart. Urgency runs along the x-axis and importance along the y-axis, so that the work that matters most collects in the top-right corner. A circle's area shows the item's scope.

A session's job is to choose the next item to work on and to re-score the items that have changed since the last session. A feature belongs in the MVP when the product cannot do that job without it.

Each circle links to the item's source of truth. Hovering a circle previews its detail; selecting it, by click or by keyboard, keeps the detail open and keeps the item's arrows shown. Circles are layered by status category (to do, in progress, done), and done items are hidden by default.

The primary user is the author, who runs Top Right locally as a personal tool. Agents and an editing UI both write scores. Later hosts serve developers at work, Jira customers, and small-scale users through skypilot.dev.

Revised after the product manager and interaction designer evaluations: The purpose described the chart and not the session's job, which the MVP boundary needs as its test, and it named hover as the one path to detail, which keyboard and touch do not have.

## Non-goals

- Replacing the tracker. GitHub and Jira remain the source of truth for an item's title, description, and state; Top Right stores only what the sources do not hold.
- Planning by dependency. Relationships are shown on the chart but never position a circle.
- A hosted service before there is demand for one.

## Stage

The product has passed the idea and opinions stages of the product-development workflow: The idea and the decisions below are recorded, five roles have evaluated the idea in the Evaluations section, and the decisions carry the revisions that those evaluations caused. The next stage is the prototype brief and the prototype round, which issue #6 owns. This document becomes the end vision once that round has taught what the product should be.

The project declares its maturity, sensitivity, and audience in [`.agents/preferences.yaml`](../.agents/preferences.yaml). The values settle these decisions:

- Maturity and audience: The first host is a local process with a SQLite file, and it does not add access control beyond the tokens of the source platforms.
- Sensitivity: The data is the author's own GitHub issues. A host that reads an employer's Jira site raises it.

## Decisions

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

Urgency, importance, effort, and progress live in the app's store, because the sources do not have fields for them. A score is keyed by the item's source identity and by user, so that it survives a refresh of the source. An item's category comes from the source, through its labels or components. Writing scores through to Jira issue entity properties waits for a Forge release after the first, so that the first Forge manifest requests read scopes only.

Revised after the Jira site admin and developer evaluations: The decision offered the entity-property write-through as optional from the start, and a Forge manifest declares its scopes for every user at install, so an unused write scope still costs the admin a write approval; the decision also did not say how a score keeps its item across refreshes.

### Unscored items and agent-written scores

A score is absent until an agent or the author writes it, never defaulted. Urgency and importance place an item, and the chart renders an item that lacks either apart from the placed ones rather than at a default position. A missing effort renders at the marked floor, and a missing progress leaves remaining scope equal to original scope. The first session's scores come from an agent that reads the backlog and scores it, and the author corrects them on the chart. An agent writes through the same store interface as the editing UI.

Added after the product manager, interaction designer, and developer evaluations: A real backlog arrives without scores, so the first session is empty or a pile at the origin unless something scores it, and a defaulted score misstates the item's position. Agent-written scores are also what sets the product apart from a priority field or a project board, and they had no decision of their own.

### GitHub adapter first, Jira adapter second

The GitHub adapter comes first, because using the tool on real data on the development machine is what keeps it from staying an idea. The local host reads its GitHub token from `GITHUB_TOKEN` or from `gh auth token`, so that the first run needs nothing beyond `gh auth login`. The Jira adapter comes second. It is built against a personal Atlassian site seeded by a script, and it depends on `@williamthorsen/atlassian-tools` for auth and transport.

Revised after the developer evaluation: The decision did not say where the local host gets its GitHub token, and whether it is a pasted personal access token or the one that `gh` already holds decides the first hour.

### Status is a derived category with an override

Each adapter derives an item's status category from its source, and the app stores an override. GitHub issues do not have a native "in progress" state, so the override is how an item gets one. The source's done state outranks the override, and a change of the source's state clears the override, so that an item closed at the source does not reappear as in progress after a refresh.

Revised after the developer evaluation: The decision had no precedence rule between the source and the override.

### Custom tasks

A custom task is a store record whose remote link is empty. It needs neither a tracker nor an adapter.

### The core publishes to npm

The core publishes to npm with provenance, because the Forge host lives in a work repository and the web host in `skypilot-site`, and each consumes the core as versioned packages. The local host stays in this repository.

### Relationships

A blocker is an arrow from the blocking item to the blocked one. GitHub's blocked-by relations and Jira's "blocks" links are blockers; sub-issues and other links are plain relations, which render the same way without an arrowhead. Arrows appear while a circle is hovered and stay while it is selected, and a toggle shows all of them.

Edges never move circles, because a circle's position states the item's urgency and importance, and moving it would misstate them.

Revised after the developer and interaction designer evaluations: The decision did not name which source relations are blockers, and it used hover and selection interchangeably, where hover is a preview and selection is the persistent state that keyboard and touch can reach.

### Original and remaining scope

A toggle switches a circle's area between original scope and remaining scope. Remaining scope is effort × (1 − progress). Area is proportional to scope on one scale across both modes, so that an item changes size only when its data does, and a circle whose scope falls below the smallest legible area takes a minimum radius that is marked as a floor.

Revised after the data-visualization evaluation: Remaining scope reaches zero, and a circle without area vanishes or takes an unmarked minimum that breaks the area-to-scope ratio.

### Crowding

A collision layout keeps circles from overlapping while a leash holds each one near its true coordinates. The leash's bound is stated in score units, a nudge never carries a circle across a quadrant line, and a displaced circle shows an anchor at its true point. Labels sit on the circles, and semantic zoom controls how much detail a dense region shows. Together they keep crowded regions readable and keep every displacement bounded and visible.

Revised after the data-visualization evaluation: The decision claimed that the layout misstates no position while it moves circles off their coordinates; the honest claim is a bounded displacement that the viewer can see.

### Visual channels

Fill colour carries status category, which has three ordered classes. Category, which is nominal and unbounded because it comes from labels, takes a secondary channel, an outline or a capped palette with every class past the cap collapsed into "other", and the prototype round picks which. The chart carries a legend.

Added after the data-visualization evaluation: The doc assigned no channel to status or category, and colour cannot carry more than about seven nominal classes.

## Rejected alternatives

- Separate apps for GitHub and Jira: Each app would duplicate the model, scoring, layout, and chart. One core with an adapter per source keeps a single copy.
- Scores as Jira custom fields: A custom field needs a site admin to create it and changes the issue schema for every user of the site. It also holds one value per issue, which cannot key a score by user.
- Labels as score carriers: Labels are free text shared by everyone who reads the source, and they cannot hold a number cleanly. They also cannot key a score by user.
- A default score for an unscored item: A default position states an urgency and an importance that nobody assigned, which is the misstatement that the chart exists to avoid. Added after the interaction designer evaluation.

## Evaluations

Five roles evaluated the idea at the opinions stage. Each subsection records the role's concerns, what the evaluation changed, and the questions that it leaves to the prototype round.

### Product manager

- The purpose described the chart and not the session's job, so the MVP boundary had no test to apply.
- A real backlog arrives unscored, so the first session is an empty chart or a pile at the origin.
- Personal scores over a shared tracker, written by agents, is what a priority field or a project board cannot copy, and it had no decision of its own.
- Nothing shows what changed since the last visit, which is what brings a user back.

What it would change: The session's job is now stated in Purpose, and "Unscored items and agent-written scores" is a new decision.

Questions for the round: What on the chart shows what changed since the last visit, and whether on-chart re-scoring is fast enough to become a session's habit.

### Interaction designer

- Four scores per item make a hundred items cost four hundred entries, and nothing stated a scoring flow, and an unscored item had no coordinates.
- The score scale, continuous or a small ordinal set, decides whether dragging a circle is a precise edit.
- Hover, focus, and selection were used interchangeably, and keyboard and touch have no hover.
- An agent can rescore a circle while the author is dragging it.

What it would change: Hover now previews and selection persists, in Purpose and "Relationships"; an unscored dimension is absent rather than defaulted, in "Unscored items and agent-written scores"; a default score is a rejected alternative. The score scale is a question for the round, because the round shows which scale reads.

Questions for the round: Where an unscored item renders and how a user scores many in sequence; whether drag sets urgency and importance alone and how it coexists with select; what keyboard focus and Escape do; how a circle that an agent rescored is shown moving; whether labels stay legible on the smallest circles.

### Data-visualization specialist

- The crowding decision claimed no misstatement while it moves circles off their coordinates.
- Coarse hand-scored axes make ties the rule, and the chart implies a precision that the scores lack.
- Remaining scope reaches zero, and an unmarked minimum radius breaks the area ratio.
- Status layering is draw order, so a large circle can hide a small one.
- The doc assigned no channel to status or category.

What it would change: "Crowding" now states a bounded, visible displacement; "Original and remaining scope" states one area scale with a marked floor; "Visual channels" is a new decision.

Questions for the round: Whether the axis scale is discrete or continuous and how a tie renders; whether the true-point anchor reads at the default zoom and the leash bound holds in the densest region; how many categories the backlog carries and whether colour survives layering; whether a fourfold scope difference reads as fourfold; how occlusion between layered circles is handled.

### Jira site admin

- An optional write-through still costs a write scope at install, because a Forge manifest declares its scopes for every user.
- The seam did not say whether `requestJira` runs as the user or as the app.
- Forge storage is scoped to the app, so the admin needs a statement of what the Forge host stores and how it is keyed.
- The sensitivity raise that a Jira host causes must be settled before the Forge host is designed, because it decides scopes and storage.

What it would change: The write-through waits for a Forge release after the first, in "Scores live in the app's store"; the Forge client runs as the user, in "Seams fixed at MVP time". The storage statement and the sensitivity raise are constraints on the Forge host and change nothing now.

Questions for the round: Which issue fields the detail reveal shows, because the set fixes the read scopes.

### Developer running it on their own backlog

- The token's source decides the first hour, and unscored items, refresh, and a score's survival across a refresh were unstated.
- The source of a blocker edge was unnamed.
- The status override had no precedence against the source.
- Done hidden by default still means fetching years of closed issues on every refresh unless the adapter bounds them.

What it would change: The token comes from `GITHUB_TOKEN` or `gh auth token`, in "GitHub adapter first, Jira adapter second"; the source's done state outranks the override, in "Status is a derived category with an override"; blocker sources are named, in "Relationships"; a score is keyed by source identity, in "Scores live in the app's store"; unscored items have a new decision. Refresh timing and the bound on closed issues are settled when the MVP is specified, because the round does not prototype adapters.

Questions for the round: How a user reveals a recently closed item once done is hidden, and whether the detail reveal shows the source state beside the override.

## Rough structure

The package split below is rough and is settled when the MVP starts.

- `packages/model`: work items, scores, status categories, relationships, and scoring
- `packages/layout`: the leashed collision layout, as pure code
- `packages/chart`: the browser chart, which takes props only
- `packages/adapter-github`: the GitHub adapter
- `packages/adapter-jira`: the Jira adapter
- `packages/store`: the store interface
- `apps/local`: the local host, which implements the store on SQLite

Every package under `packages/` is part of the published core. `apps/local` stays in this repository and is not published.
