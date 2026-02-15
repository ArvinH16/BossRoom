/** Floating holographic Mission Control panel beyond the office boundary — shows all agents, statuses, and workspace phase. */
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore, type WorkspacePhase } from '@/stores/workspaceStore';
import { statusColors, zoneDisplayNames, toDynamicAgentData } from '@/data/agents';
import type { AgentStatus } from '@bossroom/shared-types';

/* ── Shared materials (created once, reused across instances) ─────────── */

const borderMaterial = new THREE.MeshStandardMaterial({
  color: '#4A90D9',
  emissive: new THREE.Color('#4A90D9'),
  emissiveIntensity: 3,
  toneMapped: false,
});

const scanLineMaterial = new THREE.MeshBasicMaterial({
  color: '#4A90D9',
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

const separatorMaterial = new THREE.MeshStandardMaterial({
  color: '#6366f1',
  emissive: new THREE.Color('#6366f1'),
  emissiveIntensity: 2,
  toneMapped: false,
});

/* ── Streaming dots (3 bouncing spheres) ─────────────────────────────── */

function StreamingDots({ color }: { color: string }) {
  const dotsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!dotsRef.current) return;
    for (let i = 0; i < dotsRef.current.children.length; i++) {
      dotsRef.current.children[i].position.y = 0.05 * Math.sin(t * 4 - i * 0.8);
    }
  });

  return (
    <group ref={dotsRef}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.2, 0, 0]}>
          <sphereGeometry args={[0.06, 6, 6]} />
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
  isStreaming: boolean;
  yOffset: number;
}

function AgentRow({ name, color, zone, status, messageCount, isStreaming, yOffset }: AgentRowProps) {
  const orbRef = useRef<THREE.Mesh>(null);
  const isActive = status === 'thinking' || status === 'working';

  useFrame(({ clock }) => {
    if (!orbRef.current) return;
    if (isActive) {
      const t = clock.getElapsedTime();
      const s = 1 + 0.15 * Math.sin(t * 3);
      orbRef.current.scale.setScalar(s);
    } else {
      orbRef.current.scale.setScalar(1);
    }
  });

  const orbColor = statusColors[status] ?? '#888888';
  const zoneLabel = zoneDisplayNames[zone] ?? zone.toUpperCase();

  return (
    <group position={[0, yOffset, 0]}>
      {/* Status orb */}
      <mesh ref={orbRef} position={[-5.0, 0, 0.01]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color={orbColor}
          emissive={new THREE.Color(orbColor)}
          emissiveIntensity={isActive ? 2.5 : 1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Agent name */}
      <Text
        position={[-4.2, 0, 0.01]}
        fontSize={0.32}
        color={color}
        anchorX="left"
        anchorY="middle"
      >
        {name}
      </Text>

      {/* Zone label */}
      <Text
        position={[-0.5, 0, 0.01]}
        fontSize={0.24}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fillOpacity={0.4}
      >
        {zoneLabel}
      </Text>

      {/* Message count badge */}
      {messageCount > 0 && (
        <group position={[2.0, 0, 0.01]}>
          <RoundedBox args={[0.7, 0.35, 0.01]} radius={0.08}>
            <meshBasicMaterial color="#4A90D9" transparent opacity={0.3} />
          </RoundedBox>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.2}
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
        <group position={[4.0, 0, 0.01]}>
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
    mat.opacity = 0.4 + 0.3 * Math.sin(clock.getElapsedTime() * 2);
  });

  const color = phaseColors[phase];

  return (
    <group position={[0, -3.5, 0.01]}>
      <RoundedBox ref={ref} args={[2.4, 0.45, 0.01]} radius={0.1}>
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.22}
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

/** Panel sits just beyond the far wall (Z=-35), at eye level (Y=8). */
const PANEL_X = 0;
const PANEL_Y = 8;
const PANEL_Z = -35;

export function MissionControlSky() {
  const groupRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  // Store subscriptions
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
      groupRef.current.position.y = PANEL_Y + 0.15 * Math.sin(t * 0.5);
    }

    if (scanRef.current) {
      scanRef.current.position.y = ((t * 0.25) % 1) * 7 - 3.5;
    }
  });

  const summaryText = taskSummary || 'No active workspace';

  return (
    <group ref={groupRef} position={[PANEL_X, PANEL_Y, PANEL_Z]}>
      {/* ── Panel background ─────────────────────────────────────── */}
      <RoundedBox args={[12, 8, 0.05]} radius={0.15} position={[0, 0, 0]}>
        <meshBasicMaterial
          color="#0a0e27"
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* ── Neon border (4 emissive strips) ──────────────────────── */}
      {/* Top */}
      <mesh position={[0, 4, 0.03]} material={borderMaterial}>
        <boxGeometry args={[12, 0.04, 0.01]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -4, 0.03]} material={borderMaterial}>
        <boxGeometry args={[12, 0.04, 0.01]} />
      </mesh>
      {/* Left */}
      <mesh position={[-6, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.04, 8, 0.01]} />
      </mesh>
      {/* Right */}
      <mesh position={[6, 0, 0.03]} material={borderMaterial}>
        <boxGeometry args={[0.04, 8, 0.01]} />
      </mesh>

      {/* ── Title ────────────────────────────────────────────────── */}
      <Text
        position={[0, 3.5, 0.04]}
        fontSize={0.55}
        color="#4A90D9"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.15}
      >
        MISSION CONTROL
      </Text>

      {/* ── Task summary ─────────────────────────────────────────── */}
      <Text
        position={[0, 2.8, 0.04]}
        fontSize={0.28}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.6}
        maxWidth={10}
      >
        {summaryText}
      </Text>

      {/* ── Separator line ───────────────────────────────────────── */}
      <mesh position={[0, 2.2, 0.03]} material={separatorMaterial}>
        <boxGeometry args={[10, 0.02, 0.01]} />
      </mesh>

      {/* ── Agent rows ───────────────────────────────────────────── */}
      {allAgents.map((agent, i) => {
        const yOffset = 1.6 - i * 1.0;
        const msgs = chatMessages[agent.id] ?? [];
        const streaming = !!(streamingText[agent.id]);

        return (
          <AgentRow
            key={agent.id}
            name={agent.name}
            color={agent.color}
            zone={agent.zone}
            status={agent.status}
            messageCount={msgs.length}
            isStreaming={streaming}
            yOffset={yOffset}
          />
        );
      })}

      {/* ── Phase indicator ──────────────────────────────────────── */}
      <PhaseIndicator phase={phase} />

      {/* ── Scan line (sweeping horizontal bar) ──────────────────── */}
      <mesh ref={scanRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[11, 0.06]} />
        <primitive object={scanLineMaterial} attach="material" />
      </mesh>

      {/* ── Sparkles (ambient particles) ─────────────────────────── */}
      <Sparkles
        count={40}
        scale={[14, 10, 2]}
        size={1.5}
        speed={0.3}
        color="#4A90D9"
      />
    </group>
  );
}
