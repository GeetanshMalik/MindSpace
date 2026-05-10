const fs = require('fs');
const path = require('path');

const siteIndex = path.join(__dirname, '..', 'site', 'index.html');

if (!fs.existsSync(siteIndex)) {
  throw new Error('Missing netlify/site/index.html');
}

console.log('Mindspace Netlify backend-only build: static status page and functions are ready.');
