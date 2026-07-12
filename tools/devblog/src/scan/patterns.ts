export interface SecretPattern {
  id: string;
  description: string;
  regex: RegExp;
}

/**
 * Deterministic, versioned patterns for the MUST-level secret scan gate
 * (design.md D4). This is the primary, decisive layer — any optional
 * external scanner (gitleaks) is additive, not a substitute.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: "generic-api-key",
    description: "汎用 API キー形式(sk-... 等)",
    regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    id: "aws-access-key-id",
    description: "AWS アクセスキー ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "bearer-token",
    description: "Bearer トークン",
    regex: /\bBearer\s+[A-Za-z0-9_\-.]{20,}\b/g,
  },
  {
    id: "assigned-secret",
    description: "KEY/SECRET/TOKEN/PASSWORD への代入値",
    regex: /\b[A-Za-z_][A-Za-z0-9_]*_(?:KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*['"]?[A-Za-z0-9\-_./+=]{8,}['"]?/gi,
  },
  {
    id: "private-key-block",
    description: "秘密鍵ブロック",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "email-address",
    description: "メールアドレス",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    id: "internal-host",
    description: "内部ホスト名・プライベート IP",
    regex: /\b(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
  },
];
