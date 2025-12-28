// =============================================
// repo: kaerez/cfcap
// file: src/index.js
// =============================================

import Cap from "@cap.js/server";

// Helper: Check Access Control
// Returns true if allowed, false otherwise.
function checkAccess(request, env) {
  if (!env.ALLOWED || env.ALLOWED.trim() === "") return true;

  // Parse ALLOWED list
  // Strip quotes (single/double) and spaces, split by comma
  const allowedRaw = env.ALLOWED.replace(/['"]/g, "").split(",");
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
      storage: {
        challenges: {
          store: async (token, challengeData) => {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO challenges (token, data, expires)
              VALUES (?, ?, ?)
            `)
              .bind(token, JSON.stringify(challengeData), challengeData.expires)
              .run();
          },
          read: async (token) => {
            const row = await env.DB.prepare(`
              SELECT data, expires
              FROM challenges
              WHERE token = ?
                AND expires > ?
              LIMIT 1
            `)
              .bind(token, Date.now())
              .first();
            return row
              ? { challenge: JSON.parse(row.data), expires: Number(row.expires) }
              : null;
          },
          delete: async (token) => {
            await env.DB.prepare(`DELETE FROM challenges WHERE token = ?`).bind(token).run();
          },
          deleteExpired: async () => {
            await env.DB.prepare(`DELETE FROM challenges WHERE expires <= ?`).bind(Date.now()).run();
          },
        },
        tokens: {
          store: async (tokenKey, expires) => {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO tokens (key, expires)
              VALUES (?, ?)
            `)
              .bind(tokenKey, expires)
              .run();
          },
          get: async (tokenKey) => {
            const row = await env.DB.prepare(`
              SELECT expires
              FROM tokens
              WHERE key = ?
                AND expires > ?
              LIMIT 1
            `)
              .bind(tokenKey, Date.now())
              .first();
            return row ? Number(row.expires) : null;
          },
          delete: async (tokenKey) => {
            await env.DB.prepare(`DELETE FROM tokens WHERE key = ?`).bind(tokenKey).run();
          },
          deleteExpired: async () => {
            await env.DB.prepare(`DELETE FROM tokens WHERE expires <= ?`).bind(Date.now()).run();
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
    if (pathname === "/" || pathname === "" || pathname === "/demo" || pathname === "/landing.html") {
      const assetUrl = new URL("/demo/landing.html", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // C. Default Asset Serving
    // Handles:
    // - /widget/widget.js
    // - /widget/cap-floating.min.js
    return env.ASSETS.fetch(request);
  },
};
