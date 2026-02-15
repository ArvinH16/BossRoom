'use client';

import { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { AVATARS } from '@/data/avatars';
import { MUSIC } from '@/data/gameConfig';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMusicStore } from '@/stores/musicStore';

export function SettingsPanel() {
  const avatarPreference = useSettingsStore((s) => s.avatarPreference);
  const selectAvatar = useSettingsStore((s) => s.selectAvatar);
  const closeSettingsPanel = useSettingsStore((s) => s.closeSettingsPanel);
  const [activeTab, setActiveTab] = useState<'avatar' | 'music'>('avatar');
  const trackId = useMusicStore((s) => s.trackId);
  const musicVolume = useMusicStore((s) => s.volume);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const setTrack = useMusicStore((s) => s.setTrack);
  const setMusicVolume = useMusicStore((s) => s.setVolume);
  const togglePlay = useMusicStore((s) => s.togglePlay);

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
          <button
            onClick={() => setActiveTab('avatar')}
            className={`text-xs font-medium px-2 py-1 rounded cursor-pointer ${
              activeTab === 'avatar'
                ? 'text-white bg-white/10'
                : 'text-white/40'
            }`}
          >
            Avatar
          </button>
          <button
            onClick={() => setActiveTab('music')}
            className={`text-xs font-medium px-2 py-1 rounded cursor-pointer ${
              activeTab === 'music'
                ? 'text-white bg-white/10'
                : 'text-white/40'
            }`}
          >
            Music
          </button>
        </div>

        {/* Avatar tab */}
        {activeTab === 'avatar' && (
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => selectAvatar(avatar.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-all ${
                  avatarPreference === avatar.id
                    ? 'bg-indigo-500/30 ring-2 ring-indigo-400'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                  {avatar.id === 'random' ? '🎲' : '🧑'}
                </div>
                <span className="text-[10px] text-white/70">
                  {avatar.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Music tab */}
        {activeTab === 'music' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={togglePlay}
              className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                isPlaying
                  ? 'bg-indigo-500/30 text-white'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              {isPlaying ? 'Music On' : 'Music Off'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {MUSIC.tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => setTrack(track.id)}
                  className={`p-2 rounded-lg text-xs cursor-pointer transition-all ${
                    trackId === track.id
                      ? 'bg-indigo-500/30 ring-2 ring-indigo-400 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {track.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50">Vol</span>
              <input
                type="range"
                min={0}
                max={100}
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                className="flex-1 accent-indigo-400"
              />
              <span className="text-[10px] text-white/50 w-8 text-right">
                {musicVolume}%
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
