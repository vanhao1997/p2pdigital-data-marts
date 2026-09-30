import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { McpScope } from '@owox/idp-protocol';
import { IsNull, Repository } from 'typeorm';
import {
  OAuthDynamicClient,
  type OAuthDynamicClientStatus,
} from './entities/oauth-dynamic-client.entity';

export interface OAuthRegisteredClient {
  clientId: string;
  clientName?: string;
  userId?: string;
  resource?: string;
  status?: OAuthDynamicClientStatus;
  redirectUris: string[];
  scopes: McpScope[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

@Injectable()
export class OAuthClientRegistry {
  constructor(
    @InjectRepository(OAuthDynamicClient)
    private readonly repository: Repository<OAuthDynamicClient>
  ) {}

  async register(client: OAuthRegisteredClient): Promise<OAuthRegisteredClient> {
    await this.repository.save({
      clientId: client.clientId,
      clientName: client.clientName ?? null,
      userId: client.userId ?? null,
      resource: client.resource ?? null,
      status: client.status ?? 'pending',
      redirectUris: client.redirectUris,
      scopes: client.scopes,
      createdAt: client.createdAt,
      lastUsedAt: client.lastUsedAt ?? null,
      expiresAt: client.expiresAt ?? null,
    });
    return client;
  }

  async get(clientId: string): Promise<OAuthRegisteredClient | undefined> {
    const client = await this.repository.findOne({ where: { clientId } });
    if (!client) return undefined;
    if (client.expiresAt && client.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }
    return this.toRegisteredClient(client);
  }

  async hasRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
    return (await this.get(clientId))?.redirectUris.includes(redirectUri) ?? false;
  }

  async attachUserIfMissing(clientId: string, userId: string): Promise<void> {
    await this.repository.update({ clientId, userId: IsNull() }, { userId });
  }

  async markSuccessfulTokenExchange(clientId: string, usedAt: Date = new Date()): Promise<void> {
    await this.repository.update({ clientId }, { status: 'success', lastUsedAt: usedAt });
  }

  async removeExpired(now: Date = new Date()): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(OAuthDynamicClient)
      .where('expiresAt IS NOT NULL AND expiresAt <= :now', { now })
      .execute();
  }

  private toRegisteredClient(client: OAuthDynamicClient): OAuthRegisteredClient {
    return {
      clientId: client.clientId,
      clientName: client.clientName ?? undefined,
      userId: client.userId ?? undefined,
      resource: client.resource ?? undefined,
      status: client.status,
      redirectUris: client.redirectUris,
      scopes: client.scopes,
      createdAt: client.createdAt,
      lastUsedAt: client.lastUsedAt ?? undefined,
      expiresAt: client.expiresAt ?? undefined,
    };
  }
}
