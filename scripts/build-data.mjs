import { writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const UA = { 'User-Agent': 'movie-picks/1.0 (github.com/ravi-kiran-agarthi/movie-picks)' };
const day = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const today = day(now);
const from = day(new Date(now - 30 * 864e5));
const to = day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)));

const rq = `SELECT ?l ?imdb ?rt ?wp (MIN(?d) AS ?date) (GROUP_CONCAT(DISTINCT ?gl;separator="|") AS ?g) WHERE {
 ?f wdt:P31 wd:Q11424; wdt:P364 wd:Q1860; wdt:P345 ?imdb; wdt:P577 ?d.
 FILTER(?d>="${from}"^^xsd:dateTime && ?d<"${to}"^^xsd:dateTime)
 OPTIONAL{?f wdt:P1258 ?rt}
 OPTIONAL{?f wdt:P136 ?ge. ?ge rdfs:label ?gl FILTER(lang(?gl)="en")}
 OPTIONAL{?wp schema:about ?f; schema:isPartOf <https://en.wikipedia.org/>}
 ?f rdfs:label ?l FILTER(lang(?l)="en")
} GROUP BY ?l ?imdb ?rt ?wp LIMIT 1000`;

const w = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query: rq }), { headers: { ...UA, Accept: 'application/json' } });
if (!w.ok) throw new Error('wikidata ' + w.status);
const rows = (await w.json()).results.bindings;

const ratings = new Map();
const gz = Buffer.from(await (await fetch('https://datasets.imdbws.com/title.ratings.tsv.gz', { headers: UA })).arrayBuffer());
for (const line of gunzipSync(gz).toString().split('\n')) {
  const [id, r] = line.split('\t');
  if (id?.startsWith('tt')) ratings.set(id, parseFloat(r));
}

const GENRES = [['Comedy', /comedy/], ['Drama', /drama/], ['Action', /action/], ['Animation', /animat/], ['Horror', /horror/], ['Thriller', /thriller|crime|mystery/], ['Sci-Fi', /science fiction|fantasy/], ['Romance', /romance/], ['Family', /family|children/], ['Adventure', /adventure/], ['Documentary', /documentary/], ['Biography', /biograph/], ['Musical', /music/]];
const genresOf = (s) => GENRES.filter(([, re]) => re.test(s.toLowerCase())).map(([n]) => n);

const byId = new Map();
for (const r of rows) {
  const id = r.imdb.value;
  if (byId.has(id)) continue;
  byId.set(id, {
    id, d: r.date.value.slice(0, 10), title: r.l.value,
    genres: genresOf(r.g.value),
    rtId: r.rt?.value || null,
    wp: r.wp ? decodeURIComponent(r.wp.value.split('/wiki/')[1]).replace(/_/g, ' ') : null,
  });
}

// Poster thumbnails from English Wikipedia page summaries
const posters = new Map();
const titles = [...byId.values()].map((m) => m.wp).filter(Boolean);
for (let i = 0; i < titles.length; i += 8) {
  await Promise.all(titles.slice(i, i + 8).map(async (t) => {
    try {
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')), { headers: UA });
      const src = (await r.json()).thumbnail?.source;
      if (src) posters.set(t, src.split('?')[0]);
    } catch {}
  }));
}

const movies = [...byId.values()].map((m) => ({
  title: m.title, year: m.d.slice(0, 4), status: m.d <= today ? 'now' : 'soon', genres: m.genres,
  poster: posters.get(m.wp) || null, imdb: ratings.get(m.id) ?? null, rt: null, imdbId: m.id, rtId: m.rtId,
}));

mkdirSync('public', { recursive: true });
writeFileSync('public/data.json', JSON.stringify({ month: day(now).slice(0, 7), movies }));
console.log(`Wrote ${movies.length} movies, ${movies.filter((m) => m.poster).length} posters, ${movies.filter((m) => m.imdb).length} rated`);
