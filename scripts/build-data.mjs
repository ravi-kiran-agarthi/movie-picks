import { writeFileSync, mkdirSync } from 'node:fs';

const TMDB = process.env.TMDB_API_KEY, OMDB = process.env.OMDB_API_KEY;
if (!TMDB || !OMDB) { console.log('Missing API keys; keeping existing public/data.json'); process.exit(0); }

const now = new Date();
const ym = now.toISOString().slice(0, 7);
const start = `${ym}-01`;
const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

const j = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u.replace(/api_key=\w+/, '') + ' ' + r.status); return r.json(); };
const q = (o) => new URLSearchParams({ api_key: TMDB, language: 'en-US', region: 'US', with_original_language: 'en', with_release_type: '2|3', ...o });

const genres = Object.fromEntries((await j(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB}`)).genres.map((g) => [g.id, g.name]));

async function discover(status, o) {
  const out = [];
  for (let p = 1; p <= 3; p++) {
    const d = await j('https://api.themoviedb.org/3/discover/movie?' + q({ ...o, page: p, sort_by: 'popularity.desc' }));
    out.push(...d.results.map((m) => ({ ...m, status })));
    if (p >= d.total_pages) break;
  }
  return out;
}

const today = now.toISOString().slice(0, 10);
const nowList = await discover('now', { 'primary_release_date.gte': new Date(now - 60 * 864e5).toISOString().slice(0, 10), 'primary_release_date.lte': today });
const soonList = await discover('soon', { 'primary_release_date.gte': today, 'primary_release_date.lte': end });
const seen = new Set();
const all = [...nowList, ...soonList].filter((m) => !seen.has(m.id) && seen.add(m.id));

const movies = [];
for (const m of all) {
  const ext = await j(`https://api.themoviedb.org/3/movie/${m.id}/external_ids?api_key=${TMDB}`);
  let imdb = null, rt = null;
  if (ext.imdb_id) {
    try {
      const o = await j(`https://www.omdbapi.com/?apikey=${OMDB}&i=${ext.imdb_id}`);
      if (o.imdbRating && o.imdbRating !== 'N/A') imdb = parseFloat(o.imdbRating);
      const r = (o.Ratings || []).find((x) => x.Source === 'Rotten Tomatoes');
      if (r) rt = parseInt(r.Value, 10);
    } catch {}
  }
  movies.push({
    title: m.title,
    year: (m.release_date || '').slice(0, 4),
    status: m.status,
    genres: m.genre_ids.map((i) => genres[i]).filter(Boolean),
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    imdb, rt, imdbId: ext.imdb_id || null,
  });
}
mkdirSync('public', { recursive: true });
writeFileSync('public/data.json', JSON.stringify({ month: ym, movies }));
console.log(`Wrote ${movies.length} movies`);
