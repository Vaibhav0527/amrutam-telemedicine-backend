import speakeasy from 'speakeasy';
import { generateMfaSecret, verifyMfaToken } from '../../src/security/totp';

describe('Security — Multi-Factor Authentication (TOTP)', () => {
  it('should generate a valid TOTP secret and data URL QR code', async () => {
    const result = await generateMfaSecret('dr.arvind@amrutam.co.in');

    expect(result.secret).toBeDefined();
    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(result.qrCodeDataUrl).toContain('data:image/png;base64,');
  });

  it('should verify a valid TOTP token generated with the same secret', () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const token = speakeasy.totp({ secret, encoding: 'base32' });

    const isValid = verifyMfaToken(token, secret);
    expect(isValid).toBe(true);
  });

  it('should reject an invalid TOTP token', () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const invalidToken = '000000';

    const isValid = verifyMfaToken(invalidToken, secret);
    expect(isValid).toBe(false);
  });
});
