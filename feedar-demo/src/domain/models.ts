export type MembershipRole = 'OWNER' | 'ADMIN' | 'USER';
export type Role = MembershipRole | 'BOSS' | 'GUEST';
export type Lifecycle = 'active' | 'suspended' | 'archived';
export interface RecordBase { id: string; createdAt: number; updatedAt: number; revision: number }
export interface Actor { userId: string; organizationId?: string; support?: boolean }
export interface User extends RecordBase { name: string; email: string; platformRole?: 'BOSS'; status: Lifecycle; avatar?: string }
export interface Organization extends RecordBase { name: string; slug: string; industry: string; city: string; country: string; description: string; status: Lifecycle; ownerId: string; color: string; welcome: string; language: 'en' | 'fa' | 'tr'; preferredLanguages?: ('en' | 'fa' | 'tr')[]; timezone: string; contact: string; contactPhone?: string; logo?: string; openingHours?: string; notificationPreferences?: { incidents: boolean; invitations: boolean; sessions: boolean }; quotas: { robots: number; users: number; branches: number; sessions: number }; approvalRequired: boolean; speedLimit: number }
export interface Permission { action: string; allowed: boolean }
export interface Membership extends RecordBase { organizationId: string; userId: string; role: MembershipRole; status: Lifecycle; capabilities: string[]; lastActivity?: number }
export interface Location extends RecordBase { organizationId: string; name: string; address: string }
export interface Floor extends RecordBase { organizationId: string; locationId: string; name: string }
export type Connectivity = 'online' | 'offline';
export type RobotMode = 'welcome' | 'telepresence' | 'charging' | 'maintenance';
export interface DeviceIdentity { deviceId: string; pairing: 'unpaired' | 'code_pending' | 'paired' | 'expired' | 'revoked'; pairingCode?: string; pairingExpiresAt?: number; credentialGeneration: number }
export interface Robot extends RecordBase { organizationId: string; name: string; serial: string; deviceId: string; connectivity: Connectivity; mode: RobotMode; fault: string | null; battery: number; x: number; y: number; heading: number; floorId: string; locationId?: string; pairing: DeviceIdentity['pairing']; pairingCode?: string; pairingExpiresAt?: number; credentialGeneration: number; status: Lifecycle; assignedUserIds: string[]; capabilities: string[]; agentVersion: string; firmwareVersion: string; telemetry: Telemetry; estop: boolean; generation: number; stopState: 'requested' | 'acknowledged' | 'unavailable'; currentSessionId?: string; maintenanceAt?: number }
export interface RobotAssignment extends RecordBase { organizationId: string; robotId: string; userId: string; capabilities: string[] }
export interface Telemetry { timestamp: number; linear: number; angular: number; leftWheel: number; rightWheel: number; wheelRadius: number; trackWidth: number; latency: number; signal: number; temperature: number; voltage: number | null; current: number | null; serialConnected: boolean; surfaceConnected: boolean; camera: boolean; microphone: boolean; obstacle: boolean }
export type SessionStatus = 'waiting' | 'ringing' | 'connecting' | 'connected' | 'rejected' | 'busy' | 'reconnecting' | 'disconnected' | 'expired' | 'revoked' | 'ended';
export interface Session extends RecordBase { organizationId: string; robotId: string; userId: string; status: SessionStatus; capabilities: string[]; expiresAt: number; participantIds: string[]; invitationId?: string }
export type GrantStatus = 'not_requested' | 'pending' | 'granted' | 'denied' | 'revoked' | 'expired';
export interface ControlGrant extends RecordBase { organizationId: string; robotId: string; sessionId: string; operatorId: string; status: GrantStatus; leaseId: string; generation: number; expiresAt: number; lastSequence: number; commandDeadline?: number; haltedAt?: number; capabilities: string[] }
export interface RobotCommand { version: 1; organizationId: string; robotId: string; sessionId: string; leaseId: string; generation: number; sequence: number; linear: number; angular: number; issuedAt: number; deadline: number; ttl: number }
export interface Call extends RecordBase { organizationId: string; sessionId: string; status: SessionStatus }
export interface CallParticipant extends RecordBase { organizationId: string; callId: string; userId: string; status: 'joining' | 'connected' | 'left' }
export interface Conversation extends RecordBase { organizationId: string; sessionId: string; channel: 'admin' | 'robot' }
export interface Message extends RecordBase { organizationId: string; sessionId: string; channel: 'admin' | 'robot'; userId: string; text: string; status: 'pending' | 'delivered' | 'failed'; simulated?: boolean; references?: string[]; readBy: string[] }
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface Invitation extends RecordBase { organizationId: string; kind: 'membership' | 'session'; token: string; role: MembershipRole; invitee: string; inviterId: string; robotIds: string[]; capabilities: string[]; expiresAt: number; status: InvitationStatus; acceptedBy?: string; acceptedAt?: number; revokedAt?: number; redeemedSessionId?: string }
export interface Map extends RecordBase { organizationId: string; floorId: string; name: string; active: boolean; version: number; blob?: Blob; coordinates: 'percent'; scale?: number; origin?: [number, number] }
export interface MapPoint extends RecordBase { organizationId: string; floorId: string; name: string; category: string; x: number; y: number }
export type MissionStatus = 'queued' | 'running' | 'paused' | 'completed' | 'canceled' | 'failed';
export interface Mission extends RecordBase { organizationId: string; robotId: string; pointId: string; status: MissionStatus; eta: number; actorId: string }
export interface Incident extends RecordBase { organizationId: string; robotId?: string; severity: 'info' | 'warning' | 'critical'; title: string; status: 'open' | 'resolved' }
export interface AuditLog extends RecordBase { organizationId?: string; actorId: string; role: Role; entityId?: string; robotId?: string; action: string; severity: 'info' | 'warning' | 'critical'; outcome: 'success' | 'denied'; summary: string }
export interface Release extends RecordBase { organizationId?: string; robotId?: string; name: string; version: string; status: 'available' | 'installing' | 'completed' | 'failed'; progress: number }
export interface KnowledgeSource extends RecordBase { organizationId: string; title: string; text: string; category: string; status: 'draft' | 'published' | 'archived'; filename?: string; blob?: Blob; indexing?: 'not_configured' }
export interface SupportTicket extends RecordBase { organizationId?: string; userId: string; robotId?: string; subject: string; text: string; status: 'open' | 'resolved' }
export interface Notification extends RecordBase { organizationId?: string; userId?: string; title: string; text: string; href: string; readBy: string[] }
export interface Database { schemaVersion: 1; revision: number; simulatorTimestamp?: number; organizations: Organization[]; users: User[]; memberships: Membership[]; robots: Robot[]; invitations: Invitation[]; sessions: Session[]; grants: ControlGrant[]; messages: Message[]; maps: Map[]; points: MapPoint[]; missions: Mission[]; knowledge: KnowledgeSource[]; audits: AuditLog[]; tickets: SupportTicket[]; incidents: Incident[]; releases: Release[]; notifications: Notification[]; locations: Location[]; floors: Floor[]; assignments: RobotAssignment[]; calls: Call[]; participants: CallParticipant[]; conversations: Conversation[] }
export interface AssistantAnswer { text: string; references: string[]; tool?: 'find_location' | 'show_map' | 'notify_admin' | 'create_support_ticket' | 'start_video_call' | 'check_robot_status' | 'request_navigation'; pointId?: string }
