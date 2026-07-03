/**
 * Future multi-session terminal architecture.
 *
 * Current implementation uses a single global PTY in embedded.ts.
 * To support parallel embedded sessions (tabs), migrate to:
 *
 * - TerminalSessionManager holding Map<sessionId, EmbeddedSession>
 * - IPC channels scoped by sessionId (terminal:write, terminal:data, etc.)
 * - Renderer tab bar switching active sessionId on one or many xterm instances
 *
 * @see embedded.ts for the current single-session implementation
 */

export interface EmbeddedSessionMeta {
  id: string
  projectPath: string
  profileId: string
  model: string
  startedAt: number
}

export interface EmbeddedSession extends EmbeddedSessionMeta {
  cols: number
  rows: number
}

export interface TerminalTabViewModel {
  sessionId: string
  title: string
  projectPath: string
  active: boolean
  exited: boolean
}

export interface MultiSessionTerminalManager {
  createSession(options: {
    projectPath: string
    profileId: string
    model: string
    size: { cols: number; rows: number }
  }): Promise<EmbeddedSession>
  closeSession(sessionId: string): void
  listSessions(): EmbeddedSessionMeta[]
  setActiveSession(sessionId: string): void
  getActiveSessionId(): string | null
}
