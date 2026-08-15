import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT,"public","data","business-network","businesses.json");
const CACHE_DIR = path.join(ROOT,".cache","fsq-agriculture");
const TOKEN = process.env.FSQ_PLACES_TOKEN || process.env.FSQ_PLACES_API_KEY || "";
const MAX_NEW_CALLS = Math.max(1, Number.parseInt(process.env.FSQ_MAX_API_CALLS || "470",10) || 470);
const TARGET_NEW = Math.max(100, Number.parseInt(process.env.FSQ_TARGET_NEW || "1500",10) || 1500);
const RESULT_LIMIT = Math.max(1, Math.min(50, Number.parseInt(process.env.FSQ_RESULTS_PER_CALL || "50",10) || 50));
const REQUEST_DELAY_MS = Math.max(50, Number.parseInt(process.env.FSQ_DELAY_MS || "220",10) || 220);
const API = "https://places-api.foursquare.com/places/search";

const HUBS = [
  "Chicago, IL, USA","Houston, TX, USA","Los Angeles, CA, USA","Toronto, Canada","Mexico City, Mexico",
  "Sao Paulo, Brazil","Buenos Aires, Argentina","Santiago, Chile","Lima, Peru","Rotterdam, Netherlands",
  "London, United Kingdom","Paris, France","Hamburg, Germany","Madrid, Spain","Istanbul, Turkiye",
  "Cairo, Egypt","Casablanca, Morocco","Lagos, Nigeria","Accra, Ghana","Nairobi, Kenya",
  "Addis Ababa, Ethiopia","Johannesburg, South Africa","Dubai, United Arab Emirates","Karachi, Pakistan",
  "Lahore, Pakistan","Mumbai, India","Delhi, India","Dhaka, Bangladesh","Bangkok, Thailand",
  "Ho Chi Minh City, Vietnam","Jakarta, Indonesia","Singapore","Shanghai, China","Tokyo, Japan"
];

const PROFILES = [
  {query:"grain supplier",roles:["supplier","trader"],groups:["grains"],items:[]},
  {query:"wheat supplier",roles:["supplier","trader"],groups:["grains"],items:["wheat"]},
  {query:"rice mill",roles:["processor","supplier","milling"],groups:["grains"],items:["rice"]},
  {query:"flour mill",roles:["processor","supplier","milling"],groups:["grains"],items:["wheat"]},
  {query:"fruit wholesaler",roles:["supplier","wholesaler","distributor"],groups:["fruit"],items:[]},
  {query:"vegetable wholesaler",roles:["supplier","wholesaler","distributor"],groups:["vegetables"],items:[]},
  {query:"coffee exporter",roles:["supplier","exporter","trader"],groups:["beverages"],items:["coffee"]},
  {query:"cocoa supplier",roles:["supplier","trader","processor"],groups:["cocoa"],items:["cocoa"]},
  {query:"cotton supplier",roles:["supplier","trader","exporter"],groups:["fibre"],items:["cotton-lint-ginned","seed-cotton-unginned"]},
  {query:"sugar supplier",roles:["supplier","trader","processor"],groups:["sugar"],items:["sugar-cane","sugar-beet"]},
  {query:"soybean supplier",roles:["supplier","trader","processor"],groups:["oilseeds"],items:["soybeans"]},
  {query:"fertilizer supplier",roles:["agri-inputs","fertilizer supplier"],groups:["agriculture"],items:[]},
  {query:"seed supplier agriculture",roles:["agri-inputs","seed supplier"],groups:["agriculture"],items:[]},
  {query:"cold storage food agriculture",roles:["cold chain","warehousing","logistics"],groups:["agriculture"],items:[]}
];

const CONSUMER_RE = /\\b(restaurant|cafe|coffee shop|bakery|bar|pub|hotel|nightclub|supermarket|grocery store|convenience store|shopping mall|fast food|dessert shop|ice cream shop)\\b/i;
const B2B_RE = /\\b(supplier|wholesale|wholesaler|export|exporter|import|importer|mill|milling|processor|processing|manufacturer|distributor|distribution|warehouse|warehousing|storage|fertilizer|seed|grain|cotton|cocoa|agriculture|agricultural|logistics|cold chain)\\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v) => String(v ?? "").trim();
const normalize = (v) => clean(v).toLowerCase();
const uniq = (values) => [...new Set(values.map(clean).filter(Boolean))];
const asNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const sha1 = (v) => crypto.createHash("sha1").update(v).digest("hex");

function safeWebsite(value){
  const raw=clean(value); if(!raw) return "";
  try { const u=new URL(raw); return (u.protocol==="http:"||u.protocol==="https:") ? u.toString() : ""; } catch { return ""; }
}
function websiteHost(value){ const w=safeWebsite(value); if(!w) return ""; try{return new URL(w).hostname.toLowerCase().replace(/^www\\./,"");}catch{return "";} }
function countryName(value){ const raw=clean(value); if(!raw) return ""; if(/^[A-Za-z]{2}$/.test(raw)){ try{return new Intl.DisplayNames(["en"],{type:"region"}).of(raw.toUpperCase())||raw.toUpperCase();}catch{return raw.toUpperCase();}} return raw; }
function categoryLabels(place){
  if(Array.isArray(place?.fsq_category_labels)) return place.fsq_category_labels.map(clean).filter(Boolean);
  if(Array.isArray(place?.categories)) return place.categories.map(c=>clean(c?.name??c?.label??c?.short_name)).filter(Boolean);
  return [];
}
function latLng(place){
  const lat=asNumber(place?.latitude)??asNumber(place?.geocodes?.main?.latitude)??asNumber(place?.location?.latitude);
  const lng=asNumber(place?.longitude)??asNumber(place?.geocodes?.main?.longitude)??asNumber(place?.location?.longitude);
  if(lat==null||lng==null||lat<-90||lat>90||lng<-180||lng>180) return null;
  return {lat,lng};
}
function locality(place,fallback){ return clean(place?.locality)||clean(place?.location?.locality)||clean(place?.location?.city)||clean(place?.city)||fallback.split(",")[0].trim(); }
function regionValue(place){ return clean(place?.region)||clean(place?.location?.region)||clean(place?.location?.state)||clean(place?.state); }
function countryValue(place){ return clean(place?.country)||clean(place?.location?.country)||clean(place?.location?.country_code)||clean(place?.country_code); }
function fsqId(place){ return clean(place?.fsq_place_id??place?.fsq_id??place?.id); }
function resultList(payload){ if(Array.isArray(payload?.results)) return payload.results; if(Array.isArray(payload?.places)) return payload.places; if(Array.isArray(payload)) return payload; return []; }
function rejectConsumerVenue(name,categories,profile){ const text=[name,categories.join(" "),profile.query].join(" "); return CONSUMER_RE.test(text)&&!B2B_RE.test([name,categories.join(" ")].join(" ")); }

function inferRoles(name,categories,profile){
  const text=normalize([name,categories.join(" "),profile.query].join(" ")); const roles=[...profile.roles];
  const rules=[["exporter",/\\bexport/],["importer",/\\bimport/],["trader",/\\btrading|\\btrader|\\bmerchant/],["processor",/\\bprocess|\\bmanufacturer|\\bmill\\b|\\bmilling/],["distributor",/\\bdistribut/],["wholesaler",/\\bwholesale/],["logistics",/\\blogistic|\\bfreight|\\bshipping/],["warehousing",/\\bwarehouse|\\bstorage/],["producer",/\\bproducer|\\bgrower|\\bfarm\\b/],["agri-inputs",/\\bfertilizer|\\bfertiliser|\\bseed\\b|\\bcrop protection/]];
  for(const [role,re] of rules) if(re.test(text)) roles.push(role); return uniq(roles);
}
function itemKeysFromText(name,categories,profile){
  const text=normalize([name,categories.join(" "),profile.query].join(" ")); const items=[...profile.items];
  const rules=[["wheat",/\\bwheat\\b|\\bflour mill/],["rice",/\\brice\\b|\\brice mill/],["maize",/\\bmaize\\b|\\bcorn\\b/],["barley",/\\bbarley\\b/],["soybeans",/\\bsoybean|\\bsoya\\b/],["coffee",/\\bcoffee\\b/],["cocoa",/\\bcocoa\\b|\\bcacao\\b/],["tea",/\\btea\\b/],["potatoes",/\\bpotato/],["bananas",/\\bbanana/],["avocados",/\\bavocado/],["sugar-cane",/\\bsugar cane|\\bsugarcane/],["sugar-beet",/\\bsugar beet/],["cotton-lint-ginned",/\\bcotton\\b/],["seed-cotton-unginned",/\\bcotton\\b/]];
  for(const [item,re] of rules) if(re.test(text)) items.push(item); return uniq(items);
}
function groupKeysFromText(name,categories,profile){
  const text=normalize([name,categories.join(" "),profile.query].join(" ")); const groups=[...profile.groups];
  const rules=[["grains",/\\bgrain|\\bwheat|\\brice|\\bmaize|\\bcorn|\\bbarley|\\bflour/],["fruit",/\\bfruit|\\bbanana|\\bavocado|\\bmango|\\bcitrus|\\bapple|\\bgrape|\\bberry/],["vegetables",/\\bvegetable|\\bpotato|\\btomato|\\bonion|\\bcarrot/],["beverages",/\\bcoffee|\\btea\\b/],["cocoa",/\\bcocoa|\\bcacao/],["fibre",/\\bcotton|\\bfibre|\\bfiber/],["sugar",/\\bsugar/],["oilseeds",/\\bsoybean|\\bsoya|\\boilseed|\\bpalm oil|\\bsunflower|\\bcanola/],["pulses",/\\bpulse|\\blentil|\\bchickpea|\\bbean\\b/],["nuts",/\\bnut\\b|\\bnuts\\b|\\balmond|\\bcashew|\\bpistachio/],["spices",/\\bspice|\\bpepper|\\bginger|\\bturmeric|\\bcinnamon/]];
  for(const [group,re] of rules) if(re.test(text)) groups.push(group); if(!groups.length) groups.push("agriculture"); return uniq(groups);
}
function mergeArrays(a,b){ return uniq([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]); }
function mergeClassification(target,incoming){ target.roles=mergeArrays(target.roles,incoming.roles); target.commerceGroups=mergeArrays(target.commerceGroups,incoming.commerceGroups); target.itemKeys=mergeArrays(target.itemKeys,incoming.itemKeys); return target; }
function businessKey(name,city,country){ return [normalize(name),normalize(city),normalize(country)].join("|"); }
const readJson = async (file) => JSON.parse(await fs.readFile(file,"utf8"));
const writeJson = async (file,value) => fs.writeFile(file,JSON.stringify(value,null,2),"utf8");

let newApiCalls=0, cacheHits=0, apiErrors=0;
async function fetchSearch(near,profile){
  const cacheFile=path.join(CACHE_DIR,`${sha1(`${near}|${profile.query}|${RESULT_LIMIT}`)}.json`);
  try { const cached=await readJson(cacheFile); cacheHits+=1; return cached; } catch {}
  if(newApiCalls>=MAX_NEW_CALLS) return null;
  const url=new URL(API); url.searchParams.set("query",profile.query); url.searchParams.set("near",near); url.searchParams.set("limit",String(RESULT_LIMIT)); url.searchParams.set("sort","RELEVANCE");
  for(let attempt=1; attempt<=4; attempt+=1){
    if(newApiCalls>=MAX_NEW_CALLS) return null; newApiCalls+=1;
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(url,{headers:{Authorization:`Bearer ${TOKEN}`,"X-Places-Api-Version":"2025-06-17",Accept:"application/json","User-Agent":"StratifyConnect/1.0 (https://worldstats360.com)"},signal:controller.signal}); clearTimeout(timer);
      if(response.status===429){ const retryAfter=Number.parseInt(response.headers.get("retry-after")||"0",10); const waitMs=Math.max(5000,retryAfter>0?retryAfter*1000:attempt*7500); console.warn(`429 rate limit: waiting ${Math.round(waitMs/1000)}s`); await sleep(waitMs); continue; }
      if(!response.ok){ const body=await response.text(); throw new Error(`HTTP ${response.status}: ${body.slice(0,200)}`); }
      const payload=await response.json(); await writeJson(cacheFile,payload); await sleep(REQUEST_DELAY_MS); return payload;
    } catch(error){ clearTimeout(timer); if(attempt===4||newApiCalls>=MAX_NEW_CALLS){ apiErrors+=1; console.warn(`Search failed: ${profile.query} | ${near} | ${error instanceof Error?error.message:String(error)}`); return null; } await sleep(attempt*2000); }
  }
  return null;
}

async function main(){
  if(!TOKEN){ console.error("\nMissing FSQ Places token.\nPowerShell: $env:FSQ_PLACES_TOKEN=\"YOUR_TOKEN\"\nThen rerun: node .\\scripts\\import-fsq-agriculture.mjs\n"); process.exit(2); }
  await fs.mkdir(CACHE_DIR,{recursive:true});
  const payload=await readJson(DATA_PATH); if(!Array.isArray(payload.businesses)) throw new Error("businesses.json has no businesses array.");
  const originalCount=payload.businesses.length; const timestamp=new Date().toISOString().replace(/[:.]/g,"-"); const backup=`${DATA_PATH}.bak-fsq-${timestamp}`; await fs.copyFile(DATA_PATH,backup);
  const byFsqId=new Map(), byHost=new Map(), byNameLocation=new Map();
  for(const b of payload.businesses){ const fid=clean(b.fsqPlaceId); if(fid) byFsqId.set(fid,b); const host=websiteHost(b.website); if(host) byHost.set(host,b); byNameLocation.set(businessKey(b.name,b.city,b.country),b); }
  const newBusinesses=[], newByFsqId=new Map(), newByHost=new Map(), newByNameLocation=new Map();
  let rawResults=0,rejectedNoWebsite=0,rejectedConsumer=0,rejectedNoCoordinates=0,enrichedExisting=0,mergedDiscovered=0;
  outer: for(const near of HUBS){ for(const profile of PROFILES){
    if(newBusinesses.length>=TARGET_NEW||newApiCalls>=MAX_NEW_CALLS) break outer;
    process.stdout.write(`\rFSQ calls ${newApiCalls}/${MAX_NEW_CALLS} | new ${newBusinesses.length}/${TARGET_NEW} | ${profile.query} @ ${near.slice(0,24)}           `);
    const response=await fetchSearch(near,profile); if(!response) continue;
    for(const place of resultList(response)){
      rawResults+=1; const id=fsqId(place), name=clean(place?.name); if(!id||!name) continue;
      const coordinates=latLng(place); if(!coordinates){rejectedNoCoordinates+=1;continue;}
      const website=safeWebsite(place?.website); if(!website){rejectedNoWebsite+=1;continue;}
      const categories=categoryLabels(place); if(rejectConsumerVenue(name,categories,profile)){rejectedConsumer+=1;continue;}
      const city=locality(place,near), countryRaw=countryValue(place), country=countryName(countryRaw), region=regionValue(place), host=websiteHost(website), locationKey=businessKey(name,city,country);
      const incoming={id:`fsq-${id}`,name,module:"agriculture",country:country||countryName(near.split(",").at(-1))||"Unknown",countryCode:/^[A-Za-z]{2}$/.test(countryRaw)?countryRaw.toUpperCase():"",city,lat:coordinates.lat,lng:coordinates.lng,coverage:"Local / Regional",roles:inferRoles(name,categories,profile),commerceGroups:groupKeysFromText(name,categories,profile),itemKeys:itemKeysFromText(name,categories,profile),description:`FSQ-discovered agriculture business matched through "${profile.query}" in ${near}.${categories.length?` Categories: ${categories.slice(0,4).join(", ")}.`:""}`,website,sourceUrl:`https://foursquare.com/placemakers/review-place/${encodeURIComponent(id)}`,verified:false,featured:false,sourceType:"fsq-places-api",verificationStatus:"discovered",locationPrecision:"poi",fsqPlaceId:id,fsqCategories:categories,address:clean(place?.address??place?.location?.formatted_address??place?.location?.address),region,phone:clean(place?.tel??place?.telephone),discoveryQuery:profile.query,discoveryNear:near};
      const existing=byFsqId.get(id)||(host?byHost.get(host):null)||byNameLocation.get(locationKey); if(existing){mergeClassification(existing,incoming);enrichedExisting+=1;continue;}
      const discovered=newByFsqId.get(id)||(host?newByHost.get(host):null)||newByNameLocation.get(locationKey); if(discovered){mergeClassification(discovered,incoming);mergedDiscovered+=1;continue;}
      newBusinesses.push(incoming); newByFsqId.set(id,incoming); if(host)newByHost.set(host,incoming); newByNameLocation.set(locationKey,incoming); if(newBusinesses.length>=TARGET_NEW) break;
    }
  }}
  console.log(""); newBusinesses.sort((a,b)=>a.name.localeCompare(b.name)); payload.businesses.push(...newBusinesses); payload.generatedAt=new Date().toISOString(); payload.sourcePolicy="Green-badge listings are manually verified. Source-linked listings are curated from official company websites. FSQ-discovered listings are sourced through Foursquare Places and remain unverified until reviewed or claimed."; await writeJson(DATA_PATH,payload);
  const groupCounts=new Map(); for(const b of payload.businesses){ for(const g of Array.isArray(b.commerceGroups)?b.commerceGroups:[]){ groupCounts.set(g,(groupCounts.get(g)||0)+1); }}
  console.log("\n============================================================\nSTRATIFY CONNECT - FSQ IMPORT COMPLETE\n============================================================");
  console.log(`Existing before : ${originalCount}\nNew businesses  : ${newBusinesses.length}\nFinal directory : ${payload.businesses.length}\nNew API calls   : ${newApiCalls}\nCache hits      : ${cacheHits}\nRaw POI results : ${rawResults}\nEnriched old    : ${enrichedExisting}\nMerged new dupes: ${mergedDiscovered}\nNo website      : ${rejectedNoWebsite}\nConsumer reject : ${rejectedConsumer}\nNo coordinates  : ${rejectedNoCoordinates}\nAPI errors      : ${apiErrors}\nBackup          : ${backup}\n`);
  console.log("Top groups:"); for(const [group,count] of [...groupCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)) console.log(`  ${group.padEnd(16)} ${count}`); console.log("\nNext: npm run build");
}
main().catch((error)=>{console.error("\nFSQ agriculture import failed:\n",error);process.exit(1);});
