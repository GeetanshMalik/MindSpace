const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/i18n/translations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'types.ts');

const translations = {
  hi: { "Copy Message": "संदेश कॉपी करें", "Delete for Me": "मेरे लिए हटाएं" },
  bn: { "Copy Message": "বার্তা কপি করুন", "Delete for Me": "আমার জন্য মুছুন" },
  ja: { "Copy Message": "メッセージをコピー", "Delete for Me": "自分のために削除" },
  pt: { "Copy Message": "Copiar mensagem", "Delete for Me": "Apagar para mim" },
  zh: { "Copy Message": "复制消息", "Delete for Me": "为我删除" },
  fr: { "Copy Message": "Copier le message", "Delete for Me": "Supprimer pour moi" },
  es: { "Copy Message": "Copiar mensaje", "Delete for Me": "Eliminar para mí" },
  de: { "Copy Message": "Nachricht kopieren", "Delete for Me": "Für mich löschen" },
  ar: { "Copy Message": "نسخ الرسالة", "Delete for Me": "حذف لدي" }
};

for (const file of files) {
  const lang = file.replace('.ts', '');
  if (!translations[lang]) continue;
  
  const tr = translations[lang];
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const lastBraceIndex = content.lastIndexOf('};');
  if (lastBraceIndex === -1) continue;

  const insertStr = `  "Copy Message": "${tr["Copy Message"]}",\n  "Delete for Me": "${tr["Delete for Me"]}",\n`;
  content = content.slice(0, lastBraceIndex) + insertStr + content.slice(lastBraceIndex);
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + file);
}
