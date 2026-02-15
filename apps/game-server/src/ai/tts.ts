import { env } from '../env.js';
import { log } from '../logger.js';

interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  const apiKey = env.INWORLD_API_KEY;
  if (!apiKey) {
    log.warn('[tts] INWORLD_API_KEY not configured, skipping TTS');
    return null;
  }

  try {
    const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId: env.INWORLD_VOICE_ID,
        modelId: env.INWORLD_TTS_MODEL_ID,
      }),
    });

    if (!res.ok) {
      log.error(`[tts] Inworld TTS failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as { audioContent?: string };
    if (!data.audioContent) {
      log.error('[tts] No audioContent in Inworld response');
      return null;
    }

    return { audioBase64: data.audioContent, mimeType: 'audio/wav' };
  } catch (err) {
    log.error('[tts] TTS synthesis error:', err);
    return null;
  }
}
