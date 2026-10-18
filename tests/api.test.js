import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, addCode } from "../server/database.js";
import { createApp } from "../server/app.js";
test("API enforces quota, ownership, concurrency, conflict checks, idempotency and private/public separation", async () => {
  const db = openDatabase(":memory:");
  addCode(db, "QA-FIRST-2026");
  addCode(db, "QA-OTHER-2026");
  const server = createApp({ db, config: { brand: "见己" } }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (
    path,
    { token, method = "GET", body, headers = {} } = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request("/tests/contrast")).status, 401);
    assert.equal(
      (
        await request("/session", {
          method: "POST",
          body: { code: "WRONGPASS" },
        })
      ).status,
      401,
    );
    const login = (
      await request("/session", {
        method: "POST",
        body: { code: "qa-first-2026" },
      })
    ).data;
    const token = login.token;
    assert.equal(login.remaining, 3);
    const other = (
      await request("/session", {
        method: "POST",
        body: { code: "QA-OTHER-2026" },
      })
    ).data.token;
    const parallel = await Promise.all(
      Array.from({ length: 5 }, () =>
        request("/attempts", {
          token,
          method: "POST",
          body: { quizId: "contrast", requestId: randomUUID() },
        }),
      ),
    );
    assert.ok(parallel.every((r) => r.status === 200));
    assert.equal(new Set(parallel.map((r) => r.data.attempt.id)).size, 1);
    assert.equal(parallel[0].data.session.remaining, 2);
    const initial = parallel[0].data.attempt;
    const answers = new Array(48).fill(2);
    answers[0] = 4;
    assert.equal(
      (
        await request(`/attempts/${initial.id}`, {
          token: other,
          method: "PUT",
          body: { answers, currentQuestion: 1, revision: 0 },
        })
      ).status,
      404,
    );
    const saved = await request(`/attempts/${initial.id}`, {
      token,
      method: "PUT",
      body: { answers, currentQuestion: 1, revision: 0 },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.revision, 1);
    const conflict = await request(`/attempts/${initial.id}`, {
      token,
      method: "PUT",
      body: { answers, currentQuestion: 1, revision: 0 },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.code, "REVISION_CONFLICT");
    assert.equal(
      (
        await request(`/attempts/${initial.id}/submit`, {
          token,
          method: "POST",
          body: { answers: new Array(48).fill(-1), revision: 1 },
        })
      ).status,
      400,
    );
    const completed = await request(`/attempts/${initial.id}/submit`, {
      token,
      method: "POST",
      body: { answers, revision: 1 },
    });
    assert.equal(completed.status, 200);
    const id = completed.data.resultId;
    assert.equal(
      (
        await request(`/attempts/${initial.id}/submit`, {
          token,
          method: "POST",
          body: { answers, revision: 1 },
        })
      ).data.resultId,
      id,
    );
    const report = await request(`/results/${id}`);
    assert.equal(report.status, 200);
    assert.equal(report.data.dimensions.length, 4);
    for (const key of ["answers", "token", "code_id", "request_id"])
      assert.equal(Object.hasOwn(report.data, key), false);
    assert.equal(
      (
        await request("/attempts", {
          method: "POST",
          token,
          body: {
            quizId: "contrast",
            requestId: parallel[0].data.requestId || "bad",
          },
        })
      ).status,
      400,
    );
    for (let i = 0; i < 2; i++) {
      const started = await request("/attempts", {
        token,
        method: "POST",
        body: { quizId: "contrast", requestId: randomUUID() },
      });
      assert.equal(started.status, 200);
      assert.equal(
        (
          await request(`/attempts/${started.data.attempt.id}/submit`, {
            token,
            method: "POST",
            body: { answers, revision: 0 },
          })
        ).status,
        200,
      );
    }
    assert.equal((await request("/session", { token })).data.remaining, 0);
    assert.equal(
      (
        await request("/attempts", {
          token,
          method: "POST",
          body: { quizId: "contrast", requestId: randomUUID() },
        })
      ).data.code,
      "QUOTA_EXHAUSTED",
    );
    assert.equal(
      (
        await request("/session", {
          method: "POST",
          body: { code: "QA-FIRST-2026" },
        })
      ).data.remaining,
      0,
    );
    assert.equal(
      (
        await request("/session", {
          method: "POST",
          body: { code: "QA-FIRST-2026" },
          headers: { Origin: "https://unrelated.example" },
        })
      ).status,
      403,
    );
    assert.equal((await request("/results/not-valid")).status, 404);
    await request("/session", { token, method: "DELETE" });
    assert.equal((await request("/session", { token })).status, 401);
    assert.equal((await request(`/results/${id}`)).status, 200);
    db.prepare("UPDATE codes SET enabled=0").run();
    assert.equal((await request("/session", { token: other })).status, 401);
    assert.equal((await request(`/results/${id}`)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
test("database progress, result and quota persist across restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "jianji-"));
  let db = openDatabase(dir);
  try {
    addCode(db, "PERSIST-2026");
    const row = db.prepare("SELECT id FROM codes").get();
    db.prepare(
      "INSERT INTO attempts(id,code_id,quiz_id,version,request_id,answers,created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      row.id,
      "contrast",
      "test",
      randomUUID(),
      JSON.stringify(new Array(48).fill(4)),
      new Date().toISOString(),
    );
    db.close();
    db = openDatabase(dir);
    assert.equal(db.prepare("SELECT count(*) AS n FROM codes").get().n, 1);
    assert.equal(
      JSON.parse(db.prepare("SELECT answers FROM attempts").get().answers)[0],
      4,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM attempts").get().n, 1);
  } finally {
    db.close();
    const cleanupPath = resolve(dir);
    assert.equal(dirname(cleanupPath), resolve(tmpdir()));
    assert.match(basename(cleanupPath), /^jianji-[A-Za-z0-9]+$/);
    rmSync(cleanupPath, { recursive: true, force: true });
  }
});

test("login limits distinguish clients behind a local proxy without trusting an extra untrusted hop", async () => {
  const db = openDatabase(":memory:");
  const app = createApp({ db, config: {} });
  const trust = app.get("trust proxy fn");
  assert.equal(trust("127.0.0.1"), true);
  assert.equal(trust("198.51.100.20"), false);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/session`;
  const login = async (forwarded) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": forwarded,
      },
      body: JSON.stringify({ code: "INVALID2026" }),
    });
    await response.text();
    return response.status;
  };
  try {
    const attempts = await Promise.all(
      Array.from({ length: 30 }, () => login("198.51.100.20")),
    );
    assert.ok(attempts.every((status) => status === 401));
    assert.equal(await login("198.51.100.20"), 429);
    assert.equal(await login("198.51.100.21"), 401);
    assert.equal(await login("203.0.113.8, 198.51.100.20"), 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
