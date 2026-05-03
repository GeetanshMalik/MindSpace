const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/i18n/translations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'types.ts');

const translations = {
  hi: {
    "Error": "त्रुटि",
    "Failed": "विफल",
    "Feed Error": "फ़ीड त्रुटि",
    "Could not post story. Please try again.": "स्टोरी पोस्ट नहीं की जा सकी। कृपया पुनः प्रयास करें।",
    "Could not post. Please try again.": "पोस्ट नहीं किया जा सका। कृपया पुनः प्रयास करें।",
    "Could not post comment.": "टिप्पणी पोस्ट नहीं की जा सकी।",
    "Could not load the community feed. Please try again.": "समुदाय फ़ीड लोड नहीं किया जा सका। कृपया पुनः प्रयास करें।",
    "Could not update post.": "पोस्ट अपडेट नहीं की जा सकी।",
    "Could not hide post.": "पोस्ट छिपाया नहीं जा सका।"
  },
  bn: {
    "Error": "ত্রুটি",
    "Failed": "ব্যর্থ",
    "Feed Error": "ফিড ত্রুটি",
    "Could not post story. Please try again.": "স্টোরি পোস্ট করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    "Could not post. Please try again.": "পোস্ট করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    "Could not post comment.": "মন্তব্য পোস্ট করা যায়নি।",
    "Could not load the community feed. Please try again.": "কমিউনিটি ফিড লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    "Could not update post.": "পোস্ট আপডেট করা যায়নি।",
    "Could not hide post.": "পোস্ট লুকানো যায়নি।"
  },
  ja: {
    "Error": "エラー",
    "Failed": "失敗",
    "Feed Error": "フィードエラー",
    "Could not post story. Please try again.": "ストーリーを投稿できませんでした。もう一度お試しください。",
    "Could not post. Please try again.": "投稿できませんでした。もう一度お試しください。",
    "Could not post comment.": "コメントを投稿できませんでした。",
    "Could not load the community feed. Please try again.": "コミュニティフィードを読み込めませんでした。もう一度お試しください。",
    "Could not update post.": "投稿を更新できませんでした。",
    "Could not hide post.": "投稿を非表示にできませんでした。"
  },
  pt: {
    "Error": "Erro",
    "Failed": "Falhou",
    "Feed Error": "Erro no Feed",
    "Could not post story. Please try again.": "Não foi possível postar o story. Por favor, tente novamente.",
    "Could not post. Please try again.": "Não foi possível postar. Por favor, tente novamente.",
    "Could not post comment.": "Não foi possível postar o comentário.",
    "Could not load the community feed. Please try again.": "Não foi possível carregar o feed da comunidade. Por favor, tente novamente.",
    "Could not update post.": "Não foi possível atualizar o post.",
    "Could not hide post.": "Não foi possível ocultar o post."
  },
  zh: {
    "Error": "错误",
    "Failed": "失败",
    "Feed Error": "动态错误",
    "Could not post story. Please try again.": "无法发布动态。请重试。",
    "Could not post. Please try again.": "无法发布。请重试。",
    "Could not post comment.": "无法发布评论。",
    "Could not load the community feed. Please try again.": "无法加载社区动态。请重试。",
    "Could not update post.": "无法更新帖子。",
    "Could not hide post.": "无法隐藏帖子。"
  },
  fr: {
    "Error": "Erreur",
    "Failed": "Échoué",
    "Feed Error": "Erreur de flux",
    "Could not post story. Please try again.": "Impossible de publier la story. Veuillez réessayer.",
    "Could not post. Please try again.": "Impossible de publier. Veuillez réessayer.",
    "Could not post comment.": "Impossible de publier le commentaire.",
    "Could not load the community feed. Please try again.": "Impossible de charger le flux de la communauté. Veuillez réessayer.",
    "Could not update post.": "Impossible de mettre à jour la publication.",
    "Could not hide post.": "Impossible de masquer la publication."
  },
  es: {
    "Error": "Error",
    "Failed": "Fallido",
    "Feed Error": "Error de feed",
    "Could not post story. Please try again.": "No se pudo publicar la historia. Por favor, inténtalo de nuevo.",
    "Could not post. Please try again.": "No se pudo publicar. Por favor, inténtalo de nuevo.",
    "Could not post comment.": "No se pudo publicar el comentario.",
    "Could not load the community feed. Please try again.": "No se pudo cargar el feed de la comunidad. Por favor, inténtalo de nuevo.",
    "Could not update post.": "No se pudo actualizar la publicación.",
    "Could not hide post.": "No se pudo ocultar la publicación."
  },
  de: {
    "Error": "Fehler",
    "Failed": "Fehlgeschlagen",
    "Feed Error": "Feed-Fehler",
    "Could not post story. Please try again.": "Story konnte nicht gepostet werden. Bitte versuche es erneut.",
    "Could not post. Please try again.": "Konnte nicht posten. Bitte versuche es erneut.",
    "Could not post comment.": "Kommentar konnte nicht gepostet werden.",
    "Could not load the community feed. Please try again.": "Community-Feed konnte nicht geladen werden. Bitte versuche es erneut.",
    "Could not update post.": "Beitrag konnte nicht aktualisiert werden.",
    "Could not hide post.": "Beitrag konnte nicht verborgen werden."
  },
  ar: {
    "Error": "خطأ",
    "Failed": "فشل",
    "Feed Error": "خطأ في التغذية",
    "Could not post story. Please try again.": "تعذر نشر القصة. يرجى المحاولة مرة أخرى.",
    "Could not post. Please try again.": "تعذر النشر. يرجى المحاولة مرة أخرى.",
    "Could not post comment.": "تعذر نشر التعليق.",
    "Could not load the community feed. Please try again.": "تعذر تحميل تغذية المجتمع. يرجى المحاولة مرة أخرى.",
    "Could not update post.": "تعذر تحديث المنشور.",
    "Could not hide post.": "تعذر إخفاء المنشور."
  }
};

for (const file of files) {
  const lang = file.replace('.ts', '');
  if (!translations[lang]) continue;
  
  const tr = translations[lang];
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const lastBraceIndex = content.lastIndexOf('};');
  if (lastBraceIndex === -1) continue;

  let insertStr = '';
  for (const [key, val] of Object.entries(tr)) {
    // Only add if it doesn't already exist to avoid duplicates
    if (!content.includes(`"${key}":`)) {
       insertStr += `  "${key}": "${val}",\n`;
    }
  }
  
  if (insertStr) {
    // Also make sure there's a comma before if missing
    const preContent = content.substring(0, lastBraceIndex);
    const preContentTrimmed = preContent.trimEnd();
    let prefix = '';
    if (preContentTrimmed[preContentTrimmed.length - 1] === '"' || preContentTrimmed[preContentTrimmed.length - 1] === "'") {
       prefix = ',\n';
    }
    
    content = preContent + prefix + insertStr + content.substring(lastBraceIndex);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added missing keys to ' + file);
  }
}
