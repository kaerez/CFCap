const { execSync } = require('child_process');

// Helper: Run command safely
// Returns true on success, false on failure (without crashing)
function runCommand(command, label) {
    try {
        console.log(`[${label}] Running: ${command}`);
        // redirect output to /dev/null to keep logs clean unless error? 
        // No, user wants to see what's happening.
        execSync(command, { stdio: 'pipe' }); // pipe to avoid noisy errors in build logs if we handle them
        console.log(`   -> Success.`);
        return true;
    } catch (error) {
        // Prepare to ignore specific "already exists" errors if possible, 
        // checking stdout/stderr might be needed but simple catch is safer for now.
        const msg = error.stderr ? error.stderr.toString() : error.message;
        if (msg.includes("already exists")) {
            console.log(`   -> Resource already exists (Skipped).`);
            return true;
        }
        if (msg.includes("auth") || msg.includes("login") || msg.includes("Authentication")) {
            console.log(`   -> Warning: Authentication failed. Build continuing. (Is CLOUDFLARE_API_TOKEN set?)`);
            return false;
        }

        console.log(`   -> Note: Command failed. Ignored.`);
        return false;
    }
}

const buckets = ['cap-challenges', 'cap-tokens'];

console.log("---------------------------------------------------------");
console.log("CFCap Auto-Setup (CI/CD Safe)");
console.log("---------------------------------------------------------");
console.log("Attempting to configure R2 and Secrets...");

// 1. Buckets & Lifecycle
buckets.forEach(bucket => {
    runCommand(`npx wrangler r2 bucket create ${bucket}`, `Create ${bucket}`);
    // Lifecycle: 1 Day retention
    runCommand(`npx wrangler r2 bucket lifecycle add ${bucket} --expire-days 1`, `Lifecycle ${bucket}`);
});

// 2. Secrets
// We strictly rely on Code Defaults (src/index.js) or Manual Dashboard Text Variables.
// Users requested "Type: Text", which cannot be easily automated via CLI without 'wrangler.toml' overwrites.
// Since code has defaults, we don't need to force-create them.
console.log("\nSecrets configuration rely on code defaults or manual Dashboard Variables.");
console.log("(See README for optional overrides)");

// ALWAYS exit 0 to allow build to proceed even if setup failed (manual fallback)
console.log("---------------------------------------------------------");
console.log("Setup Attempt Finished. Continuing build...");
process.exit(0);
