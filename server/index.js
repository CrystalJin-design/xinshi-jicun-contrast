import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, addCode, digest, normalizeCode } from "./database.js";
import { createApp } from "./app.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const db = openDatabase(process.env.DATA_DIR || resolve(root, "data"));
if (
  !production &&
  !db
    .prepare("SELECT id FROM codes WHERE hash=?")
    .get(digest(normalizeCode("JIANJI2026")))
)
  addCode(db, "JIANJI2026", "本地交付体验，3次");
const config = JSON.parse(
  readFileSync(resolve(root, "site.config.json"), "utf8"),
);
const app = createApp({ db, config, production });
if (existsSync(resolve(root, "dist/index.html"))) {
  app.use(
    express.static(resolve(root, "dist"), { index: false, maxAge: "1h" }),
  );
  app.get("/{*splat}", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(resolve(root, "dist/index.html"));
  });
}
const port = Number(process.env.PORT || 8790);
const server = app.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(
    `见己测评 http://localhost:${port} · 开发前端 http://localhost:5174`,
  ),
);
const shutdown = () =>
  server.close(() => {
    db.close();
    process.exit(0);
  });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
