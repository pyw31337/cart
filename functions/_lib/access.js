// functions/_lib/access.js — Cloudflare Access JWT(RS256)를 Workers 안에서 직접 검증한다.
// 헤더 존재만으로 통과시키지 않는다. 공개 경로는 이 모듈을 호출하지 않는다.
import { HttpError } from './http.js';

const JWKS_TTL_MS = 60 * 60 * 1000;
let _jwks = { url: null, at: 0, keys: null };

function b64urlBytes(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
  const bin = atob(b + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
}

async function teamKeys(teamDomain) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (_jwks.keys && _jwks.url === url && Date.now() - _jwks.at < JWKS_TTL_MS) return _jwks.keys;
  const res = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new HttpError(503, `Access 공개키를 가져오지 못했습니다 (${res.status})`);
  const body = await res.json();
  _jwks = { url, at: Date.now(), keys: body.keys || [] };
  return _jwks.keys;
}

async function verifyJwt(token, { teamDomain, aud }) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Access JWT 형식이 아닙니다');
  const [h, p, sig] = parts;
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new HttpError(401, 'Access JWT 가 만료되었습니다');
  if (payload.nbf && payload.nbf > now + 60) throw new HttpError(401, 'Access JWT 가 아직 유효하지 않습니다');
  if (aud) {
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) throw new HttpError(403, '이 애플리케이션의 Access 토큰이 아닙니다');
  }
  if (teamDomain && payload.iss && !String(payload.iss).includes(teamDomain)) {
    throw new HttpError(403, 'Access 팀 도메인이 일치하지 않습니다');
  }
  const keys = await teamKeys(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid) || keys[0];
  if (!jwk) throw new HttpError(503, 'Access 공개키에 kid 가 없습니다');
  const key = await crypto.subtle.importKey(
    'jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new HttpError(401, 'Access JWT 서명이 올바르지 않습니다');
  return payload;
}

/** @returns {{email: string, via: 'access-jwt'}} */
export async function requireAccess(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const emailHeader = request.headers.get('Cf-Access-Authenticated-User-Email') || '';
  const teamDomain = env?.ACCESS_TEAM_DOMAIN || '';
  const aud = env?.ACCESS_AUD || '';
  const allowed = (env?.ACCESS_ALLOWED_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  if (!jwt || !teamDomain) {
    throw new HttpError(401, 'Cloudflare Access 인증이 필요합니다');
  }
  const payload = await verifyJwt(jwt, { teamDomain, aud });
  const email = String(payload.email || emailHeader || '').toLowerCase();
  if (!email) throw new HttpError(401, 'Access 신원(이메일)이 없습니다');
  if (allowed.length && !allowed.includes(email)) {
    throw new HttpError(403, `허용되지 않은 계정입니다: ${email}`);
  }
  return { email, via: 'access-jwt' };
}
