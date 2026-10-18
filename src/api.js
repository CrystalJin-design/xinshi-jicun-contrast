const key = "jianji-contrast-session-v1";
const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
let memory = "";
export const getToken = () => {
  try {
    return localStorage.getItem(key) || memory;
  } catch {
    return memory;
  }
};
export const setToken = (token) => {
  memory = token || "";
  try {
    token ? localStorage.setItem(key, token) : localStorage.removeItem(key);
  } catch {}
};
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(publicKey ? { apikey: publicKey } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "网络暂时没有回应。已选择的答案会在本机保留，请检查连接后重试。",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("测评服务暂时无法连接，请稍后重试。");
  }
  if (!response.ok)
    throw Object.assign(new Error(data.error || "暂时无法完成，请重试。"), {
      status: response.status,
      code: data.code,
      attempt: data.attempt,
    });
  return data;
}
export const resultUrl = (id) =>
  `${location.origin}${location.pathname}#/result/${id}`;
export async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {}
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.append(input);
  input.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  input.remove();
  return ok;
}
