import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Generates a new TOTP secret and QR code for user MFA onboarding
 */
export async function generateMfaSecret(email: string): Promise<MfaSetupResult> {
  const secret = speakeasy.generateSecret({
    name: `Amrutam Telemedicine (${email})`,
    issuer: 'Amrutam Ayurveda',
    length: 20,
  });

  const otpauthUrl = secret.otpauth_url || '';
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: secret.base32,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

/**
 * Verifies a 6-digit TOTP token against a user's stored secret
 */
export function verifyMfaToken(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 30 seconds drift for mobile clocks
  });
}
