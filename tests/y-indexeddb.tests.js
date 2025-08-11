import * as Y from "yjs";
import {
  IndexeddbPersistence,
  clearDocument,
  PREFERRED_TRIM_SIZE,
  fetchUpdates,
} from "../src/y-indexeddb.js";
import * as t from "lib0/testing.js";
import * as promise from "lib0/promise.js";
import * as libidb from "lib0/indexeddb";

/**
 * Helper to count entries in the `updates` store for a given doc name.
 * @param {string} name
 */
const getUpdateCount = async (name) => {
  const db = await libidb.openDB(name, () => {});
  const [updates] = libidb.transact(db, ["updates"], "readonly");
  const cnt = await libidb.count(updates);
  db.close();
  return cnt;
};

/**
 * @param {t.TestCase} tc
 */
export const testPerf = async (tc) => {
  await t.measureTimeAsync(
    "time to create a y-indexeddb instance",
    async () => {
      const ydoc = new Y.Doc();
      const provider = new IndexeddbPersistence(tc.testName, ydoc);
      await provider.whenSynced;
      provider.destroy();
    }
  );
};

/**
 * @param {t.TestCase} tc
 */
export const testIdbUpdateAndMerge = async (tc) => {
  await clearDocument(tc.testName);
  const doc1 = new Y.Doc();
  const arr1 = doc1.getArray("t");
  const doc2 = new Y.Doc();
  const arr2 = doc2.getArray("t");
  arr1.insert(0, [0]);
  const persistence1 = new IndexeddbPersistence(tc.testName, doc1);
  persistence1._storeTimeout = 0;
  await persistence1.whenSynced;
  arr1.insert(0, [1]);
  const persistence2 = new IndexeddbPersistence(tc.testName, doc2);
  persistence2._storeTimeout = 0;
  let calledObserver = false;
  // @ts-ignore
  arr2.observe((event, tr) => {
    t.assert(!tr.local);
    t.assert(tr.origin === persistence2);
    calledObserver = true;
  });
  await persistence2.whenSynced;
  t.assert(calledObserver);
  t.assert(arr2.length === 2);
  for (let i = 2; i < PREFERRED_TRIM_SIZE + 1; i++) {
    arr1.insert(i, [i]);
  }
  await promise.wait(100);
  await fetchUpdates(persistence2);
  t.assert(arr2.length === PREFERRED_TRIM_SIZE + 1);
  t.assert(persistence1._dbsize === 1); // wait for dbsize === 0. db should be concatenated
};

/**
 * @param {t.TestCase} tc
 */
export const testIdbConcurrentMerge = async (tc) => {
  await clearDocument(tc.testName);
  const doc1 = new Y.Doc();
  const arr1 = doc1.getArray("t");
  const doc2 = new Y.Doc();
  const arr2 = doc2.getArray("t");
  arr1.insert(0, [0]);
  const persistence1 = new IndexeddbPersistence(tc.testName, doc1);
  persistence1._storeTimeout = 0;
  await persistence1.whenSynced;
  arr1.insert(0, [1]);
  const persistence2 = new IndexeddbPersistence(tc.testName, doc2);
  persistence2._storeTimeout = 0;
  await persistence2.whenSynced;
  t.assert(arr2.length === 2);
  arr1.insert(0, ["left"]);
  for (let i = 0; i < PREFERRED_TRIM_SIZE + 1; i++) {
    arr1.insert(i, [i]);
  }
  arr2.insert(0, ["right"]);
  for (let i = 0; i < PREFERRED_TRIM_SIZE + 1; i++) {
    arr2.insert(i, [i]);
  }
  await promise.wait(100);
  await fetchUpdates(persistence1);
  await fetchUpdates(persistence2);
  t.assert(persistence1._dbsize < 10);
  t.assert(persistence2._dbsize < 10);
  t.compareArrays(arr1.toArray(), arr2.toArray());
};

/**
 * @param {t.TestCase} tc
 */
export const testMetaStorage = async (tc) => {
  await clearDocument(tc.testName);
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(tc.testName, ydoc);
  persistence.set("a", 4);
  persistence.set(4, "meta!");
  // @ts-ignore
  persistence.set("obj", { a: 4 });
  const resA = await persistence.get("a");
  t.assert(resA === 4);
  const resB = await persistence.get(4);
  t.assert(resB === "meta!");
  const resC = await persistence.get("obj");
  t.compareObjects(resC, { a: 4 });
};

/**
 * @param {t.TestCase} tc
 */
export const testEarlyDestroy = async (tc) => {
  let hasbeenSyced = false;
  const ydoc = new Y.Doc();
  const indexDBProvider = new IndexeddbPersistence(tc.testName, ydoc);
  indexDBProvider.on("synced", () => {
    hasbeenSyced = true;
  });
  indexDBProvider.destroy();
  await new Promise((resolve) => setTimeout(resolve, 500));
  t.assert(!hasbeenSyced);
};

/**
 * Reproduces the unbounded growth on reopen without changes:
 * Opening the same document twice without modifying it should not
 * increase the number of entries in the `updates` store.
 * @param {t.TestCase} tc
 */
export const testNoGrowthOnReopenWithoutChanges = async (tc) => {
  await clearDocument(tc.testName);

  // First open
  const doc1 = new Y.Doc();
  const idb1 = new IndexeddbPersistence(tc.testName, doc1);
  await idb1.whenSynced;
  const c1 = await getUpdateCount(tc.testName);
  t.assert(c1 === 1);
  await idb1.destroy();
  doc1.destroy();

  // Re-open without making any changes
  const doc2 = new Y.Doc();
  const idb2 = new IndexeddbPersistence(tc.testName, doc2);
  await idb2.whenSynced;
  const c2 = await getUpdateCount(tc.testName);
  t.assert(c2 === 1);
  await idb2.destroy();
  doc2.destroy();
};

/**
 * When the store already contains updates, reopening should not add a new one.
 * @param {t.TestCase} tc
 */
export const testNoGrowthOnReopenWithExistingUpdates = async (tc) => {
  await clearDocument(tc.testName);

  // Open and perform a change so there are two entries (initial snapshot + 1 update)
  const doc1 = new Y.Doc();
  const idb1 = new IndexeddbPersistence(tc.testName, doc1);
  await idb1.whenSynced;
  doc1.getArray("a").insert(0, [0]);
  // wait until the update is written to IDB
  for (let i = 0; i < 50; i++) {
    const cnt = await getUpdateCount(tc.testName);
    if (cnt >= 2) break;
    await promise.wait(10);
  }
  const afterFirstSession = await getUpdateCount(tc.testName);
  t.assert(afterFirstSession === 2);
  await idb1.destroy();
  doc1.destroy();

  // Reopen without further changes; count should remain 2
  const doc2 = new Y.Doc();
  const idb2 = new IndexeddbPersistence(tc.testName, doc2);
  await idb2.whenSynced;
  const afterReopen = await getUpdateCount(tc.testName);
  t.assert(afterReopen === 2);
  await idb2.destroy();
  doc2.destroy();
};

/**
 * Edits are persisted across sessions; reopening without changes does not change count.
 * @param {t.TestCase} tc
 */
export const testPersistEditsAndStableCountOnReopen = async (tc) => {
  await clearDocument(tc.testName);

  // Session 1: initial open creates 1 snapshot, then make 3 edits
  const doc1 = new Y.Doc();
  const idb1 = new IndexeddbPersistence(tc.testName, doc1);
  await idb1.whenSynced;
  const arr = doc1.getArray("persist");
  arr.insert(0, ["a"]);
  arr.insert(1, ["b"]);
  arr.insert(2, ["c"]);
  // Wait until updates flush to IDB (expect 1 + 3 = 4)
  for (let i = 0; i < 100; i++) {
    const cnt = await getUpdateCount(tc.testName);
    if (cnt >= 4) break;
    await promise.wait(10);
  }
  const afterEdits = await getUpdateCount(tc.testName);
  t.assert(afterEdits === 4);
  await idb1.destroy();
  doc1.destroy();

  // Session 2: reopen, verify content and that count stays the same
  const doc2 = new Y.Doc();
  const idb2 = new IndexeddbPersistence(tc.testName, doc2);
  await idb2.whenSynced;
  const arr2 = doc2.getArray("persist");
  t.compareArrays(arr2.toArray(), ["a", "b", "c"]);
  const afterReopenCnt = await getUpdateCount(tc.testName);
  t.assert(afterReopenCnt === 4);
  await idb2.destroy();
  doc2.destroy();
};
