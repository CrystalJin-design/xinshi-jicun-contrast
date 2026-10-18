import { createCloudHandler } from "../_shared/cloud-api-handler.js";
import config from "../_shared/site.config.json" with { type: "json" };

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = (
  Deno.env.get("JIANJI_ALLOWED_ORIGINS") ||
  "https://crystaljin-design.github.io"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const handler = createCloudHandler({
  config,
  allowedOrigins,
  rpc: async (name: string, params: Record<string, unknown>) => {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.message || "RPC_FAILED"), {
        code: data.code,
      });
    return data;
  },
});
Deno.serve(handler);
