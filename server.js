const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const publicDir = path.join(root, 'public');
const baseHeritage = JSON.parse(fs.readFileSync(path.join(root, 'data', 'heritage.json'), 'utf8'));
const expandedHeritage = JSON.parse(fs.readFileSync(path.join(root, 'data', 'expanded-heritage.json'), 'utf8'));
const heritage = [...baseHeritage, ...expandedHeritage];
const imageCache = new Map();
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function matches(entry, query) {
  const terms = [entry.name, entry.category, entry.kind, entry.district, entry.summary, ...entry.tags].join(' ').toLowerCase();
  if (!query) return true;
  const wholeQuery = query.toLowerCase();
  if (terms.includes(wholeQuery)) return true;
  const ignored = new Set(['a', 'an', 'the', 'near', 'in', 'at', 'of', 'and', 'to']);
  const words = wholeQuery.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word && !ignored.has(word));
  return words.length > 0 && words.every((word) => terms.includes(word));
}

async function withImage(entry) {
  if (entry.image || !entry.wiki) return entry;
  if (!imageCache.has(entry.wiki)) {
    imageCache.set(entry.wiki, fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entry.wiki)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((page) => page && page.thumbnail ? page.thumbnail.source : null)
      .catch(() => null));
  }
  const image = await imageCache.get(entry.wiki);
  // A missing remote thumbnail should never silently become an unrelated fort photo.
  return { ...entry, image: image || '' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/heritage') {
    const q = (url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || '').trim().toLowerCase();
    const featured = url.searchParams.get('featured');
    const results = heritage.filter((entry) =>
      matches(entry, q) &&
      (!category || entry.category.toLowerCase() === category) &&
      (featured !== 'true' || entry.featured)
    );
    return sendJson(res, 200, { scope: 'Maharashtra', total: results.length, results: await Promise.all(results.map(withImage)) });
  }
  if (url.pathname.startsWith('/api/heritage/')) {
    const slug = decodeURIComponent(url.pathname.slice('/api/heritage/'.length));
    const entry = heritage.find((item) => item.slug === slug);
    return entry ? sendJson(res, 200, await withImage(entry)) : sendJson(res, 404, { error: 'Heritage record not found.' });
  }
  if (url.pathname === '/api/stats') {
    const categories = [...new Set(heritage.map((entry) => entry.category))];
    return sendJson(res, 200, { scope: 'Maharashtra only', records: heritage.length, categories: categories.length, districts: new Set(heritage.map((entry) => entry.district)).size });
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = path.normalize(path.join(publicDir, requested));
  if (!target.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(target, (error, data) => {
    if (error) return sendJson(res, error.code === 'ENOENT' ? 404 : 500, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Parampara is listening at http://localhost:${port}`));
