import 'fake-indexeddb/auto';
import v8 from 'node:v8';

// jsdom lacks structuredClone, which IndexedDB uses for persisted values.
globalThis.structuredClone ??= value=>v8.deserialize(v8.serialize(value));
