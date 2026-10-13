import type { Actor, AssistantAnswer, Database } from '../../domain/models';
export interface Store { read(): Promise<Database>; transaction<T>(update: (database: Database) => T): Promise<T>; subscribe(callback: () => void): () => void; reset(): Promise<void> }
export interface Provider { execute(actor: Actor, action: string, payload?: Record<string, unknown>): Promise<string | undefined> }
export type AuthProvider = Provider;
export type OrganizationProvider = Provider;
export type InvitationProvider = Provider;
export type RobotProvider = Provider;
export type SessionProvider = Provider;
export type ControlProvider = Provider;
export type ChatProvider = Provider;
export type MapProvider = Provider;
export type KnowledgeProvider = Provider;
export type AuditProvider = Provider;
export type UpdateProvider = Provider;
export interface AIProvider { answer(organizationId: string, question: string, language?: 'en' | 'fa' | 'tr'): Promise<AssistantAnswer> }
export interface MediaProvider { startCamera(): Promise<MediaStream>; startScreen(): Promise<MediaStream>; stop(): void }
export class UnavailableProvider implements Provider { async execute(): Promise<never> { throw new Error('Requires backend/hardware integration. This provider is not configured.'); } }
