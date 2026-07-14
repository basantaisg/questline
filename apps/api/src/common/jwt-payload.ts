export type Role = 'user' | 'admin';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  /**
   * UI hint only — lets the client render admin controls without an extra
   * round-trip. Never authorize on this: an access token lives up to 15m, so a
   * demoted admin would still present role:'admin' until it expires. Every
   * privileged path re-reads users.role from the DB (see isAdmin).
   */
  role: Role;
  /**
   * Email-verification state at issue time. Safe to authorize on, unlike role:
   * verification is one-way (false → true), so a stale token can only ever be
   * *more* restrictive than the database. Tokens are only ever minted with
   * `true` — signup hands out no session at all — but JwtAuthGuard still
   * rejects `false` as defence in depth.
   */
  verified: boolean;
}
