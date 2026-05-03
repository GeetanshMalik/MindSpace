// Mindspace AI Service — Gemini first, Groq fallback
import { AI_CONFIG } from './aiConfig';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Gemini API ──────────────────────────────────────────────────────
async function callGemini(messages: AIMessage[]): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Prepend system instruction as first user message context
  const body = {
    system_instruction: {
      parts: [{ text: AI_CONFIG.SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
      topP: 0.95,
    },
  };

  const url = `${AI_CONFIG.GEMINI_ENDPOINT}?key=${AI_CONFIG.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text.trim();
}

// ─── Groq API ────────────────────────────────────────────────────────
async function callGroq(messages: AIMessage[]): Promise<string> {
  const groqMessages = [
    { role: 'system' as const, content: AI_CONFIG.SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const body = {
    model: AI_CONFIG.GROQ_MODEL,
    messages: groqMessages,
    temperature: 0.8,
    max_tokens: 512,
    top_p: 0.95,
  };

  const res = await fetch(AI_CONFIG.GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_CONFIG.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');
  return text.trim();
}

// ─── Public API — Gemini first, Groq fallback ────────────────────────
export async function sendToAI(messages: AIMessage[]): Promise<string> {
  try {
    return await callGemini(messages);
  } catch (geminiError: any) {
    console.warn('[Sage] Gemini failed, falling back to Groq:', geminiError.message);
    try {
      return await callGroq(messages);
    } catch (groqError: any) {
      console.error('[Sage] Both providers failed:', groqError.message);
      return "I'm having a little trouble connecting right now. Please try again in a moment — I'll be right here when you're ready. 🌿";
    }
  }
}
