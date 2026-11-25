export function createNewsService({ cache, getRange }) {
  const safeUrl = value => /^https?:\/\//i.test(value || '') ? value : '';
  const PROXY_BUILDERS=[
  feed=>'https://api.allorigins.win/raw?url='+encodeURIComponent(feed),
  feed=>'https://corsproxy.io/?url='+encodeURIComponent(feed),
  feed=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(feed),
  feed=>'https://cors.isomorphic-git.org/'+feed,
  feed=>'https://proxy.cors.dev/'+feed
];
// Paste your Cloudflare Worker URL here, e.g. 'https://news-proxy.yourname.workers.dev/'
const WORKER_URL='https://sparkling-glade-bb6d.webmiscuser.workers.dev/';
if(WORKER_URL)PROXY_BUILDERS.unshift(feed=>WORKER_URL+(WORKER_URL.includes('?')?'':'?')+'url='+encodeURIComponent(feed));
// Vercel serves this same-origin endpoint without browser CORS restrictions.
if(typeof window!=='undefined')PROXY_BUILDERS.unshift(feed=>'/api/news-feed?url='+encodeURIComponent(feed));
const DIRECT_TIMEOUT_MS=4000, PROXY_TIMEOUT_MS=9000, STAGGER_MS=600, MAX_FEEDS_TRIED=2;
const CACHE_TTL=10*60*1000, HISTORY_TTL=7*24*60*60*1000;

  async function timedFetch(url,timeoutMs){
  let timer;
  try{
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{reject(new Error('timed out after '+Math.round(timeoutMs/1000)+'s'))},timeoutMs);
    });
    const request=(async()=>{
      const response=await fetch(url,{credentials:'omit'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.text();
    })();
    request.catch(()=>{});
    return await Promise.race([request,timeout]);
  }finally{clearTimeout(timer)}
}
// Hedged race: direct request first, then each proxy starts STAGGER_MS later.
// The first one that returns a valid feed wins and the rest are aborted.
function fetchFirst(feed){
  const attempts=[{url:feed,timeout:DIRECT_TIMEOUT_MS},...PROXY_BUILDERS.map(b=>({url:b(feed),timeout:PROXY_TIMEOUT_MS}))];
  return new Promise((resolve,reject)=>{
    const timers=[];
    let pending=attempts.length,done=false;const errs=[];
    attempts.forEach((at,i)=>{
      timers.push(setTimeout(async()=>{
        if(done)return;
                try{
          const items=parseFeed(await timedFetch(at.url,at.timeout));
          if(!done){done=true;timers.forEach(clearTimeout);resolve(items)}
        }catch(e){let h='?';try{h=new URL(at.url).hostname.replace(/^(www|api)\./,'')}catch(_){}errs.push(h+': '+(e&&e.message?e.message:'network error'))}
        if(--pending===0&&!done)reject(new Error(errs.join(' | ')));
      },i*STAGGER_MS));
    });
  });
}
function parseFeed(xml){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  if(doc.querySelector('parsererror'))throw new Error('Not a valid RSS/Atom feed');
  // RSS/Atom can be valid even when there are no items for the current search.
  if(!doc.querySelector('item,entry')){
    if(doc.querySelector('rss,feed,rdf\\:RDF'))return [];
    throw new Error('Not a valid RSS/Atom feed');
  }
  const txt=(n,t)=>{const e=n.getElementsByTagName(t)[0];return e?e.textContent.trim():''};
  const plain=h=>{const d=new DOMParser().parseFromString(h||'','text/html');return(d.body.textContent||'').replace(/\s+/g,' ').trim()};
  return [...doc.querySelectorAll('item,entry')].map(n=>{
    let link=txt(n,'link');
    if(!link){const l=n.querySelector('link[href]');link=l?l.getAttribute('href'):''}
    const raw=txt(n,'description')||txt(n,'summary')||txt(n,'content');
    const enc=txt(n,'content:encoded');
    let img='';
    const m=n.getElementsByTagName('media:content')[0]||n.getElementsByTagName('media:thumbnail')[0];
    if(m)img=m.getAttribute('url')||'';
    if(!img){const en=n.getElementsByTagName('enclosure')[0];if(en&&/image/.test(en.getAttribute('type')||''))img=en.getAttribute('url')||''}
    if(!img){const g=(enc||raw).match(/<img[^>]+src=["']([^"']+)/i);if(g)img=g[1]}
    const dateFields=[...n.getElementsByTagName('*')].filter(e=>['pubdate','published','updated','date','created','issued'].includes((e.localName||e.nodeName.split(':').pop()).toLowerCase()));
    const ds=txt(n,'pubDate')||txt(n,'published')||txt(n,'updated')||txt(n,'dc:date')||dateFields[0]?.textContent?.trim()||'';
    const t=ds?Date.parse(ds):NaN;
    const rssCats=[...n.getElementsByTagNameNS('*','category'),...n.getElementsByTagNameNS('*','subject')]
      .map(c=>(c.getAttribute('term')||c.getAttribute('label')||c.textContent||'').trim()).filter(Boolean);
    return{title:plain(txt(n,'title')),link:safeUrl(link),summary:plain(raw).slice(0,220),img:safeUrl(img),
      date:isNaN(t)?null:t,rssCats:[...new Set(rssCats)]};
  }).filter(a=>a.title&&a.link);
}
async function loadSource(src,force){
  const range=getRange(),key='inh_c_'+src.id,c=cache.get(key,null),now=Date.now();
  if(!force&&c&&c.searchRange===range&&now-c.t<CACHE_TTL)return{items:c.items,cached:true};
  const errors=[],fresh=[];
  // For publisher feeds, Google News is added for wider history. Search-only sources
  // use it in Latest News too because they do not expose a usable RSS feed.
  const host=src.searchHost||(src.feeds[0]?new URL(src.feeds[0]).hostname.replace(/^(www|publish)\./,''):'');
  const days=range==='latest'?2:Math.max(1,Math.ceil(Number(range)/24));
  const gn='https://news.google.com/rss/search?q='+encodeURIComponent('site:'+host+' when:'+days+'d')+'&hl=en-IN&gl=IN&ceid=IN:en';
  const includeSearch=range!=='latest'||src.searchOnly;
  const publisherFeeds=src.searchOnly?[]:src.feeds.slice(0,MAX_FEEDS_TRIED);
  const jobs=[...publisherFeeds.map(feed=>fetchFirst(feed)),...(includeSearch?[fetchFirst(gn)]:[])];
  const results=await Promise.allSettled(jobs);
  results.forEach((result,i)=>{
    if(result.status!=='fulfilled'){
      errors.push((includeSearch&&i===jobs.length-1?'Google News':'Publisher RSS')+': '+(result.reason?.message||'request failed'));
      return;
    }
    const fromSearch=includeSearch&&i===jobs.length-1;
    result.value.forEach(a=>fresh.push(fromSearch?{...a,title:a.title.replace(/\s+-\s+[^-]+$/,''),summary:'',img:''}:a));
  });

  // Merge with the rolling seven-day cache so changing from 24/48 hours to a week
  // does not lose headlines that an earlier fetch already found.
  const prior=Array.isArray(c?.items)?c.items:[];
  const recent=[...prior,...fresh].filter(a=>a.date
    ? a.date<=now+60*60*1000&&now-a.date<=HISTORY_TTL
    : range==='latest');
  const seen=new Set(),items=[];
  for(const a of recent.sort((x,y)=>(y.date||0)-(x.date||0))){
    const title=(a.title||'').toLowerCase().replace(/\s+-\s+[^-]+$/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const identity=title.replace(/\s+/g,' ')||(a.link||'').split('?')[0].replace(/\/$/,'');
    if(!identity||seen.has(identity))continue;
    seen.add(identity);items.push(a);
  }
  if(items.length){
    cache.set(key,{t:now,searchRange:range,items});
    return{items};
  }
  if(prior.length)return{items:prior,stale:true,err:errors.join(' | ')};
  throw new Error(errors.join(' | ')||'No recent stories were returned. The publisher feed may be stale, or the search feed may have no matching articles in the selected date range.');
}

  return { loadSource };
}
