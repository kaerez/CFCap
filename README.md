# CFCap
Secure, R2-backed deployment of [Cap](https://github.com/tiagozip/cap) captcha on Cloudflare Workers.

## Features
- **Secure Access Control**: Domain whitelisting.
- **R2 Storage**: Serverless, scalable object storage for challenges (1-day auto-expiry).
- **Configurable TTL**: Customize expiration for challenges (300s) and tokens (330s).

---

## 1. GUI Based Deployment (Cloudflare Dashboard)

**Refined for Ease:** This project includes a setup script that runs automatically during the build.
*   **Default Behavior:** Without extra config, it builds the code but **skips** resource creation (Buckets/Secrets) due to lack of permissions. You would then create them manually.
*   **Automated (Recommended):** Add your `CLOUDFLARE_API_TOKEN` to build settings to let the script auto-create everything!

### Step A: Deployment
1.  **Fork** this repository.
2.  Connect it to Cloudflare Pages/Workers.

> **Retry Deployment** (if needed). The build log will show "CFCap Auto-Setup" successfully creating your buckets and secrets.

### Step B: Manual Fallback (If Automation Failed)
1.  **R2**: Create buckets `cap-challenges` and `cap-tokens` in the dashboard with a **1 Day Lifecycle Rule**.

*Note: Bucket bindings are handled automatically by `wrangler.toml`. Secrets (ALLOWED, TTLs) allow overrides but have safe defaults in code.*


---

## 2. CLI Based Deployment (Wrangler)

Use this method if you are comfortable with the command line.

### Step A: Setup
1.  Clone the repo and install dependencies:
    ```bash
    npm install
    ```
2.  Run the automated setup script:
    ```bash
    npm run setup
    ```
    *This will auto-create R2 buckets, Lifecycle rules, and set default Secrets (`ALLOWED`, `TTLs`) ONLY if they don't already exist.*

### Step B: Deploy
```bash
npm run deploy
```

### Step C: Configuration
To verify or change variables for a deploy:
```bash
# Example: Set allowed domains
wrangler vars set ALLOWED "example.com"
```
Or check `wrangler.toml` (note: it does not contain default variables to avoid overwriting your Dashboard settings).
