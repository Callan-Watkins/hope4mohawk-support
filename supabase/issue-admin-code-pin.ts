import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const allowedOrigin = "https://callan-watkins.github.io";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function headers(origin: string | null): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    ...(origin === allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function respond(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return respond({ error: "Forbidden origin" }, 403, origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);

  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > 256) return respond({ error: "Invalid request" }, 400, origin);
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return respond({ error: "Invalid request" }, 400, origin); }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
      !("pin" in payload) || typeof payload.pin !== "string" || !/^\d{4}$/.test(payload.pin)) {
    return respond({ error: "Invalid request" }, 400, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pepper = Deno.env.get("ADMIN_CODE_PEPPER");
  if (!url || !serviceKey || !pepper) return respond({ error: "Issuer is not configured" }, 503, origin);

  // The visitor's IP never goes into the database in clear text. If the
  // gateway supplies no trusted address, use one shared rate-limit bucket.
  const remoteAddress = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await sha256(`${pepper}:web-pin-ip:${remoteAddress}`);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: accepted, error: verifyError } = await admin.rpc("verify_web_admin_pin", {
    p_pin: payload.pin,
    p_ip_hash: ipHash,
  });
  if (verifyError) return respond({ error: "Issuer is temporarily unavailable" }, 503, origin);
  if (accepted !== true) return respond({ error: "Incorrect PIN or temporarily locked" }, 403, origin);

  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("admin_codes")
    .select("created_at, expires_at, used_at")
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false })
    .limit(50);
  if (recentError || !recent) return respond({ error: "Issuer is temporarily unavailable" }, 503, origin);
  const active = recent.filter((item) => !item.used_at && Date.parse(item.expires_at) > now);
  if (recent.length >= 6 || active.length >= 3 ||
      (recent[0] && now - Date.parse(recent[0].created_at) < 45_000)) {
    return respond({ error: "Please wait before creating another code" }, 429, origin);
  }

  const code = createCode();
  const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
  const codeHash = await sha256(`${pepper}:${code}`);
  const { error: insertError } = await admin.from("admin_codes").insert({
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertError) return respond({ error: "Code could not be created" }, 503, origin);
  return respond({ code, expires_at: expiresAt, valid_for_seconds: 600 }, 200, origin);
});
