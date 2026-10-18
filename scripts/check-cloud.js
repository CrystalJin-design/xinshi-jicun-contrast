import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  randomToken,
  hash,
  normalizeCode,
} from "../shared/cloud-api-handler.js";
process.loadEnvFile(".env.admin.local");
const project = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLIC_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = "https://crystaljin-design.github.io";
const api = project + "/functions/v1/jianji";
const codes = [];
async function rest(path, { method = "GET", body, key = serviceKey } = {}) {
  const response = await fetch(project + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data };
}
async function request(
  path,
  { method = "GET", body, token, requestOrigin = origin } = {},
) {
  const response = await fetch(api + path, {
    method,
    headers: {
      apikey: publicKey,
      Origin: requestOrigin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    headers: response.headers,
  };
}
async function createCode() {
  const code = "QA-" + randomToken();
  const digest = await hash(normalizeCode(code));
  const created = await rest("rpc/jianji_create_code", {
    method: "POST",
    body: { p_code_hash: digest, p_label: "公网API验收" },
  });
  assert.equal(created.status, 200);
  codes.push(digest);
  const login = await request("/session", { method: "POST", body: { code } });
  assert.equal(login.status, 200);
  return { code, ...login.data };
}
try {
  assert.equal((await request("/config")).data.storeName, "心事寄存");
  assert.equal(
    (await request("/config", { requestOrigin: "https://unapproved.example" }))
      .status,
    403,
  );
  const preflight = await request("/session", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal((await request("/tests/contrast")).status, 401);
  const a = await createCode(),
    b = await createCode();
  assert.equal(a.remaining, 3);
  assert.equal(
    (await request("/tests/contrast", { token: a.token })).data.questions
      .length,
    48,
  );
  const attempts = await Promise.all(
    Array.from({ length: 8 }, () =>
      request("/attempts", {
        method: "POST",
        token: a.token,
        body: { quizId: "contrast", requestId: randomUUID() },
      }),
    ),
  );
  assert.ok(attempts.every((row) => row.status === 200));
  assert.equal(new Set(attempts.map((row) => row.data.attempt.id)).size, 1);
  assert.ok(attempts.every((row) => row.data.session.remaining === 2));
  const active = attempts[0].data.attempt;
  const answers = new Array(48).fill(2);
  assert.equal(
    (
      await request(`/attempts/${active.id}`, {
        method: "PUT",
        token: b.token,
        body: { answers, currentQuestion: 0, revision: 0 },
      })
    ).status,
    404,
  );
  const saved = await request(`/attempts/${active.id}`, {
    method: "PUT",
    token: a.token,
    body: { answers, currentQuestion: 20, revision: 0 },
  });
  assert.equal(saved.data.revision, 1);
  const conflict = await request(`/attempts/${active.id}`, {
    method: "PUT",
    token: a.token,
    body: { answers, currentQuestion: 0, revision: 0 },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.attempt.currentQuestion, 20);
  assert.equal(
    (
      await request(`/attempts/${active.id}/submit`, {
        method: "POST",
        token: a.token,
        body: { answers, revision: 0 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/attempts/${active.id}/submit`, {
        method: "POST",
        token: a.token,
        body: { answers: new Array(48).fill(-1), revision: 1 },
      })
    ).status,
    400,
  );
  const submit = await request(`/attempts/${active.id}/submit`, {
    method: "POST",
    token: a.token,
    body: { answers, revision: 1 },
  });
  assert.equal(submit.status, 200);
  const id = submit.data.resultId;
  assert.equal(
    (
      await request(`/attempts/${active.id}/submit`, {
        method: "POST",
        token: a.token,
        body: { answers, revision: 1 },
      })
    ).data.resultId,
    id,
  );
  const report = await request(`/results/${id}`);
  assert.equal(report.status, 200);
  assert.equal(report.data.profile.name, "中间光谱 · 多面过渡者");
  for (const key of ["answers", "token", "code_id", "request_id"])
    assert.equal(Object.hasOwn(report.data, key), false);
  for (let i = 0; i < 2; i++) {
    const start = await request("/attempts", {
      method: "POST",
      token: a.token,
      body: { quizId: "contrast", requestId: randomUUID() },
    });
    assert.equal(start.status, 200);
    assert.equal(
      (
        await request(`/attempts/${start.data.attempt.id}/submit`, {
          method: "POST",
          token: a.token,
          body: { answers, revision: 0 },
        })
      ).status,
      200,
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
  for (const table of [
    "jianji_codes",
    "jianji_sessions",
    "jianji_attempts",
    "jianji_rate_limits",
  ]) {
    const unauthorized = await rest(table + "?select=*&limit=1", {
      key: publicKey,
    });
    assert.ok(
      [401, 403].includes(unauthorized.status),
      table + " must be private",
    );
  }
  const helper = await rest("rpc/jianji_session_for_code", {
    method: "POST",
    key: publicKey,
    body: { p_code_id: randomUUID() },
  });
  assert.ok([401, 403].includes(helper.status));
  const record = {
    passed: true,
    api,
    checkedAt: new Date().toISOString(),
    checks: [
      "cloud configuration and CORS",
      "password required",
      "48 questions",
      "8 concurrent starts charge once",
      "ownership",
      "save and conflict recovery",
      "stale submission rejection",
      "incomplete rejection",
      "idempotent submit",
      "public report privacy",
      "quota exhaustion persists",
      "anonymous tables and RPC denied",
    ],
  };
  writeFileSync(
    "artifacts/cloud-api-verification.json",
    JSON.stringify(record, null, 2),
  );
  console.log(JSON.stringify(record, null, 2));
} finally {
  for (const digest of codes) {
    const revoked = await rest(`jianji_codes?code_hash=eq.${digest}`, {
      method: "PATCH",
      body: { enabled: false },
    });
    if (revoked.status !== 204)
      throw new Error("Unable to disable a QA password");
  }
}
