// functions/_lib/http.js — JSON 응답과 오류 처리
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

export function json(data, init) {
  const headers = new Headers(Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  }, SEC));
  if (init && init.headers) Object.entries(init.headers).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(data), { status: (init && init.status) || 200, headers });
}

export function fail(err) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : "서버 오류가 발생했습니다";
  return json({ ok: false, error: message, status }, { status });
}

export function html(body, status) {
  return new Response(body, {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, SEC),
  });
}

export function badRequest(msg) {
  return new HttpError(400, msg);
}
