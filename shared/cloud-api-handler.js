import {
  library,
  quiz,
  scoreAnswers,
  validateAnswers,
} from "./contrast-scoring.js";
import { VERSION } from "./contrast.js";

export const normalizeCode = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase().replace(/[\s-]/g, "")
    : "";
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function hash(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const errors = {
  INVALID_CODE: [401, "密码不正确或已停用，请检查后重试。"],
  SESSION_EXPIRED: [
    401,
    "验证已过期或密码已停用，请重新验证；已保存的进度仍会保留。",
  ],
  QUOTA_EXHAUSTED: [409, "这个密码的3次测评已用完，已有报告仍可查看和保存。"],
  ATTEMPT_NOT_FOUND: [404, "没有找到这次测评。"],
  ATTEMPT_COMPLETED: [409, "这份测评已经完成，请查看已有报告。"],
  REVISION_CONFLICT: [409, "进度已在其他页面更新，请载入最新进度。"],
  INVALID_ANSWERS: [400, "答题数据不完整，请完成全部适用题目或选择暂无经历。"],
  INVALID_INPUT: [400, "测评参数不完整，请刷新后重试。"],
  RESULT_NOT_FOUND: [404, "没有找到这份报告，请检查链接是否完整。"],
};
const fail = (code) => {
  throw new Error(code);
};
export function createCloudHandler({ rpc, config, allowedOrigins = [] }) {
  return async function handle(request) {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      Vary: "Origin",
    };
    if (origin && allowedOrigins.includes(origin))
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "3600",
      });
    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (origin && !allowedOrigins.includes(origin))
      return respond({ error: "此来源无法访问测评服务。" }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    const path =
      new URL(request.url).pathname.replace(
        /^.*\/(?:jianji|api)(?=\/|$)/,
        "",
      ) || "/";
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
    const tokenHash = /^[a-f0-9]{48}$/.test(token) ? await hash(token) : "";
    const authenticated = () => tokenHash || fail("SESSION_EXPIRED");
    const call = async (name, params) => {
      const data = await rpc(name, params);
      if (data?._error)
        throw Object.assign(new Error(data._error), { attempt: data.attempt });
      return data;
    };
    try {
      let body = {};
      if (["POST", "PUT"].includes(request.method)) {
        if (Number(request.headers.get("content-length") || 0) > 20000)
          return respond({ error: "请求内容过大。" }, 413);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 20000)
          return respond({ error: "请求内容过大。" }, 413);
        try {
          body = JSON.parse(raw);
        } catch {
          return respond({ error: "请求格式不正确。" }, 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return respond({ error: "请求格式不正确。" }, 400);
      }
      if (path === "/config" && request.method === "GET")
        return respond(config);
      if (path === "/library" && request.method === "GET")
        return respond({ tests: library(), version: VERSION });
      if (path === "/session" && request.method === "POST") {
        const code = normalizeCode(body.code);
        const ip =
          request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
          "unknown";
        // The code bucket remains effective even if a caller manipulates forwarding headers.
        const ipOk = await call("jianji_take_rate_limit", {
          p_key_hash: await hash(`login-ip:${ip}`),
          p_limit: 100,
          p_seconds: 600,
        });
        const codeOk = await call("jianji_take_rate_limit", {
          p_key_hash: await hash(`login-code:${code.slice(0, 64)}`),
          p_limit: 30,
          p_seconds: 600,
        });
        if (!ipOk || !codeOk)
          return respond(
            { error: "尝试较多，请10分钟后重试或联系店铺客服。" },
            429,
          );
        if (!/^[A-Z0-9]{6,64}$/.test(code)) fail("INVALID_CODE");
        const newToken = randomToken();
        const session = await call("jianji_login", {
          p_code_hash: await hash(code),
          p_token_hash: await hash(newToken),
        });
        return respond({ token: newToken, ...session });
      }
      if (path === "/session" && request.method === "GET")
        return respond(
          await call("jianji_session", { p_session_hash: authenticated() }),
        );
      if (path === "/session" && request.method === "DELETE") {
        if (tokenHash)
          await call("jianji_logout", { p_session_hash: tokenHash });
        return respond({ ok: true });
      }
      if (path === "/tests/contrast" && request.method === "GET") {
        await call("jianji_session", { p_session_hash: authenticated() });
        return respond(quiz("contrast"));
      }
      if (path === "/attempts" && request.method === "POST") {
        if (body.quizId !== "contrast" || !uuid.test(body.requestId || ""))
          fail("INVALID_INPUT");
        return respond(
          await call("jianji_start", {
            p_session_hash: authenticated(),
            p_request_id: body.requestId,
            p_quiz_id: body.quizId,
            p_version: VERSION,
          }),
        );
      }
      const attempt = path.match(/^\/attempts\/([a-f0-9-]+)(\/submit)?$/i);
      if (attempt && uuid.test(attempt[1])) {
        authenticated();
        const complete = Boolean(attempt[2]);
        if (
          (!complete && request.method === "PUT") ||
          (complete && request.method === "POST")
        ) {
          if (
            !validateAnswers("contrast", body.answers, complete) ||
            !Number.isInteger(body.revision) ||
            body.revision < 0
          )
            fail("INVALID_ANSWERS");
          if (
            !complete &&
            (!Number.isInteger(body.currentQuestion) ||
              body.currentQuestion < 0 ||
              body.currentQuestion >= 48)
          )
            fail("INVALID_ANSWERS");
          const params = {
            p_session_hash: tokenHash,
            p_attempt_id: attempt[1],
            p_answers: body.answers,
            p_revision: body.revision,
          };
          return respond(
            await call(
              complete ? "jianji_complete" : "jianji_save",
              complete
                ? {
                    ...params,
                    p_report: scoreAnswers("contrast", body.answers),
                    p_result_id: randomToken(),
                  }
                : { ...params, p_current_question: body.currentQuestion },
            ),
          );
        }
      }
      const result = path.match(/^\/results\/([a-f0-9]{48})$/);
      if (result && request.method === "GET")
        return respond(await call("jianji_result", { p_result_id: result[1] }));
      return respond({ error: "没有找到这个接口。" }, 404);
    } catch (error) {
      const code = Object.keys(errors).find((key) =>
        String(error?.message).includes(key),
      );
      if (code)
        return respond(
          {
            error: errors[code][1],
            code,
            ...(error.attempt ? { attempt: error.attempt } : {}),
          },
          errors[code][0],
        );
      console.error(
        "Jianji cloud API:",
        error?.code || error?.name || "unknown",
      );
      return respond({ error: "服务暂时无法回应，请稍后重试。" }, 500);
    }
  };
}
