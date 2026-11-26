const COLLABORATOR_COLORS = [
  '#22D3EE', // Cyan
  '#3B82F6', // Electric Blue
  '#14B8A6', // Teal
  '#A855F7', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F97316', // Orange
] as const;

export function getCollaboratorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLLABORATOR_COLORS[hash % COLLABORATOR_COLORS.length]!;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

