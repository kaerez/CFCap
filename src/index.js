// =============================================
// repo: kaerez/cfcap
// file: src/index.js
// =============================================

import Cap from "@cap.js/server";

// Helper: Check Access Control
// Returns true if allowed, false otherwise.
function checkAccess(request, env) {
  // Parse ALLOWED list
  // Strip quotes (single/double) and spaces, split by comma
  const allowedRaw = (env.ALLOWED || "").replace(/['"]/g, "").split(",");
  const allowedPatterns = allowedRaw.map(s => s.trim()).filter(s => s.length > 0);

  if (allowedPatterns.length === 0) return true;

  const referer = request.headers.get("Referer");
  const origin = request.headers.get("Origin");
  const urlToCheck = referer || origin;

  if (!urlToCheck) return false; // Enforce presence if restriction exists

  try {
    const hostname = new URL(urlToCheck).hostname;

    return allowedPatterns.some(pattern => {
      if (pattern.startsWith("*.")) {
        const domain = pattern.slice(2);
        return hostname.endsWith(domain) && hostname.split('.').length > domain.split('.').length;
      }
      return hostname === pattern;
    });
  } catch (e) {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ---------------------------------------------------------
    // 0. ACCESS CONTROL
    // ---------------------------------------------------------
    const isApiOrWidget = pathname.startsWith("/api") || pathname.startsWith("/widget");
    if (isApiOrWidget) {
      if (!checkAccess(request, env)) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    // ---------------------------------------------------------
    // 1. API Routes (Backend Logic)
    // ---------------------------------------------------------

    const cap = new Cap({
      challengeTTL: Number(env.CHALLENGE_TTL) || 300,
      tokenTTL: Number(env.TOKEN_TTL) || 330,
      storage: {
        challenges: {
          store: async (token, challengeData) => {
            // Store metadata for expiration checking
            await env.R2_CHALLENGES.put(token, JSON.stringify(challengeData), {
              customMetadata: { expires: String(challengeData.expires) }
            });
          },
          read: async (token) => {
            const obj = await env.R2_CHALLENGES.get(token);
            if (!obj) return null;

            // Check expiration
            const expires = Number(obj.customMetadata.expires);
            if (Date.now() > expires) {
              // Optionally delete async to cleanup?
              // obj.delete(); // No, we'll let lifecycle or lazy delete handle it
              return null;
            }

            const data = await obj.json();
            return { challenge: data, expires: expires };
          },
          delete: async (token) => {
            await env.R2_CHALLENGES.delete(token);
          },
          deleteExpired: async () => {
            // R2 Lifecycle Policy handles this more efficiently
            // No-op for code compatibility
          },
        },
        tokens: {
          store: async (tokenKey, expires) => {
            await env.R2_TOKENS.put(tokenKey, "valid", {
              customMetadata: { expires: String(expires) }
            });
          },
          get: async (tokenKey) => {
            const obj = await env.R2_TOKENS.get(tokenKey);
            if (!obj) return null;

            const expires = Number(obj.customMetadata.expires);
            if (Date.now() > expires) return null;

            return expires;
          },
          delete: async (tokenKey) => {
            await env.R2_TOKENS.delete(tokenKey);
          },
          deleteExpired: async () => {
            // R2 Lifecycle Policy handles this more efficiently
            // No-op for code compatibility
          },
        },
      },
    });

    // API Routes
    if (request.method === "POST") {
      if (pathname === "/api/challenge") {
        try {
          const challenge = await cap.createChallenge();
          return new Response(JSON.stringify(challenge), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }
      if (pathname === "/api/redeem") {
        try {
          const { token, solutions } = await request.json();
          if (!token || !solutions) {
            return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), { status: 400 });
          }
          const result = await cap.redeemChallenge({ token, solutions });
          return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
        }
      }
      if (pathname === "/api/validate") {
        try {
          const { token } = await request.json();
          const result = await cap.validateToken(token);
          return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
        }
      }
    }

    // ---------------------------------------------------------
    // 2. Routing & Asset Serving
    // ---------------------------------------------------------

    if (!env.ASSETS) {
      return new Response("Configuration Error: Assets binding not found.", { status: 500 });
    }

    // Serve Demo Page at Root or /demo
    if (pathname === "/" || pathname === "/landing.html") {
      const assetUrl = new URL("/demo/landing.html", request.url);
      const resp = await env.ASSETS.fetch(new Request(assetUrl, request));
      // Reconstitute response to ensure no 301/302 redirect happens
      return new Response(resp.body, {
        status: resp.status,
        headers: resp.headers
      });
    }

    // C. Default Asset Serving
    // Handles:
    // - /widget/widget.js
    // - /widget/cap-floating.min.js
    return env.ASSETS.fetch(request);
  },
};
