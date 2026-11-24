import { CATEGORIES, RULES, NATIONAL } from './newsSources.js';

export function classifyArticle(a){
  const labels=Array.isArray(a.rssCats)?a.rssCats:(a.rssCats?[String(a.rssCats)]:[]);
  const normalize=s=>String(s).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const normalizedLabels=labels.map(normalize).filter(Boolean);
  const publisherText=labels.join(' '),publisherHits=[];
  const aliases={
    'National':['india','indian','domestic','nation'],
    'International':['world','global','foreign affairs','overseas'],
    'Politics':['political'],
    'Opinion':['editorial','op-ed','op ed','commentary','column','columns','viewpoint','perspective'],
    'Explained':['explainer','explainers'],
    'Business':['business news','finance','financial'],
    'Economy':['economic','economics'],
    'Technology':['tech','gadgets'],
    'Artificial Intelligence':['ai','machine learning'],
    'Science':['scientific'],
    'Education':['educational'],
    'Sports':['sport'],
    'Entertainment':['movies','film','television','tv'],
    'Health':['healthcare','medicine'],
    'Lifestyle':['life style','fashion','travel'],
    'Environment':['climate','weather','nature'],
    'Crime':['law enforcement'],
    'Government & Policies':['government','policy','policies'],
    'Startups':['startup','entrepreneurship'],
    'Automobile':['automobile','automotive','cars','motoring'],
    'Agriculture':['farming','farm']
  };
  for(const category of CATEGORIES){
    if(category==='All News')continue;
    const names=[category,...(aliases[category]||[])].map(normalize);
    if(normalizedLabels.some(label=>names.includes(label)))publisherHits.push(category);
  }
  // Handle descriptive publisher labels such as "AI & Technology" or "World Politics".
  if(publisherText){
    for(const[k,r]of Object.entries(RULES))if(r.test(publisherText)&&!publisherHits.includes(k))publisherHits.push(k);
    if(/\b(national|india|indian|domestic)\b/i.test(publisherText)&&!publisherHits.includes('National'))publisherHits.push('National');
  }
  const hits=publisherHits.length?publisherHits:[];
  const hay=(a.title||'')+' '+(a.summary||'');
  if(!hits.length){
    for(const[k,r]of Object.entries(RULES))if(r.test(hay))hits.push(k);
    if(!hits.length&&NATIONAL.test(a.title||''))hits.push('National');
  }
  if(hits.includes('Cricket')&&!hits.includes('Sports'))hits.push('Sports');
  if(hits.includes('Bollywood')&&!hits.includes('Entertainment'))hits.push('Entertainment');
  return hits.length?hits:['General'];
}
