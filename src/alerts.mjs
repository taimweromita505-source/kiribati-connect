import { sendMail } from './auth.mjs';

export async function handleAlerts(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/alerts/subscribe' && request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const island = typeof data?.island === 'string' && data.island.length <= 100 ? data.island : 'All islands';
    const boats = data?.boats === false ? 0 : 1;
    const jobs = data?.jobs === false ? 0 : 1;
    const digest = data?.digest === false ? 0 : 1;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO email_alerts (id, email, island, boats, jobs, digest, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET island=excluded.island, boats=excluded.boats, jobs=excluded.jobs, digest=excluded.digest
    `).bind(id, email, island, boats, jobs, digest, now).run();

    if (env.RESEND_API_KEY) {
      try {
        await (env.sendMail || sendMail)(env, email, 'Kiribati Connect Alerts Confirmed',
          `Mauri!\n\nYou are now subscribed to island alerts on Kiribati Connect for ${island}.\n\n` +
          `Preferences:\n` +
          `• Boat departures: ${boats ? 'Yes' : 'No'}\n` +
          `• Job vacancies: ${jobs ? 'Yes' : 'No'}\n` +
          `• Weekly Island Digest: ${digest ? 'Yes' : 'No'}\n\n` +
          `Visit: https://kiribaticonnect.app\n` +
          `To unsubscribe: https://kiribaticonnect.app/api/alerts/unsubscribe?email=${encodeURIComponent(email)}`
        );
      } catch (err) {
        console.error(JSON.stringify({ event: 'alert_confirm_email_failed', message: err.message }));
      }
    }
    return Response.json({ ok: true, message: 'Subscribed to alerts successfully.' });
  }

  if (path === '/api/alerts/unsubscribe') {
    const email = url.searchParams.get('email')?.trim().toLowerCase();
    if (email) {
      await env.DB.prepare('DELETE FROM email_alerts WHERE email=?').bind(email).run();
    }
    if (request.method === 'GET') {
      return new Response('<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed · Kiribati Connect</title><style>body{font-family:sans-serif;padding:40px;text-align:center;color:#163f3a;background:#f7f7ef}a{color:#08665d}</style></head><body><h1>Unsubscribed</h1><p>You have been unsubscribed from Kiribati Connect email alerts.</p><p><a href="https://kiribaticonnect.app">Return to Kiribati Connect</a></p></body></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    return Response.json({ ok: true, message: 'Unsubscribed.' });
  }

  return Response.json({ error: 'Not found.' }, { status: 404 });
}

export async function sendWeeklyDigests(env) {
  if (!env.DB || !env.RESEND_API_KEY) return;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  
  const subscribers = await env.DB.prepare(`
    SELECT email, island, boats, jobs FROM email_alerts
    WHERE digest = 1 AND (last_sent_at IS NULL OR last_sent_at < ?)
    LIMIT 10
  `).bind(weekAgo).all();

  if (!subscribers.results || !subscribers.results.length) return;

  const recent = await env.DB.prepare(`
    SELECT title, category, island, employer, details_json, created_at
    FROM notices
    WHERE status = 'approved' AND created_at >= ?
    ORDER BY created_at DESC LIMIT 20
  `).bind(weekAgo).all();

  const items = recent.results || [];
  if (!items.length) return;

  for (const sub of subscribers.results) {
    const subItems = items.filter(it => sub.island === 'All islands' || it.island === sub.island || it.island === 'South Tarawa');
    if (!subItems.length) continue;

    let body = `Mauri!\n\nHere is your Kiribati Connect weekly digest for ${sub.island}:\n\n`;
    for (const item of subItems.slice(0, 8)) {
      body += `• [${item.category.toUpperCase()}] ${item.title} (${item.island})\n`;
      if (item.employer) body += `  By: ${item.employer}\n`;
    }
    body += `\nExplore all listings & lagoon weather at: https://kiribaticonnect.app\n\n`;
    body += `To manage or unsubscribe: https://kiribaticonnect.app/api/alerts/unsubscribe?email=${encodeURIComponent(sub.email)}\n`;

    try {
      await (env.sendMail || sendMail)(env, sub.email, `Kiribati Connect Weekly Digest · ${sub.island}`, body);
      await env.DB.prepare('UPDATE email_alerts SET last_sent_at=? WHERE email=?').bind(now.toISOString(), sub.email).run();
    } catch (e) {
      console.error(JSON.stringify({ event: 'digest_send_failed', email: sub.email, error: e.message }));
    }
  }
}
