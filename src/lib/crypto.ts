import crypto from 'crypto'

import argon2 from 'argon2'

import { env } from './env.js'

// Hash a token (refresh token, etc.) using SHA-256 for safe storage in the database
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Encrypts a value using AES-256-GCM for storing Osensitive fields at rest.
// Returns a string in the format: iv:authTag:ciphertext (all hex encoded)
export function encryptField(plaintext: string): string {
  const keyBuffer = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// Decrypts a value that was encrypted using encryptField()
export function decryptField(encryptedValue: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encryptedValue.split(':')

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted value format')
  }

  const keyBuffer = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

// Generates a cryptographically secure random token (used for refresh tokens, invite tokens, etc.)
export function generateSecureToken(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex')
}

// Hashes a password using Argon2 for secure password storage
// Default options are: memoryCost = 19456, timeCost = 2, parallelism = 1 => 2^19.456 bytes of memory, 2 iterations, 1 thread
export async function hashPassword(
  password: string,
  options: { memoryCost?: number; timeCost?: number; parallelism?: number } = {},
): Promise<string> {
  return await argon2.hash(password, { ...options })
}

// Verifies a password against a stored hash using Argon2
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password)
}

/**
 * Precomputed Argon2id hash of a non-guessable string. Used during login so `verifyPassword`
 * always runs with real Argon2 work when the user row is missing, mitigating timing probes.
 */
export const DUMMY_PASSWORD_VERIFICATION_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$t4GQRQdS0t1a8ZUcd3FN3w$KosJi/v5cbi5QGuLZ2pTS4X/JMOiskYia461QrF8CsM' as const
