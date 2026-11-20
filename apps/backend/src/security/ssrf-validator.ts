import dns from 'dns/promises';
import { URL } from 'url';
import ipaddr from 'ipaddr.js';
import { TargetValidationResult } from '@k6-platform/shared-types';
import { config } from '../config/env.js';

export async function validateTargetUrl(
  rawUrl: string,
  allowlistDomains?: string[]
): Promise<TargetValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      isValid: false,
      reason: 'Malformed URL: Must be a valid absolute HTTP or HTTPS URL',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      reason: `Unsupported protocol "${parsed.protocol}": Only http: and https: are permitted`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Project Domain allowlist check
  if (allowlistDomains && allowlistDomains.length > 0) {
    const isDomainAllowed = allowlistDomains.some((d) => {
      const trimmed = d.trim().toLowerCase();
      return hostname === trimmed || hostname.endsWith(`.${trimmed}`);
    });

    if (!isDomainAllowed) {
      return {
        isValid: false,
        reason: `Target domain "${hostname}" is not in the project's authorized allowlist`,
      };
    }
  }

  // Always block link-local cloud metadata endpoints (AWS, GCP, Azure, OpenStack)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return {
      isValid: false,
      reason: 'Access to cloud instance metadata services is strictly forbidden',
      isPrivateNetwork: true,
    };
  }

  // Resolve hostname via DNS
  let resolvedIp: string;
  try {
    const lookupResult = await dns.lookup(hostname);
    resolvedIp = lookupResult.address;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      reason: `DNS resolution failed for hostname "${hostname}": ${errorMsg}`,
    };
  }

  // Check if resolved IP is in private / bogon / link-local / loopback range
  let parsedIp: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsedIp = ipaddr.parse(resolvedIp);
  } catch {
    return {
      isValid: false,
      resolvedIp,
      reason: `Failed to parse resolved IP address "${resolvedIp}"`,
    };
  }

  const range = parsedIp.range();
  const isPrivate = [
    'loopback',
    'private',
    'linkLocal',
    'uniqueLocal',
    'carrierGradeNat',
    'unspecified',
    'broadcast',
  ].includes(range);

  // If local targets are not allowed, block private networks
  if (isPrivate && !config.allowLocalTargets) {
    return {
      isValid: false,
      resolvedIp,
      isPrivateNetwork: true,
      reason: `Target resolves to a restricted/private network address (${resolvedIp}, range: ${range}). SSRF protection blocked this request.`,
    };
  }

  return {
    isValid: true,
    resolvedIp,
    isPrivateNetwork: isPrivate,
  };
}
