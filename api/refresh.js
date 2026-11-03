const { redis, daysBack, authed, aggregate, readDay, json, DAY_TTL } = require('./_lib');

module.exports = async (req, res) => {
  const by = authed(req);
  if (!by) return json(res, 401, { error: 'No autorizado' });
  const n = Math.max(1, Math.min(400, parseInt((req.query && req.query.days) || '3', 10) || 3));
  try {
    const days = daysBack(n);
    for (const d of days) {
      const agg = aggregate(d, await readDay(d));
      await redis([['SET', 'agg:' + d, JSON.stringify(agg), 'EX', DAY_TTL]]);
    }
    const at = new Date().toISOString();
    await redis([['SET', 'meta:last', JSON.stringify({ at, by, days: n })]]);
    json(res, 200, { ok: true, at, by, days });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
};
