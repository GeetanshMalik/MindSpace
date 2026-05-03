const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/i18n/translations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'types.ts');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find "Copy Message"
  const copyMessageIdx = content.indexOf('  "Copy Message":');
  if (copyMessageIdx > -1) {
    // Check the character before the spaces and newline
    const preContent = content.substring(0, copyMessageIdx);
    const lastCharIdx = preContent.trimEnd().length - 1;
    const preContentTrimmed = preContent.trimEnd();
    
    if (preContentTrimmed[preContentTrimmed.length - 1] === '"' || preContentTrimmed[preContentTrimmed.length - 1] === "'") {
       // Insert comma
       content = preContentTrimmed + ',\n' + content.substring(preContentTrimmed.length).replace(/^\s+/, '  ');
       fs.writeFileSync(filePath, content, 'utf8');
       console.log('Fixed comma in ' + file);
    }
  }
}
