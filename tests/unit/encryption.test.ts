import { encryptPHI, decryptPHI } from '../../src/security/encryption';

describe('Security & Encryption — PHI (AES-256-GCM)', () => {
  it('should successfully encrypt and decrypt sensitive clinical notes', () => {
    const originalText = 'Patient reports severe Pitta aggravation with burning sensation in epigastrium.';
    const encrypted = encryptPHI(originalText);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(originalText);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decryptPHI(encrypted);
    expect(decrypted).toEqual(originalText);
  });

  it('should detect tampering and reject altered ciphertext or tag', () => {
    const originalText = 'Blood pressure 130/85, pulse irregular.';
    const encrypted = encryptPHI(originalText);
    const parts = encrypted.split(':');

    // Alter the ciphertext part by flipping one byte
    const alteredCiphertext = parts[2].slice(0, -2) + (parts[2].slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedPayload = `${parts[0]}:${parts[1]}:${alteredCiphertext}`;

    expect(() => decryptPHI(tamperedPayload)).toThrow();
  });
});
