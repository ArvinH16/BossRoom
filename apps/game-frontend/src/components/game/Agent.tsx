/** NPC agent: Kenney character model + floating name label + status orb + sparkles + click-to-chat + wander + thought bubbles. */
'use client';

import { useRef, useEffect, useState } from 'react';
import { Billboard, Text, Sparkles } from '@react-three/drei';
import { CharacterModel } from './CharacterModel';
import { ThoughtBubble } from './ThoughtBubble';
import { SpeechBubble } from './SpeechBubble';
import { useChatStore } from '@/stores/chatStore';
import { useWorldStore } from '@/stores/worldStore';
import { useAgentWander } from '@/hooks/useAgentWander';
import { statusColors, statusLabels, type AgentData } from '@/data/agents';
import { PUNCH } from '@/data/gameConfig';

interface AgentProps {
  agent: AgentData;
}

export function Agent({ agent }: AgentProps) {
  const openChat = useChatStore((s) => s.openChat);
  const isActive = agent.status !== 'idle';
  const isBusy = agent.status !== 'idle';
  const punchedAgentId = useWorldStore((s) => s.punchedAgentId);
  const punchReaction = useWorldStore((s) => s.punchReaction);

  const { animation: wanderAnimation, groupRef } = useAgentWander(agent.id, agent.position, isBusy);

  const [reactionAnim, setReactionAnim] = useState<string | null>(null);
  const punchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (punchedAgentId === agent.id && punchReaction) {
      setReactionAnim(punchReaction);
      if (punchTimer.current) clearTimeout(punchTimer.current);
      punchTimer.current = setTimeout(() => setReactionAnim(null), PUNCH.reactionDuration);
    }
  }, [punchedAgentId, punchReaction, agent.id]);

  const isPunched = reactionAnim !== null;
  const animation = reactionAnim ?? wanderAnimation;

  return (
    <group position={agent.position}>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          openChat(agent.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <CharacterModel url={agent.modelUrl} animation={animation} />

        {/* Floating name label */}
        <Billboard position={[0, 2.2, 0]}>
          <Text
            fontSize={0.25}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {agent.name}
          </Text>
        </Billboard>

        {/* Status label when active */}
        {isActive && (
          <Billboard position={[0, 2.8, 0]}>
            <Text
              fontSize={0.15}
              color={statusColors[agent.status]}
              anchorX="center"
              anchorY="middle"
            >
              {statusLabels[agent.status]}
            </Text>
          </Billboard>
        )}

        {/* Status orb */}
        <mesh position={[0, 2.55, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color={statusColors[agent.status]}
            emissive={statusColors[agent.status]}
            emissiveIntensity={isActive ? 2.5 : 1.5}
          />
        </mesh>

        {/* Sparkle effects for thinking/working */}
        {(agent.status === 'thinking' || agent.status === 'working') && (
          <Sparkles
            count={agent.status === 'working' ? 30 : 12}
            scale={2}
            size={agent.status === 'working' ? 4 : 2}
            speed={agent.status === 'working' ? 2 : 0.5}
            color={agent.color}
            position={[0, 1, 0]}
          />
        )}

        {/* Error effect */}
        {agent.status === 'error' && (
          <Sparkles
            count={20}
            scale={1.5}
            size={3}
            speed={3}
            color="#ff4444"
            position={[0, 1, 0]}
          />
        )}

        {/* Punch reaction effect */}
        {isPunched && (
          <Sparkles
            count={25}
            scale={2}
            size={5}
            speed={4}
            color="#ff2222"
            position={[0, 1, 0]}
          />
        )}

        {/* Thought bubble */}
        <ThoughtBubble agentId={agent.id} isBusy={isBusy} />

        {/* Speech bubble (streamed agent response) */}
        <SpeechBubble agentId={agent.id} />
      </group>
    </group>
  );
}
