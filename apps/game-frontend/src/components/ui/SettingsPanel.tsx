'use client';

import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { AVATARS } from '@/data/avatars';
import { useSettingsStore } from '@/stores/settingsStore';

export function SettingsPanel() {
  const avatarId = useSettingsStore((s) => s.avatarId);
  const selectAvatar = useSettingsStore((s) => s.selectAvatar);
  const closeSettingsPanel = useSettingsStore((s) => s.closeSettingsPanel);

  // Preload avatar models when panel opens
  useEffect(() => {
    AVATARS.forEach((a) => useGLTF.preload(a.modelUrl));
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettingsPanel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeSettingsPanel]);

  return (
    <>
      {/* Backdrop — click outside to close */}
      <div
        className="fixed inset-0 z-50"
        onClick={closeSettingsPanel}
      />

      {/* Panel */}
      <div
        className="absolute top-full left-0 mt-2 z-50 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab bar */}
        <div className="flex gap-2 mb-3 border-b border-white/10 pb-2">
          <div className="text-xs font-medium text-white px-2 py-1 bg-white/10 rounded">
            Avatar
          </div>
        </div>

        {/* Avatar grid */}
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => selectAvatar(avatar.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-all ${
                avatarId === avatar.id
                  ? 'bg-indigo-500/30 ring-2 ring-indigo-400'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                🧑
              </div>
              <span className="text-[10px] text-white/70">{avatar.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
