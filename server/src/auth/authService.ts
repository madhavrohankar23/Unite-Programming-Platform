import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import type { UserProfileDto } from '../../../shared/types/models.js';
import type { DatabaseRepositories } from '../database/types.js';
import {
  generateSecureId,
  hashPassword,
  verifyPassword,
} from '../security/tokens.js';
import type { ServerEnv } from '../utils/env.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';

export interface AuthSessionResult {
  accessToken: string;
  user: UserProfileDto;
}

export class AuthService {
  private readonly env: ServerEnv;
  private readonly db: DatabaseRepositories;
  private readonly supabase: SupabaseClient | null;
  private readonly localSecretKey: Uint8Array;
  private readonly supabaseSecretKey: Uint8Array | null;

  constructor(env: ServerEnv, db: DatabaseRepositories) {
    this.env = env;
    this.db = db;
    this.localSecretKey = new TextEncoder().encode(env.LOCAL_JWT_SECRET);
    this.supabaseSecretKey = env.SUPABASE_JWT_SECRET
      ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
      : null;

    if (env.AUTH_PROVIDER === 'supabase' && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.supabase = null;
    }
  }

  public getMode(): 'supabase' | 'local' {
    return this.env.AUTH_PROVIDER;
  }

  public async verifyAccessToken(token: string): Promise<UserProfileDto> {
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedError('Missing access token');
    }

    if (this.env.AUTH_PROVIDER === 'supabase') {
      return this.verifySupabaseToken(token);
    }
    return this.verifyLocalToken(token);
  }

  private async verifyLocalToken(token: string): Promise<UserProfileDto> {
    try {
      const { payload } = await jwtVerify(token, this.localSecretKey, {
        issuer: 'unite-auth',
        audience: 'unite-app',
      });
      const userId = payload.sub;
      if (!userId) {
        throw new UnauthorizedError('Invalid token subject');
      }
      const user = await this.db.users.findById(userId);
      if (!user) {
        throw new UnauthorizedError('User session no longer exists');
      }
      const { passwordHash: _ph, ...dto } = user;
      return dto;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired authentication token');
    }
  }

  private async verifySupabaseToken(token: string): Promise<UserProfileDto> {
    let authUserId: string;
    let email: string;
    let displayName: string;
    let avatarUrl: string | null = null;

    if (this.supabaseSecretKey) {
      try {
        const { payload } = await jwtVerify(token, this.supabaseSecretKey);
        if (!payload.sub || typeof payload.email !== 'string') {
          throw new UnauthorizedError('Invalid Supabase token claims');
        }
        authUserId = payload.sub;
        email = payload.email;
        const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
        displayName =
          typeof meta.display_name === 'string' && meta.display_name.trim()
            ? meta.display_name.trim()
            : typeof meta.full_name === 'string' && meta.full_name.trim()
              ? meta.full_name.trim()
              : email.split('@')[0] || 'Developer';
        avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError('Invalid or expired Supabase token');
      }
    } else if (this.supabase) {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data.user || !data.user.email) {
        throw new UnauthorizedError('Invalid or expired Supabase session');
      }
      authUserId = data.user.id;
      email = data.user.email;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      displayName =
        typeof meta.display_name === 'string' && meta.display_name.trim()
          ? meta.display_name.trim()
          : typeof meta.full_name === 'string' && meta.full_name.trim()
            ? meta.full_name.trim()
            : email.split('@')[0] || 'Developer';
      avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
    } else {
      throw new UnauthorizedError('Supabase authentication is not configured on the server');
    }

    const profile = await this.db.users.upsertByAuthUser({
      id: generateSecureId('usr'),
      authUserId,
      email,
      displayName,
      avatarUrl,
    });
    const { passwordHash: _ph, ...dto } = profile;
    return dto;
  }

  public async registerLocal(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthSessionResult> {
    if (this.env.AUTH_PROVIDER !== 'local') {
      throw new BadRequestError(
        'Use Supabase client authentication when AUTH_PROVIDER=supabase',
        'USE_SUPABASE_CLIENT',
      );
    }
    const existing = await this.db.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_EXISTS');
    }

    const id = generateSecureId('usr');
    const passwordHash = await hashPassword(input.password);
    const created = await this.db.users.create({
      id,
      authUserId: id,
      email: input.email.toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash,
    });

    await this.db.audit.log({
      id: generateSecureId('aud'),
      workspaceId: null,
      userId: created.id,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: created.id,
    });

    const accessToken = await this.signLocalToken(created.id, created.email, created.displayName);
    const { passwordHash: _ph, ...dto } = created;
    return { accessToken, user: dto };
  }

  public async loginLocal(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionResult> {
    if (this.env.AUTH_PROVIDER !== 'local') {
      throw new BadRequestError(
        'Use Supabase client authentication when AUTH_PROVIDER=supabase',
        'USE_SUPABASE_CLIENT',
      );
    }
    const user = await this.db.users.findByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const accessToken = await this.signLocalToken(user.id, user.email, user.displayName);
    const { passwordHash: _ph, ...dto } = user;
    return { accessToken, user: dto };
  }

  public async signLocalToken(userId: string, email: string, displayName: string): Promise<string> {
    return new SignJWT({ email, displayName })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('unite-auth')
      .setAudience('unite-app')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.localSecretKey);
  }
}

