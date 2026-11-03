const { redis, daysBack, dayOf, authed, merge, json } = require('./_lib');

module.exports = async (req, res) => {
  if (!authed(req)) return json(res, 401, { error: 'No autorizado' });
  const n = Math.max(1, Math.min(365, parseInt((req.query && req.query.days) || '30', 10) || 30));
  try {
    const cur = daysBack(n);
    const prevEnd = new Date(new Date(cur[0] + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
    const prev = daysBack(n, prevEnd);
    const today = dayOf(Date.now());
    const [curRaw, prevRaw, meta, tail] = await redis([
      ['MGET', ...cur.map(d => 'agg:' + d)],
      ['MGET', ...prev.map(d => 'agg:' + d)],
      ['GET', 'meta:last'],
      ['LRANGE', 'ev:' + today, -2000, -1]
    ]);
    const parse = a => (a || []).map(x => { try { return x ? JSON.parse(x) : null; } catch (e) { return null; } });
    const C = parse(curRaw), P = parse(prevRaw);
    const series = cur.map((d, i) => {
      const a = C[i];
      return { d, v: a ? a.v.length : 0, s: a ? a.s : 0, pv: a ? a.pv : 0, c: a ? a.conv.form + a.conv.wa + a.conv.tel + a.conv.mail : 0 };
    });
    const t5 = Date.now() - 5 * 60000, live = new Set();
    (tail || []).forEach(s => { try { const e = JSON.parse(s); if (e.t >= t5) live.add(e.sid); } catch (e) {} });
    const m = meta ? JSON.parse(meta) : null;
    json(res, 200, {
      at: m ? m.at : null, by: m ? m.by : null,
      range: { from: cur[0], to: cur[cur.length - 1], days: n },
      cur: merge(C), prev: merge(P), series, live: live.size
    });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
};
