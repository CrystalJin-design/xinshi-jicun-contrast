import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { hash, normalizeCode } from "../shared/cloud-api-handler.js";
if (existsSync(".env.admin.local")) process.loadEnvFile(".env.admin.local");
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret)
  throw new Error("请先配置本机 .env.admin.local 中的Supabase服务端凭证。");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const rest = async (path, { method = "GET", body, headers = {} } = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `云端操作失败（${response.status}），已生成的密码文件会保留，请核对后重试。`,
    );
  return response.status === 204 ? null : response.json();
};
try {
  if (args[0] === "create") {
    const supplied = option("code", "");
    const count = supplied ? 1 : Number(option("count", "10"));
    if (!Number.isInteger(count) || count < 1 || count > 1000)
      throw new Error("数量需为1–1000。");
    await mkdir("data", { recursive: true });
    const file = `data/线上发货密码-${Date.now()}.csv`;
    await writeFile(file, "\ufeff密码,可测次数\r\n", { mode: 0o600 });
    for (let i = 0; i < count; i++) {
      const code =
        supplied ||
        `XS-${randomBytes(8).toString("hex").toUpperCase().match(/.{4}/g).join("-")}`;
      const normalized = normalizeCode(code);
      if (!/^[A-Z0-9]{6,64}$/.test(normalized))
        throw new Error("密码需为6–64位字母或数字，可使用分隔符。");
      await rest("rpc/jianji_create_code", {
        method: "POST",
        body: {
          p_code_hash: await hash(normalized),
          p_label: option("label", "心事寄存发货"),
        },
      });
      await appendFile(file, `${code},3\r\n`);
    }
    console.log(`已生成${count}个线上密码，每个可测3次。文件：${file}`);
  } else if (args[0] === "list") {
    const rows = await rest(
      "jianji_codes?select=id,label,used,enabled,created_at&order=created_at.desc&limit=1000",
    );
    console.table(rows.map((row) => ({ ...row, remaining: 3 - row.used })));
  } else if (args[0] === "revoke") {
    const code = normalizeCode(option("code", ""));
    if (!code) throw new Error("请指定 --code。");
    const rows = await rest(`jianji_codes?code_hash=eq.${await hash(code)}`, {
      method: "PATCH",
      body: { enabled: false },
      headers: { Prefer: "return=representation" },
    });
    console.log(
      rows.length ? "线上密码已停用，已分享报告仍可阅读。" : "未找到该密码。",
    );
  } else throw new Error("使用 create --count 100 / list / revoke --code 密码");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
