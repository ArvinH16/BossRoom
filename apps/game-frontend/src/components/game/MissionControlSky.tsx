/** Floating todo-list board beyond the office boundary. */
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { useWorkspaceStore, type WorkspacePhase } from '@/stores/workspaceStore';
import { statusColors, statusLabels, toDynamicAgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

/* ── Layout constants ────────────────────────────────────────────────── */

const PW = 18;
const PH = 16;
const HALF_W = PW / 2;
const HALF_H = PH / 2;
const ROW_H = 1.8;
const LEFT = -HALF_W + 1.2;

/* ── Shared materials ────────────────────────────────────────────────── */

const borderMaterial = new THREE.MeshStandardMaterial({
  color: '#334155',
  emissive: new THREE.Color('#334155'),
  emissiveIntensity: 1,
  toneMapped: false,
});

const dividerMaterial = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.07,
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getLastMessagePreview(messages: ChatMessage[], stream: string): string {
  if (stream) {
    const trimmed = stream.slice(-70).replace(/\n/g, ' ');
    return trimmed.length < stream.length ? '...' + trimmed : trimmed;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'agent') {
      const text = msg.content.replace(/\n/g, ' ').trim();
      const end = text.search(/[.!?]\s/);
      if (end > 0 && end < 70) return text.slice(0, end + 1);
      if (text.length > 60) return text.slice(0, 60) + '...';
      return text;
    }
  }
  return '';
}

function statusIcon(status: AgentStatus): string {
  switch (status) {
    case 'working': return '[>>]';
    case 'thinking': return '[..]';
    case 'listening': return '[ ~]';
    case 'error': return '[ !]';
    default: return '[ok]';
  }
}

/* ── Checkbox visual ─────────────────────────────────────────────────── */

function Checkbox({ status, color }: { status: AgentStatus; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const isActive = status === 'thinking' || status === 'working';

  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (isActive) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + 0.3 * Math.sin(clock.getElapsedTime() * 3);
    }
  });

  const c = statusColors[status] ?? '#888';

  return (
    <group>
      {/* Box outline */}
      <RoundedBox args={[0.6, 0.6, 0.01]} radius={0.08}>
        <meshBasicMaterial color={c} transparent opacity={0.2} />
      </RoundedBox>
      {/* Fill for active/done states */}
      <RoundedBox ref={ref} args={[0.42, 0.42, 0.01]} radius={0.05} position={[0, 0, 0.005]}>
        <meshBasicMaterial color={c} transparent opacity={status === 'idle' ? 0.15 : 0.7} />
      </RoundedBox>
      {/* Status icon text */}
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.22}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {status === 'idle' ? '' : status === 'working' ? '>>' : status === 'thinking' ? '..' : status === 'error' ? '!' : '~'}
      </Text>
    </group>
  );
}

/* ── Single todo row ─────────────────────────────────────────────────── */

interface TodoRowProps {
  name: string;
  color: string;
  status: AgentStatus;
  messageCount: number;
  lastMessage: string;
  isStreaming: boolean;
  yOffset: number;
}

function TodoRow({ name, color, status, messageCount, lastMessage, isStreaming, yOffset }: TodoRowProps) {
  const statusText = statusLabels[status] || 'Idle';
  const msgPreview = lastMessage || (status === 'idle' ? 'Waiting for task...' : 'Starting up...');

  return (
    <group position={[0, yOffset, 0]}>
      {/* Divider above row */}
      <mesh position={[0, ROW_H / 2 + 0.05, 0.01]} material={dividerMaterial}>
        <boxGeometry args={[PW - 2, 0.02, 0.01]} />
      </mesh>

      {/* Checkbox */}
      <group position={[LEFT + 0.3, 0.15, 0.02]}>
        <Checkbox status={status} color="#ffffff" />
      </group>

      {/* Agent name */}
      <Text
        position={[LEFT + 1.2, 0.35, 0.02]}
        fontSize={0.48}
        color={color}
        anchorX="left"
        anchorY="middle"
      >
        {name}
      </Text>

      {/* Status badge */}
      <group position={[LEFT + 1.2 + name.length * 0.28 + 0.6, 0.35, 0.02]}>
        <RoundedBox args={[statusText.length * 0.2 + 0.6, 0.4, 0.01]} radius={0.1}>
          <meshBasicMaterial color={statusColors[status]} transparent opacity={0.2} />
        </RoundedBox>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.22}
          color={statusColors[status]}
          anchorX="center"
          anchorY="middle"
        >
          {statusText}
        </Text>
      </group>

      {/* Message count (right side) */}
      {messageCount > 0 && (
        <Text
          position={[HALF_W - 1.2, 0.35, 0.02]}
          fontSize={0.3}
          color="#94a3b8"
          anchorX="right"
          anchorY="middle"
        >
          {messageCount} msg{messageCount !== 1 ? 's' : ''}
        </Text>
      )}

      {/* Last message preview */}
      <Text
        position={[LEFT + 1.2, -0.2, 0.02]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={isStreaming ? 0.6 : 0.35}
        maxWidth={PW - 4}
      >
        {isStreaming ? `${statusIcon(status)} ${msgPreview}` : msgPreview}
      </Text>
    </group>
  );
}

/* ── Phase badge ─────────────────────────────────────────────────────── */

const phaseLabels: Record<WorkspacePhase, string> = {
  reception: 'Lobby',
  building: 'Building...',
  ready: 'Ready',
};
const phaseColors: Record<WorkspacePhase, string> = {
  reception: '#64748b',
  building: '#f59e0b',
  ready: '#22c55e',
};

/* ── Main component ──────────────────────────────────────────────────── */

const PANEL_Z = -30;

export function MissionControlSky() {
  const groupRef = useRef<THREE.Group>(null);

  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const phase = useWorkspaceStore((s) => s.phase);
  const taskSummary = useWorkspaceStore((s) => s.taskSummary);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);

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

  // Gentle bob
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 10 + 0.15 * Math.sin(clock.getElapsedTime() * 0.4);
    }
  });

  const summary = taskSummary || 'No active task';
  const activeCount = allAgents.filter((a) => a.status !== 'idle').length;
  const phaseColor = phaseColors[phase];

  return (
    <group ref={groupRef} position={[0, 10, PANEL_Z]}>
      {/* ── Background ───────────────────────────────────────────── */}
      <RoundedBox args={[PW, PH, 0.05]} radius={0.3}>
        <meshBasicMaterial color="#0f172a" transparent opacity={0.8} side={THREE.DoubleSide} />
      </RoundedBox>

      {/* ── Subtle border ────────────────────────────────────────── */}
      <mesh position={[0, HALF_H, 0.03]} material={borderMaterial}>
        <boxGeometry args={[PW, 0.04, 0.01]} />
      </mesh>
      <mesh position={[0, -HALF_H, 0.03]} material={borderMaterial}>
        <boxGeometry args={[PW, 0.04, 0.01]} />
      </mesh>
      <mesh position={[-HALF_W, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.04, PH, 0.01]} />
      </mesh>
      <mesh position={[HALF_W, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.04, PH, 0.01]} />
      </mesh>

      {/* ── Header ───────────────────────────────────────────────── */}
      <Text
        position={[LEFT, HALF_H - 1.1, 0.04]}
        fontSize={0.8}
        color="#e2e8f0"
        anchorX="left"
        anchorY="middle"
      >
        Todo List
      </Text>

      {/* Phase badge (top right) */}
      <group position={[HALF_W - 2.5, HALF_H - 1.1, 0.04]}>
        <RoundedBox args={[phaseLabels[phase].length * 0.25 + 0.8, 0.55, 0.01]} radius={0.12}>
          <meshBasicMaterial color={phaseColor} transparent opacity={0.25} />
        </RoundedBox>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.28}
          color={phaseColor}
          anchorX="center"
          anchorY="middle"
        >
          {phaseLabels[phase]}
        </Text>
      </group>

      {/* Task summary + counts */}
      <Text
        position={[LEFT, HALF_H - 1.9, 0.04]}
        fontSize={0.34}
        color="#94a3b8"
        anchorX="left"
        anchorY="middle"
        maxWidth={PW - 3}
      >
        {summary}
      </Text>
      <Text
        position={[HALF_W - 1.2, HALF_H - 1.9, 0.04]}
        fontSize={0.3}
        color="#64748b"
        anchorX="right"
        anchorY="middle"
      >
        {activeCount}/{allAgents.length} active
      </Text>

      {/* ── Header divider ───────────────────────────────────────── */}
      <mesh position={[0, HALF_H - 2.4, 0.03]}>
        <boxGeometry args={[PW - 1.5, 0.03, 0.01]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.5} />
      </mesh>

      {/* ── Agent todo rows ──────────────────────────────────────── */}
      {allAgents.map((agent, i) => {
        const yOffset = HALF_H - 3.3 - i * ROW_H;
        const msgs = chatMessages[agent.id] ?? [];
        const stream = streamingText[agent.id] ?? '';
        const isStreaming = !!stream;
        const lastMessage = getLastMessagePreview(msgs, stream);

        return (
          <TodoRow
            key={agent.id}
            name={agent.name}
            color={agent.color}
            status={agent.status}
            messageCount={msgs.length}
            lastMessage={lastMessage}
            isStreaming={isStreaming}
            yOffset={yOffset}
          />
        );
      })}
    </group>
  );
}
