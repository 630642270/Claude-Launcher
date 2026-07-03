type SessionStateListener = () => void

const listeners = new Set<SessionStateListener>()

export function onSessionStateChange(listener: SessionStateListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitSessionStateChange(): void {
  for (const listener of listeners) {
    listener()
  }
}
