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

  const voiceInput = useVoiceInput();

  useNearestAgent(agents, ecctrlRef);

  useEffect(() => {
    useVoiceStore.getState().setVoiceTranscript(voiceInput.transcript);
  }, [voiceInput.transcript]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }

      if (e.code === 'KeyT' && !e.repeat && nearestAgent) {
        // Open chat if not already open
        if (!chatPanelOpen) openChat(nearestAgent);
        voiceInput.startRecording();
        useVoiceStore.getState().setRecording(true);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'KeyT' && voiceInput.isRecording) {
        voiceInput.stopRecording().then((transcript) => {
          useVoiceStore.getState().setRecording(false);
          useVoiceStore.getState().setVoiceTranscript('');
          const agent = useChatStore.getState().activeAgent;
          if (transcript.trim() && agent) {
            useChatStore.getState().sendMessage(agent, transcript.trim());
          }
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nearestAgent, chatPanelOpen, openChat, voiceInput]);

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
