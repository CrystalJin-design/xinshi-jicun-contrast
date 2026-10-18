import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import {
  openDatabase,
  addCode,
  digest,
  normalizeCode,
} from "../server/database.js";
import { questions } from "../shared/contrast.js";

const output = resolve("artifacts");
mkdirSync(output, { recursive: true });
const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:5174/";
const cloud = process.env.VERIFY_CLOUD === "1";
if (cloud) process.loadEnvFile(".env.admin.local");
const adminRequest = async (path, method, body) => {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: secret,
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Cloud verification setup failed (${response.status})`);
};
const qa = `JJ-QA-${randomBytes(6).toString("hex").toUpperCase()}`;
let db;
if (cloud) {
  await adminRequest("rpc/jianji_create_code", "POST", {
    p_code_hash: digest(normalizeCode(qa)),
    p_label: "公网浏览器验收专用",
  });
} else {
  db = openDatabase();
  addCode(db, qa, "浏览器验收专用，不消耗交付密码");
  db.close();
}
const browser = await chromium.launch({ headless: true });
const errors = [];
const notes = [];
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const landing = await desktop.newPage();
  landing.on("pageerror", (e) => errors.push(e.message));
  await landing.goto(baseUrl, { waitUntil: "networkidle" });
  await landing.screenshot({
    path: resolve(output, "首页-电脑.png"),
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await landing.setViewportSize({ width, height: 844 });
    await landing.evaluate(() => document.fonts.ready);
    const overflow = await landing.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, `home overflow at ${width}`);
  }
  console.log("Landing verified at 320, 390, 768, 1440 widths.");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await mobile.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(output, "首页-手机.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "测评密码", exact: true }).click();
  await page.getByLabel("测评密码", { exact: true }).fill(qa);
  await page.getByRole("button", { name: "验证并进入" }).click();
  await page.waitForURL("**/#/ready");
  assert.ok((await page.locator(".quota-note").innerText()).includes("3 / 3"));
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await page.waitForURL("**/#/quiz");
  await page.locator(".question-text").waitFor();
  await page.getByRole("radio").nth(0).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("button", { name: "上一题", exact: true }).click();
  await page.getByRole("radio").nth(1).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("radio").nth(0).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".question-text").waitFor();
  assert.ok(
    (await page.locator(".question-progress").innerText()).includes("02"),
  );
  assert.equal(
    await page.getByRole("radio").nth(0).getAttribute("aria-checked"),
    "true",
  );
  await page.getByRole("button", { name: "上一题", exact: true }).click();
  assert.equal(
    await page.getByRole("radio").nth(1).getAttribute("aria-checked"),
    "true",
  );
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.screenshot({
    path: resolve(output, "答题-手机.png"),
    fullPage: true,
  });
  for (let i = 1; i < 48; i++) {
    const q = questions[i];
    const value =
      q.context === "public"
        ? 0
        : q.context === "familiar"
          ? 4
          : q.facet === "cost"
            ? 4
            : 3;
    const answer = q.reverse ? 4 - value : value;
    await page.getByRole("radio").nth(answer).click();
    if (i < 47)
      await page.getByRole("button", { name: "下一题", exact: true }).click();
  }
  await page.getByRole("button", { name: "查看我的反差", exact: true }).click();
  await page.waitForURL("**/#/result/**", { timeout: 20000 });
  await page.locator(".report-main .report-cover h1").waitFor();
  console.log(
    "48 questions, previous/edit, refresh recovery and result generation verified.",
  );
  const url = page.url();
  notes.push({ resultUrl: url });
  await page.screenshot({
    path: resolve(output, "结果-手机.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "复制结果链接", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
  await page.getByRole("button", { name: "好评有礼" }).click();
  await page.getByRole("dialog").waitFor();
  assert.ok((await page.getByRole("dialog").innerText()).includes("1元返现"));
  await page.getByRole("button", { name: "知道啦，谢谢你" }).click();
  await page.getByRole("button", { name: "保存结果长图" }).click();
  await page.locator(".export-preview").waitFor({ timeout: 60000 });
  await page.screenshot({ path: resolve(output, "保存长图-手机.png") });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载图片", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(resolve(output, "完整结果长图.png"));
  const dimensions = await page.locator(".export-preview").evaluate((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
  assert.ok(dimensions.height > dimensions.width * 3);
  notes.push({ image: dimensions });
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  console.log(
    "Image export, actual PNG download, clipboard and reward verified.",
  );
  await page.getByRole("button", { name: "再测一次", exact: true }).click();
  await page.waitForURL("**/#/ready");
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await page.waitForURL("**/#/quiz");
  await page.locator(".question-text").waitFor();
  assert.ok(
    (await page.locator(".account-button").innerText()).includes("余1次"),
  );
  const shared = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const publicPage = await shared.newPage();
  publicPage.on("pageerror", (e) => errors.push(e.message));
  await publicPage.goto(url, { waitUntil: "networkidle" });
  await publicPage.locator(".report-main .report-cover h1").waitFor();
  assert.ok(
    (await publicPage.locator(".result-breadcrumb").innerText()).includes(
      "分享",
    ),
  );
  await publicPage.screenshot({
    path: resolve(output, "结果-电脑.png"),
    fullPage: true,
  });
  assert.equal(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve(output, "browser-verification.json"),
    JSON.stringify(
      {
        passed: true,
        baseUrl,
        backend: cloud ? "Supabase" : "local",
        notes,
        errors,
        checks: [
          "desktop/mobile landing",
          "320–1440 responsive",
          "server login quota",
          "previous and edit",
          "refresh recovery",
          "48 questions completed",
          "PNG download",
          "clipboard",
          "reward",
          "retest",
          "public report without authentication",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, notes, errors }));
} finally {
  await browser.close();
  if (cloud) {
    await adminRequest(
      `jianji_codes?code_hash=eq.${digest(normalizeCode(qa))}`,
      "PATCH",
      { enabled: false },
    );
  } else {
    db = openDatabase();
    db.prepare("UPDATE codes SET enabled=0 WHERE hash=?").run(
      digest(normalizeCode(qa)),
    );
    db.close();
  }
}
