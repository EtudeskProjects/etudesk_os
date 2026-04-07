import type { Request } from 'express';
import { isIP } from 'node:net';

function stripForwardedMetadata(value: string): string {
  const trimmed = value.trim().replace(/^for=/i, '').replace(/^"|"$/g, '');

  if (trimmed.startsWith('[')) {
    const closingBracket = trimmed.indexOf(']');
    if (closingBracket > 0) {
      return trimmed.slice(1, closingBracket);
    }
  }

  const semicolonIndex = trimmed.indexOf(';');
  if (semicolonIndex >= 0) {
    return trimmed.slice(0, semicolonIndex).trim();
  }

  return trimmed;
}

function stripPort(candidate: string): string {
  if (isIP(candidate)) {
    return candidate;
  }

  const lastColonIndex = candidate.lastIndexOf(':');
  if (lastColonIndex > 0) {
    const hostPart = candidate.slice(0, lastColonIndex);
    const portPart = candidate.slice(lastColonIndex + 1);
    if (/^\d+$/.test(portPart) && isIP(hostPart)) {
      return hostPart;
    }
  }

  return candidate;
}

export function normalizeIpAddress(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const firstHop = value.split(',')[0]?.trim();
  if (!firstHop) {
    return undefined;
  }

  const cleaned = stripPort(stripForwardedMetadata(firstHop));
  if (!cleaned) {
    return undefined;
  }

  if (cleaned.startsWith('::ffff:')) {
    const ipv4Candidate = cleaned.slice(7);
    if (isIP(ipv4Candidate) === 4) {
      return ipv4Candidate;
    }
  }

  return isIP(cleaned) ? cleaned : undefined;
}

export function getClientIp(req: Request): string | undefined {
  const headerCandidates = [
    req.headers['cf-connecting-ip'],
    req.headers['x-real-ip'],
    req.headers['x-forwarded-for'],
  ];

  const candidates: Array<string | null | undefined> = [
    ...headerCandidates.flatMap((value) => Array.isArray(value) ? value : [value]),
    req.ip,
    ...req.ips,
    req.socket.remoteAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIpAddress(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
