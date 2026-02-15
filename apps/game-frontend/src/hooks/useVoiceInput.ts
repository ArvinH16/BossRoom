'use client';

import { useRef, useState, useCallback } from 'react';

const DEEPGRAM_WS_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true&punctuate=true';

interface UseVoiceInputReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  isRecording: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef('');
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    try {
      // 1. Get short-lived token from server
      const tokenRes = await fetch(
        `${process.env.NEXT_PUBLIC_WS_URL?.replace('ws', 'http')}/api/deepgram/token`
      );
      if (!tokenRes.ok) throw new Error('Failed to get Deepgram token');
      const { access_token } = await tokenRes.json();

      // 2. Open Deepgram WebSocket with token subprotocol
      const ws = new WebSocket(DEEPGRAM_WS_URL, ['token', access_token]);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          if (data.is_final && alt.transcript) {
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + alt.transcript;
            setTranscript(finalTranscriptRef.current);
          } else if (!data.is_final && alt.transcript) {
            // Show interim: final so far + current interim
            setTranscript(
              finalTranscriptRef.current +
                (finalTranscriptRef.current ? ' ' : '') +
                alt.transcript
            );
          }
        }
      };

      ws.onerror = () => setError('Voice connection error');

      ws.onclose = () => {
        // Resolve the stop promise with final transcript
        if (resolveStopRef.current) {
          resolveStopRef.current(finalTranscriptRef.current);
          resolveStopRef.current = null;
        }
      };

      // 3. Wait for WS to open, then start mic
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(250); // Send chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;

      // Stop MediaRecorder
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;

      // Stop mic tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

      // Tell Deepgram to finalize and close
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        // Give Deepgram a moment to send final results before closing
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, 500);
      } else {
        // WS already closed, resolve immediately
        resolve(finalTranscriptRef.current);
        resolveStopRef.current = null;
      }

      setIsRecording(false);
    });
  }, []);

  return { startRecording, stopRecording, isRecording, transcript, error };
}
