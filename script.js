// KLaws script.js — 完整版（精簡行數）
// ==================== 資料定義 ====================
const DEFAULTS = {
  notes: [
    {id:1,type:'article',subject:'民法',title:'民法第 184 條 — 侵權行為',body:'因故意或過失，不法侵害他人之權利者，負損害賠償責任。',tags:['侵權行為','損害賠償'],date:'2025-03-10',detail:'構成要件：\n1. 須有加害行為\n2. 行為須不法\n3. 須有故意或過失\n4. 須有損害\n5. 加害行為與損害間有因果關係'},
    {id:2,type:'case',subject:'刑法',title:'釋字第 775 號 — 累犯加重規定',body:'累犯一律加重最低本刑，違反憲法比例原則，應依個案審查。',tags:['累犯','比例原則'],date:'2025-02-28',detail:'大法官認定相關規定違憲，法院應依個案情形審查，不得機械式適用加重。'},
  ],
  links: [{id:1,from:3,to:4,rel:'關聯',color:'#378ADD'},{id:2,from:3,to:2,rel:'關聯',color:'#378ADD'},{id:3,from:1,to:5,rel:'關聯',color:'#378ADD'}],
  types: [{key:'article',label:'條文',color:'#007AFF'},{key:'case',label:'案例',color:'#1D9E75'},{key:'concept',label:'概念',color:'#7F77DD'},{key:'diary',label:'日記',color:'#D85A30'}],
  subjects: [{key:'民法',label:'民法',color:'#D85A30'},{key:'刑法',label:'刑法',color:'#1D9E75'},{key:'憲法',label:'憲法',color:'#7F77DD'},{key:'行政法',label:'行政法',color:'#378ADD'}],
  chapters: [
    {key:'總則',label:'總則',subject:'民法'},{key:'法律行為',label:'法律行為',subject:'民法'},
    {key:'債編總論',label:'債編總論',subject:'民法'},{key:'契約',label:'契約',subject:'民法'},
    {key:'侵權行為',label:'侵權行為',subject:'民法'},{key:'不當得利',label:'不當得利',subject:'民法'},
    {key:'物權',label:'物權',subject:'民法'},{key:'親屬與繼承',label:'親屬與繼承',subject:'民法'}
  ],
  sections: []
};
const LINK_COLOR = '#378ADD', SKEY = 'legal_notes_v4', PAGE_SIZE = 24;
const SCOPE_LINKED_TOGGLE_KEY = 'klaws_scope_linked_toggle_v1';
const SYNC_KEY = 'klaws_sync_v1', SYNC_FILE = 'klaws_data.json';
const AI_MODELS = [
  {id:'openrouter/free', label:'🔀 自動選最佳免費模型（推薦）'},
  {id:'meta-llama/llama-3.3-70b-instruct:free', label:'Llama 3.3 70B（Meta）'},
  {id:'google/gemini-2.0-flash-exp:free', label:'Gemini 2.0 Flash（Google）'},
  {id:'deepseek/deepseek-r1:free', label:'DeepSeek R1（推理強）'},
  {id:'mistralai/mistral-small-3.1-24b-instruct:free', label:'Mistral Small 3.1'}
];
const DEFAULT_SHORTCUTS = [
  {id:'new',label:'新增筆記',code:'KeyN',alt:true},{id:'search',label:'搜尋',code:'KeyF',alt:true},
  {id:'map',label:'開啟體系圖',code:'KeyM',alt:true},{id:'back',label:'返回筆記列表',code:'Escape'},
  {id:'close',label:'關閉面板',code:'KeyW',alt:true},{id:'edit',label:'編輯當前筆記',code:'KeyE',alt:true},
  {id:'link',label:'新增關聯',code:'KeyL',alt:true},{id:'export',label:'匯出備份',code:'KeyS',alt:true},
  {id:'shortcuts',label:'快捷鍵設定',code:'KeyK',alt:true},
  {id:'stats',label:'統計',code:'KeyI',alt:true}
];
const BUILTIN_FIELD_DEFS = {
  body:{key:'body',label:'摘要',kind:'textarea',placeholder:'條文或重點摘要...'},
  detail:{key:'detail',label:'詳細筆記',kind:'textarea',placeholder:'構成要件、學說、實務見解...'},
  todos:{key:'todos',label:'📝 待辦清單（每行一項，開頭 [x] 代表已完成）',kind:'textarea',placeholder:'[ ] 完成筆記整理\n[x] 複習例題第 3 題'},
  tags:{key:'tags',label:'標籤（單一）',kind:'text',placeholder:'例：侵權行為'}
};
const DEFAULT_TYPE_FIELD_KEYS = {diary:['body','todos','tags']};
const DEFAULT_NORMAL_FIELD_KEYS = ['body','detail','tags'];

// ==================== 全域變數 ====================
let notes=[], links=[], nid=10, lid=10, types=[], subjects=[], chapters=[], sections=[];
let cv='all', cs='all', cch='all', csec='all', searchQ='', openId=null, editMode=false;
let selectedSubjects=[], selectedChapters=[], selectedSections=[];
let scopeLinkedEnabled = localStorage.getItem(SCOPE_LINKED_TOGGLE_KEY)==='1';
let formLinkSelections={}, tagSearchQ='', tagUnusedOnly=false;
let chapterSubjectFilter='', sectionChapterFilter='';
let activeTagCategory='type';
let nodePos={}, dragNode=null, dragOffX=0, dragOffY=0, mapW=800, mapH=500;
let nodeSizes={};
let mapScale=1, mapOffX=0, mapOffY=0, mapFilter={sub:'all',chapter:'all',section:'all',q:''}, mapLinkedOnly=true;
let mapDepth='all', mapFocusMode=false, mapFocusedNodeId=null;
let nodeEls={}, linkElsMap={}, nodeLinksIndex={}, linkCurveOffsets={}, isMapOpen=false;
let gridPage=1, sortMode='date_desc', multiSelMode=false, selectedIds={};
let examList=[], examTimer=null, examSec=0, examTotal=0, currentExam=null;
let shortcuts=[], recordingBtn=null, _aiPendingAction=null, _saveTimer=null, rafId=null;
let mapRedrawTimer=null, mapResizeObserver=null, mapCenterNodeId=null, mapCenterNodeIds={}, mapLaneConfigs={}, mapNodeMeta={};
let mapTimer=null, currentView='notes';
let mapAdvancedOpen=false;
let mapCollapsed={};
let typeFieldConfigs={}, customFieldDefs={};

// ==================== 工具函數 ====================
const g = id => document.getElementById(id);
const on = (id, evt, fn) => { const el=g(id); if(el) el.addEventListener(evt,fn); return el; };
const val = id => { const el=g(id); return el?el.value:''; };
const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const showToast = m => { let t=g('toast'); t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2200); };
const getPanelDir = () => localStorage.getItem('klaws_panel_dir')==='bottom'?'bottom':'side';
const applyPanelDir = dir => {
  const next=dir==='bottom'?'bottom':'side';
  document.body.classList.toggle('panel-dir-bottom',next==='bottom');
  localStorage.setItem('klaws_panel_dir',next);
  const btn=g('panelDirBtn');
  if(btn) btn.textContent=next==='bottom'?'↥ 底部展開':'↤ 右側展開';
};
const togglePanelDir = () => {
  const next=getPanelDir()==='side'?'bottom':'side';
  const openPanelIds=['dp','fp','tp'].filter(id=>g(id)?.classList.contains('open'));
  applyPanelDir(next);
  if(openPanelIds.length){
    openPanelIds.forEach(id=>g(id)?.classList.remove('open'));
    requestAnimationFrame(()=>{
      openPanelIds.forEach(id=>g(id)?.classList.add('open'));
      syncSidePanelState();
    });
  }
  showToast(next==='bottom'?'已切換為底部展開':'已切換為右側展開');
};
const saveDataDeferred = () => { clearTimeout(_saveTimer); _saveTimer=setTimeout(()=>{ if(JSON.stringify({notes,links}).length>4500000) showToast('⚠️ 資料接近儲存上限'); saveData(); },500); };
const typeByKey = k => types.find(t=>t.key===k)||{key:k,label:k,color:'#888'};
const subByKey = k => subjects.find(s=>s.key===k)||{key:k,label:k,color:'#888'};
const chapterByKey = k => chapters.find(c=>c.key===k)||{key:k,label:k,subject:'all'};
const sectionByKey = k => sections.find(s=>s.key===k)||{key:k,label:k,chapter:'all'};
const uniq = arr => [...new Set((Array.isArray(arr)?arr:[]).filter(Boolean))];
const noteScopeKeys = (n,arrKey,singleKey) => {
  const arr=Array.isArray(n&&n[arrKey])?n[arrKey].filter(Boolean):[];
  return uniq(arr.length?arr:((n&&n[singleKey])?[n[singleKey]]:[]));
};
const noteSubjects = n => noteScopeKeys(n,'subjects','subject');
const noteChapters = n => noteScopeKeys(n,'chapters','chapter');
const noteSections = n => noteScopeKeys(n,'sections','section');
const noteSubjectText = n => noteSubjects(n).join(' ');
const noteChapterText = n => noteChapters(n).join(' ');
const noteSectionText = n => noteSections(n).join(' ');
const intersects = (arr1,arr2) => arr1.some(x=>arr2.includes(x));
const tagUsageCount = (kind,key) => {
  if(kind==='type') return notes.filter(n=>n.type===key).length;
  if(kind==='sub') return notes.filter(n=>noteSubjects(n).includes(key)).length;
  if(kind==='section') return notes.filter(n=>noteSections(n).includes(key)).length;
  return notes.filter(n=>noteChapters(n).includes(key)).length;
};
const noteById = id => notes.find(n=>n.id===id);
const noteTags = n => Array.isArray(n&&n.tags)?n.tags:[];
const noteExtraFields = n => (n&&n.extraFields&&typeof n.extraFields==='object'&&!Array.isArray(n.extraFields))?n.extraFields:{};
const getFieldDef = key => BUILTIN_FIELD_DEFS[key]||customFieldDefs[key]||{key,label:key,kind:'text',placeholder:''};
const getTypeFieldKeys = typeKey => {
  const base=Array.isArray(typeFieldConfigs[typeKey])&&typeFieldConfigs[typeKey].length?typeFieldConfigs[typeKey]:(DEFAULT_TYPE_FIELD_KEYS[typeKey]||DEFAULT_NORMAL_FIELD_KEYS);
  return uniq(base.filter(k=>getFieldDef(k)));
};
const renderFieldValue = (n,key) => {
  if(key==='body') return n.body||'';
  if(key==='detail') return n.detail||'';
  if(key==='todos') return renderTodoHtml(n.todos);
  if(key==='tags') return noteTags(n).join('、')||'（無標籤）';
  return noteExtraFields(n)[key]||'';
};
const noteFieldValueForEdit = (n,key) => {
  if(key==='body') return n.body||'';
  if(key==='detail') return n.detail||'';
  if(key==='todos') return formatTodosForEdit(n.todos);
  if(key==='tags') return noteTags(n)[0]||'';
  return noteExtraFields(n)[key]||'';
};
const hexRgb = hex => { if(hex.length===4) hex='#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; };
const lightC = hex => `rgba(${hexRgb(hex).join(',')},0.12)`;
const darkC = hex => { let r=hexRgb(hex); return `rgb(${Math.round(r[0]*.55)},${Math.round(r[1]*.55)},${Math.round(r[2]*.55)})`; };
const safeStr = v => typeof v==='string'?v:'';
const hl = (text,q) => { const s=safeStr(text); return !q?s:s.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<span class="hl">$1</span>'); };
const getAiKey = () => localStorage.getItem('klaws_ai_key')||'';
const saveAiKey = k => localStorage.setItem('klaws_ai_key',k);
const getAiModel = () => localStorage.getItem('klaws_ai_model')||'openrouter/free';
const saveAiModel = m => localStorage.setItem('klaws_ai_model',m);
const getSyncConfig = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)||'{}'); } catch(e) { return {}; } };
const saveSyncConfig = cfg => localStorage.setItem(SYNC_KEY,JSON.stringify(cfg||{}));
const saveSyncConfigFromInputs = () => {
  const token=(g('syncTokenInput')?.value||'').trim();
  const gistId=(g('syncGistInput')?.value||'').trim();
  const autoPush=!!g('syncAutoPush')?.checked;
  const autoPull=!!g('syncAutoPull')?.checked;
  if(token&&gistId) saveSyncConfig({token,gistId,autoPush,autoPull});
};
const getMapCenterContextKey = () => `${mapFilter.sub||'all'}::${mapFilter.chapter||'all'}::${mapFilter.section||'all'}`;
const getMapCenterFromScopes = () => {
  const key=getMapCenterContextKey();
  const scopedId=mapCenterNodeIds[key];
  if(scopedId&&notes.some(n=>n.id===scopedId)) return scopedId;
  return (mapCenterNodeId&&notes.some(n=>n.id===mapCenterNodeId))?mapCenterNodeId:null;
};
const setMapCenterForCurrentScope = id => {
  if(!Number.isFinite(id)) return;
  mapCenterNodeIds[getMapCenterContextKey()]=id;
  mapCenterNodeId=id;
};
const getPayload = () => ({notes,links,nid,lid,types,subjects,chapters,sections,nodePos,nodeSizes,sortMode,mapCenterNodeId,mapCenterNodeIds,mapFilter,mapLinkedOnly,mapDepth,mapFocusMode,mapLaneConfigs,mapCollapsed,typeFieldConfigs,customFieldDefs,panelDir:getPanelDir(),updatedAt:new Date().toISOString()});
const parseUpdatedAt = raw => {
  const n=Date.parse(raw||'');
  return Number.isFinite(n)?n:0;
};
async function githubSyncRequest(url,opts={}) {
  const res=await fetch(url,opts);
  if(!res.ok){
    let msg=`HTTP ${res.status}`;
    try{ const err=await res.json(); if(err&&err.message) msg=err.message; }catch(e){}
    throw new Error(msg);
  }
  return res;
}
async function uploadToGist(token,gistId){
  const data=JSON.stringify(getPayload());
  await githubSyncRequest(`https://api.github.com/gists/${gistId}`,{
    method:'PATCH',
    headers:{'Authorization':`token ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({files:{[SYNC_FILE]:{content:data}}})
  });
}
async function downloadFromGist(token,gistId){
  const res=await githubSyncRequest(`https://api.github.com/gists/${gistId}`,{headers:{'Authorization':`token ${token}`}});
  const j=await res.json();
  const f=j&&j.files&&j.files[SYNC_FILE];
  if(!f||!f.content) throw new Error(`找不到 ${SYNC_FILE}`);
  return f.content;
}
async function autoPullIfNeeded(){
  const cfg=getSyncConfig();
  if(!cfg.token||!cfg.gistId||!cfg.autoPull) return;
  try{
    const content=await downloadFromGist(cfg.token,cfg.gistId);
    const cloud=JSON.parse(content);
    const local=JSON.parse(localStorage.getItem(SKEY)||'{}');
    if(parseUpdatedAt(cloud.updatedAt)>parseUpdatedAt(local.updatedAt)){
      localStorage.setItem(SKEY,content);
      loadData();
      rebuildUI();
      render();
      showToast('已自動載入雲端較新版本');
    }
  }catch(e){
    console.warn('Auto pull failed',e);
  }
}
async function autoPushIfEnabled(){
  const cfg=getSyncConfig();
  if(!cfg.token||!cfg.gistId||!cfg.autoPush) return;
  try{ await uploadToGist(cfg.token,cfg.gistId); }
  catch(e){ console.warn('Auto push failed',e); }
}
const MAP_NODE_RADIUS_MIN=15, MAP_NODE_RADIUS_MAX=100, MAP_NODE_RADIUS_DEFAULT=15;
const MAP_LIGHT_BUNDLING_STRENGTH=0.38;
const DEFAULT_LANE_NAMES=['法條','構成要件','違法性','罪責','其它'];
const MIN_LANE_COUNT=2, MAX_LANE_COUNT=10;
const clampMapRadius = r => Math.max(MAP_NODE_RADIUS_MIN,Math.min(MAP_NODE_RADIUS_MAX,r));
const laneContextKey = () => `${mapFilter.sub||'all'}::${mapFilter.section||'all'}`;
const defaultLaneNameAt = idx => DEFAULT_LANE_NAMES[idx]||`泳道 ${idx+1}`;
const normalizeLaneCount = v => Math.max(MIN_LANE_COUNT,Math.min(MAX_LANE_COUNT,parseInt(v,10)||DEFAULT_LANE_NAMES.length));
const getLaneConfig = () => {
  const key=laneContextKey();
const raw=mapLaneConfigs[key]||{};
  const count=normalizeLaneCount(raw.count||((Array.isArray(raw.names)&&raw.names.length)||DEFAULT_LANE_NAMES.length));
  const names=Array.from({length:count},(_,idx)=>((raw.names&&raw.names[idx])||'').trim()||defaultLaneNameAt(idx));
  mapLaneConfigs[key]={count,names};
  return {key,count,names};
};
const splitMapTitleLines = (title,max=8) => { const s=String(title||'').trim(); if(!s) return ['（未命名）']; const r=[]; for(let i=0;i<s.length;i+=max) r.push(s.slice(i,i+max)); return r; };
const parseTodos = raw => (raw||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>({text:line.replace(/^\[(x|X| )\]\s*/,''),done:/^\[(x|X)\]/.test(line)})).filter(x=>x.text);
const formatTodosForEdit = todos => (Array.isArray(todos)?todos:[]).map(t=>`${t.done?'[x]':'[ ]'} ${t.text||''}`.trim()).join('\n');
const renderTodoHtml = todos => {
  const list=(Array.isArray(todos)?todos:[]).filter(t=>t&&t.text);
  if(!list.length) return '<span style="font-size:12px;color:#bbb">尚無待辦項目</span>';
  return `<div class="todo-list">${list.map(t=>`<div class="todo-item ${t.done?'done':''}"><span class="todo-item-check">${t.done?'✅':'⬜'}</span><span class="todo-item-text">${t.text}</span></div>`).join('')}</div>`;
};

// ★ 修復日期：將 ISO timestamp 格式化為 YYYY-MM-DD
const formatDate = raw => {
  if(!raw) return '';
  // 如果已經是 YYYY-MM-DD 格式，直接回傳
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // 嘗試解析 ISO 或其他格式
  try {
    const d = new Date(raw);
    if(isNaN(d.getTime())) return raw;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch(e) { return raw; }
};

const sortedNotes = arr => arr.slice().sort((a,b)=>{
  const ad=safeStr(a&&a.date),bd=safeStr(b&&b.date),at=safeStr(a&&a.title),bt=safeStr(b&&b.title),as=noteSubjectText(a),bs=noteSubjectText(b),ach=noteChapterText(a),bch=noteChapterText(b),aty=safeStr(a&&a.type),bty=safeStr(b&&b.type);
  return sortMode==='date_desc'?bd.localeCompare(ad):sortMode==='date_asc'?ad.localeCompare(bd):sortMode==='title_asc'?at.localeCompare(bt,'zh'):sortMode==='title_desc'?bt.localeCompare(at,'zh'):sortMode==='subject'?as.localeCompare(bs)||at.localeCompare(bt):sortMode==='chapter'?ach.localeCompare(bch)||at.localeCompare(bt):aty.localeCompare(bty)||at.localeCompare(bt);
});
function normalizeNoteIds(forceReindexAll=false) {
  const seen={}, duplicates=new Set();
  notes.forEach(n=>{
  if(!Number.isFinite(n.id) || seen[n.id]) duplicates.add(n.id);
  seen[n.id]=true;
  });
  if(!forceReindexAll && !duplicates.size) {
    nid=Math.max(nid||1,notes.reduce((m,n)=>Math.max(m,n.id||0),0)+1);
    lid=Math.max(lid||1,links.reduce((m,l)=>Math.max(m,l.id||0),0)+1);
    return false;
  }
  const fromBuckets={}, toBuckets={}, firstMap={}, remapPos={}, remapSize={}, remapSelected={};
  let nextId=1;
  notes.forEach(n=>{
    const oldId=n.id, newId=nextId++;
    n.id=newId;
    if(!fromBuckets[oldId]) fromBuckets[oldId]=[];
    if(!toBuckets[oldId]) toBuckets[oldId]=[];
    fromBuckets[oldId].push(newId);
    toBuckets[oldId].push(newId);
    if(firstMap[oldId]===undefined) firstMap[oldId]=newId;
  });
  links=links.map(l=>{
    const fromList=fromBuckets[l.from],toList=toBuckets[l.to];
    const from=fromList&&fromList.length?fromList.shift():(firstMap[l.from]??null);
    const to=toList&&toList.length?toList.shift():(firstMap[l.to]??null);
    return {...l,from,to};
  }).filter(l=>Number.isFinite(l.from)&&Number.isFinite(l.to)&&l.from!==l.to);
  Object.keys(nodePos||{}).forEach(k=>{const nk=firstMap[Number(k)];if(nk!==undefined&&remapPos[nk]===undefined) remapPos[nk]=nodePos[k];});
  Object.keys(nodeSizes||{}).forEach(k=>{const nk=firstMap[Number(k)];if(nk!==undefined&&remapSize[nk]===undefined) remapSize[nk]=nodeSizes[k];});
  Object.keys(selectedIds||{}).forEach(k=>{const nk=firstMap[Number(k)];if(nk!==undefined) remapSelected[nk]=true;});
  nodePos=remapPos; nodeSizes=remapSize; selectedIds=remapSelected;
  mapCenterNodeId=firstMap[mapCenterNodeId]??null;
  if(mapCenterNodeIds&&typeof mapCenterNodeIds==='object'){
    const remappedCenters={};
    Object.keys(mapCenterNodeIds).forEach(key=>{
      const oldId=Number(mapCenterNodeIds[key]);
      const newId=firstMap[oldId];
      if(newId!==undefined) remappedCenters[key]=newId;
    });
    mapCenterNodeIds=remappedCenters;
  }
  mapFocusedNodeId=firstMap[mapFocusedNodeId]??null;
  openId=firstMap[openId]??null;
  nid=nextId;
  lid=Math.max(lid||1,links.reduce((m,l)=>Math.max(m,l.id||0),0)+1);
  return true;
}

// ==================== 資料儲存 ====================
function loadData() {
  try {
    const raw=localStorage.getItem(SKEY);
    if(raw) {
      const d=JSON.parse(raw);
      notes=Array.isArray(d.notes)?d.notes:DEFAULTS.notes.slice();
      notes.forEach(n=>{
        if(!Array.isArray(n.todos)) n.todos=[];
        if(!Array.isArray(n.tags)) n.tags=[];
        if(typeof n.title!=='string') n.title='';
        if(typeof n.body!=='string') n.body='';
        if(typeof n.detail!=='string') n.detail='';
        if(!n.extraFields||typeof n.extraFields!=='object'||Array.isArray(n.extraFields)) n.extraFields={};
        if(!Array.isArray(n.subjects)) n.subjects=typeof n.subject==='string'&&n.subject?[n.subject]:[];
        if(!Array.isArray(n.chapters)) n.chapters=typeof n.chapter==='string'&&n.chapter?[n.chapter]:[];
        if(!Array.isArray(n.sections)) n.sections=typeof n.section==='string'&&n.section?[n.section]:[];
        n.subjects=uniq(n.subjects);
        n.chapters=uniq(n.chapters);
        n.sections=uniq(n.sections);
        n.subject=n.subjects[0]||'';
        n.chapter=n.chapters[0]||'';
        n.section=n.sections[0]||'';
        // ★ 修復日期格式
        n.date = formatDate(n.date) || '1970-01-01';
      });
      links=Array.isArray(d.links)?d.links:DEFAULTS.links.slice();
      links.forEach(l=>{l.rel='關聯';l.color=LINK_COLOR;});
      nid=Number.isFinite(d.nid)?d.nid:Math.max(10,notes.reduce((m,n)=>Math.max(m,n.id||0),0)+1);
      lid=Number.isFinite(d.lid)?d.lid:Math.max(10,links.reduce((m,l)=>Math.max(m,l.id||0),0)+1);
      types=Array.isArray(d.types)?d.types:DEFAULTS.types.slice();
      if(!types.some(t=>t.key==='diary')) types.push({key:'diary',label:'日記',color:'#D85A30'});
      subjects=Array.isArray(d.subjects)?d.subjects:DEFAULTS.subjects.slice();
      chapters=Array.isArray(d.chapters)?d.chapters:DEFAULTS.chapters.slice();
      sections=Array.isArray(d.sections)?d.sections:DEFAULTS.sections.slice();
      nodePos=(d.nodePos&&typeof d.nodePos==='object'&&!Array.isArray(d.nodePos))?d.nodePos:{};
      nodeSizes=(d.nodeSizes&&typeof d.nodeSizes==='object'&&!Array.isArray(d.nodeSizes))?d.nodeSizes:{};
      if(d.sortMode) sortMode=d.sortMode;
      mapCenterNodeId=d.mapCenterNodeId||null;
      mapCenterNodeIds=(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object'&&!Array.isArray(d.mapCenterNodeIds))?d.mapCenterNodeIds:{};
      if(d.mapFilter&&typeof d.mapFilter==='object') mapFilter={
        sub:typeof d.mapFilter.sub==='string'?d.mapFilter.sub:'all',
        chapter:typeof d.mapFilter.chapter==='string'?d.mapFilter.chapter:'all',
        section:typeof d.mapFilter.section==='string'?d.mapFilter.section:'all',
        q:typeof d.mapFilter.q==='string'?d.mapFilter.q:''
      };
      if(typeof d.mapLinkedOnly==='boolean') mapLinkedOnly=d.mapLinkedOnly;
      if(['all','1','2','3'].includes(d.mapDepth)) mapDepth=d.mapDepth;
      if(typeof d.mapFocusMode==='boolean') mapFocusMode=d.mapFocusMode;
      mapLaneConfigs=(d.mapLaneConfigs&&typeof d.mapLaneConfigs==='object'&&!Array.isArray(d.mapLaneConfigs))?d.mapLaneConfigs:{};
      mapCollapsed=(d.mapCollapsed&&typeof d.mapCollapsed==='object'&&!Array.isArray(d.mapCollapsed))?d.mapCollapsed:{};
      customFieldDefs=(d.customFieldDefs&&typeof d.customFieldDefs==='object'&&!Array.isArray(d.customFieldDefs))?d.customFieldDefs:{};
      Object.keys(customFieldDefs).forEach(key=>{
        const item=customFieldDefs[key]||{};
        customFieldDefs[key]={key,label:item.label||key,kind:item.kind==='text'?'text':'textarea',placeholder:item.placeholder||''};
      });
      typeFieldConfigs=(d.typeFieldConfigs&&typeof d.typeFieldConfigs==='object'&&!Array.isArray(d.typeFieldConfigs))?d.typeFieldConfigs:{};
      types.forEach(t=>{ typeFieldConfigs[t.key]=getTypeFieldKeys(t.key); });
      let repaired=false,chapterMigrated=false;
      types.forEach(t=>{if(/^tag_t_/.test(t.key)){let old=t.key;t.key=t.label;notes.forEach(n=>{if(n.type===old)n.type=t.label;});repaired=true;}});
      subjects.forEach(s=>{if(/^tag_s_/.test(s.key)){let old=s.key;s.key=s.label;notes.forEach(n=>{n.subjects=noteSubjects(n).map(x=>x===old?s.label:x);n.subject=n.subjects[0]||'';});repaired=true;}});
      notes.forEach(n=>{
        if(!noteChapters(n).length){
          const fromTag=noteTags(n).find(t=>chapters.some(c=>c.key===t&&(noteSubjects(n).includes(c.subject)||c.subject==='all')));
          n.chapters=fromTag?[fromTag]:[];
          n.chapter=n.chapters[0]||'';
          chapterMigrated=true;
        }
      });
      if(normalizeNoteIds(true)) repaired=true;
      if(repaired||chapterMigrated) saveData();
      applyPanelDir(d.panelDir||getPanelDir());
    } else {
      notes=DEFAULTS.notes.slice();links=DEFAULTS.links.slice();types=DEFAULTS.types.slice();subjects=DEFAULTS.subjects.slice();chapters=DEFAULTS.chapters.slice();sections=DEFAULTS.sections.slice();nodeSizes={};typeFieldConfigs={};customFieldDefs={};types.forEach(t=>{typeFieldConfigs[t.key]=getTypeFieldKeys(t.key);});applyPanelDir(getPanelDir());saveData();
    }
  } catch(e) {
    notes=DEFAULTS.notes.slice();links=DEFAULTS.links.slice();types=DEFAULTS.types.slice();subjects=DEFAULTS.subjects.slice();chapters=DEFAULTS.chapters.slice();sections=DEFAULTS.sections.slice();nodeSizes={};typeFieldConfigs={};customFieldDefs={};types.forEach(t=>{typeFieldConfigs[t.key]=getTypeFieldKeys(t.key);});applyPanelDir(getPanelDir());
  }
}
function saveData() { try { localStorage.setItem(SKEY,JSON.stringify(getPayload())); autoPushIfEnabled(); } catch(e){} }

// ==================== UI 建構 ====================
function buildTypeRow() {
  const row=g('typeRow');
  row.innerHTML=`<button class="tab ${cv==='all'?'on':''}" data-v="all">全部</button>`+types.map(t=>`<button class="tab ${cv===t.key?'on':''}" data-v="${t.key}" style="${cv===t.key?`background:${t.color};`:''}">${t.label}</button>`).join('')+`<button class="tag-mgr-btn" id="tagMgrBtn">管理</button>`;
  row.querySelectorAll('.tab[data-v]').forEach(btn=>btn.addEventListener('click',()=>{cv=btn.dataset.v;gridPage=1;buildTypeRow();render();}));
  on('tagMgrBtn','click',openTagMgr);
}
function buildSubRow() {
  normalizeFilterSelections();
  const row=g('subbar');
  const isAll=selectedSubjects.length===0;
  row.innerHTML=`<button class="sc ${isAll?'on':''}" data-s="all">全部</button>`+subjects.map(s=>{
    const active=selectedSubjects.includes(s.key);
    return `<button class="sc ${active?'on':''}" data-s="${s.key}" style="${active?`background:${s.color};color:#fff;`:''}">${s.label}</button>`;
  }).join('');
  row.querySelectorAll('.sc').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.s;
    if(key==='all') selectedSubjects=[];
    else selectedSubjects=selectedSubjects[0]===key?[]:[key];
    cs=selectedSubjects.length===1?selectedSubjects[0]:'all';
    const availKeys=new Set(chaptersBySubjects(selectedSubjects).map(ch=>ch.key));
    selectedChapters=selectedChapters.filter(k=>availKeys.has(k));
    const sectionKeys=new Set(sectionsByChapters(selectedChapters).map(sec=>sec.key));
    selectedSections=selectedSections.filter(k=>sectionKeys.has(k));
    cch=selectedChapters.length===1?selectedChapters[0]:'all';
    csec=selectedSections.length===1?selectedSections[0]:'all';
    gridPage=1;buildSubRow();buildChapterRow();buildSectionRow();render();
  }));
}
function buildChapterRow() {
  normalizeFilterSelections();
  const row=g('chapterbar'); if(!row) return;
  const available=chaptersBySubjects(selectedSubjects);
  const isAll=selectedChapters.length===0;
  row.innerHTML=available.length?`<button class="ch ${isAll?'on':''}" data-ch="all">全部</button>`+available.map(ch=>{
    const active=selectedChapters.includes(ch.key);
    return `<button class="ch ${active?'on':''}" data-ch="${ch.key}">${ch.label}</button>`;
  }).join(''):'';
  row.style.display=available.length?'flex':'none';
  row.querySelectorAll('.ch').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.ch;
    if(key==='all') selectedChapters=[];
    else selectedChapters=selectedChapters[0]===key?[]:[key];
    const sectionKeys=new Set(sectionsByChapters(selectedChapters).map(sec=>sec.key));
    selectedSections=selectedSections.filter(k=>sectionKeys.has(k));
    cch=selectedChapters.length===1?selectedChapters[0]:'all';
    csec=selectedSections.length===1?selectedSections[0]:'all';
    gridPage=1;buildChapterRow();buildSectionRow();render();
  }));
}
function buildSectionRow() {
  normalizeFilterSelections();
  const row=g('sectionbar'); if(!row) return;
  const available=sectionsByChapters(selectedChapters);
  const isAll=selectedSections.length===0;
  row.innerHTML=available.length?`<button class="ch ${isAll?'on':''}" data-sec="all">全部</button>`+available.map(sec=>{
    const active=selectedSections.includes(sec.key);
    return `<button class="ch ${active?'on':''}" data-sec="${sec.key}">${sec.label}</button>`;
  }).join(''):'';
  row.style.display=available.length?'flex':'none';
  row.querySelectorAll('.ch').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.sec;
    if(key==='all') selectedSections=[];
    else selectedSections=selectedSections[0]===key?[]:[key];
    csec=selectedSections.length===1?selectedSections[0]:'all';
    gridPage=1;buildSectionRow();render();
  }));
}
function chaptersBySubjects(subKeys){
  if(!Array.isArray(subKeys)||!subKeys.length) return chapters.slice();
  return chapters.filter(ch=>subKeys.includes(ch.subject)||ch.subject==='all');
}
function sectionsByChapters(chKeys){
  if(!Array.isArray(chKeys)||!chKeys.length) return sections.slice();
  return sections.filter(sec=>chKeys.includes(sec.chapter)||sec.chapter==='all');
}
function normalizeFilterSelections(){
  const validSubjectKeys=new Set(subjects.map(s=>s.key));
  selectedSubjects=selectedSubjects.filter(k=>validSubjectKeys.has(k)).slice(0,1);
  const validChapterKeys=new Set(chaptersBySubjects(selectedSubjects).map(ch=>ch.key));
  selectedChapters=selectedChapters.filter(k=>validChapterKeys.has(k)).slice(0,1);
  const validSectionKeys=new Set(sectionsByChapters(selectedChapters).map(sec=>sec.key));
  selectedSections=selectedSections.filter(k=>validSectionKeys.has(k)).slice(0,1);
  cs=selectedSubjects.length===1?selectedSubjects[0]:'all';
  cch=selectedChapters.length===1?selectedChapters[0]:'all';
  csec=selectedSections.length===1?selectedSections[0]:'all';
}
function chaptersBySubject(subKey){ return chapters.filter(ch=>subKey==='all'||ch.subject===subKey||ch.subject==='all'); }
function selectedValues(id){
  const el=g(id); if(!el) return [];
  return Array.from(el.selectedOptions||[]).map(opt=>opt.value).filter(Boolean);
}
function setSelectedValues(id, values=[]){
  const el=g(id); if(!el) return;
  const set=new Set(values);
  Array.from(el.options||[]).forEach(opt=>{opt.selected=set.has(opt.value);});
}
function syncChapterSelect(subjectKeys, selected=[]) {
  const fc=g('fc'); if(!fc) return;
  const keys=Array.isArray(subjectKeys)?subjectKeys.filter(Boolean):(subjectKeys?[subjectKeys]:[]);
  const available=keys.length?chaptersBySubjects(keys):chapters.slice();
  fc.innerHTML=available.map(ch=>`<option value="${ch.key}">${ch.label}</option>`).join('');
  const selectedKeys=(Array.isArray(selected)?selected.filter(Boolean):(selected?[selected]:[])).slice(0,1);
  const validSelected=selectedKeys.filter(k=>available.some(ch=>ch.key===k));
  setSelectedValues('fc',validSelected);
}
function syncSectionSelect(chapterKeys, selected=[]){
  const sec=g('fsec'); if(!sec) return;
  const keys=Array.isArray(chapterKeys)?chapterKeys.filter(Boolean):(chapterKeys?[chapterKeys]:[]);
  const available=keys.length?sectionsByChapters(keys):sections.slice();
  sec.innerHTML=available.map(item=>`<option value="${item.key}">${item.label}</option>`).join('');
  const selectedKeys=(Array.isArray(selected)?selected.filter(Boolean):(selected?[selected]:[])).slice(0,1);
  const validSelected=selectedKeys.filter(k=>available.some(item=>item.key===k));
  setSelectedValues('fsec',validSelected);
}
function buildFormSelects() {
  g('ft').innerHTML=types.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');
  g('fs2').innerHTML=subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  syncChapterSelect(selectedValues('fs2'));
  syncSectionSelect(selectedValues('fc'));
}
function rebuildUI() { buildTypeRow();buildSubRow();buildChapterRow();buildSectionRow();buildFormSelects(); }

function hasTaxonomyFilter() {
  return !!(selectedSubjects.length||selectedChapters.length||selectedSections.length);
}
function baseScopeMatch(note) {
  const subs=noteSubjects(note), chs=noteChapters(note), secs=noteSections(note);
  return (cv==='all'||note.type===cv)
    &&(!selectedSubjects.length||intersects(selectedSubjects,subs))
    &&(!selectedChapters.length||intersects(selectedChapters,chs))
    &&(!selectedSections.length||intersects(selectedSections,secs));
}
function noteMatchesSearch(note, q) {
  if(!q) return true;
  const subs=noteSubjects(note), chs=noteChapters(note), secs=noteSections(note);
  return `${note.title} ${note.body} ${subs.join(' ')} ${chs.join(' ')} ${secs.join(' ')} ${noteTags(note).join(' ')}`.toLowerCase().includes(q);
}
function expandWithLinkedNotes(seedIds) {
  const expanded=new Set(seedIds);
  links.forEach(l=>{
    if(expanded.has(l.from)) expanded.add(l.to);
    if(expanded.has(l.to)) expanded.add(l.from);
  });
  return expanded;
}

// ==================== 渲染 ====================
function render() {
  const q=searchQ.trim().toLowerCase();
  const seedIds=new Set(notes.filter(n=>baseScopeMatch(n)).map(n=>n.id));
  const shouldExpand=scopeLinkedEnabled&&hasTaxonomyFilter();
  const visibleIds=shouldExpand?expandWithLinkedNotes(seedIds):seedIds;
  const filtered=sortedNotes(notes).filter(n=>visibleIds.has(n.id)&&noteMatchesSearch(n,q));
  const sb=g('search-results-bar');
  if(q){sb.style.display='block';sb.textContent=`搜尋「${searchQ}」：找到 ${filtered.length} 筆筆記`;}
  else if(shouldExpand){
    const linkedCount=Math.max(0,filtered.length-seedIds.size);
    sb.style.display='block';
    sb.textContent=linkedCount>0?`已額外顯示 ${linkedCount} 筆跨科目關聯筆記`:'已啟用跨科目關聯顯示（目前無新增筆記）';
  }else sb.style.display='none';
  const grid=g('grid');
  const pager=g('gridPager'); if(pager) pager.remove();
  if(!filtered.length){grid.innerHTML='<div class="empty">沒有符合的筆記</div>';return;}
  const maxPg=Math.ceil(filtered.length/PAGE_SIZE);
  if(gridPage>maxPg) gridPage=maxPg;
  const pgF=filtered.slice((gridPage-1)*PAGE_SIZE,gridPage*PAGE_SIZE);
  grid.innerHTML=pgF.map(n=>{
    const tp=typeByKey(n.type),subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
    const subChips=subs.map(sk=>{const sb2=subByKey(sk);return `<span class="chip" style="background:${lightC(sb2.color)};color:${darkC(sb2.color)}">${sb2.label}</span>`;}).join('');
    const chapterChips=chs.map(chk=>`<span class="chip">${chapterByKey(chk).label}</span>`).join('');
    const sectionChips=secs.map(sk=>`<span class="chip">${sectionByKey(sk).label}</span>`).join('');
    const tags=noteTags(n).slice(0,1).map(t=>`<span class="chip">${hl(t,q)}</span>`).join('');
    const linkedChip=(shouldExpand&&!seedIds.has(n.id))?'<span class="chip" style="background:#EAF3DE;color:#3B6D11;border-color:#97C459">跨科關聯</span>':'';
    const displayDate=formatDate(n.date);
    return `<div class="card" data-id="${n.id}"><div class="sel-check"></div><div class="cbar" style="background:${tp.color}"></div><div class="ctop"><span class="ctag" style="background:${tp.color}">${tp.label}</span><span class="cdate">${displayDate}</span></div><div class="ctitle">${hl(n.title,q)}</div><div class="cbody">${n.body}</div><div class="cfoot">${subChips}${chapterChips}${sectionChips}${tags}${linkedChip}</div></div>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(c=>{
    const id=parseInt(c.dataset.id);
    if(multiSelMode) c.classList.add('selectable');
    if(selectedIds[id]){c.classList.add('selected');c.querySelector('.sel-check').textContent='✓';}
    c.addEventListener('click',()=>multiSelMode?toggleCardSelect(id):openNote(id));
  });
  if(filtered.length>PAGE_SIZE){
    const totalPg=Math.ceil(filtered.length/PAGE_SIZE),pager=document.createElement('div');
    pager.id='gridPager';pager.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 14px 28px;';
    if(gridPage>1){const pb=document.createElement('button');pb.className='tool-btn';pb.textContent='← 上一頁';pb.onclick=()=>{gridPage--;render();window.scrollTo(0,0);};pager.appendChild(pb);}
    const pi=document.createElement('span');pi.style.cssText='font-size:12px;color:#7b8492;';pi.textContent=`${gridPage} / ${totalPg}`;pager.appendChild(pi);
    if(gridPage<totalPg){const nb=document.createElement('button');nb.className='tool-btn';nb.textContent='下一頁 →';nb.onclick=()=>{gridPage++;render();window.scrollTo(0,0);};pager.appendChild(nb);}
    g('content').appendChild(pager);
  }
}

function openNote(id) {
  const n=noteById(id); if(!n) return;
  openId=id;
  const tp=typeByKey(n.type),subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
  g('dp-badge').textContent=tp.label; g('dp-badge').style.background=tp.color;
  g('dp-title').textContent=n.title;
  const bodyLabel=g('dp-body')?.previousElementSibling,detailLabel=g('dp-detail')?.previousElementSibling;
  const todoWrap=g('dp-todo'),todoLabel=g('dp-todo-label');
  const fields=getTypeFieldKeys(n.type);
  if(bodyLabel){bodyLabel.style.display=fields.includes('body')?'block':'none';}
  if(detailLabel){detailLabel.style.display=fields.includes('detail')?'block':'none';}
  g('dp-body').style.display=fields.includes('body')?'block':'none';
  g('dp-detail').style.display=fields.includes('detail')?'block':'none';
  g('dp-body').textContent=n.body||'（尚無摘要）';
  g('dp-detail').innerHTML=n.detail||'（尚無詳細筆記）';
  if(fields.includes('todos')){todoLabel.style.display='block';todoWrap.style.display='block';todoWrap.innerHTML=renderTodoHtml(n.todos);}
  else{todoLabel.style.display='none';todoWrap.style.display='none';todoWrap.innerHTML='';}
  const subChips=subs.map(sk=>{const sb=subByKey(sk);return `<span class="chip" style="background:${lightC(sb.color)};color:${darkC(sb.color)}">${sb.label}</span>`;}).join('');
  const chapterChips=chs.map(ch=>`<span class="chip" style="background:#E6F1FB;color:#0C447C">${chapterByKey(ch).label}</span>`).join('');
  const sectionChips=secs.map(sec=>`<span class="chip" style="background:#EEF7FF;color:#1E5AA5">${sectionByKey(sec).label}</span>`).join('');
  const tagHtml=fields.includes('tags')?noteTags(n).map(t=>`<span class="chip">${t}</span>`).join(''):'';
  const customHtml=fields.filter(k=>!BUILTIN_FIELD_DEFS[k]).map(k=>{
    const v=renderFieldValue(n,k);
    return `<span class="chip" title="${getFieldDef(k).label}">${getFieldDef(k).label}：${String(v).slice(0,20)||'（空）'}</span>`;
  }).join('');
  g('dp-chips').innerHTML=subChips+chapterChips+sectionChips+tagHtml+customHtml;
  renderLinksForNote(id);
  g('dp').classList.add('open');['fp','tp'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
}

function renderLinksForNote(id) {
  const related=links.filter(l=>l.from===id||l.to===id);
  const el=g('dp-links');
  if(!related.length){el.innerHTML='<span style="font-size:12px;color:#bbb">尚無關聯</span>';return;}
  el.innerHTML=related.map(l=>{
    const otherId=l.from===id?l.to:l.from,other=noteById(otherId),dir=l.from===id?'→':'←';
    return `<div class="link-item"><div class="link-dot" style="background:${LINK_COLOR}"></div><span class="link-rel" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="link-title link-jump" data-nid="${otherId}" style="cursor:pointer;color:#007AFF;text-decoration:underline;">${other?other.title:'（已刪除）'}</span><button class="link-del" data-lid="${l.id}">✕</button></div>`;
  }).join('');
  el.querySelectorAll('.link-jump').forEach(btn=>btn.addEventListener('click',()=>{const nid2=parseInt(btn.dataset.nid);noteById(nid2)?openNote(nid2):showToast('筆記已被刪除');}));
  el.querySelectorAll('.link-del').forEach(btn=>btn.addEventListener('click',()=>{links=links.filter(l=>l.id!==parseInt(btn.dataset.lid));saveData();renderLinksForNote(id);render();showToast('關聯已刪除');}));
}

function closeDetail() { g('dp').classList.remove('open'); openId=null; syncSidePanelState(); }

let debugVisible=false;
function ensureEruda(){
  return new Promise((resolve,reject)=>{
    if(window.eruda){resolve(window.eruda);return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/eruda';
    s.onload=()=>resolve(window.eruda);
    s.onerror=()=>reject(new Error('load eruda failed'));
    document.head.appendChild(s);
  });
}
async function toggleDebugTool(){
  const btn=g('debugToggle');
  try{
    const er=await ensureEruda();
    if(!er._isInit) er.init();
    debugVisible=!debugVisible;
    if(debugVisible){ er.show(); btn?.classList.add('active'); showToast('偵錯工具已開啟'); }
    else { er.hide(); btn?.classList.remove('active'); showToast('偵錯工具已隱藏'); }
  }catch(e){ showToast('偵錯工具載入失敗'); }
}

// ==================== 表單 ====================
function openForm(isEdit) {
  editMode=isEdit; buildFormSelects();
  if(editMode) {
    const n=noteById(openId); if(!n) return;
    g('form-title').textContent='編輯筆記';
    g('ft').value=n.type;setSelectedValues('fs2',noteSubjects(n));syncChapterSelect(noteSubjects(n),noteChapters(n));syncSectionSelect(noteChapters(n),noteSections(n));g('fti').value=n.title;
    renderDynamicFields(n.type,n);
  } else {
    g('form-title').textContent='新增筆記';
  ['fti'].forEach(id=>{const el=g(id);if(el)el.value='';});
    const defaultSub=subjects[0]?subjects[0].key:null;
    if(defaultSub){setSelectedValues('fs2',[defaultSub]);syncChapterSelect([defaultSub],[]);syncSectionSelect([],[]);}
    else{setSelectedValues('fs2',[]);syncChapterSelect([],[]);syncSectionSelect([],[]);}
    renderDynamicFields(g('ft').value,null);
  }
  buildInlineLinksPanel();
  g('fp').classList.add('open');['dp','tp'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
}
function closeForm() { g('fp').classList.remove('open'); syncSidePanelState(); }

function detachSidePanelsFromNotesView(){
  const host=document.body;
  ['dp','fp','tp'].forEach(id=>{
    const panel=g(id);
    if(panel&&panel.parentElement!==host) host.appendChild(panel);
  });
}
function syncSidePanelState(){
  const hasOpen=['dp','fp','tp'].some(id=>g(id)?.classList.contains('open'));
  document.body.classList.toggle('side-panel-open',hasOpen);
}

function buildInlineLinksPanel() {
  formLinkSelections={};
  renderFormLinks();
  const searchEl=g('fl-search');
  if(searchEl){searchEl.value='';searchEl.oninput=debounce(renderFormLinkSearch,200);}
  const selAllBtn=g('flSelectAllBtn'),addSelBtn=g('flAddSelectedBtn');
  if(selAllBtn) selAllBtn.onclick=()=>{
    g('fl-results')?.querySelectorAll('.fl-result-item').forEach(item=>{formLinkSelections[parseInt(item.dataset.nid,10)]=true;item.classList.add('selected');});
    updateFormLinkBulkActions();
  };
  if(addSelBtn) addSelBtn.onclick=addSelectedFormLinks;
  renderFormLinkSearch();
}
function renderFormLinks() {
  const el=g('form-links-list');
  if(!el||!openId){if(el)el.innerHTML='';return;}
  const related=links.filter(l=>l.from===openId||l.to===openId);
  if(!related.length){el.innerHTML='<span style="font-size:12px;color:#bbb">尚無關聯</span>';return;}
  el.innerHTML=related.map(l=>{const otherId=l.from===openId?l.to:l.from,other=noteById(otherId);return `<div class="fl-item"><span class="fl-item-title">${other?other.title:'（已刪除）'}</span><button class="fl-del" data-lid="${l.id}">✕</button></div>`;}).join('');
  el.querySelectorAll('.fl-del').forEach(btn=>btn.addEventListener('click',()=>{links=links.filter(l=>l.id!==parseInt(btn.dataset.lid));saveData();renderFormLinks();if(isMapOpen)scheduleMapRedraw(100);showToast('關聯已刪除');}));
}
function renderFormLinkSearch() {
  const el=g('fl-results'); if(!el) return;
  const q=(val('fl-search')||'').toLowerCase().trim();
  if(!q){el.innerHTML='';updateFormLinkBulkActions();return;}
  const existIds=links.filter(l=>openId&&(l.from===openId||l.to===openId)).map(l=>l.from===openId?l.to:l.from);
  const pool=notes.filter(n=>n.id!==openId&&!existIds.includes(n.id)&&`${n.title} ${noteSubjectText(n)} ${typeByKey(n.type).label}`.toLowerCase().includes(q)).slice(0,24);
  if(!pool.length){el.innerHTML='<div style="font-size:12px;color:#bbb;padding:4px 0;">找不到符合的筆記</div>';updateFormLinkBulkActions();return;}
  el.innerHTML=pool.map(n=>`<div class="fl-result-item ${formLinkSelections[n.id]?'selected':''}" data-nid="${n.id}"><input type="checkbox" ${formLinkSelections[n.id]?'checked':''}><span class="fl-result-type" style="background:${typeByKey(n.type).color}">${typeByKey(n.type).label}</span><span class="fl-result-title">${n.title}</span></div>`).join('');
  el.querySelectorAll('.fl-result-item').forEach(item=>{
    item.addEventListener('click',()=>{
      const toId=parseInt(item.dataset.nid);
 formLinkSelections[toId]=!formLinkSelections[toId];
      item.classList.toggle('selected',!!formLinkSelections[toId]);
      const cb=item.querySelector('input[type="checkbox"]'); if(cb) cb.checked=!!formLinkSelections[toId];
      updateFormLinkBulkActions();
    });
  });
updateFormLinkBulkActions();
}
function updateFormLinkBulkActions(){
  const wrap=g('fl-bulk-actions'),btn=g('flAddSelectedBtn');
  if(!wrap||!btn) return;
  const count=Object.keys(formLinkSelections).filter(id=>formLinkSelections[id]).length;
  wrap.style.display=g('fl-results')?.children.length?'flex':'none';
  btn.textContent=`建立 ${count} 筆關聯`;
  btn.disabled=count===0;
}
function addSelectedFormLinks(){
  if(!openId){showToast('請先儲存筆記，再新增關聯');return;}
  const targetIds=Object.keys(formLinkSelections).filter(id=>formLinkSelections[id]).map(Number);
  if(!targetIds.length){showToast('請先選擇要關聯的筆記');return;}
  let added=0;
  targetIds.forEach(toId=>{
    if(!links.some(l=>(l.from===openId&&l.to===toId)||(l.from===toId&&l.to===openId))){
      links.push({id:lid++,from:openId,to:toId,rel:'關聯',color:LINK_COLOR}); added++;
    }
  });
  formLinkSelections={};saveData();renderFormLinks();renderFormLinkSearch();showToast(`已建立 ${added} 筆關聯`);if(isMapOpen)scheduleMapRedraw(100);
}

function collectFormValuesByType(typeKey){
  const result={body:'',detail:'',tags:[],todos:[],extraFields:{}};
  getTypeFieldKeys(typeKey).forEach(key=>{
    const el=g(`f-field-${key}`);
    if(!el) return;
    const raw=(el.value||'').trim();
    if(key==='body') result.body=raw;
    else if(key==='detail') result.detail=raw;
    else if(key==='tags') result.tags=raw?[raw]:[];
    else if(key==='todos') result.todos=parseTodos(raw);
    else result.extraFields[key]=raw;
  });
  return result;
}
function renderDynamicFields(typeKey,note=null){
  const wrap=g('dynamicFields'); if(!wrap) return;
  const keys=getTypeFieldKeys(typeKey);
  wrap.innerHTML=keys.map(key=>{
    const def=getFieldDef(key);
    const isText=def.kind==='text';
    const value=note?noteFieldValueForEdit(note,key):'';
    return `<div class="type-field-item"><div class="type-field-title"><label class="type-field-label" for="f-field-${key}">${def.label}</label>${!BUILTIN_FIELD_DEFS[key]?`<button class="type-field-remove" data-remove-custom="${key}" type="button">刪除此自訂欄位</button>`:''}</div>${isText?`<input class="fi" id="f-field-${key}" placeholder="${def.placeholder||''}" value="${value.replace(/"/g,'&quot;')}">`:`<textarea class="ft" id="f-field-${key}" placeholder="${def.placeholder||''}" ${key==='todos'?'style="min-height:96px;"':''}>${value}</textarea>`}</div>`;
  }).join('');
  wrap.querySelectorAll('[data-remove-custom]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.removeCustom;
    const typeCfg=getTypeFieldKeys(typeKey).filter(k=>k!==key);
    typeFieldConfigs[typeKey]=typeCfg;
    saveData();
    renderDynamicFields(typeKey,note);
    showToast('已刪除欄位');
  }));
}
function addTypeFieldForCurrentType(){
  const typeKey=g('ft')?.value;
  if(!typeKey) return;
  const current=getTypeFieldKeys(typeKey);
  const builtins=Object.keys(BUILTIN_FIELD_DEFS).filter(k=>!current.includes(k));
  const guide=builtins.map(k=>`${k}: ${BUILTIN_FIELD_DEFS[k].label}`).join('\n');
  const input=prompt(`輸入要新增的欄位 key（可輸入內建 key 或自訂名稱）\n${guide||'（目前內建欄位已全加入）'}`,'detail');
  if(input===null) return;
  const raw=input.trim();
  if(!raw){showToast('欄位名稱不能空白');return;}
  let key=raw;
  if(!BUILTIN_FIELD_DEFS[key]&&!customFieldDefs[key]){
    const label=prompt('請輸入欄位顯示名稱：',raw);
    if(!label) return;
    const kindRaw=prompt('欄位型態（text / textarea）：','textarea');
    if(kindRaw===null) return;
    const kind=kindRaw.trim()==='text'?'text':'textarea';
    customFieldDefs[key]={key,label:label.trim()||raw,kind,placeholder:''};
  }
  if(current.includes(key)){showToast('此欄位已存在');return;}
  typeFieldConfigs[typeKey]=[...current,key];
  saveData();
  renderDynamicFields(typeKey,editMode&&openId?noteById(openId):null);
  showToast('欄位已新增');
}
function removeTypeFieldForCurrentType(){
  const typeKey=g('ft')?.value;
  if(!typeKey) return;
  const current=getTypeFieldKeys(typeKey);
  if(current.length<=1){showToast('至少需保留一個欄位');return;}
  const guide=current.map(k=>`${k}: ${getFieldDef(k).label}`).join('\n');
  const input=prompt(`輸入要刪除的欄位 key\n${guide}`,current[current.length-1]||'');
  if(input===null) return;
  const key=input.trim();
  if(!current.includes(key)){showToast('找不到該欄位');return;}
  typeFieldConfigs[typeKey]=current.filter(k=>k!==key);
  saveData();
  renderDynamicFields(typeKey,editMode&&openId?noteById(openId):null);
  showToast('欄位已刪除');
}
function saveNote() {
  const title=(g('fti').value||'').trim();
  if(!title){g('fti').style.borderColor='#FF3B30';showToast('請輸入標題');return;}
  g('fti').style.borderColor='';
  const typeKey=g('ft').value;
  const fieldData=collectFormValuesByType(typeKey);
  const selectedSubs=selectedValues('fs2').slice(0,1);
  if(!selectedSubs.length){showToast('請至少選擇一個科目');return;}
  const selectedChs=selectedValues('fc').slice(0,1);
  const selectedSecs=selectedValues('fsec').slice(0,1);
  const primarySubject=selectedSubs[0]||'';
  const primaryChapter=selectedChs[0]||'';
  const primarySection=selectedSecs[0]||'';
  if(editMode&&openId) {
    const idx=notes.findIndex(n=>n.id===openId);
  if(idx!==-1) Object.assign(notes[idx],{type:typeKey,subject:primarySubject,subjects:selectedSubs,chapter:primaryChapter,chapters:selectedChs,section:primarySection,sections:selectedSecs,title,body:fieldData.body,detail:fieldData.detail,tags:fieldData.tags,todos:fieldData.todos,extraFields:fieldData.extraFields});
    saveData();closeForm();render();showToast('筆記已更新！');
    setTimeout(()=>openNote(openId),150);
  } else {
    const d=new Date(),dt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newNote={id:nid++,type:typeKey,subject:primarySubject,subjects:selectedSubs,chapter:primaryChapter,chapters:selectedChs,section:primarySection,sections:selectedSecs,title,body:fieldData.body,detail:fieldData.detail,tags:fieldData.tags,date:dt,todos:fieldData.todos,extraFields:fieldData.extraFields};
    notes.unshift(newNote);openId=newNote.id;
    saveData();closeForm();render();showToast('筆記已儲存！');
    if(isMapOpen) setTimeout(()=>openNote(newNote.id),120);
    else setTimeout(()=>{window.scrollTo(0,0);setTimeout(()=>openNote(notes[0].id),300);},100);
  }
}
function duplicateNote() {
  if(!openId){showToast('請先開啟要複製的筆記');return;}
  const src=noteById(openId);
  if(!src){showToast('找不到要複製的筆記');return;}
  const d=new Date(),dt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const copyTitle=`${src.title}（複製）`;
  const newNote={
    id:nid++,
    type:src.type,
    subject:src.subject,
    subjects:[...noteSubjects(src)],
    chapter:src.chapter||'',
    chapters:[...noteChapters(src)],
    section:src.section||'',
    sections:[...noteSections(src)],
    title:copyTitle,
    body:src.body||'',
    detail:src.detail||'',
    tags:[...noteTags(src)],
    date:dt,
    todos:Array.isArray(src.todos)?src.todos.map(t=>({text:t.text||'',done:!!t.done})):[],
    extraFields:{...noteExtraFields(src)}
  };
  notes.unshift(newNote);
  openId=newNote.id;
  saveData();
  render();
  showToast('已複製筆記');
  setTimeout(()=>{window.scrollTo(0,0);setTimeout(()=>openNote(newNote.id),220);},80);
}
async function copyNoteToClipboard() {
  if(!openId){showToast('請先開啟要複製的筆記');return;}
  const n=noteById(openId);
  if(!n){showToast('找不到要複製的筆記');return;}
  const tagText=noteTags(n).join('、')||'無';
  const text=[
    n.title||'（未命名）',
    '',
    '摘要',
    n.body||'',
    '',
    '詳細筆記',
    n.detail||'',
    '',
    `標籤：${tagText}`
  ].join('\n');
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
    }else{
      const ta=document.createElement('textarea');
      ta.value=text;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast('已複製筆記內容');
  }catch(_err){
    showToast('複製失敗，請稍後再試');
  }
}
function deleteNote() { if(!openId||!confirm('確定刪除這筆筆記？相關關聯也會一起刪除。')) return; links=links.filter(l=>l.from!==openId&&l.to!==openId);notes=notes.filter(n=>n.id!==openId);saveData();closeDetail();render();showToast('已刪除'); }
// ==================== 標籤管理 ====================
function openTagMgr() {
  chapterSubjectFilter='';
  sectionChapterFilter='';
  activeTagCategory='type';
  g('tp').classList.add('open');
  ['dp','fp'].forEach(p=>g(p).classList.remove('open'));
  renderTagLists();
  syncSidePanelState();
}
function renderTagLists() {
  renderTagList('typeTagList',types,'type');
  renderTagList('subTagList',subjects,'sub');
  if(chapterSubjectFilter&&!subjects.some(s=>s.key===chapterSubjectFilter)) chapterSubjectFilter='';
  if(sectionChapterFilter&&!chapters.some(ch=>ch.key===sectionChapterFilter)) sectionChapterFilter='';
  renderChapterTagList();
  renderSectionTagList();
  const sel=g('newChapterSubject');
  if(sel) sel.innerHTML='<option value="all">全部科目</option>'+subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  const secSel=g('newSectionChapter');
  if(secSel) secSel.innerHTML='<option value="all">全部章</option>'+chapters.map(ch=>`<option value="${ch.key}">${ch.label}</option>`).join('');
  g('tagCategoryNav')?.querySelectorAll('.tag-nav-btn').forEach(btn=>{
    const active=btn.dataset.category===activeTagCategory;
    btn.classList.toggle('active',active);
    btn.onclick=()=>{ activeTagCategory=btn.dataset.category||'type'; renderTagLists(); };
  });
  g('tp')?.querySelectorAll('.tag-category-panel').forEach(panel=>{
    panel.classList.toggle('active',panel.dataset.categoryPanel===activeTagCategory);
  });
}
function renderTagList(cid,arr,kind) {
  const el=g(cid);
let list=arr.map((item,idx)=>({...item,_idx:idx,_usage:tagUsageCount(kind,item.key)}));
  if(tagSearchQ) list=list.filter(item=>item.label.toLowerCase().includes(tagSearchQ));
  if(tagUnusedOnly) list=list.filter(item=>item._usage===0);
  if(!list.length){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">（無符合條件的標籤）</div>';return;}
  el.innerHTML=list.map(item=>`<div class="tag-item ${kind==='sub'&&chapterSubjectFilter===item.key?'active-subject':''}" draggable="true" data-draggable-tag="1" data-idx="${item._idx}" data-kind="${kind}" ${kind==='sub'?`data-subject-key="${item.key}"`:''}><span class="tag-drag-handle" title="拖曳排序">⋮⋮</span><div class="tag-color-dot" style="background:${item.color}"></div><span class="tag-item-label">${item.label}</span><span class="tag-item-meta">${item._usage} 筆</span><div class="tag-actions"><button class="tag-icon-btn" title="上移" data-idx="${item._idx}" data-kind="${kind}" data-dir="-1">↑</button><button class="tag-icon-btn" title="下移" data-idx="${item._idx}" data-kind="${kind}" data-dir="1">↓</button><button class="tag-icon-btn" title="編輯" data-idx="${item._idx}" data-kind="${kind}" data-edit="1">✎</button><button class="tag-icon-btn delete" title="刪除" data-idx="${item._idx}" data-kind="${kind}" data-del="1">🗑</button></div></div>`).join('');
  if(kind==='sub'){
    el.querySelectorAll('.tag-item[data-subject-key]').forEach(row=>row.addEventListener('click',ev=>{
      if(ev.target.closest('button')) return;
      chapterSubjectFilter=row.dataset.subjectKey||'';
      activeTagCategory='chapter';
      renderTagLists();
    }));
  }
  bindTagActions(el);
  bindTagDrag(el);
}
function renderChapterTagList() {
  const el=g('chapterTagList'); if(!el) return;
  if(!chapterSubjectFilter){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">請先到「科目」面板選擇一個科目，再管理章。</div>';return;}
let list=chapters.map((item,idx)=>({...item,_idx:idx,_usage:tagUsageCount('chapter',item.key)}));
  list=list.filter(item=>item.subject===chapterSubjectFilter||item.subject==='all');
  if(tagSearchQ) list=list.filter(item=>`${item.label} ${subByKey(item.subject).label}`.toLowerCase().includes(tagSearchQ));
  if(tagUnusedOnly) list=list.filter(item=>item._usage===0);
  if(!list.length){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">（無符合條件的章）</div>';return;}
  el.innerHTML=list.map(item=>{
    const subLabel=item.subject==='all'?'全部':subByKey(item.subject).label;
return `<div class="tag-item ${sectionChapterFilter===item.key?'active-subject':''}" draggable="true" data-draggable-tag="1" data-idx="${item._idx}" data-kind="chapter" data-chapter-key="${item.key}"><span class="tag-drag-handle" title="拖曳排序">⋮⋮</span><div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;"><span class="tag-item-label">${item.label}</span><span class="tag-item-sub">${subLabel}</span></div><span class="tag-item-meta">${item._usage} 筆</span><div class="tag-actions"><button class="tag-icon-btn" title="上移" data-idx="${item._idx}" data-kind="chapter" data-dir="-1">↑</button><button class="tag-icon-btn" title="下移" data-idx="${item._idx}" data-kind="chapter" data-dir="1">↓</button><button class="tag-icon-btn" title="編輯" data-idx="${item._idx}" data-kind="chapter" data-edit="1">✎</button><button class="tag-icon-btn delete" title="刪除" data-idx="${item._idx}" data-kind="chapter" data-del="1">🗑</button></div></div>`;
  }).join('');
  el.querySelectorAll('.tag-item[data-chapter-key]').forEach(row=>row.addEventListener('click',ev=>{
    if(ev.target.closest('button')) return;
    sectionChapterFilter=row.dataset.chapterKey||'';
    activeTagCategory='section';
    renderTagLists();
  }));
  bindTagActions(el);
  bindTagDrag(el);
}
function renderSectionTagList() {
  const el=g('sectionTagList'); if(!el) return;
  if(!sectionChapterFilter){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">請先到「章」面板選擇一個章，再管理節。</div>';return;}
  let list=sections.map((item,idx)=>({...item,_idx:idx,_usage:tagUsageCount('section',item.key)}));
  list=list.filter(item=>item.chapter===sectionChapterFilter||item.chapter==='all');
  if(tagSearchQ) list=list.filter(item=>`${item.label} ${chapterByKey(item.chapter).label}`.toLowerCase().includes(tagSearchQ));
  if(tagUnusedOnly) list=list.filter(item=>item._usage===0);
  if(!list.length){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">（無符合條件的節）</div>';return;}
  el.innerHTML=list.map(item=>{
    const chapterLabel=item.chapter==='all'?'全部章':chapterByKey(item.chapter).label;
    return `<div class="tag-item" draggable="true" data-draggable-tag="1" data-idx="${item._idx}" data-kind="section"><span class="tag-drag-handle" title="拖曳排序">⋮⋮</span><div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;"><span class="tag-item-label">${item.label}</span><span class="tag-item-sub">${chapterLabel}</span></div><span class="tag-item-meta">${item._usage} 筆</span><div class="tag-actions"><button class="tag-icon-btn" title="上移" data-idx="${item._idx}" data-kind="section" data-dir="-1">↑</button><button class="tag-icon-btn" title="下移" data-idx="${item._idx}" data-kind="section" data-dir="1">↓</button><button class="tag-icon-btn" title="編輯" data-idx="${item._idx}" data-kind="section" data-edit="1">✎</button><button class="tag-icon-btn delete" title="刪除" data-idx="${item._idx}" data-kind="section" data-del="1">🗑</button></div></div>`;
  }).join('');
  bindTagActions(el);
  bindTagDrag(el);
}
function bindTagActions(root){
  root.querySelectorAll('.tag-icon-btn[data-dir]').forEach(b=>b.addEventListener('click',()=>moveTag(parseInt(b.dataset.idx,10),b.dataset.kind,parseInt(b.dataset.dir,10))));
  root.querySelectorAll('.tag-icon-btn[data-edit]').forEach(b=>b.addEventListener('click',()=>editTag(parseInt(b.dataset.idx,10),b.dataset.kind)));
  root.querySelectorAll('.tag-icon-btn[data-del]').forEach(b=>b.addEventListener('click',()=>deleteTag(parseInt(b.dataset.idx,10),b.dataset.kind)));
}
function bindTagDrag(root){
  root.querySelectorAll('.tag-item[data-draggable-tag]').forEach(row=>{
    row.addEventListener('dragstart',ev=>{
      row.classList.add('dragging');
      ev.dataTransfer.effectAllowed='move';
      ev.dataTransfer.setData('text/plain',JSON.stringify({idx:Number(row.dataset.idx),kind:row.dataset.kind}));
    });
    row.addEventListener('dragend',()=>row.classList.remove('dragging'));
    row.addEventListener('dragover',ev=>ev.preventDefault());
    row.addEventListener('drop',ev=>{
      ev.preventDefault();
      const raw=ev.dataTransfer.getData('text/plain');
      if(!raw) return;
      let data=null;
      try{ data=JSON.parse(raw); }catch(_e){ return; }
      const toIdx=Number(row.dataset.idx), fromIdx=Number(data.idx), kind=row.dataset.kind;
      if(!Number.isFinite(fromIdx)||!Number.isFinite(toIdx)||kind!==data.kind||fromIdx===toIdx) return;
      reorderTagByIndex(kind,fromIdx,toIdx);
    });
  });
}
function reorderTagByIndex(kind,fromIdx,toIdx){
  const arr=kind==='type'?types:(kind==='sub'?subjects:(kind==='section'?sections:chapters));
  if(!arr[fromIdx]||!arr[toIdx]) return;
  const [item]=arr.splice(fromIdx,1);
  arr.splice(toIdx,0,item);
  saveData();renderTagLists();rebuildUI();render();
}
function moveTag(idx,kind,dir){
  const arr=kind==='type'?types:(kind==='sub'?subjects:(kind==='section'?sections:chapters));
  const target=idx+dir;
  if(!arr[idx]||target<0||target>=arr.length) return;
  [arr[idx],arr[target]]=[arr[target],arr[idx]];
  saveData();renderTagLists();rebuildUI();render();
}
function clearUnusedTags(){
  const usedTypes=new Set(notes.map(n=>n.type)),usedSubs=new Set(notes.flatMap(n=>noteSubjects(n))),usedChapters=new Set(notes.flatMap(n=>noteChapters(n))),usedSections=new Set(notes.flatMap(n=>noteSections(n)));
  const before={types:types.length,subs:subjects.length,chapters:chapters.length,sections:sections.length};
  types=types.filter(t=>usedTypes.has(t.key));
  subjects=subjects.filter(s=>usedSubs.has(s.key));
  chapters=chapters.filter(c=>usedChapters.has(c.key));
  sections=sections.filter(s=>usedSections.has(s.key));
  const removed=(before.types-types.length)+(before.subs-subjects.length)+(before.chapters-chapters.length)+(before.sections-sections.length);
  saveData();renderTagLists();rebuildUI();render();showToast(removed?`已清理 ${removed} 個未使用標籤`:'沒有可清理的標籤');
}
function editTag(idx,kind) {
  if(kind==='chapter'){editChapterTag(idx);return;}
  if(kind==='section'){editSectionTag(idx);return;}
  const arr=kind==='type'?types:subjects,item=arr[idx];
  const nl2=prompt('修改標籤名稱：',item.label); if(!nl2) return;
  const nv=nl2.trim(); if(!nv){showToast('名稱不能為空');return;}
  if(arr.some((t,i)=>i!==idx&&t.label===nv)){showToast('標籤名稱重複');return;}
  const nc=prompt('修改顏色（#RRGGBB）：',item.color); if(!nc) return;
  const ncv=nc.trim(); if(!/^#[0-9A-Fa-f]{6}$/.test(ncv)){showToast('顏色格式不正確');return;}
  arr[idx].label=nv;arr[idx].color=ncv;
  saveData();renderTagLists();buildTypeRow();buildSubRow();render();showToast('標籤已更新');
}
function editChapterTag(idx) {
  const item=chapters[idx]; if(!item) return;
  const nl2=prompt('修改章名稱：',item.label); if(!nl2) return;
  const nv=nl2.trim(); if(!nv){showToast('名稱不能為空');return;}
  if(chapters.some((c,i)=>i!==idx&&c.label===nv&&c.subject===item.subject)){showToast('相同科目下章重複');return;}
  const guide=['all: 全部科目'].concat(subjects.map(s=>`${s.key}: ${s.label}`)).join('\n');
  const ns=prompt(`修改章科目（請輸入 key）\n${guide}`,item.subject||'all'); if(ns===null) return;
  const subjectKey=(ns||'').trim()||'all';
  if(subjectKey!=='all'&&!subjects.some(s=>s.key===subjectKey)){showToast('章科目不存在');return;}
  const oldKey=item.key;
  item.label=nv;item.subject=subjectKey;
  if(!chapters.some((c,i)=>i!==idx&&c.key===nv)){item.key=nv;notes.forEach(n=>{const chs=noteChapters(n).map(x=>x===oldKey?nv:x);n.chapters=uniq(chs);n.chapter=n.chapters[0]||'';});sections.forEach(sec=>{if(sec.chapter===oldKey)sec.chapter=nv;});if(cch===oldKey)cch='all';if(mapFilter.chapter===oldKey)mapFilter.chapter='all';}
  saveData();renderTagLists();rebuildUI();render();showToast('章已更新');
}
function editSectionTag(idx){
  const item=sections[idx]; if(!item) return;
  const nl2=prompt('修改節名稱：',item.label); if(!nl2) return;
  const nv=nl2.trim(); if(!nv){showToast('名稱不能為空');return;}
  if(sections.some((s,i)=>i!==idx&&s.label===nv&&s.chapter===item.chapter)){showToast('相同章下節重複');return;}
  const guide=['all: 全部章'].concat(chapters.map(ch=>`${ch.key}: ${ch.label}`)).join('\n');
  const nc=prompt(`修改節所屬章（請輸入 key）\n${guide}`,item.chapter||'all'); if(nc===null) return;
  const chapterKey=(nc||'').trim()||'all';
  if(chapterKey!=='all'&&!chapters.some(ch=>ch.key===chapterKey)){showToast('章不存在');return;}
  const oldKey=item.key;
  item.label=nv; item.chapter=chapterKey;
  if(!sections.some((s,i)=>i!==idx&&s.key===nv)){item.key=nv;notes.forEach(n=>{const secs=noteSections(n).map(x=>x===oldKey?nv:x);n.sections=uniq(secs);n.section=n.sections[0]||'';});if(csec===oldKey)csec='all';}
  saveData();renderTagLists();rebuildUI();render();showToast('節已更新');
}
function deleteTag(idx,kind) {
  const arr=kind==='type'?types:(kind==='sub'?subjects:(kind==='section'?sections:chapters));
  if(kind==='chapter'){
    const removed=arr[idx]; if(!removed) return;
    if(!confirm(`確定刪除章「${removed.label}」？已使用此章的筆記會改為未分類。`)) return;
    arr.splice(idx,1);notes.forEach(n=>{n.chapters=noteChapters(n).filter(ch=>ch!==removed.key);n.chapter=n.chapters[0]||'';});
    sections=sections.filter(s=>s.chapter!==removed.key);
    if(cch===removed.key)cch='all';if(mapFilter.chapter===removed.key)mapFilter.chapter='all';
    saveData();renderTagLists();rebuildUI();render();showToast('章已刪除');return;
  }
  if(kind==='section'){
    const removed=arr[idx]; if(!removed) return;
    if(!confirm(`確定刪除節「${removed.label}」？已使用此節的筆記會改為未分類。`)) return;
    arr.splice(idx,1);notes.forEach(n=>{n.sections=noteSections(n).filter(sec=>sec!==removed.key);n.section=n.sections[0]||'';});
    if(csec===removed.key)csec='all';
    saveData();renderTagLists();rebuildUI();render();showToast('節已刪除');return;
  }
  const removed=arr[idx];
  if(!confirm(`確定刪除標籤「${removed.label}」？`)) return;
  arr.splice(idx,1);
  if(kind==='type'&&removed) delete typeFieldConfigs[removed.key];
  saveData();renderTagLists();rebuildUI();render();showToast('標籤已刪除');
}

function addTag(kind) {
  if(kind==='chapter'){
    const label=(g('newChapterLabel').value||'').trim();
    const subjectSel=g('newChapterSubject');
    const subject=subjectSel?(subjectSel.value||'all'):'all';
    if(!label){showToast('請輸入章名稱');return;}
    if(chapters.some(ch=>ch.label===label&&ch.subject===subject)){showToast('章已存在');return;}
    const key=chapters.some(ch=>ch.key===label)?`chapter_${Date.now()}`:label;
    chapters.push({key,label,subject});
    g('newChapterLabel').value='';
    saveData();renderTagLists();rebuildUI();showToast('章已新增！');return;
  }
  if(kind==='section'){
    const label=(g('newSectionLabel').value||'').trim();
    const chapterSel=g('newSectionChapter');
    const chapter=chapterSel?(chapterSel.value||'all'):'all';
    if(!label){showToast('請輸入節名稱');return;}
    if(sections.some(sec=>sec.label===label&&sec.chapter===chapter)){showToast('節已存在');return;}
    const key=sections.some(sec=>sec.key===label)?`section_${Date.now()}`:label;
    sections.push({key,label,chapter});
    g('newSectionLabel').value='';
    saveData();renderTagLists();rebuildUI();showToast('節已新增！');return;
  }
  const isType=kind==='type';
  const label=(g(isType?'newTypeLabel':'newSubLabel').value||'').trim();
  const color=g(isType?'newTypeColor':'newSubColor').value;
  if(!label){showToast('請輸入標籤名稱');return;}
  const arr=isType?types:subjects;
  if(arr.some(t=>t.label===label)){showToast('標籤已存在');return;}
  const newKey='tag_'+Date.now();
  arr.push({key:newKey,label,color});
  if(isType) typeFieldConfigs[newKey]=getTypeFieldKeys(newKey);
  g(isType?'newTypeLabel':'newSubLabel').value='';
  saveData();renderTagLists();rebuildUI();showToast('標籤已新增！');
}

// ==================== 匯入/匯出 ====================
function exportData() {
  const json=JSON.stringify({notes,links,nid,lid,types,subjects,chapters,sections,nodeSizes,mapCenterNodeId,mapCenterNodeIds,mapCollapsed,exported:new Date().toISOString()},null,2);
  const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const d=new Date();
  a.download=`法律筆記備份_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}.json`;
  a.href=url;a.click();URL.revokeObjectURL(url);showToast('已匯出！');
}
function importData(file) {
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const d=JSON.parse(e.target.result); if(!d.notes) throw new Error();
      // ★ 修復匯入日期格式
      d.notes.forEach(n=>{
        if(!n.dispute)n.dispute='';if(!n.f_article)n.f_article='';if(!n.f_elements)n.f_elements='';if(!n.f_conclusion)n.f_conclusion='';
        if(!n.tags)n.tags=[];if(!n.detail)n.detail='';if(!Array.isArray(n.todos))n.todos=[];
        if(!Array.isArray(n.subjects)) n.subjects=typeof n.subject==='string'&&n.subject?[n.subject]:[];
        if(!Array.isArray(n.chapters)) n.chapters=typeof n.chapter==='string'&&n.chapter?[n.chapter]:[];
        if(!Array.isArray(n.sections)) n.sections=typeof n.section==='string'&&n.section?[n.section]:[];
        n.subjects=uniq(n.subjects);n.chapters=uniq(n.chapters);
        n.sections=uniq(n.sections);
        n.subject=n.subjects[0]||'';n.chapter=n.chapters[0]||'';n.section=n.sections[0]||'';
        n.date=formatDate(n.date)||'1970-01-01';
      });
      if(d.links) d.links.forEach(l=>{l.rel='關聯';l.color=LINK_COLOR;});
      if(confirm('確定 = 完整覆蓋（取代所有現有筆記，保留現有科目/章設定）\n取消 = 合併（只加入新筆記）')) {
        // ★ 覆蓋模式：不覆蓋 types/subjects/chapters
        notes=d.notes;links=d.links||[];
        nodeSizes=d.nodeSizes||{};mapCenterNodeId=d.mapCenterNodeId||null;mapCenterNodeIds=(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object')?d.mapCenterNodeIds:{};mapCollapsed=(d.mapCollapsed&&typeof d.mapCollapsed==='object')?d.mapCollapsed:{};
        nid=d.nid||notes.length+100;lid=d.lid||10;notes.sort((a,b)=>b.id-a.id);
        normalizeNoteIds(true);
        saveData();rebuildUI();render();showToast(`已覆蓋，共 ${notes.length} 筆筆記`);
      } else {
        // ★ 合併模式：同樣不覆蓋 types/subjects/chapters
        const existing=notes.map(n=>n.id);let added=0;
        d.notes.forEach(n=>{if(!existing.includes(n.id)){notes.push(n);added++;if(n.id>=nid)nid=n.id+1;}});
        if(d.links)links=d.links;
        if(d.nodeSizes)nodeSizes={...nodeSizes,...d.nodeSizes};if(d.mapCenterNodeId)mapCenterNodeId=d.mapCenterNodeId;
        if(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object') mapCenterNodeIds={...mapCenterNodeIds,...d.mapCenterNodeIds};
        if(d.mapCollapsed&&typeof d.mapCollapsed==='object') mapCollapsed={...mapCollapsed,...d.mapCollapsed};
        notes.sort((a,b)=>b.id-a.id);normalizeNoteIds(true);saveData();rebuildUI();render();showToast(`已合併，新增 ${added} 筆`);
      }
    } catch(ex){showToast('匯入失敗，請確認檔案格式');}
  };
  reader.readAsText(file);
}

// ==================== 快捷鍵 ====================
function loadShortcuts() { try{const raw=localStorage.getItem('legal_shortcuts_v2');if(raw){const p=JSON.parse(raw);shortcuts=DEFAULT_SHORTCUTS.map(s=>p.find(x=>x.id===s.id)?{...s,...p.find(x=>x.id===s.id)}:{...s});}else shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s}));}catch(e){shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s}));} }
function saveShortcuts() { localStorage.setItem('legal_shortcuts_v2',JSON.stringify(shortcuts)); }
const codeToDisplay = c => !c?'未設定':c==='Escape'?'Esc':c==='Space'?'Space':c==='Backspace'?'Backspace':c==='Enter'?'Enter':c==='Tab'?'Tab':c.startsWith('Key')?c.slice(3).toUpperCase():c.startsWith('Digit')?c.slice(5):c;
const fmtKey = sc => !sc.code?'未設定':[sc.ctrl?'Ctrl':'',sc.alt?'Alt':'',sc.shift?'Shift':'',codeToDisplay(sc.code)].filter(Boolean).join(' + ');
function renderShortcutList() {
  g('scpList').innerHTML=shortcuts.map((sc,i)=>`<div class="sc-item"><span class="sc-label">${sc.label}</span><button class="sc-key${sc.code?' has-key':''}" data-idx="${i}">${fmtKey(sc)}</button><button data-clear="${i}">✕</button></div>`).join('');
  g('scpList').querySelectorAll('.sc-key').forEach(btn=>btn.addEventListener('click',()=>{if(recordingBtn){recordingBtn.classList.remove('recording');recordingBtn.textContent=fmtKey(shortcuts[parseInt(recordingBtn.dataset.idx)]);}recordingBtn=btn;btn.classList.add('recording');btn.textContent='請按下按鍵...';btn.focus();}));
  g('scpList').querySelectorAll('[data-clear]').forEach(btn=>btn.addEventListener('click',()=>{const idx=parseInt(btn.dataset.clear);shortcuts[idx].code='';shortcuts[idx].ctrl=shortcuts[idx].shift=shortcuts[idx].alt=false;saveShortcuts();renderShortcutList();}));
}
function openShortcutMgr() {
  recordingBtn=null;
  renderShortcutList();
  g('scp').style.display='block';
  ['dp','fp','tp'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
  setTimeout(()=>g('scp').scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}
function closeShortcutMgr() { if(recordingBtn){recordingBtn.classList.remove('recording');recordingBtn=null;}g('scp').style.display='none'; }
function handleGlobalKey(e) {
  if(recordingBtn){
    if(['Control','Shift','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;
    e.preventDefault();e.stopPropagation();
    if(e.code==='Escape'){recordingBtn.classList.remove('recording');recordingBtn.textContent=fmtKey(shortcuts[parseInt(recordingBtn.dataset.idx)]);recordingBtn=null;return;}
    const idx=parseInt(recordingBtn.dataset.idx);shortcuts[idx]={...shortcuts[idx],code:e.code,ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey,alt:e.altKey};
    recordingBtn.classList.remove('recording');recordingBtn.classList.add('has-key');recordingBtn.textContent=fmtKey(shortcuts[idx]);recordingBtn=null;saveShortcuts();return;
  }
  if(['input','textarea','select'].includes(e.target.tagName.toLowerCase())) return;
  const ctrl=e.ctrlKey||e.metaKey;
  shortcuts.forEach(sc=>{if(sc.code&&sc.code===e.code&&sc.ctrl===ctrl&&sc.shift===e.shiftKey&&sc.alt===e.altKey){e.preventDefault();execShortcut(sc.id);}});
}
function execShortcut(id) {
  const map={
    new:()=>openForm(false),
    search:()=>{
      const target=isMapOpen?g('mapSearchInput'):g('searchInput');
      if(target){target.focus();target.select?.();}
    },
    map:()=>{if(!isMapOpen)toggleMapView(true);},back:()=>{if(isMapOpen)toggleMapView(false);},
    close:()=>{if(g('scp').style.display==='block')closeShortcutMgr();else if(g('tp').classList.contains('open')){g('tp').classList.remove('open');syncSidePanelState();}else if(g('fp').classList.contains('open'))closeForm();else if(g('dp').classList.contains('open'))closeDetail();},
    edit:()=>{if(openId)openForm(true);},link:()=>{if(openId)openForm(true);},
    export:()=>exportData(),stats:()=>{if(!isMapOpen)openStats();},shortcuts:()=>openShortcutMgr()
  };
  if(map[id]) map[id]();
  showShortcutHint({new:'新增筆記',search:'搜尋',map:'開啟體系圖',back:'返回筆記列表',close:'關閉',edit:'編輯筆記',link:'新增關聯',export:'匯出備份',stats:'統計',shortcuts:'快捷鍵設定'}[id]);
}
function showShortcutHint(t){ const h=g('scHint');h.textContent=t;h.style.display='block';clearTimeout(h._t);h._t=setTimeout(()=>h.style.display='none',1800); }
function setMapLinkedOnlyBtnStyle(){
  const btn=g('mapLinkedOnlyBtn');
  if(!btn) return;
  btn.style.background=mapLinkedOnly?'#edf4fb':'#f5f5f5';
  btn.style.color=mapLinkedOnly?'#0C447C':'#666';
  btn.style.borderColor=mapLinkedOnly?'#b7d1eb':'#ddd';
  btn.textContent=mapLinkedOnly?'✓ 關聯節點':'🔗 關聯節點';
}
function updateMapPinnedChapter(){
  const el=g('mapPinnedChapter');
  if(!el) return;
  const ch=mapFilter.chapter==='all'?null:chapterByKey(mapFilter.chapter);
  el.textContent=ch?`章：${ch.label}`:'章：未設定';
}
function setMapAdvanced(open){
  mapAdvancedOpen=!!open;
  const mapView=g('mapView');
  if(mapView) mapView.classList.toggle('map-advanced-open',mapAdvancedOpen);
  const btn=g('mapAdvancedToggleBtn');
  if(btn){
    btn.textContent=mapAdvancedOpen?'⚙️ 收合進階':'⚙️ 進階';
    btn.style.background=mapAdvancedOpen?'#0C447C':'#f5f5f5';
    btn.style.color=mapAdvancedOpen?'#fff':'#555';
    btn.style.borderColor=mapAdvancedOpen?'#0C447C':'#ddd';
  }
}

function toggleMapView(open) {
  isMapOpen=open;currentView=open?'map':'notes';
  g('notesView').style.display=open?'none':'block';
  g('mapView').classList.toggle('open',open);
  g('subbar').style.display=open?'none':'flex';
  const advanced=g('filterAdvanced');
  if(advanced) advanced.style.display=open?'none':'block';
  if(open){
    setMapAdvanced(false);
    if(cch!=='all') mapFilter.chapter=cch;
    else if(selectedChapters.length) mapFilter.chapter=selectedChapters[0];
    buildMapFilters();
    updateMapPinnedChapter();
    const mapSearch=g('mapSearchInput');if(mapSearch)mapSearch.value=mapFilter.q||'';
    g('zoomLabel').textContent=Math.round(mapScale*100)+'%';
    setMapLinkedOnlyBtnStyle();
    const focusBtn=g('mapFocusBtn');
    if(focusBtn){focusBtn.style.background=mapFocusMode?'#0C447C':'#f0f7ff';focusBtn.style.color=mapFocusMode?'#fff':'#0C447C';focusBtn.textContent=`🎯 焦點模式：${mapFocusMode?'開':'關'}`;}
    setTimeout(()=>{const hadNodePos=Object.keys(nodePos).length>0;initNodePos();drawMap();if(!hadNodePos)saveData();},80);
  } else { closeLanePanel();closeMapPopup(); }
}

// ==================== 統計 ====================
function openStats() {
  const sp=g('statsPanel');
  if(sp.classList.contains('open')){sp.classList.remove('open');return;}
  const total=notes.length,byT={},byS={};
  notes.forEach(n=>{byT[n.type]=(byT[n.type]||0)+1;noteSubjects(n).forEach(sk=>{byS[sk]=(byS[sk]||0)+1;});});
  const lnk={};links.forEach(l=>{lnk[l.from]=true;lnk[l.to]=true;});const lc=Object.keys(lnk).length;
  let html=`<div class="stats-grid"><div class="stat-card"><div class="stat-num">${total}</div><div class="stat-lbl">筆記總數</div></div><div class="stat-card"><div class="stat-num">${links.length}</div><div class="stat-lbl">關聯數量</div></div><div class="stat-card"><div class="stat-num">${lc}</div><div class="stat-lbl">有關聯筆記</div></div><div class="stat-card"><div class="stat-num">${subjects.length}</div><div class="stat-lbl">科目數</div></div></div><div style="font-size:11px;font-weight:700;color:#888;margin-bottom:8px;">各科目筆記數</div>`;
  Object.keys(byS).sort((a,b)=>byS[b]-byS[a]).forEach(sk=>{const s=subByKey(sk),c=byS[sk],p=Math.round(c/total*100);html+=`<div class="stats-bar-row"><span class="stats-bar-label">${s.label}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${p}%;background:${s.color}"></div></div><span class="stats-bar-count">${c}</span></div>`;});
  html+=`<div style="font-size:11px;font-weight:700;color:#888;margin:12px 0 8px;">各類型筆記數</div>`;
  Object.keys(byT).sort((a,b)=>byT[b]-byT[a]).forEach(tk=>{const t=typeByKey(tk),c=byT[tk],p=Math.round(c/total*100);html+=`<div class="stats-bar-row"><span class="stats-bar-label">${t.label}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${p}%;background:${t.color}"></div></div><span class="stats-bar-count">${c}</span></div>`;});
  sp.innerHTML=html;sp.classList.add('open');setTimeout(()=>sp.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}

// ==================== 多選 ====================
function enterMultiSel() {
  multiSelMode=true;selectedIds={};
  g('selectBar').classList.add('open');
  g('multiSelBtn').style.background='#1a1a2e';
  g('multiSelBtn').style.color='#fff';
  ['dp','fp'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
  updateSelBar();
  render();
}
function exitMultiSel() { multiSelMode=false;selectedIds={};g('selectBar').classList.remove('open');g('multiSelBtn').style.background='#f0f0f0';g('multiSelBtn').style.color='';render(); }
function updateSelBar() { const cnt=Object.keys(selectedIds).length;g('selectCount').textContent=`已選 ${cnt} 筆`;g('selDeleteBtn').disabled=cnt===0;g('selDeleteBtn').style.opacity=cnt===0?'0.4':'1'; }
function toggleCardSelect(id) { selectedIds[id]?delete selectedIds[id]:selectedIds[id]=true;updateSelBar();const c=g('grid').querySelector(`.card[data-id="${id}"]`);if(c){if(selectedIds[id]){c.classList.add('selected');c.querySelector('.sel-check').textContent='✓';}else{c.classList.remove('selected');c.querySelector('.sel-check').textContent='';}} }
function selectAll() { const cards=g('grid').querySelectorAll('.card'),allSel=Object.keys(selectedIds).length===cards.length;if(allSel)selectedIds={};else cards.forEach(c=>{const cid=parseInt(c.dataset.id);selectedIds[cid]=true;c.classList.add('selected');c.querySelector('.sel-check').textContent='✓';});updateSelBar(); }
function deleteSelected() { const ids=Object.keys(selectedIds);if(!ids.length)return;if(!confirm(`確定刪除這 ${ids.length} 筆筆記？此操作無法復原。`))return;const idNums=ids.map(Number);links=links.filter(l=>!idNums.includes(l.from)&&!idNums.includes(l.to));notes=notes.filter(n=>!selectedIds[n.id]);saveData();exitMultiSel();showToast(`已刪除 ${ids.length} 筆筆記`); }

// ==================== 申論測驗 ====================
function loadExams() { try{const r=localStorage.getItem('klaws_exams_v1');if(r){examList=JSON.parse(r);examList.forEach(e=>{if(/^tag_s_|^tag_t_/.test(e.subject))e.subject=subByKey(e.subject).label;});saveExams();}}catch(e){examList=[];} }
function saveExams() { try{localStorage.setItem('klaws_exams_v1',JSON.stringify(examList));}catch(e){} }
function openExamPanel() {
  loadExams();renderExamList();
  const esel=g('examSubSel');if(esel)esel.innerHTML=subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  g('examListPanel').classList.add('open');g('examAddForm').classList.remove('open');g('dp').classList.remove('open');
  setTimeout(()=>g('examListPanel').scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}
function renderExamList() {
  const el=g('examListItems');
  if(!examList.length){el.innerHTML='<div style="color:#bbb;font-size:13px;padding:12px 0;">尚無題目，請點新增題目</div>';return;}
  el.innerHTML=examList.map((ex,i)=>`<div class="exam-item" data-idx="${i}"><div><div class="exam-item-title">${subByKey(ex.subject).label} | ${ex.question.slice(0,35)}${ex.question.length>35?'...':''}</div><div class="exam-item-meta">${ex.timeLimit}分鐘</div></div><button class="exam-item-del" data-del="${i}">🗑️</button></div>`).join('');
  el.querySelectorAll('.exam-item').forEach(el2=>{el2.addEventListener('click',ev=>{if(ev.target.getAttribute('data-del')!==null)return;startExam(examList[parseInt(el2.dataset.idx)]);});});
  el.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();examList.splice(parseInt(btn.dataset.del),1);saveExams();renderExamList();}));
}
function startExam(exam) {
  currentExam=exam;g('examListPanel').classList.remove('open');g('notesView').style.display='none';g('examView').classList.add('open');
  g('examBody').style.display='flex';g('examResult').style.display='none';
  g('examQuestionDisplay').textContent=exam.question;g('examIssueChips').innerHTML=(exam.issues||[]).map(iss=>`<span class="exam-issue-chip">${iss}</span>`).join('');
  g('examAnswerBox').value='';g('examWordCount').textContent='0 字';g('examHeaderTitle').textContent=`✒️ ${subByKey(exam.subject).label}`;
  examTotal=exam.timeLimit*60;examSec=examTotal;
  const updateTimer=()=>{const m=Math.floor(examSec/60),s=examSec%60;g('examTimer').textContent=`${m<10?'0':''}${m}:${s<10?'0':''}${s}`;if(examSec<=300)g('examTimer').classList.add('warning');};
  updateTimer();clearInterval(examTimer);examTimer=setInterval(()=>{examSec--;updateTimer();if(examSec<=0)doSubmit(true);},1000);
}
function doSubmit(timeUp) {
  clearInterval(examTimer);const ans=g('examAnswerBox').value.trim(),used=Math.round((examTotal-examSec)/60*10)/10;
  g('examBody').style.display='none';g('examResult').style.display='flex';g('examResult').classList.add('open');
  g('resultScoreNum').textContent='--';g('resultComment').textContent='評分中，請稍候…';g('resultRef').textContent='';g('resultTags').innerHTML='';
  gradeEssay(currentExam,ans,used,timeUp);
}
function gradeEssay(exam,ans,used,timeUp) {
  const issueList=(exam.issues||[]).join('、');
  const prompt=`你是台灣大學法律系教授，正在批改學生的申論題作答。請給予詳細、具體、有教育價值的評語。\n\n【科目】${subByKey(exam.subject).label}\n【題目】\n${exam.question.slice(0,300)}\n【預設爭點】${issueList}\n【學生作答】\n${(ans||'(未作答)').slice(0,3000)}\n【作答時間】${used}分鐘${timeUp?' (時間到，作答可能不完整)':''}\n\n請依下列 JSON 格式輸出評分（只輸出 JSON，不加任何其他文字或 markdown）：\n{"score":<0-100整數>,"comment":"<100-150字整體總評>","issue_analysis":[{"issue":"<爭點名稱>","hit":<true/false>,"analysis":"<針對此爭點的詳細評析>"}],"strengths":["<具體優點1>"],"weaknesses":["<具體缺點1>"],"suggestions":["<具體改進建議1>"],"reference":"<參考答題要點>"}`;
  fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAiKey(),'HTTP-Referer':'https://kinayaya.github.io/LawsNote','X-Title':'KLaws'},
    body:JSON.stringify({model:getAiModel(),max_tokens:5000,messages:[{role:'user',content:prompt}]})
  }).then(r=>r.json()).then(d=>{
    if(d.error){g('resultScoreNum').textContent='?';g('resultComment').textContent='AI 錯誤：'+(d.error.message||JSON.stringify(d.error));return;}
    let raw=(((d.choices||[{}])[0].message||{}).content||'').replace(/```json|```/g,'').trim();
    const start=raw.indexOf('{'),end=raw.lastIndexOf('}');if(start!==-1&&end!==-1)raw=raw.slice(start,end+1);
    try{showResult(JSON.parse(raw));}catch(e){g('resultScoreNum').textContent='?';g('resultComment').textContent='AI 回應無法解析，原始內容：\n'+raw.slice(0,300);}
  }).catch(e=>{g('resultScoreNum').textContent='?';g('resultComment').textContent='評分服務暫時無法連線。錯誤：'+e.message;});
}
function showResult(r) {
  g('resultScoreNum').textContent=r.score||'--';
  const sc=g('resultScoreNum').parentElement;sc.style.background=r.score>=80?'#1D9E75':r.score>=60?'#378ADD':r.score>=40?'#D85A30':'#8B1A1A';
  g('resultComment').textContent=r.comment||'';
  const iaEl=g('resultIssueAnalysis');if(iaEl)iaEl.innerHTML=(r.issue_analysis||[]).map(item=>`<div class="issue-analysis-item"><div class="issue-analysis-head"><span class="issue-analysis-name">${item.issue}</span><span class="issue-hit-badge" style="background:${item.hit?'#1D9E75':'#D85A30'}">${item.hit?'✔ 有涵蓋':'✘ 未涵蓋'}</span></div><div class="issue-analysis-body">${item.analysis}</div></div>`).join('');
  let tags='';(r.strengths||[]).forEach(s=>tags+=`<span class="result-tag good">✓ ${s}</span>`);(r.weaknesses||[]).forEach(s=>tags+=`<span class="result-tag bad">✗ ${s}</span>`);(r.suggestions||[]).forEach(s=>tags+=`<span class="result-tag ok">→ ${s}</span>`);
  g('resultTags').innerHTML=tags;g('resultRef').textContent=r.reference||'';
}
function closeExamView() {
  clearInterval(examTimer);
  g('examView').classList.remove('open');
  g('notesView').style.display='block';
  g('subbar').style.display='flex';
  const advanced=g('filterAdvanced');
  if(advanced) advanced.style.display='block';
}

function initMoreMenu(){
  const btn=g('moreToolsBtn'),menu=g('moreToolsMenu');
  if(!btn||!menu) return;
  btn.addEventListener('click',e=>{e.stopPropagation();menu.classList.toggle('open');});
  menu.querySelectorAll('button,label').forEach(el=>el.addEventListener('click',()=>menu.classList.remove('open')));
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&e.target!==btn)menu.classList.remove('open');});
}

// ==================== 體系圖 ====================
function initNodePos() { const canvas=g('mapCanvas');mapW=canvas.offsetWidth||800;mapH=canvas.offsetHeight||500;const cx=mapW/2,cy=mapH/2,r=Math.min(mapW,mapH)*.44;notes.forEach((n,i)=>{if(!nodePos[n.id]){const angle=(i/notes.length)*2*Math.PI;nodePos[n.id]={x:cx+r*Math.cos(angle),y:cy+r*Math.sin(angle)};}}); }
function getNodeRadius(id){ return clampMapRadius(parseFloat(nodeSizes[id])||MAP_NODE_RADIUS_DEFAULT); }
function clampNodeToCanvas(id){ if(!nodePos[id])return;const r=getNodeRadius(id)+12;nodePos[id].x=Math.max(r,Math.min(mapW-r,nodePos[id].x));nodePos[id].y=Math.max(r,Math.min(mapH-r,nodePos[id].y)); }
function pointToSegmentDistance(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
  if(!len2) return {dist:Math.hypot(px-x1,py-y1),nx:0,ny:0};
  let t=((px-x1)*dx+(py-y1)*dy)/len2;t=Math.max(0,Math.min(1,t));
  const cx=x1+t*dx,cy=y1+t*dy,vx=px-cx,vy=py-cy,d=Math.hypot(vx,vy);
  if(d<.001){const nx=-dy/Math.sqrt(len2),ny=dx/Math.sqrt(len2);return{dist:0,nx,ny};}
  return{dist:d,nx:vx/d,ny:vy/d};
}
function pushNodeOffLinks(nodeId,visLinks,pad=0){
  const pos=nodePos[nodeId];if(!pos)return false;
  const need=getNodeRadius(nodeId)+12+pad;let moved=false;
  visLinks.forEach(lk=>{if(lk.from===nodeId||lk.to===nodeId)return;const a=nodePos[lk.from],b=nodePos[lk.to];if(!a||!b)return;const hit=pointToSegmentDistance(pos.x,pos.y,a.x,a.y,b.x,b.y);if(hit.dist<need){const push=need-hit.dist+.8;pos.x+=hit.nx*push;pos.y+=hit.ny*push;clampNodeToCanvas(nodeId);moved=true;}});
  return moved;
}
function forceLayout() {
  const canvas=g('mapCanvas');mapW=canvas.offsetWidth||800;mapH=canvas.offsetHeight||600;
  const layoutNotes=visibleNotes(),visIds={};layoutNotes.forEach(n=>visIds[n.id]=true);
  const visLinks=visibleLinks(visIds),n2=layoutNotes.length;if(!n2)return;
  const scopedCenterId=getMapCenterFromScopes();
  const hasStoredCenter=!!scopedCenterId&&notes.some(n=>n.id===scopedCenterId);
  if(!hasStoredCenter){
    const linkCount={};layoutNotes.forEach(n=>linkCount[n.id]=0);visLinks.forEach(lk=>{linkCount[lk.from]=(linkCount[lk.from]||0)+1;linkCount[lk.to]=(linkCount[lk.to]||0)+1;});
    setMapCenterForCurrentScope(layoutNotes.reduce((max,n)=>linkCount[n.id]>linkCount[max.id]?n:max,layoutNotes[0]).id);
  }
  const activeCenterId=getMapCenterFromScopes();
  const layoutCenterNodeId=visIds[activeCenterId]?activeCenterId:(()=>{
    const linkCount={};layoutNotes.forEach(n=>linkCount[n.id]=0);visLinks.forEach(lk=>{linkCount[lk.from]=(linkCount[lk.from]||0)+1;linkCount[lk.to]=(linkCount[lk.to]||0)+1;});
    return layoutNotes.reduce((max,n)=>linkCount[n.id]>linkCount[max.id]?n:max,layoutNotes[0]).id;
  })();
  const laneCfg=getLaneConfig(),laneCount=laneCfg.names.length;
  const ROW_GAP_Y=92,TOP_PAD=72,BOT_PAD=40;
  const laneLeft=Math.max(80,mapW*.1),laneRight=Math.min(mapW-80,mapW*.9);
  const laneGapX=laneCount>1?(laneRight-laneLeft)/(laneCount-1):0;
  const adj={};layoutNotes.forEach(n=>adj[n.id]=[]);visLinks.forEach(lk=>{if(adj[lk.from])adj[lk.from].push(lk.to);if(adj[lk.to])adj[lk.to].push(lk.from);});
  const layers={},visited=new Set(),queue=[layoutCenterNodeId];layers[layoutCenterNodeId]=0;visited.add(layoutCenterNodeId);
  while(queue.length){const current=queue.shift(),cl=layers[current];(adj[current]||[]).forEach(neighbor=>{if(!visited.has(neighbor)){visited.add(neighbor);layers[neighbor]=cl+1;queue.push(neighbor);}});}
  const connectedMaxLayer=Object.values(layers).reduce((m,v)=>Math.max(m,v),0);
  layoutNotes.forEach(n=>{if(!visited.has(n.id))layers[n.id]=connectedMaxLayer+1;});
  const laneGroups={};Object.keys(layers).forEach(nodeId=>{const lane=Math.max(0,Math.min(laneCount-1,layers[nodeId]||0));if(!laneGroups[lane])laneGroups[lane]=[];laneGroups[lane].push(parseInt(nodeId,10));});
  const laneOrder={};Object.keys(laneGroups).forEach(lane=>{laneOrder[lane]=laneGroups[lane].slice().sort((a,b)=>(adj[b]||[]).length-(adj[a]||[]).length||a-b);});
  for(let pass=0;pass<6;pass++){
    for(let lane=1;lane<laneCount;lane++){
      const arr=laneOrder[lane]||[],prev=laneOrder[lane-1]||[],prevIdx={};prev.forEach((id,idx)=>prevIdx[id]=idx);
      arr.sort((a,b)=>{
        const an=(adj[a]||[]).map(id=>prevIdx[id]).filter(v=>v!==undefined);
        const bn=(adj[b]||[]).map(id=>prevIdx[id]).filter(v=>v!==undefined);
        const am=an.length?an.reduce((s,v)=>s+v,0)/an.length:9999,bm=bn.length?bn.reduce((s,v)=>s+v,0)/bn.length:9999;
        return am-bm||a-b;
      });
    }
  }
  mapNodeMeta={};
  for(let lane=0;lane<laneCount;lane++){
    const arr=laneOrder[lane]||[],x=laneLeft+lane*laneGapX;
    const usableHeight=Math.max(120,mapH-TOP_PAD-BOT_PAD);
    const gap=arr.length>1?Math.min(ROW_GAP_Y,usableHeight/(arr.length-1)):0;
    const totalHeight=Math.max(0,(arr.length-1)*gap),startY=TOP_PAD+(usableHeight-totalHeight)/2;
    arr.forEach((nodeId,idx)=>{const y=startY+idx*gap;nodePos[nodeId]={x,y};mapNodeMeta[nodeId]={lane,order:idx};clampNodeToCanvas(nodeId);});
  }
  saveDataDeferred();
}
function visibleLinks(visIds){ return links.filter(lk=>visIds[lk.from]&&visIds[lk.to]); }
function buildLinkCurveOffsets(visLinks){
  if(MAP_LIGHT_BUNDLING_STRENGTH<=0) return {};
  const groups={},spacing=12,laneOrder2=idx=>idx===0?0:(idx%2===1?(idx+1)/2:-(idx/2));
  visLinks.forEach(lk=>{
    const fp=nodePos[lk.from],tp=nodePos[lk.to];if(!fp||!tp)return;
    const dx=tp.x-fp.x,dy=tp.y-fp.y,ang=Math.atan2(dy,dx);
    const key=`${lk.from}_${Math.round((ang+Math.PI)/(Math.PI/10))}`;
    if(!groups[key])groups[key]=[];groups[key].push(lk);
  });
  const offsets={};
  Object.values(groups).forEach(arr=>{
    arr.sort((a,b)=>{
      const ta=nodePos[a.to],tb=nodePos[b.to];
      if(!ta||!tb) return a.id-b.id;
      return ta.y-tb.y||ta.x-tb.x||a.id-b.id;
    });
    arr.forEach((lk,idx)=>{offsets[lk.id]=laneOrder2(idx)*spacing;});
  });
  return offsets;
}
function calcLinkPath(lk,opt={}){
  const fp=nodePos[lk.from],tp=nodePos[lk.to];if(!fp||!tp)return null;
  const dx=tp.x-fp.x,dy=tp.y-fp.y,dist=Math.sqrt(dx*dx+dy*dy)||1,nx=dx/dist,ny=dy/dist;
  const px=-ny,py=nx;
  const rf=getNodeRadius(lk.from),rt=getNodeRadius(lk.to);
  const x1=fp.x+nx*rf,y1=fp.y+ny*rf,x2=tp.x-nx*(rt+8),y2=tp.y-ny*(rt+8);
  const laneOffset=linkCurveOffsets[lk.id]||0;
  const unbundled=!!opt.unbundled;
  const splitOffset=unbundled?0:Math.max(-26,Math.min(26,laneOffset*MAP_LIGHT_BUNDLING_STRENGTH));
  const trunkLen=Math.max(22,Math.min(68,dist*0.5));
  const c1x=x1+nx*trunkLen, c1y=y1+ny*trunkLen;
  const c2x=x2-nx*Math.max(20,Math.min(52,dist*0.22))+px*splitOffset;
  const c2y=y2-ny*Math.max(20,Math.min(52,dist*0.22))+py*splitOffset;
  const d=`M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  return {d};
}
function moveNodeEl(id,x,y){
  const grp=nodeEls[id];if(!grp)return;
  const mainCircle=grp.querySelector('circle.node-main'),r=parseFloat(mainCircle?mainCircle.getAttribute('r'):24)||24;
  if(mainCircle){mainCircle.setAttribute('cx',x);mainCircle.setAttribute('cy',y);}
  const foldBtn=grp.querySelector('circle.node-fold-btn');
  if(foldBtn){
    const foldBtnR=parseFloat(foldBtn.getAttribute('r')||'9')||9;
    const foldOffset=(r+foldBtnR)/Math.sqrt(2);
    foldBtn.setAttribute('cx',x+foldOffset);foldBtn.setAttribute('cy',y-foldOffset);
  }
  const foldSign=grp.querySelector('text.node-fold-sign');
  if(foldSign&&foldBtn){
    const cx=parseFloat(foldBtn.getAttribute('cx')||String(x+r*.72))||x+r*.72;
    const cy=parseFloat(foldBtn.getAttribute('cy')||String(y-r*.72))||y-r*.72;
    foldSign.setAttribute('x',cx);foldSign.setAttribute('y',cy+1);
  }
  const countText=grp.querySelector('text.node-count');if(countText){countText.setAttribute('x',x);countText.setAttribute('y',y);}
  const titleText=grp.querySelector('text.node-title');if(titleText){titleText.setAttribute('x',x);titleText.setAttribute('y',y+r+14);titleText.querySelectorAll('tspan').forEach(t=>t.setAttribute('x',x));}
}
function redrawLines(affectedId){
  const visIds={};visibleNotes().forEach(n=>visIds[n.id]=true);
  linkCurveOffsets=buildLinkCurveOffsets(visibleLinks(visIds));
  const toUpdateIds=affectedId!==undefined?(nodeLinksIndex[affectedId]||[]):Object.keys(linkElsMap).map(Number);
  toUpdateIds.forEach(linkId=>{
    const els=linkElsMap[linkId],lk=links.find(x=>x.id===linkId);if(!els||!els.p||!lk)return;
    if(!visIds[lk.from]||!visIds[lk.to])return;
    const unbundled=!!mapFocusedNodeId&&(lk.from===mapFocusedNodeId||lk.to===mapFocusedNodeId);
    const c=calcLinkPath(lk,{unbundled});if(!c)return;els.p.setAttribute('d',c.d);
  });
}
function visibleNotes(){
  const q=(mapFilter.q||'').toLowerCase(),linkedIds={};
  if(mapLinkedOnly)links.forEach(l=>{linkedIds[l.from]=true;linkedIds[l.to]=true;});
  const filtered=notes.filter(n=>{
    const subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
    return (mapFilter.sub==='all'||subs.includes(mapFilter.sub))
      &&(mapFilter.chapter==='all'||chs.includes(mapFilter.chapter))
      &&(mapFilter.section==='all'||secs.includes(mapFilter.section))
      &&(!q||`${n.title}${subs.join('')}${chs.join('')}${secs.join('')}${noteTags(n).join('')}`.toLowerCase().includes(q));
  });
  let base=filtered.filter(n=>!mapLinkedOnly||linkedIds[n.id]);
  if(mapLinkedOnly&&!base.length&&filtered.length){
    mapLinkedOnly=false;setMapLinkedOnlyBtnStyle();
    showToast('目前沒有關聯節點，已自動顯示全部節點');saveDataDeferred();base=filtered;
  }
  const baseIds={};base.forEach(n=>baseIds[n.id]=true);
  if(base.length){
    const hiddenByCollapse={},stack=[];
    Object.keys(mapCollapsed||{}).forEach(key=>{
      const id=parseInt(key,10);
      if(mapCollapsed[id]&&baseIds[id]) stack.push(id);
    });
    while(stack.length){
      const current=stack.pop();
      links.forEach(lk=>{
        if(lk.from!==current||!baseIds[lk.to]||hiddenByCollapse[lk.to]||mapCollapsed[lk.to]) return;
        hiddenByCollapse[lk.to]=true;
        stack.push(lk.to);
      });
    }
    base=base.filter(n=>!hiddenByCollapse[n.id]);
  }
  if(mapDepth==='all'||!base.length)return base;
  const depthBaseIds={};base.forEach(n=>depthBaseIds[n.id]=true);
  const centerId=getMapCenterFromScopes();
  if(!centerId||!depthBaseIds[centerId])return base;
  const maxDepth=parseInt(mapDepth,10);if(!maxDepth)return base;
  const adj={};links.forEach(l=>{if(!depthBaseIds[l.from]||!depthBaseIds[l.to])return;if(!adj[l.from])adj[l.from]=[];if(!adj[l.to])adj[l.to]=[];adj[l.from].push(l.to);adj[l.to].push(l.from);});
  const seen={[centerId]:0},q2=[centerId];
  while(q2.length){const id=q2.shift(),depth=seen[id];if(depth>=maxDepth)continue;(adj[id]||[]).forEach(nid=>{if(seen[nid]===undefined){seen[nid]=depth+1;q2.push(nid);}});}
  return base.filter(n=>seen[n.id]!==undefined);
}
function scheduleMapRedraw(ms=60){ if(mapRedrawTimer)clearTimeout(mapRedrawTimer);if(mapTimer)clearTimeout(mapTimer);mapRedrawTimer=setTimeout(()=>drawMap(),ms);mapTimer=mapRedrawTimer; }
function drawMap(){
  if(!isMapOpen)return;
  const canvas=g('mapCanvas'),svg=g('mapSvg'),linksLayer=g('linksLayer'),nodesLayer=g('nodesLayer');
  if(!canvas||!svg||!linksLayer||!nodesLayer)return;
  mapW=canvas.offsetWidth||1200;mapH=canvas.offsetHeight||1000;
  svg.setAttribute('viewBox',`0 0 ${mapW} ${mapH}`);svg.setAttribute('width',String(mapW));svg.setAttribute('height',String(mapH));
  let mapWrap=svg.querySelector('#mapWrap');
  if(!mapWrap){mapWrap=document.createElementNS('http://www.w3.org/2000/svg','g');mapWrap.id='mapWrap';svg.appendChild(mapWrap);mapWrap.appendChild(linksLayer);mapWrap.appendChild(nodesLayer);}
  mapWrap.setAttribute('transform',`translate(${mapOffX},${mapOffY}) scale(${mapScale})`);
  const visNotes=visibleNotes(),visIds={};visNotes.forEach(n=>visIds[n.id]=true);
  if(visNotes.length===0){linksLayer.innerHTML='';nodesLayer.innerHTML='';nodeEls={};linkElsMap={};nodeLinksIndex={};linkCurveOffsets={};closeMapPopup();return;}
  const missingPos=visNotes.some(n=>!nodePos[n.id]||isNaN(nodePos[n.id].x)||isNaN(nodePos[n.id].y));
  if(missingPos)forceLayout();
  visNotes.forEach(n=>{if(nodePos[n.id])clampNodeToCanvas(n.id);});
  const visLinks=visibleLinks(visIds);linkCurveOffsets=buildLinkCurveOffsets(visLinks);
  nodeEls={};linkElsMap={};nodeLinksIndex={};linksLayer.innerHTML='';nodesLayer.innerHTML='';
  const laneCfg=getLaneConfig(),laneCount=laneCfg.names.length;
  const laneLeft=Math.max(80,mapW*.1),laneRight=Math.min(mapW-80,mapW*.9);
  const laneGapX=laneCount>1?(laneRight-laneLeft)/(laneCount-1):0;
  for(let i=0;i<laneCount;i++){
    const x=laneLeft+i*laneGapX;
    const guide=document.createElementNS('http://www.w3.org/2000/svg','line');
    guide.setAttribute('x1',x);guide.setAttribute('y1',42);guide.setAttribute('x2',x);guide.setAttribute('y2',mapH-18);
    guide.setAttribute('stroke','#d6deea');guide.setAttribute('stroke-width','1');guide.setAttribute('stroke-dasharray','5 6');guide.style.opacity='0.8';linksLayer.appendChild(guide);
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.classList.add('map-lane-label');label.setAttribute('x',x);label.setAttribute('y',26);label.setAttribute('text-anchor','middle');label.textContent=laneCfg.names[i];linksLayer.appendChild(label);
  }
  visLinks.forEach(lk=>{
    if(!nodeLinksIndex[lk.from])nodeLinksIndex[lk.from]=[];if(!nodeLinksIndex[lk.to])nodeLinksIndex[lk.to]=[];
    nodeLinksIndex[lk.from].push(lk.id);nodeLinksIndex[lk.to].push(lk.id);
    const pathData=calcLinkPath(lk);if(!pathData)return;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',pathData.d);path.setAttribute('stroke',LINK_COLOR);path.setAttribute('stroke-width','1.35');path.setAttribute('fill','none');path.setAttribute('marker-end','url(#arrowBlue)');path.style.opacity='0.18';linksLayer.appendChild(path);linkElsMap[lk.id]={p:path};
  });
  visNotes.forEach(n=>{
    const pos=nodePos[n.id];if(!pos)return;
    const type=typeByKey(n.type),radius=getNodeRadius(n.id);
    const grp=document.createElementNS('http://www.w3.org/2000/svg','g');grp.classList.add('map-node');grp.dataset.id=String(n.id);
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.classList.add('node-main');circle.setAttribute('cx',pos.x);circle.setAttribute('cy',pos.y);circle.setAttribute('r',radius);circle.setAttribute('fill',lightC(type.color));circle.setAttribute('stroke',type.color);circle.setAttribute('stroke-width','2');
    const countText=document.createElementNS('http://www.w3.org/2000/svg','text');countText.classList.add('node-count');countText.setAttribute('x',pos.x);countText.setAttribute('y',pos.y+4);countText.setAttribute('text-anchor','middle');countText.setAttribute('font-size',String(Math.max(10,Math.min(14,radius*.55))));countText.setAttribute('font-weight','700');countText.setAttribute('fill',type.color);countText.textContent=String(links.filter(l=>l.from===n.id||l.to===n.id).length||0);
    const titleText=document.createElementNS('http://www.w3.org/2000/svg','text');titleText.classList.add('node-title');titleText.setAttribute('x',pos.x);titleText.setAttribute('y',pos.y+radius+14);titleText.setAttribute('text-anchor','middle');titleText.setAttribute('font-size','11');titleText.setAttribute('fill','#2b2b2b');
    splitMapTitleLines(n.title,8).slice(0,2).forEach((line,i)=>{const tspan=document.createElementNS('http://www.w3.org/2000/svg','tspan');tspan.setAttribute('x',pos.x);tspan.setAttribute('dy',i===0?0:13);tspan.textContent=line;titleText.appendChild(tspan);});
    const hasChildren=links.some(l=>l.from===n.id&&noteById(l.to));
    if(hasChildren){
      const foldBtnR=Math.max(8,Math.min(11,radius*.33));
      const foldOffset=(radius+foldBtnR)/Math.sqrt(2);
      const foldX=pos.x+foldOffset,foldY=pos.y-foldOffset;
      const foldBtn=document.createElementNS('http://www.w3.org/2000/svg','circle');
      foldBtn.classList.add('node-fold-btn');
      foldBtn.setAttribute('cx',foldX);foldBtn.setAttribute('cy',foldY);foldBtn.setAttribute('r',foldBtnR);
      foldBtn.setAttribute('fill','#ffffff');foldBtn.setAttribute('stroke',type.color);foldBtn.setAttribute('stroke-width','1.5');
      foldBtn.style.cursor='pointer';
      const foldSign=document.createElementNS('http://www.w3.org/2000/svg','text');
      foldSign.classList.add('node-fold-sign');
      foldSign.setAttribute('x',foldX);foldSign.setAttribute('y',foldY+1);
      foldSign.setAttribute('text-anchor','middle');foldSign.setAttribute('dominant-baseline','middle');
      foldSign.setAttribute('font-size',String(Math.max(11,Math.min(16,radius*.65))));
      foldSign.setAttribute('font-weight','700');foldSign.setAttribute('fill',type.color);
      foldSign.style.cursor='pointer';
      foldSign.textContent=mapCollapsed[n.id]?'+':'−';
      const toggleFold=e=>{e.stopPropagation();toggleMapFold(n.id);};
      foldBtn.addEventListener('click',toggleFold);
      foldSign.addEventListener('click',toggleFold);
      grp.appendChild(foldBtn);grp.appendChild(foldSign);
    }
    grp.appendChild(circle);grp.appendChild(countText);grp.appendChild(titleText);
    grp.addEventListener('click',e=>{e.stopPropagation();showMapInfo(n.id);openMapPopup(n.id);highlightNode(n.id);});
    grp.addEventListener('mousedown',e=>startDrag(e,n.id));grp.addEventListener('touchstart',e=>startDragTouch(e,n.id),{passive:true});
    nodesLayer.appendChild(grp);nodeEls[n.id]=grp;
  });
  applyFocusStyles();
}
function toggleMapFold(id){
  if(mapCollapsed[id]) delete mapCollapsed[id];
  else mapCollapsed[id]=true;
  closeMapPopup();
  drawMap();
  saveDataDeferred();
}
function openMapPopup(id){
  const popup=g('mapPopup'),pos=nodePos[id];if(!popup||!pos)return;
  const maxLeft=Math.max(8,mapW-320),maxTop=Math.max(8,mapH-250);
  const left=Math.max(8,Math.min(maxLeft,pos.x*mapScale+mapOffX+14)),top=Math.max(8,Math.min(maxTop,pos.y*mapScale+mapOffY+14));
  popup.style.left=`${left}px`;popup.style.top=`${top}px`;popup.classList.add('open');
  const goBtn=g('mpGoto');if(goBtn)goBtn.onclick=()=>{openNote(id);closeMapPopup();};
}
function showMapInfo(id){
  const n=noteById(id);if(!n)return;
  const tp=typeByKey(n.type),sb=subByKey(n.subject),related=links.filter(l=>l.from===id||l.to===id);
  g('mpBadge').textContent=tp.label;g('mpBadge').style.background=tp.color;g('mpTitle').textContent=n.title;
  g('mpSubject').textContent=sb.label;g('mpSubject').style.background=sb.color+'22';g('mpSubject').style.color=sb.color;
  const sizeNumInput=g('mpNodeSizeNum');
  if(sizeNumInput){
    sizeNumInput.value=String(Math.round(getNodeRadius(id)));
    sizeNumInput.oninput=()=>{const v=parseInt(sizeNumInput.value,10);if(isNaN(v))return;const clamped=clampMapRadius(v);nodeSizes[id]=clamped;clampNodeToCanvas(id);moveNodeEl(id,nodePos[id].x,nodePos[id].y);redrawLines(id);saveDataDeferred();};
    g('mpNodeSizeReset').onclick=()=>{delete nodeSizes[id];sizeNumInput.value=String(Math.round(getNodeRadius(id)));clampNodeToCanvas(id);moveNodeEl(id,nodePos[id].x,nodePos[id].y);redrawLines(id);saveDataDeferred();};
  }
  const currentCenterId=getMapCenterFromScopes();
  const setCenterBtn=document.createElement('button');setCenterBtn.className='mp-set-center';
  setCenterBtn.textContent=currentCenterId===id?'✓ 已是核心':'⭐ 設為核心';
  setCenterBtn.style.cssText='width:100%;padding:8px;margin:8px 0 4px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #ddd;'+(currentCenterId===id?'background:#EAF3DE;color:#3B6D11;border-color:#97C459;':'background:#f5f5f5;color:#555;');
  setCenterBtn.onclick=()=>{setMapCenterForCurrentScope(id);nodePos={};forceLayout();drawMap();saveData();closeMapPopup();showToast(`已將「${n.title}」設為核心節點（僅此科目/章）`);};
  const goBtn=g('mpGoto');
  if(goBtn&&goBtn.parentNode){const oldBtn=goBtn.parentNode.querySelector('.mp-set-center');if(oldBtn)oldBtn.remove();goBtn.parentNode.insertBefore(setCenterBtn,goBtn);}
  const linksEl=g('mpLinks');
  if(!related.length){linksEl.innerHTML='<span class="mp-no-links">尚無關聯</span>';}
  else{
    linksEl.innerHTML=related.map(l=>{const otherId=l.from===id?l.to:l.from,other=noteById(otherId),dir=l.from===id?'→':'←',name=other?other.title:'（已刪除）';return `<div class="mp-link-row"><span class="mp-link-badge" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="mp-link-name" data-nid="${otherId}">${name}</span></div>`;}).join('');
    linksEl.querySelectorAll('.mp-link-name').forEach(el=>{el.addEventListener('click',()=>{closeMapPopup();showMapInfo(parseInt(el.dataset.nid));highlightNode(parseInt(el.dataset.nid));});});
  }
}
function closeMapPopup(){ g('mapPopup').classList.remove('open'); }
function getFocusNodeSet(id){ const set={[id]:true};links.forEach(l=>{if(l.from===id)set[l.to]=true;if(l.to===id)set[l.from]=true;});return set; }
function applyFocusStyles(){
  const focusSet=(mapFocusMode&&mapFocusedNodeId)?getFocusNodeSet(mapFocusedNodeId):null;
  g('nodesLayer').querySelectorAll('.map-node').forEach(grp=>{const nid2=parseInt(grp.dataset.id);grp.classList.remove('map-node-highlight','map-node-dimmed');if(mapFocusedNodeId===nid2)grp.classList.add('map-node-highlight');if(focusSet&&!focusSet[nid2])grp.classList.add('map-node-dimmed');});
  Object.keys(linkElsMap).forEach(key=>{
    const lid2=parseInt(key,10),lk=links.find(l=>l.id===lid2),path=linkElsMap[lid2]&&linkElsMap[lid2].p;
    if(!lk||!path)return;
    const active=!focusSet||(focusSet[lk.from]&&focusSet[lk.to]);
    const isSelectedRelated=!!mapFocusedNodeId&&(lk.from===mapFocusedNodeId||lk.to===mapFocusedNodeId);
    const c=calcLinkPath(lk,{unbundled:isSelectedRelated});
    if(c) path.setAttribute('d',c.d);
    path.style.opacity=isSelectedRelated?'0.98':(active?'0.72':'0.05');
    path.setAttribute('stroke-width',isSelectedRelated?'3.3':(active?'2.1':'0.9'));
  });
}
function highlightNode(id){ mapFocusedNodeId=id;applyFocusStyles(); }
function startDrag(e,id){ e.preventDefault();e.stopPropagation();closeMapPopup();dragNode=id;const pos=nodePos[id],rect=g('mapCanvas').getBoundingClientRect();dragOffX=e.clientX-rect.left-(pos.x*mapScale+mapOffX);dragOffY=e.clientY-rect.top-(pos.y*mapScale+mapOffY); }
function startDragTouch(e,id){ e.stopPropagation();dragNode=id;const pos=nodePos[id],rect=g('mapCanvas').getBoundingClientRect(),touch=e.touches[0];dragOffX=touch.clientX-rect.left-(pos.x*mapScale+mapOffX);dragOffY=touch.clientY-rect.top-(pos.y*mapScale+mapOffY); }
function buildMapFilters(){
  const ss=g('mapFilterSub'),sch=g('mapFilterChapter'),ssc=g('mapFilterSection'),sd=g('mapDepthSel');if(!ss||!sch||!ssc)return;
  ss.innerHTML='<option value="all">全部科目</option>'+subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  if(!subjects.some(s=>s.key===mapFilter.sub))mapFilter.sub='all';
  const mapChapters=chapters.filter(ch=>mapFilter.sub==='all'||ch.subject===mapFilter.sub||ch.subject==='all');
  const preferredChapter=(cch!=='all'&&cch)||selectedChapters[0]||'';
  if(mapChapters.length){
    if(!mapChapters.some(ch=>ch.key===mapFilter.chapter)) mapFilter.chapter=preferredChapter;
    if(!mapChapters.some(ch=>ch.key===mapFilter.chapter)) mapFilter.chapter=mapChapters[0].key;
    sch.innerHTML=mapChapters.map(ch=>`<option value="${ch.key}">${ch.label}</option>`).join('');
  }else{
    mapFilter.chapter='all';
    sch.innerHTML='<option value="all">（目前無可用章）</option>';
  }
  const mapSections=sections.filter(sec=>mapFilter.chapter==='all'||sec.chapter===mapFilter.chapter||sec.chapter==='all');
  if(mapSections.length){
    if(!mapSections.some(sec=>sec.key===mapFilter.section)) mapFilter.section='all';
    ssc.innerHTML='<option value="all">全部節</option>'+mapSections.map(sec=>`<option value="${sec.key}">${sec.label}</option>`).join('');
  }else{
    mapFilter.section='all';
    ssc.innerHTML='<option value="all">（目前無可用節）</option>';
  }
  ss.value=mapFilter.sub;sch.value=mapFilter.chapter;ssc.value=mapFilter.section;
  if(sd)sd.value=['all','1','2','3'].includes(mapDepth)?mapDepth:'all';
  updateMapPinnedChapter();
}
function laneContextLabelText(){ const s=mapFilter.sub==='all'?'全部科目':subByKey(mapFilter.sub).label,sec=mapFilter.section==='all'?'全部節':sectionByKey(mapFilter.section).label;return `目前篩選：${s} / ${sec}`; }
function ensureLanePanel(){
  const existing=g('lanePanel');if(existing)return existing;
  const canvas=g('mapCanvas');if(!canvas)return null;
  const panel=document.createElement('div');panel.id='lanePanel';
  panel.innerHTML=`<div class="lane-panel-head"><span class="lane-panel-title">泳道設定</span><button class="pcls" id="lanePanelClose">×</button></div><div class="lane-panel-desc">可依「目前科目/節篩選」分開設定泳道名稱。</div><div id="laneContextLabel"></div><div class="lane-count-row"><label for="laneCountInput">泳道數量</label><input id="laneCountInput" type="number" min="${MIN_LANE_COUNT}" max="${MAX_LANE_COUNT}" value="${DEFAULT_LANE_NAMES.length}"></div><div id="laneInputs"></div><div class="lane-panel-actions"><button class="fbtn bcl" id="laneResetBtn">恢復預設</button><button class="fbtn bsv" id="laneSaveBtn">儲存</button></div>`;
  canvas.appendChild(panel);on('lanePanelClose','click',closeLanePanel);on('laneSaveBtn','click',saveLanePanel);on('laneResetBtn','click',resetLanePanel);return panel;
}
function renderLanePanel(){
  const panel=ensureLanePanel(),ctx=g('laneContextLabel'),inputs=g('laneInputs');if(!panel||!ctx||!inputs)return;
  const cfg=getLaneConfig();ctx.textContent=`${laneContextLabelText()}（獨立泳道設定）`;
  const laneCountInput=g('laneCountInput');
  if(laneCountInput){
    laneCountInput.value=String(cfg.count);
    laneCountInput.onchange=()=>{
      const nextCount=normalizeLaneCount(laneCountInput.value);
      const currNames=Array.from(inputs.querySelectorAll('input[data-idx]')).map((el,idx)=>(el.value||'').trim()||defaultLaneNameAt(idx));
      const nextNames=Array.from({length:nextCount},(_,idx)=>currNames[idx]||defaultLaneNameAt(idx));
      mapLaneConfigs[cfg.key]={count:nextCount,names:nextNames};
      renderLanePanel();
    };
  }
  inputs.innerHTML=cfg.names.map((name,idx)=>`<div class="lane-input-row"><label>泳道 ${idx+1}</label><input data-idx="${idx}" value="${name}" maxlength="16" placeholder="泳道名稱"></div>`).join('');
}
function openLanePanel(){ const panel=ensureLanePanel();if(!panel)return;renderLanePanel();panel.classList.add('open'); }
function closeLanePanel(){ const panel=g('lanePanel');if(panel)panel.classList.remove('open'); }
function saveLanePanel(){
  const cfg=getLaneConfig(),inputsWrap=g('laneInputs');if(!inputsWrap)return;
const count=normalizeLaneCount(g('laneCountInput')?.value||cfg.count);
  const names=Array.from({length:count},(_,idx)=>{
    const el=inputsWrap.querySelector(`input[data-idx="${idx}"]`);
    return ((el&&el.value)||'').trim()||defaultLaneNameAt(idx);
  });
  mapLaneConfigs[cfg.key]={count,names};saveDataDeferred();closeLanePanel();nodePos={};forceLayout();drawMap();showToast('已儲存泳道設定');
}
function resetLanePanel(){ const cfg=getLaneConfig();mapLaneConfigs[cfg.key]={count:DEFAULT_LANE_NAMES.length,names:DEFAULT_LANE_NAMES.slice()};renderLanePanel();saveDataDeferred(); }

function bindCoreButtons(){
  const bind=(id,fn)=>{const el=g(id);if(el)el.onclick=fn;};
  bind('addBtn',()=>openForm(false));
  bind('editBtn',()=>{if(!openId){showToast('請先開啟一筆筆記');return;}openForm(true);});
  bind('copyBtn',copyNoteToClipboard);
  bind('dupBtn',duplicateNote);
  bind('dpClose',closeDetail);bind('fpClose',closeForm);bind('fpCancel',closeForm);
  bind('fpSave',saveNote);bind('delBtn',deleteNote);
}

// ==================== AI 功能 ====================
function requireAiKey(action){ const k=getAiKey();if(k){action(k);return;}_aiPendingAction=action;g('aiKeyInput').value='';const sel=g('aiModelSel');if(sel)sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join('');g('aiKeyModal').classList.add('open'); }
function openAiSettings(){ g('aiKeyInput').value=getAiKey();const sel=g('aiModelSel');if(sel)sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join('');_aiPendingAction=null;g('aiKeyModal').classList.add('open'); }

// ==================== 初始化 ====================
window.addEventListener('load',()=>{
  detachSidePanelsFromNotesView();
  loadData();rebuildUI();
  initMoreMenu();
  g('sortSelect').value=sortMode;g('sortSelect').addEventListener('change',()=>{sortMode=g('sortSelect').value;gridPage=1;render();saveData();});
  const scopeLinkedToggle=g('scopeLinkedToggle');
  if(scopeLinkedToggle){
    scopeLinkedToggle.checked=scopeLinkedEnabled;
    scopeLinkedToggle.addEventListener('change',()=>{
      scopeLinkedEnabled=!!scopeLinkedToggle.checked;
      localStorage.setItem(SCOPE_LINKED_TOGGLE_KEY,scopeLinkedEnabled?'1':'0');
      gridPage=1;
      render();
      showToast(scopeLinkedEnabled?'已啟用跨科目關聯顯示':'已關閉跨科目關聯顯示');
    });
  }
  g('multiSelBtn').addEventListener('click',()=>multiSelMode?exitMultiSel():enterMultiSel());
  g('selAllBtn').addEventListener('click',selectAll);g('selDeleteBtn').addEventListener('click',deleteSelected);g('selCancelBtn').addEventListener('click',exitMultiSel);
  on('statsBtn','click',openStats);
  on('ft','change',()=>renderDynamicFields(g('ft').value,editMode&&openId?noteById(openId):null));
  on('fs2','change',()=>{
    syncChapterSelect(selectedValues('fs2'),selectedValues('fc'));
    syncSectionSelect(selectedValues('fc'),selectedValues('fsec'));
  });
  on('fc','change',()=>syncSectionSelect(selectedValues('fc'),selectedValues('fsec')));
  const si=g('searchInput'),sc=g('searchClear');
  si.addEventListener('input',debounce(()=>{searchQ=si.value;gridPage=1;sc.style.display=searchQ?'block':'none';render();},250));
  sc.addEventListener('click',()=>{si.value='';searchQ='';gridPage=1;sc.style.display='none';render();si.focus();});
  bindCoreButtons();
  g('exportBtn').addEventListener('click',exportData);
  g('tpClose').addEventListener('click',()=>{g('tp').classList.remove('open');syncSidePanelState();});
  on('tagSearchInput','input',debounce(()=>{tagSearchQ=(val('tagSearchInput')||'').toLowerCase().trim();renderTagLists();},150));
  on('tagUnusedOnly','change',()=>{tagUnusedOnly=!!g('tagUnusedOnly').checked;renderTagLists();});
  on('clearUnusedTagsBtn','click',clearUnusedTags);
  on('tagSettingsBtn','click',()=>g('tagGlobalOptions')?.classList.toggle('open'));
  g('addTypeBtn').addEventListener('click',()=>addTag('type'));g('addSubBtn').addEventListener('click',()=>addTag('sub'));g('addChapterBtn').addEventListener('click',()=>addTag('chapter'));g('addSectionBtn').addEventListener('click',()=>addTag('section'));
  on('panelDirBtn','click',togglePanelDir);
  on('addTypeFieldBtn','click',addTypeFieldForCurrentType);
  on('removeTypeFieldBtn','click',removeTypeFieldForCurrentType);
  loadExams();on('examBtn','click',openExamPanel);on('examListClose','click',()=>g('examListPanel').classList.remove('open'));
  on('examAddBtn','click',()=>{const esel=g('examSubSel');if(esel)esel.innerHTML=subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');g('examListPanel').classList.remove('open');g('examAddForm').classList.add('open');setTimeout(()=>g('examAddForm').scrollIntoView({behavior:'smooth',block:'nearest'}),60);});
  on('examFormClose','click',()=>{g('examAddForm').classList.remove('open');openExamPanel();});on('examFCancel','click',()=>{g('examAddForm').classList.remove('open');openExamPanel();});
  on('examFSave','click',()=>{const q=(g('examQInput').value||'').trim();if(!q){showToast('請輸入題目');return;}const iss=(g('examIssInput').value||'').split(',').map(x=>x.trim()).filter(Boolean);const tl=parseInt(g('examTimeInput').value)||30;const sub=g('examSubSel').value||(subjects[0]?subjects[0].key:'all');examList.push({id:Date.now(),subject:sub,question:q,issues:iss,timeLimit:tl});saveExams();g('examQInput').value='';g('examIssInput').value='';g('examTimeInput').value='30';g('examAddForm').classList.remove('open');openExamPanel();showToast('題目已儲存！');});
  on('examSubmitBtn','click',()=>doSubmit(false));on('examCancelBtn','click',()=>{clearInterval(examTimer);closeExamView();});
  on('examRetryBtn','click',()=>{closeExamView();setTimeout(openExamPanel,100);});on('examBackBtn2','click',closeExamView);
  on('examAnswerBox','input',()=>{g('examWordCount').textContent=g('examAnswerBox').value.replace(/\s/g,'').length+' 字';});
  on('aiSettingsBtn','click',openAiSettings);
  g('aiKeySave').addEventListener('click',()=>{const k=(g('aiKeyInput').value||'').trim();if(!k){showToast('請輸入 OpenRouter API Key');return;}saveAiKey(k);const sel=g('aiModelSel');if(sel&&sel.value)saveAiModel(sel.value);g('aiKeyModal').classList.remove('open');if(_aiPendingAction){_aiPendingAction(k);_aiPendingAction=null;}else showToast('AI 設定已儲存！');});
  g('aiKeyCancel').addEventListener('click',()=>{g('aiKeyModal').classList.remove('open');_aiPendingAction=null;});
  g('importFile').addEventListener('change',e=>{if(e.target.files&&e.target.files[0])importData(e.target.files[0]);e.target.value='';});
  on('debugToggle','click',toggleDebugTool);
  g('shortcutMgrBtn').addEventListener('click',openShortcutMgr);g('scpClose').addEventListener('click',closeShortcutMgr);g('scpDone').addEventListener('click',closeShortcutMgr);
  g('scpReset').addEventListener('click',()=>{shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s}));saveShortcuts();renderShortcutList();showToast('已恢復預設快捷鍵');});
  loadShortcuts();document.addEventListener('keydown',handleGlobalKey);
  const isInsideMapCanvas = target => !!(target&&target.closest&&target.closest('#mapCanvas'));
  let lastTouchEndTs=0, lastTouchTs=0, lastTouchX=0, lastTouchY=0;
  document.addEventListener('dblclick',e=>{ if(!isInsideMapCanvas(e.target)) e.preventDefault(); },{capture:true,passive:false});
  document.addEventListener('wheel',e=>{ if(e.ctrlKey&&!isInsideMapCanvas(e.target)) e.preventDefault(); },{passive:false});
  ['gesturestart','gesturechange','gestureend'].forEach(evt=>{
    document.addEventListener(evt,e=>{ if(!isInsideMapCanvas(e.target)) e.preventDefault(); },{passive:false});
  });
  document.addEventListener('touchstart',e=>{
    if(isInsideMapCanvas(e.target)) return;
    if(e.touches.length>1){ e.preventDefault(); return; }
    const t=e.touches[0];
    if(!t) return;
    const now=Date.now(), dx=Math.abs(t.clientX-lastTouchX), dy=Math.abs(t.clientY-lastTouchY);
    if(now-lastTouchTs<350&&dx<28&&dy<28) e.preventDefault();
    lastTouchTs=now; lastTouchX=t.clientX; lastTouchY=t.clientY;
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    if(!isInsideMapCanvas(e.target)&&e.touches.length>1) e.preventDefault();
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(isInsideMapCanvas(e.target)) return;
    const now=Date.now();
    if(now-lastTouchEndTs<320) e.preventDefault();
    lastTouchEndTs=now;
  },{passive:false});
  g('mapToggleBtn').addEventListener('click',()=>toggleMapView(true));g('mapBackBtn').addEventListener('click',()=>toggleMapView(false));
  on('mapAddNoteBtn','click',()=>openForm(false));
  on('mapSearchInput','input',debounce(()=>{mapFilter.q=g('mapSearchInput').value;saveDataDeferred();if(isMapOpen)drawMap();},250));
  on('mapFilterSub','change',()=>{mapFilter.sub=g('mapFilterSub').value;buildMapFilters();nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapFilterChapter','change',()=>{mapFilter.chapter=g('mapFilterChapter').value;buildMapFilters();nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapFilterSection','change',()=>{mapFilter.section=g('mapFilterSection').value;nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapAdvancedToggleBtn','click',()=>setMapAdvanced(!mapAdvancedOpen));
  on('mapDepthSel','change',()=>{mapDepth=g('mapDepthSel').value;nodePos={};forceLayout();drawMap();saveDataDeferred();});
  on('mapFocusBtn','click',()=>{mapFocusMode=!mapFocusMode;const btn=g('mapFocusBtn');if(btn){btn.style.background=mapFocusMode?'#0C447C':'#f0f7ff';btn.style.color=mapFocusMode?'#fff':'#0C447C';btn.textContent=`🎯 焦點模式：${mapFocusMode?'開':'關'}`;}applyFocusStyles();saveDataDeferred();});
  const setZoom=z=>{mapScale=Math.max(.15,Math.min(3.5,z));g('zoomLabel').textContent=Math.round(mapScale*100)+'%';drawMap();};
  on('zoomIn','click',()=>setZoom(mapScale+.15));on('zoomOut','click',()=>setZoom(mapScale-.15));
  on('zoomFit','click',()=>{if(!notes.length)return;const xs=notes.map(n=>nodePos[n.id]?nodePos[n.id].x:mapW/2),ys=notes.map(n=>nodePos[n.id]?nodePos[n.id].y:mapH/2);const minX=Math.min(...xs)-40,maxX=Math.max(...xs)+40,minY=Math.min(...ys)-40,maxY=Math.max(...ys)+40;const sc=Math.min(mapW/(maxX-minX||1),mapH/(maxY-minY||1),2.5);mapScale=sc;mapOffX=-minX*sc+(mapW-(maxX-minX)*sc)/2;mapOffY=-minY*sc+(mapH-(maxY-minY)*sc)/2;g('zoomLabel').textContent=Math.round(sc*100)+'%';drawMap();});
  on('mpClose','click',closeMapPopup);
  on('mapLinkedOnlyBtn','click',()=>{mapLinkedOnly=!mapLinkedOnly;setMapLinkedOnlyBtnStyle();nodePos={};forceLayout();drawMap();saveDataDeferred();showToast(mapLinkedOnly?`顯示 ${visibleNotes().length} 個有關聯節點`:'顯示全部節點');});
  on('mapAutoBtn','click',()=>{const btn=g('mapAutoBtn'),orig=btn.textContent;btn.textContent='排列中...';btn.disabled=true;setTimeout(()=>{nodePos={};mapScale=1;mapOffX=mapOffY=0;forceLayout();drawMap();saveDataDeferred();g('zoomLabel').textContent='100%';btn.textContent=orig;btn.disabled=false;showToast('已自動排列（保留核心節點）');},30);});
  on('mapLaneBtn','click',()=>{const panel=ensureLanePanel();if(!panel){showToast('泳道面板載入失敗');return;}if(panel.classList.contains('open'))closeLanePanel();else openLanePanel();});
  on('lanePanelClose','click',closeLanePanel);on('laneSaveBtn','click',saveLanePanel);on('laneResetBtn','click',resetLanePanel);
  const canvas=g('mapCanvas');let panStart=null,panOffXStart=0,panOffYStart=0;
  const onDragMove=(x,y)=>{
    if(!dragNode||!nodePos[dragNode])return;const activeNodeId=dragNode,rect=canvas.getBoundingClientRect();
    let cx=(x-rect.left-dragOffX-mapOffX)/mapScale,cy=(y-rect.top-dragOffY-mapOffY)/mapScale;
    nodePos[activeNodeId]={x:cx,y:cy};clampNodeToCanvas(activeNodeId);
    const visIds={};visibleNotes().forEach(n=>visIds[n.id]=true);pushNodeOffLinks(activeNodeId,visibleLinks(visIds),10);
    cx=nodePos[activeNodeId].x;cy=nodePos[activeNodeId].y;
    if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(()=>{moveNodeEl(activeNodeId,cx,cy);redrawLines(activeNodeId);rafId=null;});
  };
  const onPanMove=(x,y)=>{if(!panStart)return;mapOffX=panOffXStart+(x-panStart.x);mapOffY=panOffYStart+(y-panStart.y);if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(()=>{const gw=g('mapSvg').querySelector('#mapWrap');if(gw)gw.setAttribute('transform',`translate(${mapOffX},${mapOffY}) scale(${mapScale})`);rafId=null;});};
  canvas.addEventListener('click',e=>{if(e.target===canvas||e.target.id==='mapSvg'||e.target.id==='linksLayer')closeMapPopup();});
  canvas.addEventListener('mousedown',e=>{if(!dragNode){panStart={x:e.clientX,y:e.clientY};panOffXStart=mapOffX;panOffYStart=mapOffY;canvas.style.cursor='grabbing';}});
  canvas.addEventListener('mousemove',e=>{if(dragNode)onDragMove(e.clientX,e.clientY);else if(panStart)onPanMove(e.clientX,e.clientY);});
  canvas.addEventListener('mouseup',()=>{if(dragNode){if(rafId)cancelAnimationFrame(rafId);saveDataDeferred();dragNode=null;}panStart=null;canvas.style.cursor='';});
  canvas.addEventListener('mouseleave',()=>{panStart=null;canvas.style.cursor='';});
  canvas.addEventListener('touchmove',e=>{if(e.touches.length===1){if(dragNode){e.preventDefault();onDragMove(e.touches[0].clientX,e.touches[0].clientY);}else if(panStart){e.preventDefault();onPanMove(e.touches[0].clientX,e.touches[0].clientY);}}},{passive:false});
  canvas.addEventListener('touchend',()=>{if(dragNode){if(rafId)cancelAnimationFrame(rafId);saveDataDeferred();dragNode=null;}panStart=null;});
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===1&&!dragNode){panStart={x:e.touches[0].clientX,y:e.touches[0].clientY};panOffXStart=mapOffX;panOffYStart=mapOffY;}},{passive:true});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(mapScale+(e.deltaY>0?-.1:.1));},{passive:false});
  let pinchDist=0;
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===2){const d=e.touches[0].clientX-e.touches[1].clientX,dd=e.touches[0].clientY-e.touches[1].clientY;pinchDist=Math.sqrt(d*d+dd*dd);}},{passive:true});
  canvas.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinchDist){e.preventDefault();const d=e.touches[0].clientX-e.touches[1].clientX,dd=e.touches[0].clientY-e.touches[1].clientY,nd=Math.sqrt(d*d+dd*dd);setZoom(mapScale*nd/pinchDist);pinchDist=nd;}},{passive:false});
  window.addEventListener('resize',()=>scheduleMapRedraw(100));window.addEventListener('orientationchange',()=>scheduleMapRedraw(120));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleMapRedraw(100);});
  window.addEventListener('pageshow',()=>bindCoreButtons());
  if(window.ResizeObserver){mapResizeObserver=new ResizeObserver(()=>scheduleMapRedraw(60));mapResizeObserver.observe(canvas);}
  const syncCfg=getSyncConfig();
  if(g('syncTokenInput')) g('syncTokenInput').value=syncCfg.token||'';
  if(g('syncGistInput')) g('syncGistInput').value=syncCfg.gistId||'';
  if(g('syncAutoPush')) g('syncAutoPush').checked=!!syncCfg.autoPush;
  if(g('syncAutoPull')) g('syncAutoPull').checked=!!syncCfg.autoPull;
  g('syncBtn').addEventListener('click',()=>g('syncModal').classList.add('open'));
  g('syncCancelBtn').addEventListener('click',()=>{ saveSyncConfigFromInputs(); g('syncModal').classList.remove('open'); });
  g('syncUploadBtn').addEventListener('click',async()=>{
    const token=(g('syncTokenInput').value||'').trim(),gistId=(g('syncGistInput').value||'').trim();
    if(!token||!gistId){showToast('請填寫 Token 和 Gist ID');return;}
    try{ await uploadToGist(token,gistId); saveSyncConfigFromInputs(); showToast('已同步到 GitHub'); g('syncModal').classList.remove('open'); }
    catch(e){showToast('同步失敗：'+e.message);}
  });
  g('syncDownloadBtn').addEventListener('click',async()=>{
    const token=(g('syncTokenInput').value||'').trim(),gistId=(g('syncGistInput').value||'').trim();
    if(!token||!gistId){showToast('請填寫 Token 和 Gist ID');return;}
    try{ const content=await downloadFromGist(token,gistId); JSON.parse(content); localStorage.setItem(SKEY,content); saveSyncConfigFromInputs(); location.reload(); }
    catch(e){showToast('載入失敗：'+e.message);}
  });
  autoPullIfNeeded();
  render();
  setTimeout(()=>toggleMapView(true),120);
});
