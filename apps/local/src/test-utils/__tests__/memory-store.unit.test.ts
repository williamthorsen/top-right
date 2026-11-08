import { describeStoreContract } from '@top-right/store/testing';

import { createMemoryStore } from '../memory-store.ts';

describeStoreContract('MemoryStore', () => ({ store: createMemoryStore(), close: () => {} }));
