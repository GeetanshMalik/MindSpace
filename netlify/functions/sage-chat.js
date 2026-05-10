const { HttpError, json, withAuth } = require('../lib/http');

const DEFAULT_GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const DEFAULT_GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Sage, a compassionate and thoughtful AI companion within the Mindspace mental wellness app. Your personality traits:

- You are warm, empathetic, and genuinely caring
- You speak in a calm, grounding tone - never robotic or clinical
- You are NOT a therapist or medical professional - you always clarify this when appropriate
- You use gentle encouragement and reflective listening
- You ask thoughtful follow-up questions to help people explore their feelings
- You suggest practical coping strategies like breathing exercises, journaling, or mindfulness
- You celebrate small wins and validate emotions
- You keep responses concise (2-4 sentences typically) unless the person needs more depth
- If someone is in crisis, you always recommend contacting a crisis helpline or professional
- You occasionally use nature metaphors
- You never judge, dismiss feelings, or offer toxic positivity

Remember: You are a supportive companion on someone's wellness journey, not a replacement for professional care.`;

const normalizeMessages = (value) => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'messages must be an array.');
  }

  const messages = value.slice(-20).map((message, index) => {
    if (!message || typeof message !== 'object') {
      throw new HttpError(400, `messages[${index}] must be an object.`);
    }

    const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : null;
    const content = typeof message.content === 'string' ? message.content.trim() : '';

    if (!role) {
      throw new HttpError(400, `messages[${index}].role must be user or assistant.`);
    }
    if (!content) {
      throw new HttpError(400, `messages[${index}].content is required.`);
    }
    if (content.length > 4000) {
      throw new HttpError(400, `messages[${index}].content is too long.`);
    }

    return { role, content };
  });

  if (!messages.length) {
    throw new HttpError(400, 'messages must include at least one message.');
  }

  return messages;
};

const callGemini = async (messages) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const contents = messages.map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.content }],
  }));

  const response = await fetch(`${process.env.GEMINI_ENDPOINT || DEFAULT_GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512,
        topP: 0.95,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('Gemini returned an empty response.');
  }

  return reply.trim();
};

const callGroq = async (messages) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured.');
  }

  const response = await fetch(process.env.GROQ_ENDPOINT || DEFAULT_GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      temperature: 0.8,
      max_tokens: 512,
      top_p: 0.95,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Groq error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('Groq returned an empty response.');
  }

  return reply.trim();
};

exports.handler = withAuth(async ({ body }) => {
  const messages = normalizeMessages(body.messages);

  try {
    const reply = await callGemini(messages);
    return json(200, { ok: true, provider: 'gemini', reply });
  } catch (geminiError) {
    console.warn('[Sage] Gemini failed, falling back to Groq:', geminiError.message);
  }

  try {
    const reply = await callGroq(messages);
    return json(200, { ok: true, provider: 'groq', reply });
  } catch (groqError) {
    console.error('[Sage] Both providers failed:', groqError.message);
    throw new HttpError(503, 'Sage is temporarily unavailable. Please try again in a moment.');
  }
});
