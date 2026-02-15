/** Floating 3D speech bubble that shows streamed agent responses above the agent's head. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import type { Group, MeshStandardMaterial } from 'three';
import { useChatStore } from '@/stores/chatStore';

type Phase = 'hidden' | 'visible' | 'fadeOut';

interface SpeechBubbleProps {
  agentId: string;
}

/** Strip basic markdown formatting for clean bubble display. */
function stripMarkdown(text: string): string {
  return text
    .replace(/[*_~`]+/g, '')     // bold, italic, strikethrough, code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/^#+\s*/gm, '')     // headings
    .replace(/^[-*]\s+/gm, '')   // list bullets
    .replace(/\n+/g, ' ')        // collapse newlines
    .trim();
}

export function SpeechBubble({ agentId }: SpeechBubbleProps) {
  const groupRef = useRef<Group>(null);
  const textRef = useRef<{ fillOpacity: number } | null>(null);
  const bgRef = useRef<MeshStandardMaterial>(null);
  const tailRef = useRef<MeshStandardMaterial>(null);

  const stateRef = useRef({
    phase: 'hidden' as Phase,
    timer: 0,
    opacity: 1,
    lastAgentMsgCount: 0,
  });

  useFrame((_, delta) => {
    const s = stateRef.current;
    const group = groupRef.current;
    if (!group) return;

    const { streamingText, chatMessages } = useChatStore.getState();
    const stream = streamingText[agentId] ?? '';
    const msgs = chatMessages[agentId] ?? [];
    const agentMsgCount = msgs.filter((m) => m.role === 'agent').length;

    switch (s.phase) {
      case 'hidden':
        group.visible = false;
        if (stream) {
          s.phase = 'visible';
          s.opacity = 1;
          group.visible = true;
          updateText(stream);
        }
        break;

      case 'visible':
        group.visible = true;
        s.opacity = 1;
        if (stream) {
          updateText(stream);
        } else if (agentMsgCount > s.lastAgentMsgCount) {
          // Stream just finalized
          s.lastAgentMsgCount = agentMsgCount;
          const lastMsg = msgs.filter((m) => m.role === 'agent').pop();
          if (lastMsg && lastMsg.role === 'agent') updateText(lastMsg.content);
          s.phase = 'fadeOut';
          s.timer = 4.0;
        }
        break;

      case 'fadeOut':
        if (stream) {
          // New stream interrupts fade
          s.phase = 'visible';
          s.opacity = 1;
          updateText(stream);
          break;
        }
        s.timer -= delta;
        if (s.timer <= 0) {
          s.opacity = MathUtils.clamp(s.opacity - delta * 2, 0, 1); // 0.5s fade
          if (s.opacity <= 0) {
            s.phase = 'hidden';
            group.visible = false;
          }
        }
        break;
    }

    // Sync lastAgentMsgCount when not transitioning
    if (s.phase === 'hidden') {
      s.lastAgentMsgCount = agentMsgCount;
    }

    // Apply opacity to materials
    if (bgRef.current) bgRef.current.opacity = s.opacity * 0.9;
    if (tailRef.current) tailRef.current.opacity = s.opacity * 0.9;
    if (textRef.current) textRef.current.fillOpacity = s.opacity;
  });

  function updateText(raw: string) {
    if (!textRef.current) return;
    let clean = stripMarkdown(raw);
    if (clean.length > 200) clean = clean.slice(0, 200) + '...';
    (textRef.current as unknown as { text: string }).text = clean;
  }

  return (
    <group ref={groupRef} visible={false}>
      <Billboard position={[0, 2.8, 0]}>
        <group>
          {/* Background box */}
          <RoundedBox args={[3.5, 1.0, 0.05]} radius={0.12} smoothness={4}>
            <meshStandardMaterial
              ref={bgRef}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </RoundedBox>

          {/* Speech text */}
          <Text
            ref={textRef}
            position={[0, 0, 0.03]}
            fontSize={0.14}
            color="#111111"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.2}
            fillOpacity={0}
          >
            {''}
          </Text>

          {/* Tail triangle pointing down */}
          <mesh position={[0, -0.58, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.12, 0.18, 3]} />
            <meshStandardMaterial
              ref={tailRef}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
