import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Computes a SHA-256 tamper-evident hash for audit logs
 * chaining previous hash + payload to prevent database tampering
 */
export function computeAuditTamperHash(
  previousHash: string,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  timestamp: string,
  payload: any
): string {
  const serialized = JSON.stringify({
    previousHash,
    userId,
    action,
    resourceType,
    resourceId,
    timestamp,
    payload,
  });

  return crypto.createHash('sha256').update(serialized).digest('hex');
}
