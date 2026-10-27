/**
 * Vercel proxy for the RepoScribe API.
 *
 * The SPA is static, but the audit backend keeps sessions and workspaces in
 * memory, so it runs as one long-lived Render service. Vercel rewrites
 * `/api/v1/*` here and this function forwards the request to that service.
 *
 * Required environment variable (Vercel → Settings → Environment Variables):
 *   BACKEND_ORIGIN = https://<your-service>.onrender.com
 */

const HOP_BY_HOP = new Set([
  "connection",
  "host",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
]);

module.exports = async function handler(request, response) {
  const origin = process.env.BACKEND_ORIGIN;
  if (!origin) {
    response.status(500).json({
      error: {
        code: "proxy_not_configured",
        message: "BACKEND_ORIGIN is not set on this Vercel project.",
        request_id: "vercel-proxy",
        retryable: false,
      },
    });
    return;
  }

  const rawPath = request.query.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const target = new URL(`/api/v1/${segments.join("/")}`, origin);

  for (const [key, value] of Object.entries(request.query)) {
    if (key === "path" || value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) target.searchParams.append(key, String(item));
    } else {
      target.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || HOP_BY_HOP.has(key)) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    // Vercel may have parsed JSON/urlencoded bodies; multipart stays a stream.
    if (request.body !== undefined && request.body !== null) {
      const body = Buffer.isBuffer(request.body)
        ? request.body
        : typeof request.body === "string"
          ? Buffer.from(request.body)
          : Buffer.from(JSON.stringify(request.body));
      init.body = body;
      headers.set("content-length", String(body.length));
    } else {
      init.body = request;
      init.duplex = "half";
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch {
    response.status(502).json({
      error: {
        code: "backend_unreachable",
        message: "The audit backend did not respond. Check BACKEND_ORIGIN and the Render logs.",
        request_id: "vercel-proxy",
        retryable: true,
      },
    });
    return;
  }

  response.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key) || key === "content-encoding" || key === "set-cookie") return;
    response.setHeader(key, value);
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    response.setHeader("set-cookie", setCookies);
  } else {
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) response.setHeader("set-cookie", cookie);
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  response.send(body);
};

// Audits are synchronous and can take up to AUDIT_TIMEOUT_SECONDS. Raise this
// on a plan that allows it; the default Hobby limit is much shorter.
module.exports.config = { maxDuration: 60 };
