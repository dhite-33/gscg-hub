// Serves photos and videos from R2 to signed-in team members, with range support so videos can seek.
import { whoIs } from "../api/[[path]].js";

export async function onRequestGet({ request, env, params }) {
  if (!whoIs(request, env)) return new Response("Not on the GSCG Hub access list.", { status: 403 });
  const id = String(params.id || "");
  if (!/^[\w-]{8,64}$/.test(id)) return new Response("Not found", { status: 404 });
  const hasRange = request.headers.has("range");
  const obj = await env.FILES.get(id, hasRange ? { range: request.headers } : {});
  if (!obj) return new Response("Not found", { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, max-age=86400");
  if (hasRange && obj.range && obj.body) {
    const r = obj.range;
    const start = r.offset !== undefined ? r.offset : obj.size - r.suffix;
    const len = r.length !== undefined ? r.length : obj.size - start;
    h.set("content-range", `bytes ${start}-${start + len - 1}/${obj.size}`);
    h.set("content-length", String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set("content-length", String(obj.size));
  return new Response(obj.body, { headers: h });
}
