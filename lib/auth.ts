// Simple JWT utilities for auth
// Uses Web Crypto API (works in both Node.js and Edge runtime)

export interface UserPayload {
  email: string;
  name: string;
  picture?: string;
}

interface JWTPayload extends UserPayload {
  iat: number;
  exp: number;
}

// Encode base64url (URL-safe base64)
function base64urlEncode(data: string | Uint8Array): string {
  const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Decode base64url
function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  return atob(base64 + padding);
}

// Get the secret key for signing
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

// Create HMAC signature using Web Crypto
async function createSignature(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    getSecretKey(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  return base64urlEncode(new Uint8Array(signature).reduce((s, b) => s + String.fromCharCode(b), ''));
}

// Verify HMAC signature
async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await createSignature(data);
  return signature === expectedSignature;
}

// Sign a JWT token
export async function signToken(payload: UserPayload, expiresInDays: number = 30): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (expiresInDays * 24 * 60 * 60),
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = await createSignature(dataToSign);

  return `${dataToSign}.${signature}`;
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const isValid = await verifySignature(dataToVerify, signature);
    if (!isValid) {
      return null;
    }

    const payload: JWTPayload = JSON.parse(base64urlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

// Extract token from Authorization header
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
