// =============================================
// repo: kaerez/cfcap
// file: scripts/prepare-assets.js
// =============================================

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Configuration
const WIDGET_VERSION = '0.1.33';
// TARGET: root/widget/widget.js
// We point to the root 'widget' folder, NOT public/widget
const TARGET_DIR = path.join(__dirname, '..', 'widget');
const TARGET_FILE = path.join(TARGET_DIR, 'widget.js');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

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

(async () => {
  try {
    await downloadFromCDN();
  } catch (err) {
    console.error('❌ Download failed:', err.message);
    process.exit(1);
  }
})();
