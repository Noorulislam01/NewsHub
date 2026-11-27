const SOURCE_TIMEOUT_MS = 12_000;

function json(body, status = 200, forceRefresh = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': forceRefresh ? 'no-store' : 's-maxage=300, stale-while-revalidate=600'
    }
  });
}

function decodeXml(value = '') {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlText(source, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

const ARXIV_CATEGORIES = {
  physics: ['astro-ph.*', 'cond-mat.*', 'gr-qc', 'hep-ex', 'hep-ph', 'hep-th', 'nucl-ex', 'nucl-th', 'physics.*', 'quant-ph'],
  biology: ['q-bio.*']
};

function arxivQuery(category, query) {
  const categories = category === 'all'
    ? [...ARXIV_CATEGORIES.physics, 'cs.AI', 'cs.LG', 'cs.CV', 'q-bio.*']
    : ARXIV_CATEGORIES[category] || ARXIV_CATEGORIES.physics;
  const categoryQuery = categories.map(value => `cat:${value}`).join(' OR ');
  return query ? `(${categoryQuery}) AND all:${query}` : categoryQuery;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/atom+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function normalizeOpenAlex(work) {
  const authors = (work.authorships || []).map(item => item.author?.display_name).filter(Boolean);
  const oaLocation = work.best_oa_location || work.primary_location || {};
  const source = oaLocation.source?.display_name || 'OpenAlex';
  const landingUrl = oaLocation.landing_page_url || work.doi || work.id;
  const abstractIndex = work.abstract_inverted_index;
  let abstract = '';
  if (abstractIndex && typeof abstractIndex === 'object') {
    const words = [];
    for (const [word, positions] of Object.entries(abstractIndex)) {
      for (const position of positions) words[position] = word;
    }
    abstract = words.filter(Boolean).join(' ');
  }
  return {
    id: work.doi || work.id,
    title: work.title || 'Untitled paper',
    authors,
    date: work.publication_date || '',
    abstract,
    source,
    recordType: 'Research article',
    categories: (work.concepts || []).slice(0, 3).map(item => item.display_name),
    doi: work.doi || '',
    url: landingUrl,
    pdfUrl: oaLocation.pdf_url || '',
    openAccess: Boolean(work.open_access?.is_oa)
  };
}

function parseArxiv(xml) {
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(([, entry]) => {
    const id = xmlText(entry, 'id');
    const authors = [...entry.matchAll(/<author\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)]
      .map(([, name]) => decodeXml(name));
    const categories = [...entry.matchAll(/<category\b[^>]*term="([^"]+)"[^>]*\/?\s*>/gi)].map(([, category]) => category);
    return {
      id,
      title: xmlText(entry, 'title') || 'Untitled paper',
      authors,
      date: xmlText(entry, 'published').slice(0, 10),
      abstract: xmlText(entry, 'summary'),
      source: 'arXiv',
      recordType: 'Preprint',
      categories,
      doi: '',
      url: id.replace('http://', 'https://'),
      pdfUrl: id.replace('/abs/', '/pdf/') + '.pdf',
      openAccess: true
    };
  });
}

function normalizeEuropePmc(record) {
  const fullTextUrl = record.fullTextUrlList?.fullTextUrl || [];
  const pdfUrl = fullTextUrl.find(item => item.documentStyle === 'pdf')?.url || '';
  const articleUrl = record.pmid
    ? `https://pubmed.ncbi.nlm.nih.gov/${record.pmid}/`
    : record.doi ? `https://doi.org/${record.doi}` : `https://europepmc.org/article/${record.source}/${record.id}`;
  return {
    id: record.doi || `${record.source}:${record.id}`,
    title: record.title || 'Untitled paper',
    authors: (record.authorList?.author || []).slice(0, 8).map(author => author.fullName || author.lastName).filter(Boolean),
    date: record.firstPublicationDate || record.pubYear || '',
    abstract: record.abstractText || '',
    source: record.journalTitle || 'Europe PMC',
    recordType: 'Research article',
    categories: record.meshHeadingList?.meshHeading?.slice(0, 3).map(item => item.descriptorName) || [],
    doi: record.doi || '',
    url: articleUrl,
    pdfUrl,
    openAccess: record.isOpenAccess === 'Y'
  };
}

async function fromOpenAlex(category, query, limit, signal) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', 'open_access.is_oa:true,language:en');
  url.searchParams.set('sort', 'publication_date:desc');
  url.searchParams.set('per_page', String(limit));
  url.searchParams.set('select', 'id,doi,title,publication_date,authorships,primary_location,best_oa_location,open_access,abstract_inverted_index,concepts');
  const subjectSearch = {
    health: 'clinical medicine public health epidemiology disease therapy',
    physics: 'physics quantum astronomy particle astrophysics',
    biology: 'biology ecology genetics biodiversity organism'
  };
  const search = query || subjectSearch[category];
  if (search) url.searchParams.set('search', search);
  const result = await fetchJson(url, signal);
  return result.results.map(normalizeOpenAlex);
}

async function fromArxiv(category, query, limit, signal) {
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('search_query', arxivQuery(category, query));
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', String(limit));
  url.searchParams.set('sortBy', 'submittedDate');
  url.searchParams.set('sortOrder', 'descending');
  return parseArxiv(await fetchText(url, signal));
}

async function fromEuropePmc(category, query, limit, signal) {
  if (category === 'physics') return [];
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  const subjectScope = {
    health: 'TITLE_ABS:(health OR medicine OR medical OR clinical OR patient OR disease OR therapy OR epidemiology)',
    biology: 'TITLE_ABS:(biology OR biological OR ecology OR genetics OR biodiversity OR organism OR evolution)'
  }[category];
  const terms = [subjectScope, query ? `(${query})` : '', 'OPEN_ACCESS:Y', 'LANG:eng', 'sort_date:y'].filter(Boolean);
  url.searchParams.set('query', terms.join(' AND '));
  url.searchParams.set('format', 'json');
  url.searchParams.set('resultType', 'core');
  url.searchParams.set('pageSize', String(limit));
  const result = await fetchJson(url, signal);
  return (result.resultList?.result || []).map(normalizeEuropePmc);
}

async function fromBiorxiv(server, query, limit, signal) {
  const url = `https://api.biorxiv.org/details/${server}/30d/0/json`;
  const result = await fetchJson(url, signal);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (result.collection || [])
    .filter(item => !terms.length || terms.some(term => `${item.title} ${item.abstract} ${item.category}`.toLowerCase().includes(term)))
    .slice(0, limit)
    .map(item => ({
      id: item.doi,
      title: item.title || 'Untitled preprint',
      authors: (item.authors || '').split(';').map(name => name.trim()).filter(Boolean).slice(0, 8),
      date: item.date || '',
      abstract: item.abstract || '',
      source: server === 'medrxiv' ? 'medRxiv' : 'bioRxiv',
      recordType: 'Preprint',
      categories: item.category ? [item.category] : [],
      doi: item.doi || '',
      url: item.doi ? `https://doi.org/${item.doi}` : 'https://www.biorxiv.org/',
      pdfUrl: item.doi ? `https://www.${server}.org/content/${item.doi}v${item.version}.full.pdf` : '',
      openAccess: true
    }));
}

function dedupe(papers) {
  const seen = new Set();
  return papers.filter(paper => {
    const key = (paper.doi || paper.id || paper.url).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const params = new URL(request.url).searchParams;
    const forceRefresh = params.get('refresh') === '1';
    const query = (params.get('q') || '').trim().slice(0, 180);
    const category = params.get('category') || 'all';
    const limit = Math.max(5, Math.min(30, Number(params.get('limit')) || 20));
    if (!['all', 'health', 'physics', 'biology'].includes(category)) return json({ error: 'Unknown research subject' }, 400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    try {
      const jobs = [
        ['OpenAlex', () => fromOpenAlex(category, query, limit, controller.signal)],
        ...(category !== 'health' ? [['arXiv', () => fromArxiv(category, query, limit, controller.signal)]] : []),
        ...(category !== 'physics' ? [['Europe PMC', () => fromEuropePmc(category, query, limit, controller.signal)]] : [])
      ];
      if (category === 'health' || category === 'all') jobs.push(['medRxiv', () => fromBiorxiv('medrxiv', query, limit, controller.signal)]);
      if (category === 'biology' || category === 'all') jobs.push(['bioRxiv', () => fromBiorxiv('biorxiv', query, limit, controller.signal)]);

      const settled = await Promise.allSettled(jobs.map(([, fetchItems]) => fetchItems()));
      const papers = [];
      const unavailable = [];
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') papers.push(...result.value);
        else {
          unavailable.push(jobs[index][0]);
          console.warn(`Research source ${jobs[index][0]} failed:`, result.reason?.message || result.reason);
        }
      });
      if (!papers.length && unavailable.length === jobs.length) {
        return json({ error: 'Research sources are temporarily unavailable. Please try again.', unavailable }, 502, forceRefresh);
      }
      return json({ papers: dedupe(papers).slice(0, limit * 2), unavailable }, 200, forceRefresh);
    } finally {
      clearTimeout(timeout);
    }
  }
};
