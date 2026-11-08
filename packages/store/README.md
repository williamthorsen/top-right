<!-- readme-type: library -->

# Store

The interface through which a Top Right host reads and writes what the sources do not hold: each user's scores, status overrides, and the end of their last visit. Each host implements it on its own storage, so that the core does not change when SQLite gives way to Forge storage or a hosted database; [`docs/design.md`](../../docs/design.md) ("Seams fixed at MVP time") records why.

```ts
import type { Store } from '@top-right/store';

const scores = await store.writeScores('github:octocat', 'octocat/hello#1', { urgency: 4 }, 'author', new Date().toISOString());
```

An implementation proves that it honours the interface by running the shared tests from its own test file:

```ts
import { describeStoreContract } from '@top-right/store/testing';

describeStoreContract('MyStore', () => ({ store: new MyStore(), close: () => {} }));
```

<!-- section:release-notes --><!-- /section:release-notes -->

## Scripts

Workspace scripts (`build`, `check`, `lint`, `test`, `typecheck`) are run with `nmr` — see [Running scripts](../../README.md#running-scripts) in the root README. Run `nmr` from this directory to list this package's scripts.
