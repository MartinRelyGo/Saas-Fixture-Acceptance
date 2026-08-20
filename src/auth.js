/**
 * Deliberately trivial token -> session mapping for the fixture.
 *
 * `Authorization: Bearer token-<tenant>-<role>` where role is `owner` or
 * `staff`. This is the ONLY source of truth for tenancy and privilege:
 * server code must never trust a client-supplied tenantId or role.
 */

const TOKEN_PATTERN = /^Bearer\s+token-([a-zA-Z0-9]+)-(owner|staff)$/;

export function sessionFromRequest(req) {
  const header = req.headers?.authorization;
  if (!header) return null;
  const match = TOKEN_PATTERN.exec(header.trim());
  if (!match) return null;
  return { tenantId: match[1], role: match[2] };
}

export function isOwner(session) {
  return session?.role === "owner";
}
