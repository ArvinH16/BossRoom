export interface AvatarOption {
  id: string;
  label: string;
  modelUrl: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'default', label: 'Default', modelUrl: '/models/characters/player.glb' },
  { id: 'female-a', label: 'Female A', modelUrl: '/models/characters/avatars/character-female-a.glb' },
  { id: 'female-b', label: 'Female B', modelUrl: '/models/characters/avatars/character-female-b.glb' },
  { id: 'female-c', label: 'Female C', modelUrl: '/models/characters/avatars/character-female-c.glb' },
  { id: 'female-d', label: 'Female D', modelUrl: '/models/characters/avatars/character-female-d.glb' },
  { id: 'female-e', label: 'Female E', modelUrl: '/models/characters/avatars/character-female-e.glb' },
  { id: 'female-f', label: 'Female F', modelUrl: '/models/characters/avatars/character-female-f.glb' },
  { id: 'male-a', label: 'Male A', modelUrl: '/models/characters/avatars/character-male-a.glb' },
  { id: 'male-b', label: 'Male B', modelUrl: '/models/characters/avatars/character-male-b.glb' },
  { id: 'male-c', label: 'Male C', modelUrl: '/models/characters/avatars/character-male-c.glb' },
  { id: 'male-d', label: 'Male D', modelUrl: '/models/characters/avatars/character-male-d.glb' },
  { id: 'male-e', label: 'Male E', modelUrl: '/models/characters/avatars/character-male-e.glb' },
  { id: 'male-f', label: 'Male F', modelUrl: '/models/characters/avatars/character-male-f.glb' },
];

export function getAvatarModelUrl(avatarId: string | undefined): string {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  return avatar?.modelUrl ?? AVATARS[0].modelUrl;
}
