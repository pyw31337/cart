// functions/media/[[path]].js — R2 `letscart-media` 공개 이미지 서빙
// 키: products/{sha[:2]}/{sha16}.webp → URL /media/products/aa/hash.webp
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const bucket = env.MEDIA_BUCKET;
  if (!bucket) return new Response('media bucket not configured', { status: 503 });

  const seg = params.path;
  const key = Array.isArray(seg) ? seg.join('/') : (seg || '');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const obj = await bucket.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

  const res = new Response(obj.body, { headers });
  context.waitUntil(cache.put(request, res.clone()));
  return res;
}
