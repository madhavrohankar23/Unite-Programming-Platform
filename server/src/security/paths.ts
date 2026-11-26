import { isValidNodeName } from '../../../shared/schemas/validation.js';
import { BadRequestError } from '../utils/errors.js';

export function sanitizeNodeName(name: string): string {
  const trimmed = name.trim();
  if (!isValidNodeName(trimmed)) {
    throw new BadRequestError(
      'Invalid file or folder name. Path separators, null bytes, and ".." are prohibited.',
      'INVALID_FILE_NAME',
    );
  }
  return trimmed;
}

export function assertNoCircularParent(
  nodeId: string,
  targetParentId: string | null,
  parentLookup: Map<string, string | null>,
): void {
  if (!targetParentId) return;
  if (targetParentId === nodeId) {
    throw new BadRequestError('A folder cannot be moved inside itself', 'CIRCULAR_PARENT');
  }
  let current: string | null | undefined = targetParentId;
  const visited = new Set<string>([nodeId]);
  while (current) {
    if (visited.has(current)) {
      throw new BadRequestError(
        'Cannot move a folder into one of its descendants',
        'CIRCULAR_PARENT',
      );
    }
    visited.add(current);
    current = parentLookup.get(current) ?? null;
  }
}

