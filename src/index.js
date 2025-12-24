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
        } catch(err) {
            return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
        }
      }
    }

    // ---------------------------------------------------------
    // 2. Static Assets & Routing
    // ---------------------------------------------------------

    if (!env.ASSETS) {
      return new Response("Configuration Error: Assets binding not found.", { status: 500 });
    }

    // A. STRICT 404 for Root path
    // Since we renamed index.html -> demo.html, Cloudflare won't auto-serve it here.
    if (pathname === "/" || pathname === "") {
      return new Response("Not Found", { status: 404 });
    }

    // B. Serve Widget JS: /widget/widget.js -> public/widget.js
    if (pathname === "/widget/widget.js") {
      const assetUrl = new URL("/widget.js", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // C. Serve Demo Page: /widget -> public/demo.html
    // We explicitly fetch 'demo.html' to avoid the 301 redirect loop associated with 'index.html'
    if (pathname === "/widget" || pathname === "/widget/" || pathname === "/widget/index.html") {
      const assetUrl = new URL("/demo.html", request.url);
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // D. Fallback for other assets (e.g. favicon)
    return env.ASSETS.fetch(request);
  },
};
