const sameAnswers = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, index) => value === b[index]);
const sameProgress = (a, b) =>
  a?.id === b?.id &&
  a.currentQuestion === b.currentQuestion &&
  sameAnswers(a.answers, b.answers);

// The draft also records the request in flight, so a refresh can recognize its
// own server acknowledgement without overwriting changes made in another tab.
export function createAttemptSaver(initial, options) {
  let storage;
  try {
    storage = options.storage ?? globalThis.localStorage;
  } catch {
    // Saving to the server still works when browser storage is unavailable.
  }
  const key = `jianji-contrast-draft-v1:${initial.id}`;
  const clearDraft = () => {
    try {
      storage?.removeItem(key);
    } catch {}
  };
  let current = initial;
  let baseline = initial;
  let inFlight = null;
  let generation = 0;
  let savedGeneration = 0;
  let running = null;
  let disposed = false;
  try {
    const draft = JSON.parse(storage?.getItem(key) || "null");
    const latest = draft?.latest;
    const valid =
      latest?.id === initial.id &&
      latest.answers?.length === initial.answers.length &&
      latest.answers.every(
        (answer) => Number.isInteger(answer) && answer >= -2 && answer <= 4,
      ) &&
      Number.isInteger(latest.currentQuestion) &&
      latest.currentQuestion >= 0 &&
      latest.currentQuestion < initial.answers.length;
    const ownBaseline =
      initial.revision === draft?.baseline?.revision &&
      sameProgress(initial, draft?.baseline);
    const ownAcknowledgement =
      initial.revision === draft?.inFlight?.revision + 1 &&
      sameProgress(initial, draft?.inFlight);
    if (
      valid &&
      (ownBaseline || ownAcknowledgement) &&
      !sameProgress(initial, latest)
    ) {
      current = {
        ...initial,
        answers: [...latest.answers],
        currentQuestion: latest.currentQuestion,
      };
      generation = 1;
    } else clearDraft();
  } catch {
    clearDraft();
  }
  function remember() {
    try {
      storage?.setItem(
        key,
        JSON.stringify({ baseline, inFlight, latest: current }),
      );
    } catch {}
  }
  function flush() {
    if (disposed) return Promise.resolve(false);
    if (running) return running;
    if (generation === savedGeneration) return Promise.resolve(true);
    options.onSaving?.(true);
    options.onError?.(null);
    running = (async () => {
      try {
        while (!disposed && savedGeneration < generation) {
          const sentGeneration = generation;
          const snapshot = {
            ...current,
            answers: [...current.answers],
            revision: baseline.revision,
          };
          inFlight = snapshot;
          remember();
          const saved = await options.request(snapshot);
          if (disposed) return false;
          baseline = saved;
          savedGeneration = sentGeneration;
          inFlight = null;
          // An older response must never move the visible question backwards.
          current =
            generation === sentGeneration
              ? saved
              : { ...current, revision: saved.revision };
          if (generation === savedGeneration) clearDraft();
          else remember();
          options.onChange?.(current);
        }
        return !disposed;
      } catch (error) {
        if (!disposed) {
          remember();
          options.onError?.(error);
        }
        return false;
      }
    })().finally(() => {
      running = null;
      if (!disposed) options.onSaving?.(false);
    });
    return running;
  }
  return {
    get: () => current,
    isDisposed: () => disposed,
    resume() {
      if (generation > savedGeneration) {
        options.onChange?.(current);
        void flush();
      }
    },
    update(patch) {
      if (disposed) return;
      current = { ...current, ...patch };
      generation++;
      remember();
      options.onChange?.(current);
      void flush();
    },
    flush,
    dispose({ discard = false } = {}) {
      disposed = true;
      if (discard) clearDraft();
    },
  };
}
