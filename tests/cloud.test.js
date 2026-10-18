import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  createCloudHandler,
  hash,
  normalizeCode,
  randomToken,
} from "../shared/cloud-api-handler.js";

let db, handler;
const origin = "https://crystaljin-design.github.io";
async function rpc(name, params) {
  assert.match(name, /^jianji_[a-z_]+$/);
  const entries = Object.entries(params);
  entries.forEach(([key]) => assert.match(key, /^p_[a-z_]+$/));
  const values = entries.map(([, value]) =>
    value && typeof value === "object" ? JSON.stringify(value) : value,
  );
  const result = await db.query(
    `select public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) as data`,
    values,
  );
  return result.rows[0].data;
}
before(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610180001_jianji.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  handler = createCloudHandler({
    rpc,
    config: { brand: "心事寄存" },
    allowedOrigins: [origin],
  });
});
after(async () => {
  await db?.close();
});
async function request(
  path,
  { method = "GET", body, token, headers = {} } = {},
) {
  const response = await handler(
    new Request(`https://test.supabase.co/functions/v1/jianji${path}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    headers: response.headers,
  };
}
async function codeAndLogin() {
  const code = `QA-${randomToken()}`;
  const id = await rpc("jianji_create_code", {
    p_code_hash: await hash(normalizeCode(code)),
    p_label: "SQL/API test",
  });
  const login = await request("/session", { method: "POST", body: { code } });
  assert.equal(login.status, 200);
  return { code, id, ...login.data };
}
test("cloud production SQL preserves quota, ownership, revision conflicts, idempotency and public reports", async () => {
  assert.equal((await request("/tests/contrast")).status, 401);
  const a = await codeAndLogin(),
    b = await codeAndLogin();
  assert.equal(a.remaining, 3);
  assert.equal(
    (await request("/tests/contrast", { token: a.token })).data.questions
      .length,
    48,
  );
  const starts = await Promise.all(
    Array.from({ length: 5 }, () =>
      request("/attempts", {
        method: "POST",
        token: a.token,
        body: { quizId: "contrast", requestId: randomUUID() },
      }),
    ),
  );
  assert.ok(starts.every((r) => r.status === 200));
  assert.equal(new Set(starts.map((r) => r.data.attempt.id)).size, 1);
  assert.equal(starts[0].data.session.remaining, 2);
  const attempt = starts[0].data.attempt;
  const answers = new Array(48).fill(2);
  assert.equal(
    (
      await request(`/attempts/${attempt.id}`, {
        method: "PUT",
        token: b.token,
        body: { answers, currentQuestion: 2, revision: 0 },
      })
    ).status,
    404,
  );
  const saved = await request(`/attempts/${attempt.id}`, {
    method: "PUT",
    token: a.token,
    body: { answers, currentQuestion: 2, revision: 0 },
  });
  assert.equal(saved.data.revision, 1);
  const conflict = await request(`/attempts/${attempt.id}`, {
    method: "PUT",
    token: a.token,
    body: { answers, currentQuestion: 3, revision: 0 },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.attempt.revision, 1);
  const stale = await request(`/attempts/${attempt.id}/submit`, {
    method: "POST",
    token: a.token,
    body: { answers, revision: 0 },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.attempt.revision, 1);
  assert.equal(
    (
      await request(`/attempts/${attempt.id}/submit`, {
        method: "POST",
        token: a.token,
        body: { answers: new Array(48).fill(-1), revision: 1 },
      })
    ).status,
    400,
  );
  const completed = await request(`/attempts/${attempt.id}/submit`, {
    method: "POST",
    token: a.token,
    body: { answers, revision: 1, report: { profile: { name: "forged" } } },
  });
  assert.equal(completed.status, 200);
  const id = completed.data.resultId;
  const repeated = await request(`/attempts/${attempt.id}/submit`, {
    method: "POST",
    token: a.token,
    body: { answers, revision: 1 },
  });
  assert.equal(repeated.data.resultId, id);
  const report = await request(`/results/${id}`);
  assert.equal(report.status, 200);
  assert.equal(report.data.profile.name, "中间光谱 · 多面过渡者");
  assert.ok(report.data.createdAt);
  for (const field of ["answers", "code_id", "token", "request_id"])
    assert.equal(Object.hasOwn(report.data, field), false);
  for (let i = 0; i < 2; i++) {
    const next = await request("/attempts", {
      method: "POST",
      token: a.token,
      body: { quizId: "contrast", requestId: randomUUID() },
    });
    const done = await request(`/attempts/${next.data.attempt.id}/submit`, {
      method: "POST",
      token: a.token,
      body: { answers: new Array(48).fill(-2), revision: 0 },
    });
    assert.equal(done.status, 200);
    assert.equal(
      (await request(`/results/${done.data.resultId}`)).data.contrast,
      null,
    );
  }
  assert.equal(
    (await request("/session", { token: a.token })).data.remaining,
    0,
  );
  assert.equal(
    (
      await request("/attempts", {
        method: "POST",
        token: a.token,
        body: { quizId: "contrast", requestId: randomUUID() },
      })
    ).data.code,
    "QUOTA_EXHAUSTED",
  );
  assert.equal(
    (await request("/session", { method: "POST", body: { code: a.code } })).data
      .remaining,
    0,
  );
  await request("/session", { method: "DELETE", token: a.token });
  assert.equal((await request("/session", { token: a.token })).status, 401);
  await db.query("update public.jianji_codes set enabled=false where id=$1", [
    b.id,
  ]);
  assert.equal((await request("/session", { token: b.token })).status, 401);
  assert.equal((await request(`/results/${id}`)).status, 200);
});
test("cloud handler rejects unapproved origins, malformed/oversized JSON and invalid inputs", async () => {
  assert.equal(
    (
      await request("/config", {
        headers: { Origin: "https://unrelated.example" },
      })
    ).status,
    403,
  );
  const preflight = await request("/session", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal((await request("/config")).data.brand, "心事寄存");
  for (const raw of ["{", "[]", "null"]) {
    const response = await handler(
      new Request("https://test/api/session", { method: "POST", body: raw }),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(
    (
      await request("/session", {
        method: "POST",
        body: { code: "x".repeat(21000) },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await request("/attempts", {
        method: "POST",
        body: { quizId: "contrast", requestId: "bad" },
      })
    ).status,
    400,
  );
  assert.equal((await request(`/results/${randomToken()}`)).status, 404);
  const answers = new Array(48).fill(0);
  answers[3] = null;
  assert.equal(
    await rpc("jianji_valid_answers", { p_answers: answers, p_complete: true }),
    false,
  );
  assert.equal(
    await rpc("jianji_valid_answers", { p_answers: {}, p_complete: false }),
    false,
  );
  assert.equal(
    await rpc("jianji_valid_answers", {
      p_answers: new Array(48).fill(-1),
      p_complete: true,
    }),
    false,
  );
  assert.equal(
    await rpc("jianji_valid_answers", {
      p_answers: new Array(48).fill(-2),
      p_complete: true,
    }),
    true,
  );
});
test("production tables and security-definer helpers cannot be accessed as anonymous or authenticated", async () => {
  const tables = await db.query(
    "select relname,relrowsecurity from pg_class where relname in ('jianji_codes','jianji_sessions','jianji_attempts','jianji_rate_limits')",
  );
  assert.equal(tables.rows.length, 4);
  assert.ok(tables.rows.every((row) => row.relrowsecurity));
  for (const role of ["anon", "authenticated"]) {
    const checks = await db.query(
      "select has_table_privilege($1,'public.jianji_codes','select') as table_access, has_function_privilege($1,'public.jianji_session_for_code(uuid)','execute') as helper_access, has_function_privilege($1,'public.jianji_create_code(text,text)','execute') as admin_access",
      [role],
    );
    assert.deepEqual(checks.rows[0], {
      table_access: false,
      helper_access: false,
      admin_access: false,
    });
  }
  const a = await codeAndLogin();
  await db.query(
    "update public.jianji_sessions set expires_at=now()-interval '1 second' where token_hash=$1",
    [await hash(a.token)],
  );
  assert.equal(
    (await request("/session", { token: a.token })).data.code,
    "SESSION_EXPIRED",
  );
});
test("database rate limits survive handler instances and code throttling is independent of spoofed client headers", async () => {
  const code = `INVALID${randomToken()}`;
  for (let i = 0; i < 30; i++)
    assert.equal(
      (
        await request("/session", {
          method: "POST",
          body: { code },
          headers: { "x-forwarded-for": `198.51.100.${i + 1}` },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/session", {
        method: "POST",
        body: { code },
        headers: { "x-forwarded-for": "203.0.113.1" },
      })
    ).status,
    429,
  );
  handler = createCloudHandler({
    rpc,
    config: { brand: "心事寄存" },
    allowedOrigins: [origin],
  });
  assert.equal(
    (
      await request("/session", {
        method: "POST",
        body: { code },
        headers: { "x-forwarded-for": "203.0.113.2" },
      })
    ).status,
    429,
  );
});
