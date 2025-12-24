// =============================================
// repo: kaerez/cfcap
// file: scripts/prepare-assets.js
// =============================================

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Configuration
const WIDGET_VERSION = '0.1.33';
// We save the file to public/widget/widget.js so Cloudflare Assets uploads it 
// and serves it at /widget/widget.js naturally.
const TARGET_DIR = path.join(__dirname, '..', 'public', 'widget');
const TARGET_FILE = path.join(TARGET_DIR, 'widget.js');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Strategy: Try to find the file in node_modules first. 
const copyFromNodeModules = () => {
  try {
    const pkgPath = require.resolve('@cap.js/widget/package.json');
    const pkgDir = path.dirname(pkgPath);
    
    // Look for a dist folder or standard browser files
    const candidates = [
      path.join(pkgDir, 'dist', 'widget.js'),
      path.join(pkgDir, 'dist', 'cap.js'),
      path.join(pkgDir, 'widget.js')
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        console.log(`✅ Found local widget file: ${candidate}`);
        fs.copyFileSync(candidate, TARGET_FILE);
        console.log(`📄 Copied to ${TARGET_FILE}`);
        return true;
      }
    }
    console.log('⚠️  Could not locate specific browser build in node_modules.');
    return false;
  } catch (e) {
    console.log('⚠️  Could not resolve @cap.js/widget locally:', e.message);
    return false;
  }
};

const downloadFromCDN = () => {
  const url = `https://cdn.jsdelivr.net/npm/@cap.js/widget@${WIDGET_VERSION}/dist/widget.js`; 
  const altUrl = `https://cdn.jsdelivr.net/npm/@cap.js/widget@${WIDGET_VERSION}/widget.js`;

  console.log(`⬇️  Downloading widget from ${url}...`);
  
  const fetchFile = (downloadUrl) => {
    return new Promise((resolve, reject) => {
      https.get(downloadUrl, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          fetchFile(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Status ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(TARGET_FILE);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`📄 Downloaded to ${TARGET_FILE}`);
          resolve(true);
        });
      }).on('error', reject);
    });
  };

  return fetchFile(url).catch(() => {
    console.log(`⚠️  Standard path failed. Trying fallback: ${altUrl}`);
    return fetchFile(altUrl);
  });
};

// Execution
(async () => {
  try {
    await downloadFromCDN();
  } catch (err) {
    console.error('❌ Download failed:', err.message);
    console.log('ℹ️  Attempting local copy...');
    if (!copyFromNodeModules()) {
      console.error('❌ Failed to prepare widget.js');
      process.exit(1);
    }
  }
})();
