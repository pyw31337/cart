// functions/thumbs/[[path]].js — 렛츠카트 썸네일 캐시 서빙 (R2 letscart-media / thumbs/ 경로)
//   /thumbs/t/<32hex>.webp     → 사진
//   /thumbs/has?h=aaa,bbb      → 존재 여부 일괄 확인(최대 300개)
//   PUT /thumbs/t/<32hex>.webp → 사진 업로드 (공유 썸네일 캐시)
const KEY = /^[0-9a-f]{32}\.webp$/;
const MAX_SIZE = 60 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,PUT,OPTIONS',
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

  const seg = params.path;
  const path = Array.isArray(seg) ? seg.join('/') : (seg || '');
  if (!path || path.includes('..')) return new Response('Not found', { status: 404, headers: CORS });

  const bucket = env.MEDIA_BUCKET || env.THUMBS_BUCKET;
  const url = new URL(request.url);

  // 존재 여부 일괄 확인 — 프론트가 사진 없는 품목만 골라 묻는다
  if (path === 'has') {
    const hs = (url.searchParams.get('h') || '').split(',').filter((h) => KEY.test(h + '.webp')).slice(0, 300);
    if (!bucket) {
      return json({ have: [] });
    }
    const got = await Promise.all(
      hs.map((h) =>
        bucket.head('thumbs/' + h + '.webp')
          .then((o) => (o ? h : bucket.head(h + '.webp').then((o2) => (o2 ? h : null))))
          .catch(() => null)
      )
    );
    return json({ have: got.filter(Boolean) });
  }

  // 사진 한 장
  const m = path.match(/^t\/([0-9a-f]{32})\.webp$/);
  if (!m) return new Response('Not found', { status: 404, headers: CORS });

  // PUT: 썸네일 업로드 (공유 캐시)
  if (request.method === 'PUT') {
    if (!bucket) return json({ ok: false, why: 'no_bucket' }, 503);
    const cType = request.headers.get('Content-Type') || '';
    if (cType !== 'image/webp') return json({ ok: false, why: 'type' }, 415);
    const len = +(request.headers.get('Content-Length') || 0);
    if (len > MAX_SIZE) return json({ ok: false, why: 'size' }, 413);
    const b = new Uint8Array(await request.arrayBuffer());
    if (b.length > MAX_SIZE || b.length < 30) return json({ ok: false, why: 'size' }, 413);
    const tag = (s) => String.fromCharCode(...b.slice(s, s + 4));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return json({ ok: false, why: 'notwebp' }, 415);
    const key = 'thumbs/' + m[1] + '.webp';
    if ((await bucket.head(key)) || (await bucket.head(m[1] + '.webp'))) {
      return json({ ok: true, exists: true });
    }
    await bucket.put(key, b, { httpMetadata: { contentType: 'image/webp' } });
    return json({ ok: true }, 201);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  if (!bucket) {
    return new Response('Not found', { status: 404, headers: CORS });
  }

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  let obj = await bucket.get('thumbs/' + m[1] + '.webp');
  if (!obj) obj = await bucket.get(m[1] + '.webp');
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
