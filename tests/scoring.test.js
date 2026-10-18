import { test } from "node:test";
import assert from "node:assert/strict";
import { questions, facets } from "../shared/contrast.js";
import { scoreAnswers, validateAnswers, quiz } from "../shared/scoring.js";
const answersFor = (fn) =>
  questions.map((q) => {
    const v = fn(q);
    return v === -2 ? -2 : q.reverse ? 4 - v : v;
  });
test("48 original questions have balanced, separated context pairs and eight support observations", () => {
  assert.equal(questions.length, 48);
  assert.equal(new Set(questions.map((q) => q.id)).size, 48);
  for (const f of facets)
    for (const context of ["public", "familiar"])
      assert.equal(
        questions.filter((q) => q.facet === f.key && q.context === context)
          .length,
        5,
      );
  for (let pair = 0; pair < 20; pair++) {
    const indices = questions
      .map((q, i) => (q.pair === pair ? i : -1))
      .filter((i) => i >= 0);
    assert.equal(indices.length, 2);
    assert.ok(Math.abs(indices[0] - indices[1]) >= 10);
  }
  assert.equal(questions.filter((q) => q.context === "support").length, 8);
  assert.ok(
    quiz("contrast").questions.every(
      (q) =>
        !Object.hasOwn(q, "reverse") &&
        !Object.hasOwn(q, "pair") &&
        q.options.length === 6,
    ),
  );
});
test("paired scores are directional, reversed items are scored, and stable patterns have zero contrast", () => {
  const a = answersFor((q) =>
    q.context === "public" ? 0 : q.context === "familiar" ? 4 : 2,
  );
  const r = scoreAnswers("contrast", a);
  assert.equal(r.contrast, 100);
  assert.ok(
    r.dimensions.every(
      (d) => d.publicValue === 0 && d.familiarValue === 100 && d.delta === 100,
    ),
  );
  const reverse = scoreAnswers(
    "contrast",
    answersFor((q) =>
      q.context === "public" ? 4 : q.context === "familiar" ? 0 : 2,
    ),
  );
  assert.equal(reverse.contrast, 100);
  assert.ok(reverse.dimensions.every((d) => d.delta === -100));
  assert.match(reverse.tagline, /公开互动/);
  const stable = scoreAnswers(
    "contrast",
    answersFor(() => 1),
  );
  assert.equal(stable.contrast, 0);
  assert.equal(stable.band, "相处同频");
  assert.match(stable.explanation, /变化较小/);
  assert.deepEqual(r, scoreAnswers("contrast", a));
});
test("all sixteen main profiles are reachable without treating middle answers as strong traits", () => {
  const names = new Set();
  for (let outer = 0; outer < 4; outer++)
    for (let inner = 0; inner < 4; inner++) {
      const a = answersFor((q) =>
        q.context === "public"
          ? q.facet === "voice"
            ? outer & 1
              ? 4
              : 0
            : q.facet === "assertion"
              ? outer & 2
                ? 4
                : 0
              : 1
          : q.context === "familiar"
            ? q.facet === "emotion"
              ? inner & 1
                ? 4
                : 0
              : q.facet === "play"
                ? inner & 2
                  ? 4
                  : 0
                : 1
            : 1,
      );
      const r = scoreAnswers("contrast", a);
      assert.equal(r.profile.outerId, outer);
      assert.equal(r.profile.innerId, inner);
      assert.equal(r.boundary, null);
      names.add(r.profile.name);
    }
  assert.equal(names.size, 16);
  const middle = scoreAnswers(
    "contrast",
    answersFor(() => 2),
  );
  assert.match(middle.profile.name, /过渡/);
  assert.ok(middle.boundary);
  assert.equal(middle.contrast, 0);
});
test("missing experiences are excluded as complete pairs, never filled or forced into a personality type", () => {
  const a = answersFor(() => 1);
  for (const pair of [0, 1])
    a[questions.findIndex((q) => q.pair === pair && q.context === "public")] =
      -2;
  const enough = scoreAnswers("contrast", a);
  assert.equal(enough.dimensions[0].pairedCount, 3);
  assert.equal(enough.contrast, 0);
  a[questions.findIndex((q) => q.pair === 2 && q.context === "public")] = -2;
  const missing = scoreAnswers("contrast", a);
  assert.equal(missing.sufficient, false);
  assert.equal(missing.contrast, null);
  assert.equal(missing.profile.name, "留白观察者");
  assert.equal(missing.dimensions[0].publicValue, null);
  const none = scoreAnswers("contrast", new Array(48).fill(-2));
  assert.equal(none.contrast, null);
  assert.equal(none.cue.value, null);
  assert.equal(none.cost.value, null);
  assert.equal(none.evidence.length, 0);
});
test("fatigue is independent of behavioral contrast and unsupported input is rejected", () => {
  const r = scoreAnswers(
    "contrast",
    answersFor((q) => (q.facet === "cost" ? 4 : 1)),
  );
  assert.equal(r.contrast, 0);
  assert.equal(r.cost.value, 100);
  assert.match(r.cost.text, /变化幅度较小.*耗能较明显/);
  for (const a of [
    [],
    new Array(48).fill(5),
    new Array(48).fill(null),
    new Array(48).fill("1"),
    new Array(48).fill(-1),
  ])
    assert.equal(validateAnswers("contrast", a, true), false);
  assert.equal(validateAnswers("contrast", new Array(48).fill(-1)), true);
  assert.throws(
    () => scoreAnswers("contrast", new Array(48).fill(-1)),
    /INVALID_ANSWERS/,
  );
});
