/**
 * Embed/dev-key sessions are authenticated only via the playerToken returned
 * from POST /embed/sessions. They must never be discoverable through the public
 * invite-code flow (POST /public/sessions, GET /sessions/by-invite, join codes).
 */
export function isPublicInviteSession(session: {
  devKeyId: string | null;
  status: string;
}): boolean {
  return session.status !== "ended" && session.devKeyId == null;
}
