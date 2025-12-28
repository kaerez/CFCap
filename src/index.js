// =============================================
// repo: kaerez/cfcap
// file: src/index.js
// =============================================

import Cap from "@cap.js/server";
import { createHash } from "node:crypto";

// Helper: Check Access Control
// Returns true if allowed, false otherwise.
function checkAccess(request, env) {
  // Parse ALLOWED list
  // Strip quotes (single/double) and spaces, split by comma
  const allowedRaw = (env.ALLOWED || "").replace(/['"]/g, "").split(",");
  const allowedPatterns = allowedRaw.map(s => s.trim()).filter(s => s.length > 0);

  if (allowedPatterns.length === 0) return false; // Strict Block: Missing/Empty ALLOWED blocks everyone

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

// Helper: Get CORS Headers
function getCorsHeaders(request, env) {
  const allowedRaw = (env.ALLOWED || "").replace(/['"]/g, "").split(",");
  const allowedPatterns = allowedRaw.map(s => s.trim()).filter(s => s.length > 0);

  // Default headers
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // If no restrictions defined, we block everyone (do NOT allow *)
  if (allowedPatterns.length === 0) {
    return headers;
  }

  // If restrictions exist, check Origin
  const origin = request.headers.get("Origin");
  if (origin) {
    // We reuse checkAccess logic checks but focused on Origin header for CORS
    const hostname = new URL(origin).hostname;
    const isAllowed = allowedPatterns.some(pattern => {
      if (pattern.startsWith("*.")) {
        const domain = pattern.slice(2);
        return hostname.endsWith(domain) && hostname.split('.').length > domain.split('.').length;
      }
      return hostname === pattern;
    });

    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin"; // Important for caching
    }
  }

  return headers;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ---------------------------------------------------------
    // 0. PREFLIGHT & ACCESS CONTROL
    // ---------------------------------------------------------

    // Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env)
      });
    }

    // [DEBUG] Health Check - Verification of Worker Startup & Capabilities
    if (pathname === "/api/health") {
      const diag = { status: "OK", checks: {} };
      try {
        // Check 1: Crypto
        const hash = createHash("sha256").update("test").digest("hex");
        diag.checks.crypto = { status: "ok", result: hash };
      } catch (e) {
        diag.checks.crypto = { status: "failed", error: e.message };
        diag.status = "WARNING";
      }

      try {
        // Check 2: R2 Connectivity
        const list = await env.R2_TOKENS.list({ limit: 1 });
        diag.checks.r2 = { status: "ok", count: list.objects.length };
      } catch (e) {
        diag.checks.r2 = { status: "failed", error: e.message };
        diag.status = "WARNING";
      }

      return new Response(JSON.stringify(diag, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("DEBUG: Incoming request", request.method, request.url);
    try {
      const isApiOrWidget = pathname.startsWith("/api") || pathname.startsWith("/widget");
      // [CHANGE] Exclude validation endpoints from strict access checks to allow server-to-server calls
      const isValidationEndpoint = pathname === "/api/validate" || pathname === "/api/verify";

      if (isApiOrWidget && !isValidationEndpoint) {
        console.log("DEBUG: Checking Access for", pathname);
        if (!checkAccess(request, env)) {
          console.log("DEBUG: Access Denied");
          return new Response("Forbidden (Debug: Access Check Failed)", {
            status: 403,
            headers: getCorsHeaders(request, env)
          });
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

      // [DEBUG] Logging Routing Decisions
      console.log(`DEBUG: Routing - Method: ${request.method}, Path: ${pathname}, IsValidation: ${isValidationEndpoint}`);

      // API Routes
      if (request.method === "POST") {
        console.log("DEBUG: Entered POST block");
        const corsHeaders = getCorsHeaders(request, env);

        if (pathname === "/api/challenge") {
          try {
            const challenge = await cap.createChallenge();
            return new Response(JSON.stringify(challenge), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
              status: 500,
              headers: corsHeaders
            });
          }
        }
        if (pathname === "/api/redeem") {
          try {
            const { token, solutions } = await request.json();
            if (!token || !solutions) {
              return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), {
                status: 400,
                headers: corsHeaders
              });
            }
            const result = await cap.redeemChallenge({ token, solutions });
            return new Response(JSON.stringify(result), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          } catch (err) {
            return new Response(JSON.stringify({ success: false, error: err.message }), {
              status: 500,
              headers: corsHeaders
            });
          }
        }
        if (pathname === "/api/validate" || pathname === "/api/verify") {
          try {
            const { token } = await request.json();
            const result = await cap.validateToken(token, { keepToken: true });
            return new Response(JSON.stringify(result), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          } catch (err) {
            return new Response(JSON.stringify({ success: false, error: err.message }), {
              status: 500,
              headers: corsHeaders
            });
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
      // Fix: Fetch '/demo/landing' (no extension) because Cloudflare Assets prefers pretty URLs
      // and might redirect .html -> no-extension. We want the content, not the redirect.
      if (pathname === "/" || pathname === "/landing.html") {
        const assetUrl = new URL("/demo/landing", request.url);
        let resp = await env.ASSETS.fetch(new Request(assetUrl, request));

        // Fallback: If no-extension fails (404), try with .html (in case pretty_urls is off)
        if (resp.status === 404) {
          resp = await env.ASSETS.fetch(new Request(new URL("/demo/landing.html", request.url), request));
        }

        // Reconstitute response to ensure no 301/302 redirect happens to the user
        return new Response(resp.body, {
          status: (resp.status >= 300 && resp.status < 400) ? 200 : resp.status, // Force 200 if it was a redirect but has body (unlikely for 301, but safe)
          headers: resp.headers
        });
      }

      // C. Default Asset Serving
      // Handles:
      // - /widget/widget.js
      // - /widget/cap-floating.min.js
      // We attach CORS headers here to ensure /widget resources can be loaded cross-origin if allowed
      let response = await env.ASSETS.fetch(request);

      // Create new response to modify headers (Response objects are immutable)
      response = new Response(response.body, response);

      const corsHeaders = getCorsHeaders(request, env);
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }

      return response;
    } catch (e) {
      // Global Error Handler
      return new Response(JSON.stringify({
        success: false,
        error: "Internal Server Error",
        details: e.message,
        stack: e.stack
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
};
