import { callPushRelay, isPushRelayConfigured } from '../pushRelay';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

type SageChatResponse = {
  ok?: boolean;
  provider?: string;
  reply?: string;
};

const FALLBACK_REPLY =
  "I'm having a little trouble connecting right now. Please try again in a moment - I'll be right here when you're ready.";

export async function sendToAI(messages: AIMessage[]): Promise<string> {
  if (!isPushRelayConfigured()) {
    console.warn('[Sage] AI relay is not configured.');
    return FALLBACK_REPLY;
  }

  try {
    const response = await callPushRelay<SageChatResponse>('sage-chat', { messages });
    if (typeof response.reply === 'string' && response.reply.trim()) {
      return response.reply.trim();
    }
    throw new Error('Sage relay returned an empty response');
  } catch (error: any) {
    console.warn('[Sage] AI relay failed:', error?.message || error);
    return FALLBACK_REPLY;
  }
}
