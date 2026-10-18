import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDatabase,
  addCode,
  digest,
  normalizeCode,
  transaction,
} from "../server/database.js";

const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const directory =
  process.env.DATA_DIR ||
  resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const db = openDatabase(directory);
try {
  if (args[0] === "create") {
    const count = Number(option("count", "1"));
    if (!Number.isInteger(count) || count < 1 || count > 1000)
      throw new Error("count需为1–1000");
    const label = option("label", "店铺发货");
    const codes = transaction(db, () =>
      Array.from({ length: count }, () => addCode(db, undefined, label)),
    );
    const file = resolve(directory, `发货密码-${Date.now()}.csv`);
    writeFileSync(
      file,
      "\ufeff密码,可测次数,说明\r\n" +
        codes.map((code) => `${code},3,反差人格测评三次`).join("\r\n"),
      "utf8",
    );
    console.log(`已生成${count}个密码：${file}`);
  } else if (args[0] === "list") {
    const rows = db
      .prepare(
        "SELECT c.id,c.label,c.enabled,c.created_at,count(a.id) AS used,3-count(a.id) AS remaining FROM codes c LEFT JOIN attempts a ON a.code_id=c.id GROUP BY c.id ORDER BY c.id DESC",
      )
      .all();
    console.table(rows);
  } else if (args[0] === "revoke") {
    const plain = option("code", "");
    if (!plain) throw new Error("请指定 --code 密码");
    const result = db
      .prepare("UPDATE codes SET enabled=0 WHERE hash=?")
      .run(digest(normalizeCode(plain)));
    console.log(
      result.changes
        ? "密码已停用，已生成的公开报告仍可访问。"
        : "未找到密码。",
    );
  } else throw new Error("使用 create --count 10 / list / revoke --code 密码");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
