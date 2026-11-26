import { describe, expect, it } from 'vitest';
import {
  detectLanguageFromFileName,
  getLanguageById,
} from '../../shared/constants/languages.js';
import {
  canDeleteWorkspace,
  canEditFiles,
  canExecuteCode,
  canManageMembers,
  canUseTerminal,
} from '../../shared/constants/roles.js';
import { isValidNodeName } from '../../shared/schemas/validation.js';
import { buildCollabDocName, parseCollabDocName } from '../../shared/types/models.js';
import {
  extractTokenFromInviteInput,
  generateInvitationToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../server/src/security/tokens.js';

describe('Shared Language & Role Logic', () => {
  it('detects Monaco language from file extensions accurately', () => {
    expect(detectLanguageFromFileName('app.ts').id).toBe('typescript');
    expect(detectLanguageFromFileName('main.py').id).toBe('python');
    expect(detectLanguageFromFileName('Main.java').id).toBe('java');
    expect(detectLanguageFromFileName('algo.cpp').id).toBe('cpp');
    expect(detectLanguageFromFileName('styles.css').id).toBe('css');
    expect(detectLanguageFromFileName('unknown.xyz').id).toBe('plaintext');
    expect(getLanguageById('python').executable).toBe(true);
    expect(getLanguageById('markdown').executable).toBe(false);
  });

  it('enforces workspace role permissions', () => {
    expect(canEditFiles('OWNER')).toBe(true);
    expect(canEditFiles('EDITOR')).toBe(true);
    expect(canEditFiles('VIEWER')).toBe(false);

    expect(canExecuteCode('EDITOR')).toBe(true);
    expect(canExecuteCode('VIEWER')).toBe(false);

    expect(canUseTerminal('EDITOR')).toBe(true);
    expect(canUseTerminal('VIEWER')).toBe(false);

    expect(canManageMembers('OWNER')).toBe(true);
    expect(canManageMembers('EDITOR')).toBe(false);
    expect(canDeleteWorkspace('OWNER')).toBe(true);
    expect(canDeleteWorkspace('EDITOR')).toBe(false);
  });

  it('rejects directory traversal and invalid node names', () => {
    expect(isValidNodeName('index.ts')).toBe(true);
    expect(isValidNodeName('.gitignore')).toBe(true);
    expect(isValidNodeName('..')).toBe(false);
    expect(isValidNodeName('.')).toBe(false);
    expect(isValidNodeName('../secret.txt')).toBe(false);
    expect(isValidNodeName('src/index.ts')).toBe(false);
    expect(isValidNodeName('src\\index.ts')).toBe(false);
    expect(isValidNodeName('bad\0name.txt')).toBe(false);
    expect(isValidNodeName('')).toBe(false);
  });

  it('parses collaboration document identifiers strictly', () => {
    const name = buildCollabDocName('ws_abc123', 'fil_xyz789');
    expect(name).toBe('workspace:ws_abc123:file:fil_xyz789');
    expect(parseCollabDocName(name)).toEqual({
      workspaceId: 'ws_abc123',
      fileId: 'fil_xyz789',
    });
    expect(parseCollabDocName('workspace:../etc:file:1')).toBeNull();
    expect(parseCollabDocName('arbitrary-doc')).toBeNull();
  });
});

describe('Security Tokens & Password Hashing', () => {
  it('hashes and verifies passwords with scrypt timing-safe check', async () => {
    const hash = await hashPassword('SuperSecretPass123!');
    expect(await verifyPassword('SuperSecretPass123!', hash)).toBe(true);
    expect(await verifyPassword('WrongPass', hash)).toBe(false);
  });

  it('generates and extracts invitation tokens deterministically', () => {
    const inv = generateInvitationToken();
    expect(inv.rawToken.startsWith('UNITE-')).toBe(true);
    expect(inv.tokenHash).toBe(hashToken(inv.rawToken));
    expect(extractTokenFromInviteInput(`https://unite.dev/join?code=${inv.rawToken}`)).toBe(
      inv.rawToken,
    );
    expect(extractTokenFromInviteInput(`https://unite.dev/join/${inv.rawToken}`)).toBe(
      inv.rawToken,
    );
  });
});

