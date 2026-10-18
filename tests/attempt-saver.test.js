import { test } from "node:test";
import assert from "node:assert/strict";
import { createAttemptSaver } from "../src/attempt-saver.js";

const initial = () => ({
  id: "attempt-one",
  revision: 0,
  currentQuestion: 0,
  answers: [-1, -1, -1],
});
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) || null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
    size: () => items.size,
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("slow saves allow immediate navigation and preserve rapid edits in revision order", async () => {
  const pending = [];
  const changes = [];
  const saver = createAttemptSaver(initial(), {
    storage: memoryStorage(),
    request: (snapshot) =>
      new Promise((resolve) => pending.push({ snapshot, resolve })),
    onChange: (next) => changes.push(next),
  });
  saver.update({ answers: [0, -1, -1] });
  saver.update({ currentQuestion: 1 });
  saver.update({ answers: [0, 2, -1] });
  saver.update({ currentQuestion: 0 });
  saver.update({ answers: [3, 2, -1] });
  saver.update({ currentQuestion: 2 });
  assert.equal(saver.get().currentQuestion, 2);
  assert.deepEqual(saver.get().answers, [3, 2, -1]);
  assert.equal(pending.length, 1, "only one request may be in flight");
  const flushing = saver.flush();
  pending[0].resolve({ ...pending[0].snapshot, revision: 1 });
  await tick();
  assert.equal(
    saver.get().currentQuestion,
    2,
    "old response must not jump back a question",
  );
  assert.equal(pending.length, 2);
  assert.equal(pending[1].snapshot.revision, 1);
  assert.equal(pending[1].snapshot.currentQuestion, 2);
  assert.deepEqual(pending[1].snapshot.answers, [3, 2, -1]);
  pending[1].resolve({ ...pending[1].snapshot, revision: 2 });
  assert.equal(await flushing, true);
  assert.equal(saver.get().revision, 2);
  assert.equal(changes.at(-1).currentQuestion, 2);
});

test("a failed save keeps edits and final flush retries before submission is allowed", async () => {
  const storage = memoryStorage();
  let rejectRequest;
  let calls = 0;
  let lastError;
  const saver = createAttemptSaver(initial(), {
    storage,
    request: async (snapshot) => {
      if (++calls === 1)
        return new Promise((resolve, reject) => {
          rejectRequest = reject;
        });
      assert.equal(snapshot.revision, 0);
      return { ...snapshot, revision: 1 };
    },
    onError: (error) => {
      lastError = error;
    },
  });
  saver.update({ answers: [0, -1, -1] });
  saver.update({ answers: [1, 2, 3], currentQuestion: 2 });
  const failed = saver.flush();
  rejectRequest(new Error("offline"));
  assert.equal(await failed, false);
  assert.equal(lastError.message, "offline");
  assert.deepEqual(saver.get().answers, [1, 2, 3]);
  assert.equal(storage.size(), 1);
  assert.equal(await saver.flush(), true);
  assert.deepEqual(saver.get().answers, [1, 2, 3]);
  assert.equal(storage.size(), 0);
});

test("refresh recovers newer draft when the server acknowledged an older in-flight save", async () => {
  const storage = memoryStorage();
  let sent;
  let complete;
  const before = createAttemptSaver(initial(), {
    storage,
    request: (snapshot) => {
      sent = snapshot;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  before.update({ answers: [1, -1, -1] });
  before.update({ currentQuestion: 1 });
  before.update({ answers: [1, 3, -1] });
  const server = { ...sent, revision: 1 };
  before.dispose();
  complete(server);
  await tick();
  const after = createAttemptSaver(server, {
    storage,
    request: async (snapshot) => ({
      ...snapshot,
      revision: snapshot.revision + 1,
    }),
  });
  assert.equal(after.get().currentQuestion, 1);
  assert.deepEqual(after.get().answers, [1, 3, -1]);
  after.resume();
  assert.equal(await after.flush(), true);
  assert.equal(after.get().revision, 2);
  assert.equal(storage.size(), 0);
});

test("a local draft cannot overwrite newer progress from another tab", () => {
  const storage = memoryStorage();
  const before = createAttemptSaver(initial(), {
    storage,
    request: () => new Promise(() => {}),
  });
  before.update({ answers: [0, -1, -1] });
  before.update({ currentQuestion: 1 });
  before.dispose();
  const server = { ...initial(), answers: [3, -1, -1], revision: 1 };
  const after = createAttemptSaver(server, {
    storage,
    request: async () => {
      throw new Error("unexpected save");
    },
  });
  assert.deepEqual(after.get(), server);
  assert.equal(storage.size(), 0);
});
