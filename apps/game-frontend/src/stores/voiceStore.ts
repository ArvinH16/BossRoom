import { create } from 'zustand';

interface TTSItem {
  agentId: string;
  audioBase64: string;
  mimeType: string;
}

interface VoiceState {
  isRecording: boolean;
  voiceTranscript: string;
  ttsQueue: TTSItem[];

  setRecording: (recording: boolean) => void;
  setVoiceTranscript: (text: string) => void;
  enqueueTTS: (item: TTSItem) => void;
  dequeueTTS: () => void;
  clearTTSQueue: () => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  voiceTranscript: '',
  ttsQueue: [],

  setRecording: (recording) => set({ isRecording: recording }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  enqueueTTS: (item) => set((s) => ({ ttsQueue: [...s.ttsQueue, item] })),
  dequeueTTS: () => set((s) => ({ ttsQueue: s.ttsQueue.slice(1) })),
  clearTTSQueue: () => set({ ttsQueue: [] }),
  reset: () => set({ isRecording: false, voiceTranscript: '', ttsQueue: [] }),
}));
