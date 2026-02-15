/** Player character: ecctrl controller + Kenney character with animation state machine. */
'use client';

import { useRef, useEffect } from 'react';
import Ecctrl, { EcctrlAnimation } from 'ecctrl';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';
import { useNearestAgent } from '@/hooks/useNearestAgent';
import { PLAYER, CAMERA } from '@/data/gameConfig';
import type { Vector3 } from 'three';

const animationSet = {
  idle: 'idle',
  walk: 'walk',
  run: 'sprint',
  jump: 'jump',
  jumpIdle: 'fall',
  jumpLand: 'idle',
  fall: 'fall',
  action1: 'emote-yes',
  action2: 'interact-right',
  action3: 'pick-up',
  action4: 'emote-no',
};

export function Player() {
  const ecctrlRef = useRef<{ group: { translation(): Vector3 } | null }>(null);
  const agents = useWorldStore((s) => s.agents);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);

  const { startRecording, stopRecording, transcript: voiceTranscript } = useVoiceInput();
  const recordingRef = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);

  useNearestAgent(agents, ecctrlRef);

  useEffect(() => {
    useVoiceStore.getState().setVoiceTranscript(voiceTranscript);
  }, [voiceTranscript]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }

      if (e.code === 'KeyT' && !e.repeat) {
        console.log('[DEBUG-FIX] T key pressed', { nearestAgent, recording: recordingRef.current, chatPanelOpen });
        if (!nearestAgent) { console.log('[DEBUG-FIX] No nearestAgent, ignoring T'); return; }
        if (recordingRef.current) { console.log('[DEBUG-FIX] Already recording, ignoring T'); return; }
        if (!chatPanelOpen) openChat(nearestAgent);
        recordingRef.current = true;
        useVoiceStore.getState().setRecording(true);
        console.log('[DEBUG-FIX] Starting recording for agent:', nearestAgent);
        startPromiseRef.current = startRecording();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'KeyT' && recordingRef.current) {
        console.log('[DEBUG-FIX] T key released, stopping recording');
        recordingRef.current = false;
        const doStop = async () => {
          // Wait for startRecording to finish before stopping
          if (startPromiseRef.current) {
            console.log('[DEBUG-FIX] Waiting for startRecording promise to resolve...');
            await startPromiseRef.current;
            startPromiseRef.current = null;
          }
          console.log('[DEBUG-FIX] Calling stopRecording...');
          const transcript = await stopRecording();
          console.log('[DEBUG-FIX] stopRecording returned transcript:', JSON.stringify(transcript));
          useVoiceStore.getState().setRecording(false);
          useVoiceStore.getState().setVoiceTranscript('');
          const agent = useChatStore.getState().activeAgent;
          console.log('[DEBUG-FIX] activeAgent:', agent, '| transcript.trim():', JSON.stringify(transcript.trim()));
          if (transcript.trim() && agent) {
            console.log('[DEBUG-FIX] Sending message to agent:', agent, 'content:', transcript.trim());
            useChatStore.getState().sendMessage(agent, transcript.trim());
          } else {
            console.log('[DEBUG-FIX] NOT sending message - transcript empty or no agent');
          }
        };
        doStop();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nearestAgent, chatPanelOpen, openChat, startRecording, stopRecording]);

  return (
    <Ecctrl
      ref={ecctrlRef as never}
      camInitDis={CAMERA.initDis}
      camMinDis={CAMERA.minDis}
      camMaxDis={CAMERA.maxDis}
      maxVelLimit={PLAYER.maxSpeed}
      capsuleHalfHeight={PLAYER.capsuleHalfHeight}
      capsuleRadius={PLAYER.capsuleRadius}
      animated
    >
      <EcctrlAnimation
        characterURL={PLAYER.modelUrl}
        animationSet={animationSet}
      >
        <group scale={2.2} />
      </EcctrlAnimation>
    </Ecctrl>
  );
}
