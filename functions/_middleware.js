// functions/_middleware.js — 공개 경로는 그대로, 개인 경로만 Cloudflare Access 로 잠근다.
//   공개 허용: / , /assets/* , /data/* , /tracker/* , /api/public/* , /media/*
//   Access 필수: /my , /my/* , /api/private/*
import { requireAccess } from './_lib/access.js';
import { json, fail, html } from './_lib/http.js';

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const p = url.pathname;
  const isPrivate = p === '/my' || p.startsWith('/my/') || p.startsWith('/api/private');
  const isApi = p.startsWith('/api/');

  if (isPrivate) {
    try {
      const identity = await requireAccess(request, env);
      const res = await next();
      const out = new Response(res.body, res);
      Object.entries(SEC_HEADERS).forEach(([k, v]) => out.headers.set(k, v));
      out.headers.set('Cache-Control', 'no-store');
      out.headers.set('X-LetsCart-Identity-Via', identity.via);
      return out;
    } catch (e) {
      if (isApi) {
        const r = fail(e);
        r.headers.set('WWW-Authenticate', 'Cloudflare-Access');
        return r;
      }
      return html(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>렛츠카트 · 인증 필요</title>
<link rel="stylesheet" href="/assets/lc.css"></head>
<body style="background:#f2f4f8"><div class="shell" style="max-width:560px;padding:48px 16px">
<div class="hero-card"><div class="hero-kicker">Cloudflare Access</div>
<h1 style="font-size:20px;margin:0 0 8px">개인 영역은 인증이 필요합니다</h1>
<p style="color:#4e5968;font-size:13.5px;margin:0 0 16px">${(e && e.message) ? String(e.message).replace(/[<>&]/g, '') : '인증이 필요합니다'}.
가계부·주문·재구매 정보는 Cloudflare Access 로 보호됩니다. 허용된 계정으로 로그인해 주세요.</p>
<a class="btn btn-primary" href="/my">다시 시도</a>
<a class="btn btn-ghost" href="/" style="margin-left:8px">공개 카탈로그</a></div></div></body></html>`, e && e.status ? e.status : 401);
    }
  }

  const res = await next();
  const out = new Response(res.body, res);
  Object.entries(SEC_HEADERS).forEach(([k, v]) => out.headers.set(k, v));
  if (p === '/' || p.endsWith('.html')) out.headers.set('X-Frame-Options', 'DENY');
  if (isApi) out.headers.set('Cache-Control', 'no-store');
  return out;
}

export { json };
