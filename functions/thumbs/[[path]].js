// functions/thumbs/[[path]].js — letsbuy-thumbs R2 사진을 렛츠카트 주소로도 그대로 서빙
//   /thumbs/t/<32hex>.webp   → 사진
//   /thumbs/has?h=aaa,bbb    → 존재 여부 일괄 확인(최대 300개)
// Pages 프로젝트에 THUMBS_BUCKET(버킷 letsbuy-thumbs) 바인딩이 있으면 R2에서 직접 읽고,
// 없으면 기존 letsbuy-thumbs Worker 로 그대로 넘긴다(두 경로 모두 같은 응답·같은 캐시 정책).
// 읽기 전용이다. 버킷에 쓰거나 지우지 않는다.
const UPSTREAM = 'https://letsbuy-thumbs.pyw213.workers.dev';
const KEY = /^[0-9a-f]{32}\.webp$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const seg = params.path;
  const path = Array.isArray(seg) ? seg.join('/') : (seg || '');
  if (!path || path.includes('..')) return new Response('Not found', { status: 404, headers: CORS });

  const bucket = env.THUMBS_BUCKET;
  const url = new URL(request.url);

  // 존재 여부 일괄 확인 — 프론트가 사진 없는 품목만 골라 묻는다
  if (path === 'has') {
    const hs = (url.searchParams.get('h') || '').split(',').filter((h) => KEY.test(h + '.webp')).slice(0, 300);
    if (!bucket) {
      const up = await fetch(UPSTREAM + '/has?h=' + hs.join(','));
      return new Response(up.body, {
        status: up.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...CORS },
      });
    }
    const got = await Promise.all(hs.map((h) => bucket.head(h + '.webp').then((o) => (o ? h : null)).catch(() => null)));
    return json({ have: got.filter(Boolean) });
  }

  // 사진 한 장
  const m = path.match(/^t\/([0-9a-f]{32})\.webp$/);
  if (!m) return new Response('Not found', { status: 404, headers: CORS });

  if (!bucket) {
    const up = await fetch(UPSTREAM + '/t/' + m[1] + '.webp');
    const h = new Headers(CORS);
    h.set('Content-Type', 'image/webp');
    h.set('Cache-Control', up.ok ? 'public, max-age=31536000, immutable' : 'public, max-age=600');
    return new Response(up.body, { status: up.status, headers: h });
  }

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const obj = await bucket.get(m[1] + '.webp');
  if (!obj) return new Response('Not found', { status: 404, headers: { ...CORS, 'Cache-Control': 'public, max-age=600' } });

  const headers = new Headers(CORS);
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

  const res = new Response(obj.body, { headers });
  context.waitUntil(cache.put(request, res.clone()));
  return res;
}
