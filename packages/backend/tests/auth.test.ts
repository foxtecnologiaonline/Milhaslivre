// Authentication tests
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword } from '../src/crypto';
import { isValidCPF, isValidEmail } from '../src/validators';

describe('Authentication', () => {
  describe('Password hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toContain(':');
      expect(hash).not.toBe(password);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('should be unique for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('Validators', () => {
    describe('CPF validation', () => {
      it('should validate correct CPF', () => {
        expect(isValidCPF('11144477735')).toBe(true);
      });

      it('should reject invalid CPF', () => {
        expect(isValidCPF('11111111111')).toBe(false);
        expect(isValidCPF('12345678901')).toBe(false);
        expect(isValidCPF('123')).toBe(false);
      });

      it('should handle formatted CPF', () => {
        expect(isValidCPF('111.444.777-35')).toBe(true);
      });
    });

    describe('Email validation', () => {
      it('should validate correct email', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
      });

      it('should reject invalid email', () => {
        expect(isValidEmail('invalid.email')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
      });
    });
  });
});
