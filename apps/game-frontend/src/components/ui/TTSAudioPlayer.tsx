'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';

export function TTSAudioPlayer() {
  const queue = useVoiceStore((s) => s.ttsQueue);
  const dequeue = useVoiceStore((s) => s.dequeueTTS);
  const playingRef = useRef(false);

  useEffect(() => {
    if (playingRef.current || queue.length === 0) return;

    const item = queue[0];
    playingRef.current = true;

    const byteChars = atob(item.audioBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: item.mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    };

    audio.onerror = (e) => {
      console.error('[TTS] Audio playback error:', e);
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    };

    audio.play().catch((err) => {
      console.error('[TTS] Autoplay blocked or play failed:', err);
      URL.revokeObjectURL(url);
      playingRef.current = false;
      dequeue();
    });
  }, [queue, dequeue]);

  return null; // No visual output
}
