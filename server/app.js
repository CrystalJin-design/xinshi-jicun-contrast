import express from "express";
import { randomUUID } from "node:crypto";
import { digest, randomToken, normalizeCode, transaction } from "./database.js";
import { getTest, VERSION } from "../shared/catalog.js";
import {
  library,
  quiz,
  scoreAnswers,
  validateAnswers,
} from "../shared/contrast-scoring.js";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (status, message, code, extra = {}) => {
  throw Object.assign(new Error(message), { status, code, ...extra });
};
const publicAttempt = (row) =>
  row
    ? {
        id: row.id,
        quizId: row.quiz_id,
        answers: JSON.parse(row.answers),
        currentQuestion: row.current_question,
        revision: row.revision,
        status: row.status,
        resultId: row.result_id,
      }
    : null;
export function createApp({
  db,
  config,
  production = false,
  publicOrigin = process.env.PUBLIC_ORIGIN,
}) {
  const app = express();
  const limits = new Map();
  app.disable("x-powered-by");
  // The documented reverse proxy connects locally; do not trust arbitrary peers.
  app.set("trust proxy", "loopback");
  app.use("/api", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    const origin = req.get("origin");
    const allowed = new Set(
      [
        `http://${req.get("host")}`,
        `https://${req.get("host")}`,
        publicOrigin,
        ...(!production
          ? ["http://localhost:5174", "http://127.0.0.1:5174"]
          : []),
      ].filter(Boolean),
    );
    if (origin && !allowed.has(origin))
      return res.status(403).json({ error: "此来源无法访问测评服务。" });
    next();
  });
  app.use("/api", express.json({ limit: "20kb" }));
  function auth(req) {
    const token = req.get("authorization")?.replace(/^Bearer /i, "") || "";
    if (!/^[a-f0-9]{48}$/.test(token))
      fail(401, "请先输入测评密码。", "SESSION_EXPIRED");
    const row = db
      .prepare(
        "SELECT s.code_id FROM sessions s JOIN codes c ON c.id=s.code_id WHERE s.hash=? AND s.expires_at>? AND c.enabled=1",
      )
      .get(digest(token), Date.now());
    if (!row)
      fail(
        401,
        "验证已过期或密码已停用，请重新验证；已保存的进度仍会保留。",
        "SESSION_EXPIRED",
      );
    return row.code_id;
  }
  function session(codeId) {
    const attempts = db
      .prepare(
        "SELECT * FROM attempts WHERE code_id=? ORDER BY created_at DESC, rowid DESC",
      )
      .all(codeId);
    return {
      remaining: Math.max(0, 3 - attempts.length),
      total: 3,
      active: publicAttempt(attempts.find((a) => a.status === "active")),
      results: attempts
        .filter((a) => a.status === "complete")
        .map((a) => {
          const report = JSON.parse(a.report);
          return {
            id: a.result_id,
            quizId: a.quiz_id,
            title: report.test.shortTitle,
            name: report.profile.name,
            createdAt: a.completed_at,
          };
        }),
    };
  }
  function ownedAttempt(id, codeId) {
    const row = db
      .prepare("SELECT * FROM attempts WHERE id=? AND code_id=?")
      .get(id, codeId);
    if (!row) fail(404, "没有找到这次测评。", "ATTEMPT_NOT_FOUND");
    return row;
  }
  function revisionCheck(row, revision) {
    if (!Number.isInteger(revision) || revision !== row.revision)
      fail(409, "进度已在其他页面更新，请载入最新进度。", "REVISION_CONFLICT", {
        attempt: publicAttempt(row),
      });
  }
  app.get("/api/config", (req, res) => res.json(config));
  app.get("/api/library", (req, res) =>
    res.json({ tests: library(), version: VERSION }),
  );
  app.post("/api/session", (req, res) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    if (limits.size > 1000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    const limit = limits.get(key);
    if (limit?.until > now && limit.count >= 30)
      return res
        .status(429)
        .json({ error: "尝试较多，请10分钟后重试或联系店铺客服。" });
    limits.set(key, {
      count: limit?.until > now ? limit.count + 1 : 1,
      until: limit?.until > now ? limit.until : now + 600000,
    });
    const code = normalizeCode(req.body?.code);
    const row =
      /^[A-Z0-9]{6,64}$/.test(code) &&
      db
        .prepare("SELECT id FROM codes WHERE hash=? AND enabled=1")
        .get(digest(code));
    if (!row) fail(401, "密码不正确或已停用，请检查后重试。", "INVALID_CODE");
    const token = randomToken();
    transaction(db, () => {
      db.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
      db.prepare(
        "INSERT INTO sessions(hash,code_id,expires_at) VALUES (?,?,?)",
      ).run(digest(token), row.id, now + 7 * 86400000);
    });
    res.json({ token, ...session(row.id) });
  });
  app.get("/api/session", (req, res) => res.json(session(auth(req))));
  app.delete("/api/session", (req, res) => {
    const token = req.get("authorization")?.replace(/^Bearer /i, "") || "";
    if (token)
      db.prepare("DELETE FROM sessions WHERE hash=?").run(digest(token));
    res.json({ ok: true });
  });
  app.get("/api/tests/:id", (req, res) => {
    auth(req);
    const data = quiz(req.params.id);
    if (!data) fail(404, "没有这个测评。", "NOT_FOUND");
    res.json(data);
  });
  app.post("/api/attempts", (req, res) => {
    const codeId = auth(req);
    const { quizId, requestId } = req.body || {};
    if (!getTest(quizId) || !uuid.test(requestId || ""))
      fail(400, "测评参数不完整，请刷新后重试。", "INVALID_INPUT");
    const result = transaction(db, () => {
      const previous = db
        .prepare("SELECT * FROM attempts WHERE code_id=? AND request_id=?")
        .get(codeId, requestId);
      if (previous) return publicAttempt(previous);
      const active = db
        .prepare("SELECT * FROM attempts WHERE code_id=? AND status='active'")
        .get(codeId);
      if (active) {
        if (active.quiz_id !== quizId)
          fail(409, "你有一份未完成的测评，请先完成它。", "ACTIVE_ATTEMPT", {
            attempt: publicAttempt(active),
          });
        return publicAttempt(active);
      }
      const used = db
        .prepare("SELECT count(*) AS n FROM attempts WHERE code_id=?")
        .get(codeId).n;
      if (used >= 3)
        fail(
          409,
          "这个密码的3次测评已用完，已有报告仍可查看和保存。",
          "QUOTA_EXHAUSTED",
        );
      const id = randomUUID();
      db.prepare(
        "INSERT INTO attempts(id,code_id,quiz_id,version,request_id,answers,created_at) VALUES (?,?,?,?,?,?,?)",
      ).run(
        id,
        codeId,
        quizId,
        VERSION,
        requestId,
        JSON.stringify(new Array(getTest(quizId).count).fill(-1)),
        new Date().toISOString(),
      );
      return publicAttempt(ownedAttempt(id, codeId));
    });
    res.json({ attempt: result, session: session(codeId) });
  });
  app.put("/api/attempts/:id", (req, res) => {
    const codeId = auth(req);
    const result = transaction(db, () => {
      const row = ownedAttempt(req.params.id, codeId);
      if (row.status !== "active")
        fail(409, "这份测评已经完成，请查看已有报告。", "ATTEMPT_COMPLETED");
      const { answers, currentQuestion, revision } = req.body || {};
      if (
        !validateAnswers(row.quiz_id, answers) ||
        !Number.isInteger(currentQuestion) ||
        currentQuestion < 0 ||
        currentQuestion >= answers.length
      )
        fail(400, "答题数据不完整，请检查后重试。", "INVALID_ANSWERS");
      revisionCheck(row, revision);
      db.prepare(
        "UPDATE attempts SET answers=?,current_question=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(answers), currentQuestion, row.id);
      return publicAttempt(ownedAttempt(row.id, codeId));
    });
    res.json(result);
  });
  app.post("/api/attempts/:id/submit", (req, res) => {
    const codeId = auth(req);
    const resultId = transaction(db, () => {
      const row = ownedAttempt(req.params.id, codeId);
      if (row.status === "complete") return row.result_id;
      revisionCheck(row, req.body?.revision);
      if (!validateAnswers(row.quiz_id, req.body?.answers, true))
        fail(400, "请完成全部题目后再生成报告。", "INVALID_ANSWERS");
      const report = scoreAnswers(row.quiz_id, req.body.answers);
      const id = randomToken();
      const createdAt = new Date().toISOString();
      db.prepare(
        "UPDATE attempts SET answers=?,report=?,result_id=?,status='complete',completed_at=?,revision=revision+1 WHERE id=?",
      ).run(
        JSON.stringify(req.body.answers),
        JSON.stringify({ ...report, createdAt }),
        id,
        createdAt,
        row.id,
      );
      return id;
    });
    res.json({ resultId, session: session(codeId) });
  });
  app.get("/api/results/:id", (req, res) => {
    if (!/^[a-f0-9]{48}$/.test(req.params.id))
      fail(404, "没有找到这份报告，请检查链接是否完整。", "RESULT_NOT_FOUND");
    const row = db
      .prepare(
        "SELECT report FROM attempts WHERE result_id=? AND status='complete'",
      )
      .get(req.params.id);
    if (!row)
      fail(404, "没有找到这份报告，请检查链接是否完整。", "RESULT_NOT_FOUND");
    res.json({ id: req.params.id, ...JSON.parse(row.report) });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "没有找到这个接口。" }),
  );
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) console.error("Jianji API:", error.code || error.name);
    res.status(status).json({
      error:
        status >= 500
          ? "服务暂时无法回应，请稍后重试。"
          : error.type === "entity.parse.failed"
            ? "请求格式不正确。"
            : error.type === "entity.too.large"
              ? "请求内容过大。"
              : error.message,
      code: error.code,
      ...(error.attempt ? { attempt: error.attempt } : {}),
    });
  });
  return app;
}
