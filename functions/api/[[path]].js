// GSCG Hub API. Everything here sits behind Cloudflare Access (email + one-time code),
// and every request is checked again against ALLOWED_EMAILS before anything is read or written.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const list = (v) => String(v || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);

export function whoIs(request, env) {
  const email = (request.headers.get("cf-access-authenticated-user-email") || "").toLowerCase().trim();
  if (!email) return null;
  return list(env.ALLOWED_EMAILS).includes(email) ? email : null;
}

export async function onRequest({ request, env, params }) {
  const email = whoIs(request, env);
  if (!email) return J({ error: "This email is not on the GSCG Hub access list." }, 403);
  const p = params.path || [];
  const m = request.method;

  if (p[0] === "me") {
    let people = {};
    try { people = JSON.parse(env.PEOPLE || "{}"); } catch (e) {}
    const x = people[email] || {};
    return J({ email, name: x.name || "", role: x.role || "", admin: list(env.ADMIN_EMAILS).includes(email) });
  }

  if (p[0] === "all" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT col, id, data, updated FROM docs").all();
    const data = {}; let mx = 0;
    for (const r of results) {
      let d; try { d = JSON.parse(r.data); } catch (e) { continue; }
      (data[r.col] = data[r.col] || []).push({ id: r.id, data: d });
      if (r.updated > mx) mx = r.updated;
    }
    return J({ sig: mx + ":" + results.length, data });
  }

  if (p[0] === "db" && p.length === 3) {
    const col = p[1], id = p[2];
    if (!/^[\w.-]{1,60}$/.test(col) || !/^[\w.:@+~-]{1,200}$/.test(id)) return J({ error: "Bad id" }, 400);
    if (m === "PUT") {
      const body = await request.text();
      if (body.length > 900000) return J({ error: "Too big" }, 413);
      try { JSON.parse(body); } catch (e) { return J({ error: "Not JSON" }, 400); }
      await env.DB.prepare("INSERT INTO docs (col, id, data, updated, by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, by = excluded.by")
        .bind(col, id, body, Date.now(), email).run();
      return J({ ok: true });
    }
    if (m === "DELETE") {
      await env.DB.prepare("DELETE FROM docs WHERE col = ? AND id = ?").bind(col, id).run();
      return J({ ok: true });
    }
  }

  if (p[0] === "files") {
    if (m === "POST" && p.length === 1) {
      const type = request.headers.get("content-type") || "application/octet-stream";
      if (!/^(image|video|audio)\/|^application\/pdf$/.test(type)) return J({ error: "Only images, videos, audio and PDFs" }, 415);
      const id = crypto.randomUUID().replace(/-/g, "");
      await env.FILES.put(id, request.body, { httpMetadata: { contentType: type }, customMetadata: { by: email } });
      return J({ id, url: "/_blob/" + id, contentType: type });
    }
    if (m === "DELETE" && p.length === 2) {
      if (!/^[\w-]{8,64}$/.test(p[1])) return J({ error: "Bad id" }, 400);
      await env.FILES.delete(p[1]);
      return J({ ok: true });
    }
  }

  if (p[0] === "import" && m === "POST") {
    if (!list(env.ADMIN_EMAILS).includes(email)) return J({ error: "Admins only" }, 403);
    const { docs } = await request.json();
    if (!Array.isArray(docs)) return J({ error: "Expected { docs: [...] }" }, 400);
    const stmt = env.DB.prepare("INSERT INTO docs (col, id, data, updated, by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, by = excluded.by");
    const now = Date.now();
    for (let i = 0; i < docs.length; i += 50) {
      await env.DB.batch(docs.slice(i, i + 50).map((d) => stmt.bind(String(d.col), String(d.id), JSON.stringify(d.data), now, email)));
    }
    return J({ ok: true, imported: docs.length });
  }

  return J({ error: "Not found" }, 404);
}
