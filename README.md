![Banner](./imgs/banner.png)
# ![](./imgs/logo-small.webp) Cap

Cap is a lightweight, modern open-source CAPTCHA alternative using [SHA-256 proof-of-work](https://capjs.js.org/guide/effectiveness.html). It's fast, private, and extremely simple to integrate.

[![Cap widget](./imgs/captcha.svg)](https://cfcap.secops.workers.dev/)
 
## Documentation

**[Read the docs](https://capjs.js.org)**, try the [demo](https://cfcap.secops.workers.dev/) or read the [feature comparison](https://capjs.js.org/guide/alternatives.html)  
Check out speed test using the implementation [Here](https://fast.kalman.co.il).

## What is Cap?

Cap replaces visual captchas with modern, accessible and privacy-preserving [proof-of-work challenges](https://capjs.js.org/guide/effectiveness.html). No images, no tracking, no dependencies, works everywhere.

You can either run it on any JavaScript runtime, or use the standalone mode with Docker. [Learn more about how Cap works](https://capjs.js.org/guide/)

## Why Cap?

- **250x smaller than hCaptcha**  
  ~20kb, zero dependencies, loads in milliseconds

- **Privacy-first**  
   Cap doesn't send any telemetry back to our servers

- **Fully customizable**  
   Change the colors, size, position, icons and more with CSS variables

- **Proof-of-work**  
   Your users no longer have to waste time solving visual puzzles.

- **Standalone mode**  
   Run Cap anywhere with a Docker container with analytics & more

- **Invisible**  
   Hide Cap's widget and solve challenges in the background

- **M2M**  
   Keep your APIs protected while accessible to friendly robots

- **Open-source**  
   Completely free & open-source under the Apache 2.0 license

Cap is a great alternative to [reCAPTCHA](https://www.google.com/recaptcha/about/), [hCaptcha](https://www.hcaptcha.com/) and [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

---

## 1. GUI Based Deployment (Cloudflare Dashboard)

**Refined for Ease:** This project includes a setup script that automatically builds the worker and creates the necessary R2 storage buckets for you.

### Step A: Deployment
1.  **Fork** this repository to your GitHub account.
2.  **Update Configuration** (Important):
    *   Open `wrangler.toml` in your repository.
    *   Find the `[vars]` section.
    *   Update the `ALLOWED` variable to restrict access to your domains.
    *   **Examples**:
        *   **Allow Single Domain** (Matches `example.com` ONLY, no subdomains):
            ```toml
            ALLOWED = "example.com"
            ```
        *   **Allow Subdomains** (Matches `any.example.com`, but NOT `example.com`):
            ```toml
            ALLOWED = "*.example.com"
            ```
        *   **Allow Root & Subdomains** (Common Setup):
            ```toml
            ALLOWED = "example.com, *.example.com"
            ```
        *   **Allow Multiple Domains**:
            ```toml
            ALLOWED = "example.com, another-site.org"
            ```
        *   **Allow All** (Public Access):
            ```toml
            ALLOWED = ""
            ```
3.  **Connect & Deploy**:
    *   Go to **Cloudflare Dashboard** > **Workers & Pages**.
    *   Click **Create Application** > **Connect to Git**.
    *   Select your forked repository.
    *   Click **Save and Deploy**.

The build system will automatically run `npm run setup`, creating your `cap-challenges` and `cap-tokens` buckets with the required **1-Day Lifecycle Rule** to auto-delete old data.

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

---

## License

This project is licensed under the Apache-2.0 License, please see the [LICENSE](https://github.com/tiagozip/cap/blob/main/LICENSE) file for details.

Copyright ©2025 - present KSEC - Erez Kalman for setup.js, index.js, landing.html, wrangler.toml, package.json  
Copyright ©2025 - present [tiago](https://tiago.zip)

---

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9920/badge)](https://www.bestpractices.dev/projects/9920) [![](https://data.jsdelivr.com/v1/package/npm/@cap.js/wasm/badge)](https://www.jsdelivr.com/package/npm/@cap.js/wasm)
