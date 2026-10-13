let appPromise;
export default async function handler(req, res) {
  try {
    if (!appPromise) appPromise = import('./_lib/server.mjs').then((m) => m.default);
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    appPromise = undefined;
    console.error('Boot error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'boot', message: String(err && err.stack || err) }));
  }
}
