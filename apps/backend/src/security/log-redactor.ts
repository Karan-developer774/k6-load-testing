const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /Basic\s+[A-Za-z0-9+/=]+/gi,
  /("?(?:password|token|secret|apiKey|client_secret)"?\s*[:=]\s*"?)[^"'\s&]+/gi,
  /(Authorization:\s*)([^\r\n]+)/gi,
];

export function redactSensitiveData(text: string): string {
  if (!text) return '';
  let redacted = text;

  // Redact Bearer
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]');

  // Redact Basic
  redacted = redacted.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]');

  // Redact JSON/URL fields
  redacted = redacted.replace(
    /("?(?:password|token|secret|apiKey|client_secret)"?\s*[:=]\s*"?)[^"'\s&]+/gi,
    '$1[REDACTED]'
  );

  return redacted;
}
