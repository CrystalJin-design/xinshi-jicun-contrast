import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const normalizeCode = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase().replace(/[\s-]/g, "")
    : "";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(24).toString("hex");
export function openDatabase(directory = process.env.DATA_DIR || "data") {
  if (directory !== ":memory:")
    mkdirSync(resolve(directory), { recursive: true });
  const db = new DatabaseSync(
    directory === ":memory:" ? directory : resolve(directory, "jianji.sqlite"),
  );
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, code_id INTEGER NOT NULL REFERENCES codes(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY, code_id INTEGER NOT NULL REFERENCES codes(id), quiz_id TEXT NOT NULL, version TEXT NOT NULL,
      request_id TEXT NOT NULL, answers TEXT NOT NULL, current_question INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','complete')),
      result_id TEXT UNIQUE, report TEXT, created_at TEXT NOT NULL, completed_at TEXT,
      UNIQUE(code_id, request_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_per_code ON attempts(code_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS attempts_code ON attempts(code_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  return db;
}
export function transaction(db, operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function addCode(
  db,
  plain = `JJ-${randomBytes(6).toString("hex").toUpperCase()}`,
  label = "",
) {
  const code = normalizeCode(plain);
  if (!/^[A-Z0-9]{6,64}$/.test(code))
    throw new Error("密码需为6–64位英文字母或数字。");
  db.prepare("INSERT INTO codes(hash,label) VALUES (?,?)").run(
    digest(code),
    label,
  );
  return plain;
}
