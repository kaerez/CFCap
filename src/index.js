// =============================================
// repo: kaerez/cfcap
// file: src/index.js
// =============================================

import Cap from "@cap.js/server";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ---------------------------------------------------------
    // 1. API Routes (Backend Logic)
    // ---------------------------------------------------------

    // Initialize Cap with D1 storage adapter
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

    // POST /api/challenge
    if (request.method === "POST" && pathname === "/api/challenge") {
      try {
        const challenge = await cap.createChallenge();
        return new Response(JSON.stringify(challenge), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // POST /api/redeem
    if (request.method === "POST" && pathname === "/api/redeem") {
      try {
        const { token, solutions } = await request.json();
        if (!token || !solutions) {
          return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const result = await cap.redeemChallenge({ token, solutions });
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /api/validate (Optional)
    if (request.method === "POST" && pathname === "/api/validate") {
      try {
        const { token } = await request.json();
        const result = await cap.validateToken(token);
        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
        });
      } catch(err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // ---------------------------------------------------------
    // 2. Static Assets (Frontend Serving)
    // ---------------------------------------------------------

    // Safety check: Ensure Assets binding exists
    if (!env.ASSETS) {
      return new Response("Configuration Error: Assets binding not found.", { status: 500 });
    }

    // Case A: Serve Widget Script
    // /widget/widget.js -> maps to public/widget.js
    if (pathname === "/widget/widget.js") {
      const assetUrl = new URL("/widget.js", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // Case B: Serve Demo Page
    // /widget, /widget/, or /widget/index.html -> maps to public/index.html
    if (pathname === "/widget" || pathname === "/widget/" || pathname === "/widget/index.html") {
      const assetUrl = new URL("/index.html", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // Case C: Default fallbacks
    // If requesting root /, serve index
    if (pathname === "/" || pathname === "") {
        const assetUrl = new URL("/index.html", request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // Otherwise serve whatever file was requested (favicon, etc.)
    return env.ASSETS.fetch(request);
  },
};
