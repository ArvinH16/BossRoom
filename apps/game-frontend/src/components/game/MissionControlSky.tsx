/** Floating holographic Mission Control panel beyond the office boundary — shows all agents, statuses, last messages, and workspace phase. */
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { useWorkspaceStore, type WorkspacePhase } from '@/stores/workspaceStore';
import { statusColors, statusLabels, zoneDisplayNames, toDynamicAgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

/* ── Panel dimensions (2x original) ──────────────────────────────────── */

const PW = 24; // panel width
const PH = 16; // panel height
const HALF_W = PW / 2;
const HALF_H = PH / 2;

/* ── Shared materials ────────────────────────────────────────────────── */

const borderMaterial = new THREE.MeshStandardMaterial({
  color: '#4A90D9',
  emissive: new THREE.Color('#4A90D9'),
  emissiveIntensity: 3,
  toneMapped: false,
});

const scanLineMaterial = new THREE.MeshBasicMaterial({
  color: '#4A90D9',
  transparent: true,
  opacity: 0.25,
  side: THREE.DoubleSide,
});

const separatorMaterial = new THREE.MeshStandardMaterial({
  color: '#6366f1',
  emissive: new THREE.Color('#6366f1'),
  emissiveIntensity: 2,
  toneMapped: false,
});

const rowDividerMaterial = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.06,
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Get the first sentence (up to ~60 chars) from the last agent message. */
function getLastMessagePreview(messages: ChatMessage[], streamingText: string): string {
  // Prefer live streaming text
  if (streamingText) {
    const trimmed = streamingText.slice(-80).replace(/\n/g, ' ');
    return trimmed.length < streamingText.length ? '...' + trimmed : trimmed;
  }

  // Find last agent message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'agent') {
      // First sentence or first 60 chars
      const text = msg.content.replace(/\n/g, ' ').trim();
      const sentenceEnd = text.search(/[.!?]\s/);
      if (sentenceEnd > 0 && sentenceEnd < 80) return text.slice(0, sentenceEnd + 1);
      if (text.length > 60) return text.slice(0, 60) + '...';
      return text;
    }
  }

  return '';
}

/* ── Streaming dots (3 bouncing spheres) ─────────────────────────────── */

function StreamingDots({ color }: { color: string }) {
  const dotsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!dotsRef.current) return;
    for (let i = 0; i < dotsRef.current.children.length; i++) {
      dotsRef.current.children[i].position.y = 0.1 * Math.sin(t * 4 - i * 0.8);
    }
  });

  return (
    <group ref={dotsRef}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.35, 0, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={new THREE.Color(color)}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Agent row ───────────────────────────────────────────────────────── */

interface AgentRowProps {
  name: string;
  color: string;
  zone: string;
  status: AgentStatus;
  messageCount: number;
  lastMessage: string;
  isStreaming: boolean;
  yOffset: number;
}

function AgentRow({ name, color, zone, status, messageCount, lastMessage, isStreaming, yOffset }: AgentRowProps) {
  const orbRef = useRef<THREE.Mesh>(null);
  const isActive = status === 'thinking' || status === 'working';

  useFrame(({ clock }) => {
    if (!orbRef.current) return;
    if (isActive) {
      const s = 1 + 0.2 * Math.sin(clock.getElapsedTime() * 3);
      orbRef.current.scale.setScalar(s);
    } else {
      orbRef.current.scale.setScalar(1);
    }
  });

  const orbColor = statusColors[status] ?? '#888888';
  const zoneLabel = zoneDisplayNames[zone] ?? zone.toUpperCase();
  const statusText = statusLabels[status];

  return (
    <group position={[0, yOffset, 0]}>
      {/* Row divider line */}
      <mesh position={[0, 0.9, 0.01]} material={rowDividerMaterial}>
        <boxGeometry args={[PW - 2, 0.02, 0.01]} />
      </mesh>

      {/* Status orb */}
      <mesh ref={orbRef} position={[-10.5, 0.2, 0.02]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial
          color={orbColor}
          emissive={new THREE.Color(orbColor)}
          emissiveIntensity={isActive ? 3 : 1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Agent name */}
      <Text
        position={[-9.5, 0.35, 0.02]}
        fontSize={0.55}
        color={color}
        anchorX="left"
        anchorY="middle"
      >
        {name}
      </Text>

      {/* Status label */}
      {statusText ? (
        <Text
          position={[-9.5, -0.15, 0.02]}
          fontSize={0.32}
          color={statusColors[status]}
          anchorX="left"
          anchorY="middle"
          fillOpacity={0.9}
        >
          {statusText}
        </Text>
      ) : (
        <Text
          position={[-9.5, -0.15, 0.02]}
          fontSize={0.32}
          color="#4AD97A"
          anchorX="left"
          anchorY="middle"
          fillOpacity={0.5}
        >
          Idle
        </Text>
      )}

      {/* Zone label */}
      <Text
        position={[-3.5, 0.35, 0.02]}
        fontSize={0.36}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.35}
      >
        {zoneLabel}
      </Text>

      {/* Last message preview */}
      <Text
        position={[-3.5, -0.2, 0.02]}
        fontSize={0.28}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={isStreaming ? 0.7 : 0.4}
        maxWidth={12}
      >
        {lastMessage || 'No messages yet'}
      </Text>

      {/* Message count badge */}
      {messageCount > 0 && (
        <group position={[8.5, 0.2, 0.02]}>
          <RoundedBox args={[1.2, 0.55, 0.01]} radius={0.12}>
            <meshBasicMaterial color="#4A90D9" transparent opacity={0.25} />
          </RoundedBox>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.32}
            color="#4A90D9"
            anchorX="center"
            anchorY="middle"
          >
            {messageCount > 99 ? '99+' : String(messageCount)}
          </Text>
        </group>
      )}

      {/* Streaming dots */}
      {isStreaming && (
        <group position={[10.0, 0.2, 0.02]}>
          <StreamingDots color={color} />
        </group>
      )}
    </group>
  );
}

/* ── Phase indicator badge ───────────────────────────────────────────── */

const phaseLabels: Record<WorkspacePhase, string> = {
  reception: 'RECEPTION',
  building: 'BUILDING',
  ready: 'READY',
};

const phaseColors: Record<WorkspacePhase, string> = {
  reception: '#4A90D9',
  building: '#FF8C00',
  ready: '#4AD97A',
};

function PhaseIndicator({ phase }: { phase: WorkspacePhase }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current || phase !== 'building') return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 + 0.3 * Math.sin(clock.getElapsedTime() * 2);
  });

  const color = phaseColors[phase];

  return (
    <group position={[0, -HALF_H + 1.0, 0.02]}>
      <RoundedBox ref={ref} args={[4, 0.8, 0.01]} radius={0.15}>
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.38}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.12}
      >
        {phaseLabels[phase]}
      </Text>
    </group>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

const PANEL_X = 0;
const PANEL_Y = 10;
const PANEL_Z = -30;

export function MissionControlSky() {
  const groupRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const phase = useWorkspaceStore((s) => s.phase);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);

  // Merge static + built dynamic agents (deduplicate by id)
  const allAgents = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string; color: string; zone: string; status: AgentStatus }[] = [];

    for (const a of agents) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        result.push({ id: a.id, name: a.name, color: a.color, zone: a.zone, status: a.status });
      }
    }

    for (const a of dynamicAgents) {
      if (builtAgentIds.has(a.agentId) && !seen.has(a.agentId)) {
        seen.add(a.agentId);
        const data = toDynamicAgentData(a);
        result.push({ id: data.id, name: data.name, color: data.color, zone: data.zone, status: data.status });
      }
    }

    return result;
  }, [agents, dynamicAgents, builtAgentIds]);

  // Animations: gentle Y bob + scan line sweep
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.position.y = PANEL_Y + 0.2 * Math.sin(t * 0.5);
    }

    if (scanRef.current) {
      scanRef.current.position.y = ((t * 0.25) % 1) * PH - HALF_H;
    }
  });

  const summaryText = taskSummary || 'No active workspace';
  const agentCount = allAgents.length;
  const activeCount = allAgents.filter((a) => a.status !== 'idle').length;

  return (
    <group ref={groupRef} position={[PANEL_X, PANEL_Y, PANEL_Z]}>
      {/* ── Panel background ─────────────────────────────────────── */}
      <RoundedBox args={[PW, PH, 0.05]} radius={0.25}>
        <meshBasicMaterial
          color="#0a0e27"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* ── Neon border (4 emissive strips) ──────────────────────── */}
      <mesh position={[0, HALF_H, 0.03]} material={borderMaterial}>
        <boxGeometry args={[PW, 0.06, 0.01]} />
      </mesh>
      <mesh position={[0, -HALF_H, 0.03]} material={borderMaterial}>
        <boxGeometry args={[PW, 0.06, 0.01]} />
      </mesh>
      <mesh position={[-HALF_W, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.06, PH, 0.01]} />
      </mesh>
      <mesh position={[HALF_W, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.06, PH, 0.01]} />
      </mesh>

      {/* ── Title ────────────────────────────────────────────────── */}
      <Text
        position={[0, HALF_H - 1.2, 0.04]}
        fontSize={1.0}
        color="#4A90D9"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
      >
        MISSION CONTROL
      </Text>

      {/* ── Subtitle: agent count + task summary ─────────────────── */}
      <Text
        position={[-HALF_W + 1.5, HALF_H - 2.3, 0.04]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.5}
      >
        {`${agentCount} agents`}{activeCount > 0 ? ` · ${activeCount} active` : ''}
      </Text>
      <Text
        position={[HALF_W - 1.5, HALF_H - 2.3, 0.04]}
        fontSize={0.4}
        color="#ffffff"
        anchorX="right"
        anchorY="middle"
        fillOpacity={0.5}
        maxWidth={14}
      >
        {summaryText}
      </Text>

      {/* ── Header separator ─────────────────────────────────────── */}
      <mesh position={[0, HALF_H - 2.8, 0.03]} material={separatorMaterial}>
        <boxGeometry args={[PW - 2, 0.03, 0.01]} />
      </mesh>

      {/* ── Column headers ───────────────────────────────────────── */}
      <Text position={[-10.5, HALF_H - 3.3, 0.04]} fontSize={0.28} color="#ffffff" anchorX="left" anchorY="middle" fillOpacity={0.25}>
        STATUS
      </Text>
      <Text position={[-9.5, HALF_H - 3.3, 0.04]} fontSize={0.28} color="#ffffff" anchorX="left" anchorY="middle" fillOpacity={0.25}>
        AGENT
      </Text>
      <Text position={[-3.5, HALF_H - 3.3, 0.04]} fontSize={0.28} color="#ffffff" anchorX="left" anchorY="middle" fillOpacity={0.25}>
        ZONE
      </Text>
      <Text position={[-3.5, HALF_H - 3.7, 0.04]} fontSize={0.28} color="#ffffff" anchorX="left" anchorY="middle" fillOpacity={0.25}>
        LAST MESSAGE
      </Text>
      <Text position={[8.5, HALF_H - 3.3, 0.04]} fontSize={0.28} color="#ffffff" anchorX="center" anchorY="middle" fillOpacity={0.25}>
        MSGS
      </Text>

      {/* ── Agent rows ───────────────────────────────────────────── */}
      {allAgents.map((agent, i) => {
        const yOffset = HALF_H - 4.6 - i * 1.9;
        const msgs = chatMessages[agent.id] ?? [];
        const stream = streamingText[agent.id] ?? '';
        const isStreaming = !!stream;
        const lastMessage = getLastMessagePreview(msgs, stream);

        return (
          <AgentRow
            key={agent.id}
            name={agent.name}
            color={agent.color}
            zone={agent.zone}
            status={agent.status}
            messageCount={msgs.length}
            lastMessage={lastMessage}
            isStreaming={isStreaming}
            yOffset={yOffset}
          />
        );
      })}

      {/* ── Phase indicator ──────────────────────────────────────── */}
      <PhaseIndicator phase={phase} />

      {/* ── Scan line ────────────────────────────────────────────── */}
      <mesh ref={scanRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[PW - 1, 0.08]} />
        <primitive object={scanLineMaterial} attach="material" />
      </mesh>

      {/* ── Sparkles ─────────────────────────────────────────────── */}
      <Sparkles
        count={60}
        scale={[PW + 4, PH + 4, 3]}
        size={2}
        speed={0.3}
        color="#4A90D9"
      />
    </group>
  );
}
