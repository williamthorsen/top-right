# Top Right design

This document records the product's idea, the decisions taken so far, and the reason for each. It is revised as the product moves through its stages, so that a new session knows the vision without being told.

## Purpose

Top Right plots work items as circles on a chart. Urgency runs along the x-axis and importance along the y-axis, so that the work that matters most collects in the top-right corner. A circle's area shows the item's scope.

Each circle links to the item's source of truth and reveals the item's detail on hover or click. Circles are layered by status category (to do, in progress, done), and done items are hidden by default. Blockers render as directed edges, which appear when a circle is focused.

The primary user is the author, who runs Top Right locally as a personal tool. Agents and an editing UI both write scores. Later hosts serve developers at work, Jira customers, and small-scale users through skypilot.dev.

## Non-goals

- Replacing the tracker. GitHub and Jira remain the source of truth for an item's title, description, and state; Top Right stores only what the sources do not hold.
- Planning by dependency. Relationships are shown on the chart but never position a circle.
- A hosted service before there is demand for one.

## Stage

The product is at the idea stage of the product-development workflow: The idea and the decisions below are recorded, and the prototype round has not run. The next stages are evaluations of the idea from other roles, a brief for the prototype round, and the round itself. This document becomes the end vision once that round has taught what the product should be.

The project declares its maturity, sensitivity, and audience in [`.agents/preferences.yaml`](../.agents/preferences.yaml). The values settle these decisions:

- Maturity and audience: The first host is a local process with a SQLite file, and it does not add access control beyond the tokens of the source platforms.
- Sensitivity: The data is the author's own GitHub issues. A host that reads an employer's Jira site raises it.

## Decisions

### Three hosts on one core

A local process comes first, a Forge app second, and a hosted web app last, only on demand. The core is the model, scoring, layout, chart, adapters, and store interface; a host supplies auth, storage, and a place to run.

The order follows the users: The author is the first user and needs only a local process. A Forge app reaches Jira customers inside the platform that they already use. A hosted app costs infrastructure to run, so it waits until someone needs it.

### Seams fixed at MVP time

- The chart is pure browser code that takes props and never fetches, so that it renders unchanged inside a Forge Custom UI iframe and on a web page.
- The Jira adapter takes an HTTP client rather than a token. Forge supplies `requestJira`, and the local host supplies a client that holds a token.
- The store is an interface with SQLite behind it, so that Forge storage or a hosted database can replace SQLite without a change to the core.
- Scores are keyed by user from the first release, so that a host with several users does not need a migration.

### Scores live in the app's store

Urgency, importance, effort, and progress live in the app's store, because the sources do not have fields for them. Jira issue entity properties are an optional write-through. An item's category comes from the source, through its labels or components.

### GitHub adapter first, Jira adapter second

The GitHub adapter comes first, because using the tool on real data on the development machine is what keeps it from staying an idea. The Jira adapter comes second. It is built against a personal Atlassian site seeded by a script, and it depends on `@williamthorsen/atlassian-tools` for auth and transport.

### Status is a derived category with an override

Each adapter derives an item's status category from its source, and the app stores an override. GitHub issues do not have a native "in progress" state, so the override is how an item gets one.

### Custom tasks

A custom task is a store record whose remote link is empty. It needs neither a tracker nor an adapter.

### The core publishes to npm

The core publishes to npm with provenance, because the Forge host lives in a work repository and the web host in `skypilot-site`, and each consumes the core as versioned packages. The local host stays in this repository.

### Relationships

A blocker is an arrow from the blocking item to the blocked one. Arrows appear when a circle is hovered or selected, and a toggle shows all of them. A plain relation renders the same way, without an arrowhead.

Edges never move circles, because a circle's position states the item's urgency and importance, and moving it would misstate them.

### Original and remaining scope

A toggle switches a circle's area between original scope and remaining scope. Remaining scope is effort × (1 − progress).

### Crowding

A collision layout keeps circles from overlapping while a leash holds each one near its true coordinates. Labels sit on the circles, and semantic zoom controls how much detail a dense region shows. Together they keep crowded regions readable without misstating any item's position.

## Rejected alternatives

- Separate apps for GitHub and Jira: Each app would duplicate the model, scoring, layout, and chart. One core with an adapter per source keeps a single copy.
- Scores as Jira custom fields: A custom field needs a site admin to create it and changes the issue schema for every user of the site. It also holds one value per issue, which cannot key a score by user.
- Labels as score carriers: Labels are free text shared by everyone who reads the source, and they cannot hold a number cleanly. They also cannot key a score by user.

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
