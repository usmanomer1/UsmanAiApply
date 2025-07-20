33// Session management utilities for job search
// Handles session persistence with 5-minute expiration

export interface SearchSession {
  sessionId: string;
  query: string;
  location: string;
  filters: any;
  createdAt: number;
  lastAccessedAt: number;
  totalJobsFound: number;
  jobsLoaded: number;
}

const SESSION_KEY = 'jobSearchSession';
const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Get session from storage, returns null if expired
export function getStoredSession(): SearchSession | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as SearchSession;
    const now = Date.now();

    // Check if session has expired (5 minutes of inactivity)
    if (now - session.lastAccessedAt > SESSION_EXPIRY_MS) {
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
}

// Save session to storage
export function saveSession(session: SearchSession): void {
  try {
    // Update last accessed time
    session.lastAccessedAt = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

// Create a new session
export function createSession(query: string, location: string, filters: any): SearchSession {
  const now = Date.now();
  const session: SearchSession = {
    sessionId: now.toString(),
    query,
    location,
    filters,
    createdAt: now,
    lastAccessedAt: now,
    totalJobsFound: 0,
    jobsLoaded: 0,
  };

  saveSession(session);
  return session;
}

// Update session with new data
export function updateSession(updates: Partial<SearchSession>): SearchSession | null {
  const session = getStoredSession();
  if (!session) return null;

  const updatedSession = {
    ...session,
    ...updates,
    lastAccessedAt: Date.now(),
  };

  saveSession(updatedSession);
  return updatedSession;
}

// Clear session
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// Check if session matches current search parameters
export function isSessionValid(
  session: SearchSession | null,
  query: string,
  location: string,
  filters: any
): boolean {
  if (!session) return false;

  // Check if search parameters match
  return (
    session.query === query &&
    session.location === location &&
    JSON.stringify(session.filters) === JSON.stringify(filters)
  );
}

// Touch session to update last accessed time
export function touchSession(): void {
  const session = getStoredSession();
  if (session) {
    session.lastAccessedAt = Date.now();
    saveSession(session);
  }
}

// Get time until session expires in milliseconds
export function getSessionTimeRemaining(): number {
  const session = getStoredSession();
  if (!session) return 0;

  const elapsed = Date.now() - session.lastAccessedAt;
  const remaining = SESSION_EXPIRY_MS - elapsed;

  return Math.max(0, remaining);
}

// Format time remaining as human-readable string
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
