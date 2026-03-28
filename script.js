// JavaScript file - 完整優化版
// ==================== 資料定義 ====================
const DEFAULTS = {
  notes: [
    {id:1,type:'article',subject:'民法',title:'民法第 184 條 — 侵權行為',body:'因故意或過失，不法侵害他人之權利者，負損害賠償責任。',tags:['侵權行為','損害賠償'],date:'2025-03-10',detail:'構成要件：\n1. 須有加害行為\n2. 行為須不法\n3. 須有故意或過失\n4. 須有損害\n5. 加害行為與損害間有因果關係'},
    {id:2,type:'case',subject:'刑法',title:'釋字第 775 號 — 累犯加重規定',body:'累犯一律加重最低本刑，違反憲法比例原則，應依個案審查。',tags:['累犯','比例原則'],date:'2025-02-28',detail:'大法官認定相關規定違憲，法院應依個案情形審查，不得機械式適用加重。'},
  ],
  links: [
    {id:1,from:3,to:4,rel:'關聯',color:'#378ADD'},
    {id:2,from:3,to:2,rel:'關聯',color:'#378ADD'},
    {id:3,from:1,to:5,rel:'關聯',color:'#378ADD'}
  ],
types: [
    {key:'article',label:'條文',color:'#007AFF'},
    {key:'case',label:'案例',color:'#1D9E75'},
    {key:'concept',label:'概念',color:'#7F77DD'},
    {key:'diary',label:'日記',color:'#D85A30'}
  ],
  subjects: [{key:'民法',label:'民法',color:'#D85A30'},{key:'刑法',label:'刑法',color:'#1D9E75'},{key:'憲法',label:'憲法',color:'#7F77DD'},{key:'行政法',label:'行政法',color:'#378ADD'}]
};
const LINK_COLOR = '#378ADD';
const SKEY = 'legal_notes_v4', PAGE_SIZE = 24;
const AI_MODELS = [
  {id:'openrouter/free', label:'🔀 自動選最佳免費模型（推薦）'},
  {id:'meta-llama/llama-3.3-70b-instruct:free', label:'Llama 3.3 70B（Meta）'},
  {id:'google/gemini-2.0-flash-exp:free', label:'Gemini 2.0 Flash（Google）'},
  {id:'deepseek/deepseek-r1:free', label:'DeepSeek R1（推理強）'},
  {id:'mistralai/mistral-small-3.1-24b-instruct:free', label:'Mistral Small 3.1'}
];
const DEFAULT_SHORTCUTS = [
  {id:'new', label:'新增筆記', code:'KeyN', alt:true}, {id:'search', label:'搜尋', code:'KeyF', alt:true},
  {id:'map', label:'開啟體系圖', code:'KeyM', alt:true}, {id:'back', label:'返回筆記列表', code:'Escape'},
  {id:'close', label:'關閉面板', code:'KeyW', alt:true}, {id:'edit', label:'編輯當前筆記', code:'KeyE', alt:true},
  {id:'link', label:'新增關聯', code:'KeyL', alt:true}, {id:'export', label:'匯出備份', code:'KeyS', alt:true},
  {id:'shortcuts', label:'快捷鍵設定', code:'KeyK', alt:true}, {id:'flash', label:'複習模式', code:'KeyR', alt:true},
  {id:'stats', label:'統計', code:'KeyI', alt:true}
];

// ==================== 全域變數 ====================
let notes=[], links=[], nid=10, lid=10, types=[], subjects=[];
let cv='all', cs='all', searchQ='', openId=null, editMode=false;
let nodePos={}, dragNode=null, dragOffX=0, dragOffY=0, mapW=800, mapH=500;
let nodeSizes={};
let mapScale=1, mapOffX=0, mapOffY=0, mapFilter={sub:"all",type:"all",q:""}, mapLinkedOnly=true;
let nodeEls={}, linkElsMap={}, nodeLinksIndex={}, linkCurveOffsets={}, isMapOpen=false;
let gridPage=1, sortMode='date_desc', multiSelMode=false, selectedIds={};
let flashDeck=[], flashIdx=0, flashShowing=false, flashSubFilter='all', flashTypeFilter2='all', flashHard=[];
let examList=[], examTimer=null, examSec=0, examTotal=0, currentExam=null;
let shortcuts=[], recordingBtn=null, _aiPendingAction=null, _saveTimer=null, rafId=null;
let mapRedrawTimer=null, mapResizeObserver=null;

// ==================== 工具函數 ====================
const g = id => document.getElementById(id);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const showToast = m => { let t=g('toast'); t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2200); };
const saveDataDeferred = () => { clearTimeout(_saveTimer); _saveTimer = setTimeout(()=>{ if(JSON.stringify({notes,links}).length>4500000) showToast("⚠️ 資料接近儲存上限"); saveData(); },500); };
const typeByKey = k => types.find(t=>t.key===k) || {key:k,label:k,color:'#888'};
const subByKey = k => subjects.find(s=>s.key===k) || {key:k,label:k,color:'#888'};
const noteById = id => notes.find(n=>n.id===id);
const noteTags = n => Array.isArray(n?.tags) ? n.tags : [];
const hexRgb = hex => { if(hex.length===4) hex='#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; };
const lightC = hex => `rgba(${hexRgb(hex).join(',')},0.12)`;
const darkC = hex => { let r=hexRgb(hex); return `rgb(${Math.round(r[0]*0.55)},${Math.round(r[1]*0.55)},${Math.round(r[2]*0.55)})`; };
const safeStr = v => typeof v==='string' ? v : '';
const hl = (text, q) => {
  const src = safeStr(text);
  return !q ? src : src.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="hl">$1</span>');
};
const sortedNotes = arr => arr.slice().sort((a,b)=>{
  const ad=safeStr(a?.date), bd=safeStr(b?.date), at=safeStr(a?.title), bt=safeStr(b?.title), as=safeStr(a?.subject), bs=safeStr(b?.subject), aty=safeStr(a?.type), bty=safeStr(b?.type);
  return sortMode==='date_desc'?bd.localeCompare(ad):sortMode==='date_asc'?ad.localeCompare(bd):sortMode==='title_asc'?at.localeCompare(bt,'zh'):sortMode==='title_desc'?bt.localeCompare(at,'zh'):sortMode==='subject'?as.localeCompare(bs)||at.localeCompare(bt):aty.localeCompare(bty)||at.localeCompare(bt);
});
const parseTodos = raw => (raw||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{ const done=/^\[(x|X)\]/.test(line); return {text:line.replace(/^\[(x|X| )\]\s*/,''), done}; }).filter(x=>x.text);
const formatTodosForEdit = todos => (Array.isArray(todos)?todos:[]).map(t=>`${t.done?'[x]':'[ ]'} ${t.text||''}`.trim()).join('\n');
const renderTodoHtml = todos => {
  const list = (Array.isArray(todos)?todos:[]).filter(t=>t&&t.text);
  if(!list.length) return '<span style="font-size:12px;color:#bbb">尚無待辦項目</span>';
  return `<div class="todo-list">${list.map(t=>`<div class="todo-item ${t.done?'done':''}"><span class="todo-item-check">${t.done?'✅':'⬜'}</span><span class="todo-item-text">${t.text}</span></div>`).join('')}</div>`;
};
const getAiKey = () => localStorage.getItem('klaws_ai_key') || '';
const saveAiKey = k => localStorage.setItem('klaws_ai_key', k);
const getAiModel = () => localStorage.getItem('klaws_ai_model') || 'openrouter/free';
const saveAiModel = m => localStorage.setItem('klaws_ai_model', m);
const MAP_NODE_RADIUS_MIN = 15, MAP_NODE_RADIUS_MAX = 100, MAP_NODE_RADIUS_DEFAULT = 15;
const clampMapRadius = r => Math.max(MAP_NODE_RADIUS_MIN, Math.min(MAP_NODE_RADIUS_MAX, r));
const splitMapTitleLines = (title, maxCharsPerLine = 8) => {
  const safe = String(title || '').trim();
  if(!safe) return ['（未命名）'];
  const lines = [];
  for(let i=0;i<safe.length;i+=maxCharsPerLine) lines.push(safe.slice(i, i + maxCharsPerLine));
  return lines;
};

// ==================== 資料儲存 ====================
function loadData() {
  try {
    const raw = localStorage.getItem(SKEY);
    if(raw) {
      const d = JSON.parse(raw);
      notes = Array.isArray(d.notes) ? d.notes : DEFAULTS.notes.slice();
      notes.forEach(n=>{
        if(!Array.isArray(n.todos)) n.todos=[];
        if(!Array.isArray(n.tags)) n.tags=[];
        if(typeof n.title!=='string') n.title='';
        if(typeof n.body!=='string') n.body='';
        if(typeof n.subject!=='string') n.subject='';
        if(typeof n.date!=='string') n.date='1970-01-01';
      });
      links = Array.isArray(d.links) ? d.links : DEFAULTS.links.slice();
      // 統一舊連結顏色為預設色
      links.forEach(l=>{ l.rel='關聯'; l.color=LINK_COLOR; });
      types = Array.isArray(d.types) ? d.types : DEFAULTS.types.slice();
      if(!types.some(t=>t.key==='diary')) types.push({key:'diary',label:'日記',color:'#D85A30'});
      subjects = Array.isArray(d.subjects) ? d.subjects : DEFAULTS.subjects.slice();
      nodePos = (d.nodePos && typeof d.nodePos==='object' && !Array.isArray(d.nodePos)) ? d.nodePos : {};
      nodeSizes = (d.nodeSizes && typeof d.nodeSizes==='object' && !Array.isArray(d.nodeSizes)) ? d.nodeSizes : {};
      if(d.sortMode) sortMode = d.sortMode;
      let repaired = false;
      types.forEach(t=>{ if(/^tag_t_/.test(t.key)) { let old=t.key; t.key=t.label; notes.forEach(n=>{if(n.type===old)n.type=t.label;}); repaired=true; } });
      subjects.forEach(s=>{ if(/^tag_s_/.test(s.key)) { let old=s.key; s.key=s.label; notes.forEach(n=>{if(n.subject===old)n.subject=s.label;}); repaired=true; } });
      if(repaired) saveData();
    } else {
      notes = DEFAULTS.notes.slice(); links = DEFAULTS.links.slice();
      types = DEFAULTS.types.slice(); subjects = DEFAULTS.subjects.slice();
      nodeSizes = {};
      saveData();
    }
  } catch(e) {
    notes = DEFAULTS.notes.slice(); links = DEFAULTS.links.slice();
    types = DEFAULTS.types.slice(); subjects = DEFAULTS.subjects.slice();
    nodeSizes = {};
  }
}
function saveData() { try { localStorage.setItem(SKEY, JSON.stringify({notes,links,nid,lid,types,subjects,nodePos,nodeSizes,sortMode})); } catch(e) {} }

// ==================== UI 建構 ====================
function buildTypeRow() {
  const row = g('typeRow');
  row.innerHTML = `<button class="tab ${cv==='all'?'on':''}" data-v="all">全部</button>` + 
    types.map(t => `<button class="tab ${cv===t.key?'on':''}" data-v="${t.key}" style="${cv===t.key?`background:${t.color};`:''}">${t.label}</button>`).join('') +
    `<button class="tag-mgr-btn" id="tagMgrBtn">⚙️ 管理標籤</button>`;
  row.querySelectorAll('.tab[data-v]').forEach(btn => btn.addEventListener('click', () => { cv = btn.dataset.v; gridPage=1; buildTypeRow(); render(); }));
  g('tagMgrBtn')?.addEventListener('click', openTagMgr);
}
function buildSubRow() {
  const row = g('subbar');
  row.innerHTML = `<button class="sc ${cs==='all'?'on':''}" data-s="all">全部科目</button>` + 
    subjects.map(s => `<button class="sc ${cs===s.key?'on':''}" data-s="${s.key}" style="${cs===s.key?`background:${s.color};color:#fff;`:''}">${s.label}</button>`).join('');
  row.querySelectorAll('.sc').forEach(btn => btn.addEventListener('click', () => { cs = btn.dataset.s; gridPage=1; buildSubRow(); render(); }));
}
function buildFormSelects() { g('ft').innerHTML = types.map(t=>`<option value="${t.key}">${t.label}</option>`).join(''); g('fs2').innerHTML = subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join(''); }
function rebuildUI() { buildTypeRow(); buildSubRow(); buildFormSelects(); }

// ==================== 渲染 ====================
function render() {
  const q = searchQ.trim().toLowerCase();
  const filtered = sortedNotes(notes).filter(n => (cv==='all'||n.type===cv) && (cs==='all'||n.subject===cs) && (!q || `${n.title} ${n.body} ${n.subject} ${noteTags(n).join(' ')}`.toLowerCase().includes(q)));
  const sb = g('search-results-bar');
  if(q) { sb.style.display='block'; sb.textContent=`搜尋「${searchQ}」：找到 ${filtered.length} 筆筆記`; } else sb.style.display='none';
  const grid = g('grid');
  g('gridPager')?.remove();
  if(!filtered.length) { grid.innerHTML='<div class="empty">沒有符合的筆記</div>'; return; }
  const maxPg = Math.ceil(filtered.length/PAGE_SIZE);
  if(gridPage>maxPg) gridPage=maxPg;
  const pgF = filtered.slice((gridPage-1)*PAGE_SIZE, gridPage*PAGE_SIZE);
  grid.innerHTML = pgF.map(n => {
    const tp = typeByKey(n.type), sb2 = subByKey(n.subject);
    const chips = noteTags(n).slice(0,2).map(t=>`<span class="chip">${hl(t,q)}</span>`).join('');
    const lc = links.filter(l=>l.from===n.id||l.to===n.id).length;
    return `<div class="card" data-id="${n.id}"><div class="sel-check"></div><div class="cbar" style="background:${tp.color}"></div><div class="ctop"><span class="ctag" style="background:${tp.color}">${tp.label}</span><span class="cdate">${n.date}</span></div><div class="ctitle">${hl(n.title,q)}</div><div class="cbody">${n.body}</div><div class="cfoot"><span class="chip" style="background:${lightC(sb2.color)};color:${darkC(sb2.color)}">${sb2.label}</span>${chips}${lc?`<span class="chip" style="background:#EAF3DE">🔗 ${lc}</span>`:''}</div></div>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(c => {
    const id = parseInt(c.dataset.id);
    if(multiSelMode) c.classList.add('selectable');
    if(selectedIds[id]) { c.classList.add('selected'); c.querySelector('.sel-check').textContent='✓'; }
    c.addEventListener('click', () => multiSelMode ? toggleCardSelect(id) : openNote(id));
  });
  if(filtered.length>PAGE_SIZE) {
    const totalPg = Math.ceil(filtered.length/PAGE_SIZE);
    const pager = document.createElement('div'); pager.id='gridPager'; pager.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 14px 28px;';
    if(gridPage>1) { const pb=document.createElement('button'); pb.className='tool-btn'; pb.textContent='← 上一頁'; pb.onclick=()=>{gridPage--;render();window.scrollTo(0,0);}; pager.appendChild(pb); }
    const pi=document.createElement('span'); pi.style.cssText='font-size:12px;color:#888;'; pi.textContent=`第 ${gridPage} / ${totalPg} 頁（共 ${filtered.length} 筆）`; pager.appendChild(pi);
    if(gridPage<totalPg) { const nb=document.createElement('button'); nb.className='tool-btn'; nb.textContent='下一頁 →'; nb.onclick=()=>{gridPage++;render();window.scrollTo(0,0);}; pager.appendChild(nb); }
    g('content').appendChild(pager);
  }
}

function openNote(id) {
  const n = noteById(id); if(!n) return;
  openId = id;
  const tp = typeByKey(n.type), sb = subByKey(n.subject);
  g('dp-badge').textContent = tp.label; g('dp-badge').style.background = tp.color;
  g('dp-title').textContent = n.title; g('dp-body').textContent = n.body;
  const dh = [];
  if(n.dispute) dh.push(`<div class="dispute-section"><div class="dispute-section-title">爭點</div><div class="dispute-section-body">${n.dispute}</div></div>`);
  if(n.f_article) dh.push(`<div class="dispute-section" style="border-color:#1D9E75"><div class="dispute-section-title" style="color:#1D9E75">適用法條</div><div class="dispute-section-body">${n.f_article}</div></div>`);
  if(n.f_elements) dh.push(`<div class="dispute-section" style="border-color:#7F77DD"><div class="dispute-section-title" style="color:#7F77DD">構成要件</div><div class="dispute-section-body">${n.f_elements}</div></div>`);
  if(n.f_conclusion) dh.push(`<div class="dispute-section" style="border-color:#D85A30"><div class="dispute-section-title" style="color:#D85A30">結論</div><div class="dispute-section-body">${n.f_conclusion}</div></div>`);
  g('dp-detail').innerHTML = dh.length ? dh.join('') + (n.detail?`<div class="dp-lbl" style="margin-top:14px;">補充筆記</div><div class="dp-txt">${n.detail}</div>`:'') : (n.detail||'（尚無詳細筆記）');
  const todoWrap = g('dp-todo'), todoLabel = g('dp-todo-label');
  if(n.type==='diary') {
    todoLabel.style.display='block';
    todoWrap.style.display='block';
    todoWrap.innerHTML = renderTodoHtml(n.todos);
  } else {
    todoLabel.style.display='none';
    todoWrap.style.display='none';
    todoWrap.innerHTML = '';
  }
  g('dp-chips').innerHTML = `<span class="chip" style="background:${lightC(sb.color)};color:${darkC(sb.color)}">${sb.label}</span>` + noteTags(n).map(t=>`<span class="chip">${t}</span>`).join('');
  renderLinksForNote(id);
  g('dp').classList.add('open'); ['fp','lp','tp'].forEach(p=>g(p).classList.remove('open'));
  setTimeout(()=>g('dp').scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}

function renderLinksForNote(id) {
  const related = links.filter(l=>l.from===id||l.to===id);
  const el = g('dp-links');
  if(!related.length) { el.innerHTML='<span style="font-size:12px;color:#bbb">尚無關聯</span>'; return; }
  el.innerHTML = related.map(l => {
    const otherId = l.from===id ? l.to : l.from;
    const other = noteById(otherId);
    const dir = l.from===id ? '→' : '←';
    return `<div class="link-item"><div class="link-dot" style="background:${LINK_COLOR}"></div><span class="link-rel" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="link-title link-jump" data-nid="${otherId}" style="cursor:pointer;color:#007AFF;text-decoration:underline;">${other?other.title:'（已刪除）'}</span><button class="link-del" data-lid="${l.id}">✕</button></div>`;
  }).join('');
  el.querySelectorAll('.link-jump').forEach(btn=>btn.addEventListener('click',()=>{ const nid2=parseInt(btn.dataset.nid); noteById(nid2)?openNote(nid2):showToast('筆記已被刪除'); }));
  el.querySelectorAll('.link-del').forEach(btn=>btn.addEventListener('click',()=>{ links=links.filter(l=>l.id!==parseInt(btn.dataset.lid)); saveData(); renderLinksForNote(id); render(); showToast('關聯已刪除'); }));
}

function closeDetail() { g('dp').classList.remove('open'); openId=null; }

// ==================== 表單（整合關聯筆記）====================
function openForm(isEdit) {
  editMode = isEdit;
  buildFormSelects();
  if(editMode) {
    const n = noteById(openId); if(!n) return;
    g('form-title').textContent='編輯筆記';
    g('ft').value=n.type; g('fs2').value=n.subject; g('fti').value=n.title; g('fbo').value=n.body;
    g('fde').value=n.detail||''; g('fta').value=noteTags(n).join(', ');
    if(g('f-todos')) g('f-todos').value = formatTodosForEdit(n.todos);
    ['f-dispute','f-article','f-elements','f-conclusion'].forEach((id,i)=>{ const el=g(id); if(el) el.value=[n.dispute,n.f_article,n.f_elements,n.f_conclusion][i]||''; });
    toggleTemplate(n.type==='case'||(n.dispute||n.f_article));
    toggleDiaryTodo(n.type==='diary');
  } else {
    g('form-title').textContent='新增筆記';
    ['fti','fbo','fde','fta','f-dispute','f-article','f-elements','f-conclusion','f-todos'].forEach(id=>{ const el=g(id); if(el) el.value=''; });
    toggleTemplate(g('ft').value==='case');
    toggleDiaryTodo(g('ft').value==='diary');
  }
  // 建立關聯搜尋 UI
  buildInlineLinksPanel();
  g('fp').classList.add('open'); ['dp','lp','tp'].forEach(p=>g(p).classList.remove('open'));
  setTimeout(()=>g('fp').scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}
function closeForm() { g('fp').classList.remove('open'); }

// ---- 表單內嵌關聯面板 ----
function buildInlineLinksPanel() {
  const wrap = g('form-links-wrap');
  if(!wrap) return;
  // 先顯示已有關聯
  renderFormLinks();
  // 搜尋欄
  const searchEl = g('fl-search');
  if(searchEl) {
    searchEl.value = '';
    searchEl.oninput = debounce(renderFormLinkSearch, 200);
  }
  renderFormLinkSearch();
}

function renderFormLinks() {
  const el = g('form-links-list');
  if(!el || !openId) { if(el) el.innerHTML=''; return; }
  const related = links.filter(l=>l.from===openId||l.to===openId);
  if(!related.length) { el.innerHTML='<span style="font-size:12px;color:#bbb">尚無關聯</span>'; return; }
  el.innerHTML = related.map(l=>{
    const otherId = l.from===openId ? l.to : l.from;
    const other = noteById(otherId);
    return `<div class="fl-item"><span class="fl-item-title">${other?other.title:'（已刪除）'}</span><button class="fl-del" data-lid="${l.id}">✕</button></div>`;
  }).join('');
  el.querySelectorAll('.fl-del').forEach(btn=>btn.addEventListener('click',()=>{
    links=links.filter(l=>l.id!==parseInt(btn.dataset.lid));
    saveData(); renderFormLinks(); if(isMapOpen) scheduleMapRedraw(100);
    showToast('關聯已刪除');
  }));
}

function renderFormLinkSearch() {
  const el = g('fl-results');
  if(!el) return;
  const q = (g('fl-search')?.value||'').toLowerCase().trim();
  // 非編輯模式（新增時）openId 可能為 null，不顯示搜尋結果
  if(!q) { el.innerHTML=''; return; }
  const existIds = links.filter(l=>openId&&(l.from===openId||l.to===openId)).map(l=>l.from===openId?l.to:l.from);
  const pool = notes.filter(n=> n.id!==openId && !existIds.includes(n.id) && `${n.title} ${n.subject} ${typeByKey(n.type).label}`.toLowerCase().includes(q)).slice(0,8);
  if(!pool.length) { el.innerHTML='<div style="font-size:12px;color:#bbb;padding:4px 0;">找不到符合的筆記</div>'; return; }
  el.innerHTML = pool.map(n=>`<div class="fl-result-item" data-nid="${n.id}"><span class="fl-result-type" style="background:${typeByKey(n.type).color}">${typeByKey(n.type).label}</span><span class="fl-result-title">${n.title}</span></div>`).join('');
  el.querySelectorAll('.fl-result-item').forEach(item=>{
    item.addEventListener('click',()=>{
      const toId = parseInt(item.dataset.nid);
      // 若是新增模式，openId 可能沒有，先存筆記再連
      if(!openId) { showToast('請先儲存筆記，再新增關聯'); return; }
      if(links.some(l=>(l.from===openId&&l.to===toId)||(l.from===toId&&l.to===openId))){ showToast('已有關聯'); return; }
      links.push({id:lid++, from:openId, to:toId, rel:'關聯', color:LINK_COLOR});
      saveData(); renderFormLinks(); g('fl-search').value=''; renderFormLinkSearch();
      showToast('關聯已建立！'); if(isMapOpen) scheduleMapRedraw(100);
    });
  });
}

function saveNote() {
  const title = (g('fti').value||'').trim();
  if(!title) { g('fti').style.borderColor='#FF3B30'; showToast('請輸入標題'); return; }
  g('fti').style.borderColor='';
  const tags = (g('fta').value||'').split(',').map(t=>t.trim()).filter(Boolean);
  const todos = parseTodos(g('f-todos')?.value||'');
  const getField = id => (g(id)?.value||'').trim();
  if(editMode && openId) {
    const idx = notes.findIndex(n=>n.id===openId);
    if(idx!==-1) Object.assign(notes[idx], {
      type:g('ft').value, subject:g('fs2').value, title, body:(g('fbo').value||'').trim(),
      detail:(g('fde').value||'').trim(), tags, dispute:getField('f-dispute'), f_article:getField('f-article'),
      f_elements:getField('f-elements'), f_conclusion:getField('f-conclusion'), todos
    });
    saveData(); closeForm(); render(); showToast('筆記已更新！'); setTimeout(()=>openNote(openId),150);
  } else {
    const d = new Date();
    const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newNote = {id:nid++, type:g('ft').value, subject:g('fs2').value, title, body:(g('fbo').value||'').trim(),
      detail:(g('fde').value||'').trim(), tags, date:dt, dispute:getField('f-dispute'), f_article:getField('f-article'),
      f_elements:getField('f-elements'), f_conclusion:getField('f-conclusion'), todos};
    notes.unshift(newNote);
    openId = newNote.id; // 新增後設定 openId，讓關聯功能可用
    saveData(); closeForm(); render(); showToast('筆記已儲存！');
    setTimeout(()=>{ window.scrollTo(0,0); setTimeout(()=>openNote(notes[0].id),300); },100);
  }
}
function deleteNote() { if(!openId||!confirm('確定刪除這筆筆記？相關關聯也會一起刪除。')) return; links=links.filter(l=>l.from!==openId&&l.to!==openId); notes=notes.filter(n=>n.id!==openId); saveData(); closeDetail(); render(); showToast('已刪除'); }
function toggleTemplate(show) { const tt=g('templateToggle'); if(tt) tt.style.display=show?'block':'none'; }
function toggleDiaryTodo(show) { const box=g('diaryTodoWrap'); if(box) box.style.display=show?'block':'none'; }

// ==================== 標籤管理 ====================
function openTagMgr() { g('tp').classList.add('open'); ['dp','fp','lp'].forEach(p=>g(p).classList.remove('open')); renderTagLists(); setTimeout(()=>g('tp').scrollIntoView({behavior:'smooth',block:'nearest'}),60); }
function renderTagLists() { renderTagList('typeTagList',types,'type'); renderTagList('subTagList',subjects,'sub'); }
function renderTagList(cid,arr,kind) {
  const el = g(cid);
  if(!arr.length) { el.innerHTML='<div style="color:#bbb;font-size:13px;padding:8px 0">（尚無標籤）</div>'; return; }
  el.innerHTML = arr.map((item,idx)=>`<div class="tag-item" data-idx="${idx}" data-kind="${kind}"><div class="tag-color-dot" style="background:${item.color}"></div><span class="tag-item-label">${item.label}</span><button class="tag-edit-btn" data-idx="${idx}" data-kind="${kind}">編輯</button><button class="tag-del-btn" data-idx="${idx}" data-kind="${kind}">刪除</button></div>`).join('');
  el.querySelectorAll('.tag-edit-btn').forEach(b=>b.addEventListener('click',()=>editTag(parseInt(b.dataset.idx),b.dataset.kind)));
  el.querySelectorAll('.tag-del-btn').forEach(b=>b.addEventListener('click',()=>deleteTag(parseInt(b.dataset.idx),b.dataset.kind)));
}
function editTag(idx,kind) {
  const arr = kind==='type'?types:subjects, item=arr[idx];
  const nl2 = prompt('修改標籤名稱：',item.label); if(!nl2) return;
  const nv = nl2.trim(); if(!nv) { showToast('名稱不能為空'); return; }
  if(arr.some((t,i)=>i!==idx&&t.label===nv)) { showToast('標籤名稱重複'); return; }
  const nc = prompt('修改顏色（#RRGGBB）：',item.color); if(!nc) return;
  const ncv = nc.trim(); if(!/^#[0-9A-Fa-f]{6}$/.test(ncv)) { showToast('顏色格式不正確'); return; }
  arr[idx].label = nv; arr[idx].color = ncv;
  saveData(); renderTagLists(); buildTypeRow(); buildSubRow(); render(); showToast('標籤已更新');
}
function deleteTag(idx,kind) {
  const arr = kind==='type'?types:subjects;
  if(!confirm(`確定刪除標籤「${arr[idx].label}」？`)) return;
  arr.splice(idx,1); saveData(); renderTagLists(); rebuildUI(); render(); showToast('標籤已刪除');
}
function addTag(kind) {
  const label = (g(kind==='type'?'newTypeLabel':'newSubLabel').value||'').trim();
  const color = g(kind==='type'?'newTypeColor':'newSubColor').value;
  if(!label) { showToast('請輸入標籤名稱'); return; }
  const arr = kind==='type'?types:subjects;
  if(arr.some(t=>t.label===label)) { showToast('標籤已存在'); return; }
  arr.push({key:'tag_'+Date.now(), label, color});
  g(kind==='type'?'newTypeLabel':'newSubLabel').value = '';
  saveData(); renderTagLists(); rebuildUI(); showToast('標籤已新增！');
}

// ==================== 匯入/匯出 ====================
function exportData() {
  const json = JSON.stringify({notes,links,nid,lid,types,subjects,nodeSizes,exported:new Date().toISOString()},null,2);
  const blob = new Blob([json],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  const d = new Date();
  a.download = `法律筆記備份_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}.json`;
  a.href = url; a.click(); URL.revokeObjectURL(url); showToast('已匯出！');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result); if(!d.notes) throw new Error();
      d.notes.forEach(n=>{ if(!n.dispute) n.dispute=''; if(!n.f_article) n.f_article=''; if(!n.f_elements) n.f_elements=''; if(!n.f_conclusion) n.f_conclusion=''; if(!n.tags) n.tags=[]; if(!n.detail) n.detail=''; if(!Array.isArray(n.todos)) n.todos=[]; });
      if(d.links) d.links.forEach(l=>{ l.rel='關聯'; l.color=LINK_COLOR; });
      if(confirm('確定 = 完整覆蓋（取代所有現有筆記）\n取消 = 合併（只加入新筆記）')) {
        notes = d.notes; links = d.links||[]; types = d.types||DEFAULTS.types.slice(); subjects = d.subjects||DEFAULTS.subjects.slice();
        nodeSizes = d.nodeSizes||{};
        nid = d.nid||notes.length+100; lid = d.lid||10; notes.sort((a,b)=>b.id-a.id);
        saveData(); rebuildUI(); render(); showToast(`已覆蓋，共 ${notes.length} 筆筆記`);
      } else {
        const existing = notes.map(n=>n.id); let added=0;
        d.notes.forEach(n=>{ if(!existing.includes(n.id)){ notes.push(n); added++; if(n.id>=nid)nid=n.id+1; } });
        if(d.links) links = d.links;
        if(d.types) types = d.types;
        if(d.subjects) subjects = d.subjects;
        if(d.nodeSizes) nodeSizes = {...nodeSizes, ...d.nodeSizes};
        notes.sort((a,b)=>b.id-a.id);
        saveData(); rebuildUI(); render(); showToast(`已合併，新增 ${added} 筆`);
      }
    } catch(ex) { showToast('匯入失敗，請確認檔案格式'); }
  };
  reader.readAsText(file);
}

// ==================== 快捷鍵 ====================
function loadShortcuts() { try { const raw=localStorage.getItem('legal_shortcuts_v2'); if(raw) { const p=JSON.parse(raw); shortcuts=DEFAULT_SHORTCUTS.map(s=>p.find(x=>x.id===s.id)?{...s,...p.find(x=>x.id===s.id)}:{...s}); } else shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s})); } catch(e){ shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s})); } }
function saveShortcuts() { localStorage.setItem('legal_shortcuts_v2',JSON.stringify(shortcuts)); }
const codeToDisplay = c => !c?'未設定':c==='Escape'?'Esc':c==='Space'?'Space':c==='Backspace'?'Backspace':c==='Enter'?'Enter':c==='Tab'?'Tab':c.startsWith('Key')?c.slice(3).toUpperCase():c.startsWith('Digit')?c.slice(5):c;
const fmtKey = sc => !sc.code?'未設定':[sc.ctrl?'Ctrl':'',sc.alt?'Alt':'',sc.shift?'Shift':'',codeToDisplay(sc.code)].filter(Boolean).join(' + ');
function renderShortcutList() { g('scpList').innerHTML=shortcuts.map((sc,i)=>`<div class="sc-item"><span class="sc-label">${sc.label}</span><button class="sc-key${sc.code?' has-key':''}" data-idx="${i}">${fmtKey(sc)}</button><button data-clear="${i}">✕</button></div>`).join(''); g('scpList').querySelectorAll('.sc-key').forEach(btn=>btn.addEventListener('click',()=>{ if(recordingBtn){ recordingBtn.classList.remove('recording'); recordingBtn.textContent=fmtKey(shortcuts[parseInt(recordingBtn.dataset.idx)]); } recordingBtn=btn; btn.classList.add('recording'); btn.textContent='請按下按鍵...'; btn.focus(); })); g('scpList').querySelectorAll('[data-clear]').forEach(btn=>btn.addEventListener('click',()=>{ const idx=parseInt(btn.dataset.clear); shortcuts[idx].code=''; shortcuts[idx].ctrl=shortcuts[idx].shift=shortcuts[idx].alt=false; saveShortcuts(); renderShortcutList(); })); }
function openShortcutMgr() { recordingBtn=null; renderShortcutList(); g('scp').style.display='block'; ['dp','fp','lp','tp'].forEach(p=>g(p).classList.remove('open')); setTimeout(()=>g('scp').scrollIntoView({behavior:'smooth',block:'nearest'}),60); }
function closeShortcutMgr() { if(recordingBtn){ recordingBtn.classList.remove('recording'); recordingBtn=null; } g('scp').style.display='none'; }
function handleGlobalKey(e) {
  if(recordingBtn) {
    if(['Control','Shift','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if(e.code==='Escape') { recordingBtn.classList.remove('recording'); recordingBtn.textContent=fmtKey(shortcuts[parseInt(recordingBtn.dataset.idx)]); recordingBtn=null; return; }
    const idx=parseInt(recordingBtn.dataset.idx); shortcuts[idx]={...shortcuts[idx], code:e.code, ctrl:e.ctrlKey||e.metaKey, shift:e.shiftKey, alt:e.altKey};
    recordingBtn.classList.remove('recording'); recordingBtn.classList.add('has-key'); recordingBtn.textContent=fmtKey(shortcuts[idx]); recordingBtn=null; saveShortcuts(); return;
  }
  if(['input','textarea','select'].includes(e.target.tagName.toLowerCase())) return;
  const ctrl=e.ctrlKey||e.metaKey;
  shortcuts.forEach(sc=>{ if(sc.code && sc.code===e.code && sc.ctrl===ctrl && sc.shift===e.shiftKey && sc.alt===e.altKey) { e.preventDefault(); execShortcut(sc.id); } });
}
function execShortcut(id) {
  const map = {
    new:()=>{if(!isMapOpen) openForm(false);}, search:()=>{if(!isMapOpen){g('searchInput').focus();g('searchInput').select();}},
    map:()=>{if(!isMapOpen) toggleMapView(true);}, back:()=>{if(isMapOpen) toggleMapView(false);},
    close:()=>{ if(g('scp').style.display==='block') closeShortcutMgr(); else if(g('tp').classList.contains('open')) g('tp').classList.remove('open'); else if(g('fp').classList.contains('open')) closeForm(); else if(g('dp').classList.contains('open')) closeDetail(); },
    edit:()=>{if(openId&&g('dp').classList.contains('open')) openForm(true);}, link:()=>{if(openId&&g('dp').classList.contains('open')) openForm(true);},
    export:()=>exportData(), flash:()=>{if(!isMapOpen) openFlash();}, stats:()=>{if(!isMapOpen) openStats();}, shortcuts:()=>openShortcutMgr()
  };
  if(map[id]) map[id]();
  showShortcutHint({new:'新增筆記',search:'搜尋',map:'開啟體系圖',back:'返回筆記列表',close:'關閉',edit:'編輯筆記',link:'新增關聯',export:'匯出備份',flash:'複習模式',stats:'統計',shortcuts:'快捷鍵設定'}[id]);
}
function showShortcutHint(t){ const h=g('scHint'); h.textContent=t; h.style.display='block'; clearTimeout(h._t); h._t=setTimeout(()=>h.style.display='none',1800); }
function toggleMapView(open) {
  isMapOpen=open;
  g('notesView').style.display=open?'none':'block';
  g('mapView').classList.toggle('open',open);
  g('subbar').style.display=open?'none':'flex';
  g('sortBar').style.display=open?'none':'';
  g('search-results-bar').style.display=open?'none':'';
  if(open){
    buildMapFilters();
    g('zoomLabel').textContent=Math.round(mapScale*100)+'%';
    const mlo=g('mapLinkedOnlyBtn');
    if(mlo){
      mlo.style.background=mapLinkedOnly?'#3B6D11':'#EAF3DE';
      mlo.style.color=mapLinkedOnly?'#fff':'#3B6D11';
      mlo.textContent=mapLinkedOnly?'✓ 只顯示關聯':'🔗 只顯示關聯';
    }
    setTimeout(()=>{ const hadNodePos=Object.keys(nodePos).length>0; initNodePos(); drawMap(); if(!hadNodePos) saveData(); },80);
  } else {
    closeMapPopup();
  }
}

// ==================== 統計 ====================
function openStats() { const sp=g('statsPanel'); if(sp.classList.contains('open')){ sp.classList.remove('open'); return; } const total=notes.length, byT={}, byS={}; notes.forEach(n=>{ byT[n.type]=(byT[n.type]||0)+1; byS[n.subject]=(byS[n.subject]||0)+1; }); const lnk={}; links.forEach(l=>{ lnk[l.from]=true; lnk[l.to]=true; }); const lc=Object.keys(lnk).length; let html=`<div class="stats-grid"><div class="stat-card"><div class="stat-num">${total}</div><div class="stat-lbl">筆記總數</div></div><div class="stat-card"><div class="stat-num">${links.length}</div><div class="stat-lbl">關聯數量</div></div><div class="stat-card"><div class="stat-num">${lc}</div><div class="stat-lbl">有關聯筆記</div></div><div class="stat-card"><div class="stat-num">${subjects.length}</div><div class="stat-lbl">科目數</div></div></div><div style="font-size:11px;font-weight:700;color:#888;margin-bottom:8px;">各科目筆記數</div>`;
  Object.keys(byS).sort((a,b)=>byS[b]-byS[a]).forEach(sk=>{ const s=subByKey(sk), c=byS[sk], p=Math.round(c/total*100); html+=`<div class="stats-bar-row"><span class="stats-bar-label">${s.label}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${p}%;background:${s.color}"></div></div><span class="stats-bar-count">${c}</span></div>`; });
  html+=`<div style="font-size:11px;font-weight:700;color:#888;margin:12px 0 8px;">各類型筆記數</div>`;
  Object.keys(byT).sort((a,b)=>byT[b]-byT[a]).forEach(tk=>{ const t=typeByKey(tk), c=byT[tk], p=Math.round(c/total*100); html+=`<div class="stats-bar-row"><span class="stats-bar-label">${t.label}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${p}%;background:${t.color}"></div></div><span class="stats-bar-count">${c}</span></div>`; });
  sp.innerHTML=html; sp.classList.add('open'); setTimeout(()=>sp.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}

// ==================== 複習模式 ====================
function buildFlashDeck() { let pool=notes.filter(n=>(flashSubFilter==='all'||n.subject===flashSubFilter)&&(flashTypeFilter2==='all'||n.type===flashTypeFilter2)); for(let i=pool.length-1;i>0;i--){ let j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; } flashDeck=pool; flashIdx=0; flashShowing=false; flashHard=[]; }
function openFlash() { const fs=g('flashFilter'); fs.innerHTML='<option value="all">全部科目</option>'+subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join(''); fs.value=flashSubFilter; const ftf=g('flashTypeFilter'); if(ftf){ ftf.innerHTML='<option value="all">全部類型</option>'+types.map(t=>`<option value="${t.key}">${t.label}</option>`).join(''); ftf.value=flashTypeFilter2; } buildFlashDeck(); if(flashDeck.length===0){ showToast('此科目沒有筆記'); return; } g('notesView').style.display='none'; g('flashView').classList.add('open'); renderFlashCard(); }
function closeFlash() { g('flashView').classList.remove('open'); g('notesView').style.display='block'; }
function updateFlashProgress() { const total=flashDeck.length, pct=total>0?Math.round(flashIdx/total*100):0; g('flashProgress').textContent=`第 ${flashIdx} / ${total} 張，${flashHard.length}張不熟`; g('flashProgressFill').style.width=`${pct}%`; }
function renderFlashCard() {
  const body = g('flashBody');
  if(flashIdx>=flashDeck.length) {
    const hc=flashHard.length;
    body.innerHTML=`<div class="flash-done"><div class="flash-done-num">${Math.round((flashDeck.length-hc)/Math.max(flashDeck.length,1)*100)}%</div><div class="flash-done-label">熟練率</div><div class="flash-done-sub">${flashDeck.length}張中，${hc}張不熟</div><div style="display:flex;gap:10px;margin-top:24px;justify-content:center;">${hc>0?'<button class="flash-btn flash-btn-hard" style="flex:0;padding:12px 20px;" id="reviewHardBtn">🔂 再練不熟</button>':''}<button class="flash-btn flash-btn-ok" style="flex:0;padding:12px 20px;" id="restartAllBtn">↺ 重新開始</button></div></div>`;
    g('reviewHardBtn')?.addEventListener('click',()=>{ flashDeck=flashHard.slice(); flashIdx=0; flashShowing=false; flashHard=[]; renderFlashCard(); });
    g('restartAllBtn')?.addEventListener('click',()=>{ buildFlashDeck(); renderFlashCard(); });
    updateFlashProgress(); return;
  }
  const n=flashDeck[flashIdx], tp=typeByKey(n.type), sb=subByKey(n.subject);
  if(!flashShowing) {
    body.innerHTML=`<div class="flash-card" id="flashCard"><div><div class="flash-front-label">請回想此筆記的內容</div><div class="flash-front-title">${n.title}</div><div class="flash-front-sub"><span class="chip" style="background:${tp.color}22;color:${tp.color}">${tp.label}</span><span class="chip" style="background:${sb.color}22;color:${sb.color}">${sb.label}</span></div></div><div class="flash-hint">點擊或向右滑動翻面</div></div>`;
    const fc = g('flashCard');
    fc.addEventListener('click',()=>{ flashShowing=true; fc.classList.add('flipping'); setTimeout(()=>renderFlashCard(),180); });
    const swipeFn = dir => { if(dir==='right'){ flashShowing=true; fc.classList.add('flipping'); setTimeout(()=>renderFlashCard(),180); } };
    let tx=0,ty=0,startX=0,startY=0,tracking=false;
    fc.addEventListener('touchstart',e=>{ startX=e.touches[0].clientX; startY=e.touches[0].clientY; tracking=true; tx=0; ty=0; },{passive:true});
    fc.addEventListener('touchmove',e=>{ if(!tracking)return; tx=e.touches[0].clientX-startX; ty=e.touches[0].clientY-startY; if(Math.abs(tx)>8&&Math.abs(tx)>Math.abs(ty)*1.2){ fc.style.transform=`translateX(${tx*0.4}px) rotate(${tx*0.03}deg)`; fc.style.opacity=1-Math.abs(tx)/500; } },{passive:true});
    fc.addEventListener('touchend',()=>{ fc.style.transform=''; fc.style.opacity=''; if(Math.abs(tx)>60&&Math.abs(tx)>Math.abs(ty)*1.2) swipeFn(tx>0?'right':'left'); tracking=false; tx=0; ty=0; });
  } else {
    const hasT = n.dispute||n.f_article||n.f_elements||n.f_conclusion;
    let bc = '';
    if(hasT){
      if(n.dispute) bc+=`<div class="dispute-section"><div class="dispute-section-title">爭點</div><div class="dispute-section-body">${n.dispute}</div></div>`;
      if(n.f_article) bc+=`<div class="dispute-section" style="border-color:#1D9E75"><div class="dispute-section-title" style="color:#1D9E75">適用法條</div><div class="dispute-section-body">${n.f_article}</div></div>`;
      if(n.f_elements) bc+=`<div class="dispute-section" style="border-color:#7F77DD"><div class="dispute-section-title" style="color:#7F77DD">構成要件</div><div class="dispute-section-body">${n.f_elements}</div></div>`;
      if(n.f_conclusion) bc+=`<div class="dispute-section" style="border-color:#D85A30"><div class="dispute-section-title" style="color:#D85A30">結論</div><div class="dispute-section-body">${n.f_conclusion}</div></div>`;
    } else { bc=`<div class="flash-back-body">${n.body}</div>`+(n.detail?`<div class="flash-back-detail">${n.detail}</div>`:''); }
    body.innerHTML=`<div class="flash-card" id="flashCardBack"><div><div class="flash-back-label">答案</div>${bc}</div></div><div class="flash-btns"><button class="flash-btn flash-btn-hard" id="fbHard">😠 不熟</button><button class="flash-btn flash-btn-ok" id="fbOk">✅ 記住了</button></div>`;
    const doHard = () => { const card=g('flashCardBack'); if(card){ card.classList.add('swipe-left'); setTimeout(()=>{ flashHard.push(flashDeck[flashIdx]); flashIdx++; flashShowing=false; renderFlashCard(); updateFlashProgress(); },300); } else{ flashHard.push(flashDeck[flashIdx]); flashIdx++; flashShowing=false; renderFlashCard(); updateFlashProgress(); } };
    const doOk = () => { const card=g('flashCardBack'); if(card){ card.classList.add('swipe-right'); setTimeout(()=>{ flashIdx++; flashShowing=false; renderFlashCard(); updateFlashProgress(); },300); } else{ flashIdx++; flashShowing=false; renderFlashCard(); updateFlashProgress(); } };
    g('fbHard').addEventListener('click',doHard); g('fbOk').addEventListener('click',doOk);
    const fcb = g('flashCardBack');
    if(fcb){
      let tx=0,ty=0,startX=0,startY=0,tracking=false;
      fcb.addEventListener('touchstart',e=>{ startX=e.touches[0].clientX; startY=e.touches[0].clientY; tracking=true; tx=0; ty=0; },{passive:true});
      fcb.addEventListener('touchmove',e=>{ if(!tracking)return; tx=e.touches[0].clientX-startX; ty=e.touches[0].clientY-startY; if(Math.abs(tx)>8&&Math.abs(tx)>Math.abs(ty)*1.2){ fcb.style.transform=`translateX(${tx*0.4}px) rotate(${tx*0.03}deg)`; fcb.style.opacity=1-Math.abs(tx)/500; } },{passive:true});
      fcb.addEventListener('touchend',()=>{ fcb.style.transform=''; fcb.style.opacity=''; if(Math.abs(tx)>60&&Math.abs(tx)>Math.abs(ty)*1.2) tx>0?doOk():doHard(); tracking=false; tx=0; ty=0; });
    }
  }
  updateFlashProgress();
}

// ==================== 多選功能 ====================
function enterMultiSel() { multiSelMode=true; selectedIds={}; g('selectBar').classList.add('open'); g('multiSelBtn').style.background='#1a1a2e'; g('multiSelBtn').style.color='#fff'; ['dp','fp'].forEach(p=>g(p).classList.remove('open')); updateSelBar(); render(); }
function exitMultiSel() { multiSelMode=false; selectedIds={}; g('selectBar').classList.remove('open'); g('multiSelBtn').style.background='#f0f0f0'; g('multiSelBtn').style.color=''; render(); }
function updateSelBar() { const cnt=Object.keys(selectedIds).length; g('selectCount').textContent=`已選 ${cnt} 筆`; g('selDeleteBtn').disabled=cnt===0; g('selDeleteBtn').style.opacity=cnt===0?'0.4':'1'; }
function toggleCardSelect(id) { selectedIds[id] ? delete selectedIds[id] : selectedIds[id]=true; updateSelBar(); const c=g('grid').querySelector(`.card[data-id="${id}"]`); if(c) { if(selectedIds[id]) { c.classList.add('selected'); c.querySelector('.sel-check').textContent='✓'; } else { c.classList.remove('selected'); c.querySelector('.sel-check').textContent=''; } } }
function selectAll() { const cards=g('grid').querySelectorAll('.card'); const allSel=Object.keys(selectedIds).length===cards.length; if(allSel) selectedIds={}; else cards.forEach(c=>{ const cid=parseInt(c.dataset.id); selectedIds[cid]=true; c.classList.add('selected'); c.querySelector('.sel-check').textContent='✓'; }); updateSelBar(); }
function deleteSelected() { const ids=Object.keys(selectedIds); if(!ids.length) return; if(!confirm(`確定刪除這 ${ids.length} 筆筆記？此操作無法復原。`)) return; const idNums=ids.map(Number); links=links.filter(l=>!idNums.includes(l.from)&&!idNums.includes(l.to)); notes=notes.filter(n=>!selectedIds[n.id]); saveData(); exitMultiSel(); showToast(`已刪除 ${ids.length} 筆筆記`); }

// ==================== 申論測驗 ====================
function loadExams() { try { const r=localStorage.getItem('klaws_exams_v1'); if(r){ examList=JSON.parse(r); examList.forEach(e=>{ if(/^tag_s_|^tag_t_/.test(e.subject)) e.subject=subByKey(e.subject).label; }); saveExams(); } } catch(e){ examList=[]; } }
function saveExams() { try { localStorage.setItem('klaws_exams_v1',JSON.stringify(examList)); } catch(e){} }
function openExamPanel() { loadExams(); renderExamList(); const esel=g('examSubSel'); if(esel) esel.innerHTML=subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join(''); g('examListPanel').classList.add('open'); g('examAddForm').classList.remove('open'); g('dp').classList.remove('open'); setTimeout(()=>g('examListPanel').scrollIntoView({behavior:'smooth',block:'nearest'}),60); }
function renderExamList() {
  const el=g('examListItems');
  if(!examList.length){ el.innerHTML='<div style="color:#bbb;font-size:13px;padding:12px 0;">尚無題目，請點新增題目</div>'; return; }
  el.innerHTML=examList.map((ex,i)=>`<div class="exam-item" data-idx="${i}"><div><div class="exam-item-title">${subByKey(ex.subject).label} | ${ex.question.slice(0,35)}${ex.question.length>35?'...':''}</div><div class="exam-item-meta">${ex.timeLimit}分鐘</div></div><button class="exam-item-del" data-del="${i}">🗑️</button></div>`).join('');
  el.querySelectorAll('.exam-item').forEach(el2=>{ el2.addEventListener('click',ev=>{ if(ev.target.getAttribute('data-del')!==null)return; startExam(examList[parseInt(el2.dataset.idx)]); }); });
  el.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',ev=>{ ev.stopPropagation(); examList.splice(parseInt(btn.dataset.del),1); saveExams(); renderExamList(); }));
}
function startExam(exam) { currentExam=exam; g('examListPanel').classList.remove('open'); g('notesView').style.display='none'; g('flashView').classList.remove('open'); g('examView').classList.add('open'); g('examBody').style.display='flex'; g('examResult').style.display='none'; g('examQuestionDisplay').textContent=exam.question; g('examIssueChips').innerHTML=(exam.issues||[]).map(iss=>`<span class="exam-issue-chip">${iss}</span>`).join(''); g('examAnswerBox').value=''; g('examWordCount').textContent='0 字'; g('examHeaderTitle').textContent=`✒️ ${subByKey(exam.subject).label}`; examTotal=exam.timeLimit*60; examSec=examTotal; const updateTimer=()=>{ const m=Math.floor(examSec/60),s=examSec%60; g('examTimer').textContent=`${m<10?'0':''}${m}:${s<10?'0':''}${s}`; if(examSec<=300)g('examTimer').classList.add('warning'); }; updateTimer(); clearInterval(examTimer); examTimer=setInterval(()=>{ examSec--; updateTimer(); if(examSec<=0)doSubmit(true); },1000); }
function doSubmit(timeUp) { clearInterval(examTimer); const ans=g('examAnswerBox').value.trim(); const used=Math.round((examTotal-examSec)/60*10)/10; g('examBody').style.display='none'; g('examResult').style.display='flex'; g('examResult').classList.add('open'); g('resultScoreNum').textContent='--'; g('resultComment').textContent='評分中，請稍候…'; g('resultRef').textContent=''; g('resultTags').innerHTML=''; gradeEssay(currentExam,ans,used,timeUp); }
function gradeEssay(exam,ans,used,timeUp) {
  const issueList=(exam.issues||[]).join('、');
  const prompt=`你是台灣大學法律系教授，正在批改學生的申論題作答。請給予詳細、具體、有教育價值的評語。

【科目】${subByKey(exam.subject).label}
【題目】
${exam.question.slice(0,300)}
【預設爭點】${issueList}
【學生作答】
${(ans||'(未作答)').slice(0,3000)}
【作答時間】${used}分鐘${timeUp?' (時間到，作答可能不完整)':''}

請依下列 JSON 格式輸出評分（只輸出 JSON，不加任何其他文字或 markdown）：
{
  "score": <0-100整數>,
  "comment": "<100-150字整體總評>",
  "issue_analysis": [{"issue":"<爭點名稱>","hit":<true/false>,"analysis":"<針對此爭點的詳細評析>"}],
  "strengths": ["<具體優點1>","<具體優點2>"],
  "weaknesses": ["<具體缺點1>","<具體缺點2>","<具體缺點3>"],
  "suggestions": ["<具體改進建議1>","<具體改進建議2>"],
  "reference": "<參考答題要點>"
}`;
  fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+getAiKey(),'HTTP-Referer':'https://kinayaya.github.io/LawsNote','X-Title':'KLaws'},
    body:JSON.stringify({model:getAiModel(), max_tokens:5000, messages:[{role:'user',content:prompt}]})
  }).then(r=>r.json()).then(d=>{
    if(d.error){ g('resultScoreNum').textContent='?'; g('resultComment').textContent='AI 錯誤：'+(d.error.message||JSON.stringify(d.error)); return; }
    let raw=(((d.choices||[{}])[0].message||{}).content||'').replace(/```json|```/g,'').trim();
    const start=raw.indexOf('{'), end=raw.lastIndexOf('}'); if(start!==-1&&end!==-1) raw=raw.slice(start,end+1);
    try{ showResult(JSON.parse(raw)); }catch(e){ g('resultScoreNum').textContent='?'; g('resultComment').textContent='AI 回應無法解析，原始內容：\n'+raw.slice(0,300); }
  }).catch(e=>{ g('resultScoreNum').textContent='?'; g('resultComment').textContent='評分服務暫時無法連線。錯誤：'+e.message; });
}
function showResult(r) {
  g('resultScoreNum').textContent=r.score||'--';
  const sc=g('resultScoreNum').parentElement; sc.style.background=r.score>=80?'#1D9E75':r.score>=60?'#378ADD':r.score>=40?'#D85A30':'#8B1A1A';
  g('resultComment').textContent=r.comment||'';
  const iaEl=g('resultIssueAnalysis');
  if(iaEl) iaEl.innerHTML=(r.issue_analysis||[]).map(item=>`<div class="issue-analysis-item"><div class="issue-analysis-head"><span class="issue-analysis-name">${item.issue}</span><span class="issue-hit-badge" style="background:${item.hit?'#1D9E75':'#D85A30'}">${item.hit?'✔ 有涵蓋':'✘ 未涵蓋'}</span></div><div class="issue-analysis-body">${item.analysis}</div></div>`).join('');
  let tags='';
  (r.strengths||[]).forEach(s=>tags+=`<span class="result-tag good">✓ ${s}</span>`);
  (r.weaknesses||[]).forEach(s=>tags+=`<span class="result-tag bad">✗ ${s}</span>`);
  (r.suggestions||[]).forEach(s=>tags+=`<span class="result-tag ok">→ ${s}</span>`);
  g('resultTags').innerHTML=tags; g('resultRef').textContent=r.reference||'';
}
function closeExamView() { clearInterval(examTimer); g('examView').classList.remove('open'); g('notesView').style.display='block'; g('subbar').style.display='flex'; }

// ==================== 體系圖 ====================
function initNodePos() { const canvas=g('mapCanvas'); mapW=canvas.offsetWidth||800; mapH=canvas.offsetHeight||500; const cx=mapW/2,cy=mapH/2,r=Math.min(mapW,mapH)*0.44; notes.forEach((n,i)=>{ if(!nodePos[n.id]){ const angle=(i/notes.length)*2*Math.PI; nodePos[n.id]={x:cx+r*Math.cos(angle),y:cy+r*Math.sin(angle)}; } }); }
function getNodeRadius(id){ return clampMapRadius(parseFloat(nodeSizes[id])||MAP_NODE_RADIUS_DEFAULT); }
function clampNodeToCanvas(id){
  if(!nodePos[id]) return;
  const r=getNodeRadius(id)+12;
  nodePos[id].x=Math.max(r,Math.min(mapW-r,nodePos[id].x));
  nodePos[id].y=Math.max(r,Math.min(mapH-r,nodePos[id].y));
}
function segmentsCross(a,b,c,d){
  const det=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const d1=det(a,b,c), d2=det(a,b,d), d3=det(c,d,a), d4=det(c,d,b);
  return (d1*d2<0)&&(d3*d4<0);
}
// ==================== 體系圖核心排列演算法 (全新層級佈局版) ====================
// 目標：將節點像範例圖片一樣，依照關聯方向從左到右、整齊分層排列。
function forceLayout() {
  const canvas = g('mapCanvas');
  mapW = canvas.offsetWidth || 800;
  mapH = canvas.offsetHeight || 600;

  // 1. 取得目前畫面上的節點與連線
  const layoutNotes = visibleNotes();
  const visIds = {};
  layoutNotes.forEach(n => visIds[n.id] = true);
  const visLinks = visibleLinks(visIds);
  const n2 = layoutNotes.length;

  if (!n2) return;

  // 定義間距常數 (您可以根據需要微調這些數字)
  const LEVEL_WIDTH = 1800; // 每一層之間的水平距離
  const NODE_MARGIN_Y = 1000; // 同一層節點之間的垂直最小間距

  // 2. 建立鄰接表 (用來分析誰連到誰)
  const adj = {};
  const inDegree = {}; // 記錄每個節點被多少人連過來 (入度)
  
  layoutNotes.forEach(n => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });

  visLinks.forEach(lk => {
    if (adj[lk.from] && adj[lk.to] !== undefined) {
      adj[lk.from].push(lk.to);
      inDegree[lk.to]++;
    }
  });

  // 3. 確定節點層級 (Level assigning)
  const levels = {}; // 格式: { nodeId: 0, nodeId: 1, ... }
  const levelGroups = []; // 格式: [[nodeId, nodeId], [nodeId], ...]

  // 使用拓撲排序思維確定層級
  let queue = layoutNotes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  
  // 如果所有節點都有人連 (形成環)，就強制抓第一個當起點
  if (queue.length === 0 && n2 > 0) {
    queue = [layoutNotes[0].id];
  }

  // 遞迴分配層級
  let currentLevel = 0;
  let visited = new Set();

  while (queue.length > 0) {
    let nextQueue = [];
    levelGroups[currentLevel] = [];

    queue.forEach(nodeId => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      levels[nodeId] = currentLevel;
      levelGroups[currentLevel].push(nodeId);

      if (adj[nodeId]) {
        adj[nodeId].forEach(neighborId => {
          if (!visited.has(neighborId)) {
            nextQueue.push(neighborId);
          }
        });
      }
    });

    // 處理未被連到的孤立節點，放在第一層
    if (nextQueue.length === 0 && visited.size < n2) {
        const unvisited = layoutNotes.filter(n => !visited.has(n.id));
        if(unvisited.length > 0) {
            nextQueue = [unvisited[0].id];
        }
    }

    queue = [...new Set(nextQueue)]; // 去重
    currentLevel++;
  }

  // 4. 計算並設定座標 (Coordinate assignment)
  // 水平方向：根據層級 (Level) 決定 X
  // 垂直方向：根據該層內的序號決定 Y，並居中
  
  levelGroups.forEach((group, levelIdx) => {
    if(!group) return;

    // 排序邏輯：讓子節點跟隨父節點的平均 Y 軸位置
    if (levelIdx > 0) {
      group.sort((a, b) => {
        const parentsA = layoutNotes.filter(n => adj[n.id] && adj[n.id].includes(a));
        const parentsB = layoutNotes.filter(n => adj[n.id] && adj[n.id].includes(b));
        const avgYA = parentsA.length ? parentsA.reduce((sum, p) => sum + (nodePos[p.id]?.y || 0), 0) / parentsA.length : 0;
        const avgYB = parentsB.length ? parentsB.reduce((sum, p) => sum + (nodePos[p.id]?.y || 0), 0) / parentsB.length : 0;
        return avgYA - avgYB;
      });
    }

    const numNodesInLevel = group.length;
    const totalLevelHeight = numNodesInLevel * NODE_MARGIN_Y;
    const startY = (mapH - totalLevelHeight) / 2;

    group.forEach((nodeId, nodeIdx) => {
      const x = levelIdx * LEVEL_WIDTH + 80; // 稍微靠左
      const y = startY + (nodeIdx * NODE_MARGIN_Y) + (NODE_MARGIN_Y / 2);
      nodePos[nodeId] = { x, y };
      clampNodeToCanvas(nodeId);
    });
  });
  // 5. 儲存新的位置資料
  saveDataDeferred();
}
// ==================== 演算法結束 ====================
function pointToSegmentDistance(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1, len2=dx*dx+dy*dy;
  if(!len2) return {dist:Math.hypot(px-x1,py-y1), nx:0, ny:0};
  let t=((px-x1)*dx+(py-y1)*dy)/len2; t=Math.max(0,Math.min(1,t));
  const cx=x1+t*dx, cy=y1+t*dy;
  let vx=px-cx, vy=py-cy, d=Math.hypot(vx,vy);
  if(d<0.001){ const nx=-dy/Math.sqrt(len2), ny=dx/Math.sqrt(len2); return {dist:0, nx, ny}; }
  return {dist:d, nx:vx/d, ny:vy/d};
}
function pushNodeOffLinks(nodeId, visLinks, pad=0){
  const pos=nodePos[nodeId]; if(!pos) return false;
  const need=getNodeRadius(nodeId)+12+pad;
  let moved=false;
  visLinks.forEach(lk=>{
    if(lk.from===nodeId||lk.to===nodeId) return;
    const a=nodePos[lk.from], b=nodePos[lk.to];
    if(!a||!b) return;
    const hit=pointToSegmentDistance(pos.x,pos.y,a.x,a.y,b.x,b.y);
    if(hit.dist<need){
      const push=need-hit.dist+0.8;
      pos.x+=hit.nx*push; pos.y+=hit.ny*push;
      clampNodeToCanvas(nodeId);
      moved=true;
    }
  });
  return moved;
}
function getArrowMarker(color){ return `url(#arrowBlue)`; }

// ==================== 體系圖核心繪製（修復拖曳連線）====================
function moveNodeEl(id,x,y){
  const grp=nodeEls[id]; if(!grp)return;
  const mainCircle=grp.querySelector('circle.node-main');
  const countText=grp.querySelector('text.node-count');
  const titleText=grp.querySelector('text.node-title');
  if(mainCircle){ mainCircle.setAttribute('cx',x); mainCircle.setAttribute('cy',y); }
  const r=parseFloat(mainCircle?mainCircle.getAttribute('r'):24)||24;
  if(countText){ countText.setAttribute('x',x); countText.setAttribute('y',y); }
  if(titleText){
    titleText.setAttribute('x',x);
    titleText.setAttribute('y',y+r+12);
    titleText.querySelectorAll('tspan').forEach(t=>t.setAttribute('x',x));
  }
}
function visibleLinks(visIds){ return links.filter(lk=>visIds[lk.from]&&visIds[lk.to]); }
function buildLinkCurveOffsets(visLinks){
  const groups={}, spacing=12;
  const laneOrder=idx=>idx===0?0:(idx%2===1?(idx+1)/2:-(idx/2));
  visLinks.forEach(lk=>{
    const fp=nodePos[lk.from], tp=nodePos[lk.to]; if(!fp||!tp)return;
    const dx=tp.x-fp.x, dy=tp.y-fp.y, ang=Math.atan2(dy,dx), mx=(fp.x+tp.x)/2, my=(fp.y+tp.y)/2;
    const key=`${Math.round(mx/84)}_${Math.round(my/84)}_${Math.round((ang+Math.PI)/(Math.PI/8))}`;
    if(!groups[key]) groups[key]=[];
    groups[key].push(lk);
  });
  const offsets={};
  Object.values(groups).forEach(arr=>{
    arr.sort((a,b)=>a.id-b.id);
    arr.forEach((lk,idx)=>{ offsets[lk.id]=laneOrder(idx)*spacing; });
  });
  return offsets;
}
function calcLinkPath(lk){
  const fp=nodePos[lk.from],tp=nodePos[lk.to]; if(!fp||!tp)return null;
  const dx=tp.x-fp.x,dy=tp.y-fp.y,dist=Math.sqrt(dx*dx+dy*dy)||1, nx=dx/dist,ny=dy/dist;
  const rf=getNodeRadius(lk.from), rt=getNodeRadius(lk.to);
  const x1=fp.x+nx*rf,y1=fp.y+ny*rf,x2=tp.x-nx*(rt+8),y2=tp.y-ny*(rt+8);
  const baseCurve=Math.max(16,Math.min(48,dist*0.14));
  const laneOffset=linkCurveOffsets[lk.id]||0;
  const orient = laneOffset===0 ? (lk.from<lk.to?1:-1) : Math.sign(laneOffset);
  const curve = orient*(baseCurve+Math.abs(laneOffset));
  const mx=(x1+x2)/2 + (-ny)*curve, my=(y1+y2)/2 + nx*curve;
  return {d:`M${x1},${y1} Q${mx},${my} ${x2},${y2}`};
}

// 修復：拖曳時同步更新所有受影響連線的路徑
function redrawLines(affectedId){
  const visIds={};
  visibleNotes().forEach(n=>visIds[n.id]=true);
  // 重建 curveOffsets（位置改變後偏移量要重算）
  linkCurveOffsets = buildLinkCurveOffsets(visibleLinks(visIds));

  // 如果有 affectedId，只更新和該節點相關的線；否則全部更新
  const toUpdateIds = affectedId !== undefined
    ? (nodeLinksIndex[affectedId] || [])
    : Object.keys(linkElsMap).map(Number);

  toUpdateIds.forEach(linkId=>{
    const els = linkElsMap[linkId];
    const lk = links.find(x=>x.id===linkId);
    if(!els || !els.p || !lk) return;
    // 確認兩端節點都在可視集合中
    if(!visIds[lk.from] || !visIds[lk.to]) return;
    const c = calcLinkPath(lk);
    if(!c) return;
    els.p.setAttribute('d', c.d);
  });
}

function visibleNotes(){ const q=mapFilter.q.toLowerCase(), linkedIds={}; if(mapLinkedOnly) links.forEach(l=>{ linkedIds[l.from]=true; linkedIds[l.to]=true; }); return notes.filter(n=>(mapFilter.sub==='all'||n.subject===mapFilter.sub)&&(mapFilter.type==='all'||n.type===mapFilter.type)&&(!q||`${n.title}${n.subject}${noteTags(n).join('')}`.toLowerCase().includes(q))&&(!mapLinkedOnly||linkedIds[n.id])); }
function scheduleMapRedraw(delay=80){
  clearTimeout(mapRedrawTimer);
  mapRedrawTimer=setTimeout(()=>{ if(isMapOpen) drawMap(); },delay);
}
function drawMap() {
  initNodePos();
  const svg=g('mapSvg'), canvas=g('mapCanvas');
  mapW=canvas.offsetWidth||800; mapH=canvas.offsetHeight||500;
  svg.setAttribute('width',mapW); svg.setAttribute('height',mapH);

  const ll=g('linksLayer'), nl=g('nodesLayer');
  let gw=svg.querySelector('#mapWrap');
  if(!gw){
    gw=document.createElementNS('http://www.w3.org/2000/svg','g');
    gw.setAttribute('id','mapWrap');
    svg.insertBefore(gw,svg.firstChild);
  }
  // 每次重繪確保圖層在 mapWrap 中（修復 Safari/iPad 連線消失）
  gw.appendChild(ll);
  gw.appendChild(nl);
  ll.innerHTML=''; nl.innerHTML='';
  gw.setAttribute('transform',`translate(${mapOffX},${mapOffY}) scale(${mapScale})`);

  const vis=visibleNotes(), visIds={};
  vis.forEach(v=>visIds[v.id]=true);
  const visLinks=visibleLinks(visIds);
  linkCurveOffsets=buildLinkCurveOffsets(visLinks);

  // 重置索引
  linkElsMap={}; nodeLinksIndex={};

  // 繪製連線
  visLinks.forEach(lk=>{
    const c=calcLinkPath(lk); if(!c)return;
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');
    line.setAttribute('d',c.d);
    line.setAttribute('stroke',LINK_COLOR);
    line.setAttribute('stroke-width','2');
    line.setAttribute('fill','none');
    line.setAttribute('marker-end','url(#arrowBlue)');
    line.setAttribute('vector-effect','non-scaling-stroke');
    line.setAttribute('stroke-linecap','round');
    ll.appendChild(line);
    linkElsMap[lk.id]={p:line};
    if(!nodeLinksIndex[lk.from]) nodeLinksIndex[lk.from]=[];
    if(!nodeLinksIndex[lk.to]) nodeLinksIndex[lk.to]=[];
    nodeLinksIndex[lk.from].push(lk.id);
    nodeLinksIndex[lk.to].push(lk.id);
  });

  // 繪製節點
  notes.forEach(n=>{
    if(!visIds[n.id])return;
    const pos=nodePos[n.id]; if(!pos)return;
    const tp=typeByKey(n.type), lc=links.filter(l=>l.from===n.id||l.to===n.id).length, radius=getNodeRadius(n.id);
    const grp=document.createElementNS('http://www.w3.org/2000/svg','g');
    grp.setAttribute('class','map-node'); grp.setAttribute('data-id',n.id);
    const circ=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circ.setAttribute('class','node-main'); circ.setAttribute('cx',pos.x); circ.setAttribute('cy',pos.y);
    circ.setAttribute('r',radius); circ.setAttribute('fill',tp.color);
    circ.setAttribute('stroke','#fff'); circ.setAttribute('stroke-width','2');
    grp.appendChild(circ);
    if(lc>0){
      const bt=document.createElementNS('http://www.w3.org/2000/svg','text');
      bt.setAttribute('class','node-count'); bt.setAttribute('x',pos.x); bt.setAttribute('y',pos.y);
      bt.setAttribute('text-anchor','middle'); bt.setAttribute('dominant-baseline','middle');
      bt.setAttribute('font-size',String(Math.max(9,Math.min(13,radius*0.45))));
      bt.setAttribute('fill','#fff'); bt.setAttribute('font-weight','800'); bt.textContent=lc;
      grp.appendChild(bt);
    }
    const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('class','node-title'); txt.setAttribute('x',pos.x); txt.setAttribute('y',pos.y+radius+12);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','10'); txt.setAttribute('fill','#444');
    splitMapTitleLines(n.title).forEach((line,idx)=>{
      const sp=document.createElementNS('http://www.w3.org/2000/svg','tspan');
      sp.setAttribute('x',pos.x); sp.setAttribute('dy',idx===0?'0':'1.15em'); sp.textContent=line;
      txt.appendChild(sp);
    });
    grp.appendChild(txt);
    nl.appendChild(grp);
  });

  if(visLinks.length && ll.childElementCount===0){
    scheduleMapRedraw(120);
  }

  // 重建節點索引並綁定事件
  nodeEls={};
  nl.querySelectorAll('.map-node').forEach(ng=>{
    const id=parseInt(ng.dataset.id,10);
    if(Number.isNaN(id)) return;
    nodeEls[id]=ng;
    ng.addEventListener('mousedown',e=>startDrag(e,id));
    ng.addEventListener('touchstart',e=>startDragTouch(e,id),{passive:true});
    ng.addEventListener('click',e=>{
      e.stopPropagation();
      highlightNode(id);
      showMapInfo(id);
      openMapPopup(id);
    });
  });
}

function openMapPopup(id){
  const popup=g('mapPopup'), pos=nodePos[id];
  if(!popup||!pos) return;
  const maxLeft=Math.max(8, mapW-320), maxTop=Math.max(8, mapH-250);
  const left=Math.max(8, Math.min(maxLeft, pos.x*mapScale+mapOffX+14));
  const top=Math.max(8, Math.min(maxTop, pos.y*mapScale+mapOffY+14));
  popup.style.left=`${left}px`;
  popup.style.top=`${top}px`;
  popup.classList.add('open');
  const goBtn=g('mpGoto');
  if(goBtn){
    goBtn.onclick=()=>{
      toggleMapView(false);
      openNote(id);
    };
  }
}
function showMapInfo(id){ const n=noteById(id); if(!n)return; const tp=typeByKey(n.type), sb=subByKey(n.subject), related=links.filter(l=>l.from===id||l.to===id);
  g('mpBadge').textContent=tp.label; g('mpBadge').style.background=tp.color; g('mpTitle').textContent=n.title; g('mpSubject').textContent=sb.label; g('mpSubject').style.background=sb.color+'22'; g('mpSubject').style.color=sb.color;
  const sizeNumInput=g('mpNodeSizeNum');
  if(sizeNumInput){
    const radius=getNodeRadius(id);
    sizeNumInput.value=String(Math.round(radius));
    sizeNumInput.oninput=()=>{
      const v=parseInt(sizeNumInput.value,10);
      if(isNaN(v)) return;
      const clamped=clampMapRadius(v);
      nodeSizes[id]=clamped;
      clampNodeToCanvas(id); moveNodeEl(id,nodePos[id].x,nodePos[id].y); redrawLines(id); saveDataDeferred();
    };
    g('mpNodeSizeReset').onclick=()=>{
      delete nodeSizes[id];
      const nr=getNodeRadius(id);
      sizeNumInput.value=String(Math.round(nr));
      clampNodeToCanvas(id); moveNodeEl(id,nodePos[id].x,nodePos[id].y); redrawLines(id); saveDataDeferred();
    };
  }
 const linksEl=g('mpLinks');
 if(!related.length){
    linksEl.innerHTML='<span class="mp-no-links">尚無關聯</span>';
  } else {
    linksEl.innerHTML=related.map(l=>{
      const otherId=l.from===id?l.to:l.from, other=noteById(otherId), dir=l.from===id?'→':'←', name=other?other.title:'（已刪除）';
      return `<div class="mp-link-row"><span class="mp-link-badge" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="mp-link-name" data-nid="${otherId}">${name}</span></div>`;
    }).join('');
    linksEl.querySelectorAll('.mp-link-name').forEach(el=>{
      el.addEventListener('click',()=>{
        closeMapPopup();
        const tid=parseInt(el.dataset.nid);
        showMapInfo(tid);
        highlightNode(tid);
      });
    });
  }
}
function closeMapPopup(){ g('mapPopup').classList.remove('open'); }
function highlightNode(id){ g('nodesLayer').querySelectorAll('.map-node').forEach(grp=>{ grp.classList.remove('map-node-highlight'); if(parseInt(grp.dataset.id)===id) grp.classList.add('map-node-highlight'); }); }
function startDrag(e,id){ e.preventDefault(); e.stopPropagation(); closeMapPopup(); dragNode=id; const pos=nodePos[id], rect=g('mapCanvas').getBoundingClientRect(); dragOffX=e.clientX-rect.left-(pos.x*mapScale+mapOffX); dragOffY=e.clientY-rect.top-(pos.y*mapScale+mapOffY); }
function startDragTouch(e,id){ e.stopPropagation(); dragNode=id; const pos=nodePos[id], rect=g('mapCanvas').getBoundingClientRect(), touch=e.touches[0]; dragOffX=touch.clientX-rect.left-(pos.x*mapScale+mapOffX); dragOffY=touch.clientY-rect.top-(pos.y*mapScale+mapOffY); }
function buildMapFilters(){ const ss=g('mapFilterSub'), st=g('mapFilterType'); if(!ss)return; ss.innerHTML='<option value="all">全部科目</option>'+subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join(''); st.innerHTML='<option value="all">全部類型</option>'+types.map(t=>`<option value="${t.key}">${t.label}</option>`).join(''); }

// ==================== AI 功能 ====================
function requireAiKey(action){ const k=getAiKey(); if(k){ action(k); return; } _aiPendingAction=action; g('aiKeyInput').value=''; const sel=g('aiModelSel'); if(sel) sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join(''); g('aiKeyModal').classList.add('open'); }
function openAiSettings(){ g('aiKeyInput').value=getAiKey(); const sel=g('aiModelSel'); if(sel) sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join(''); _aiPendingAction=null; g('aiKeyModal').classList.add('open'); }
function callAI(key, prompt, onSuccess, onError){ const model=getAiModel(); const doFetch=(m,isRetry)=>{ fetch('https://openrouter.ai/api/v1/chat/completions',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'HTTP-Referer':'https://kinayaya.github.io/LawsNote','X-Title':'KLaws'}, body:JSON.stringify({model:m, max_tokens:2000, messages:[{role:'user',content:prompt}]}) }).then(r=>r.json()).then(d=>{ if(d.error){ if(!isRetry && m!=='openrouter/free'){ showToast('模型暫時不可用，自動切換重試...'); doFetch('openrouter/free',true); return; } onError(d.error.message||'API 錯誤'); return; } let raw=(((d.choices||[{}])[0].message||{}).content||'').replace(/```json|```/g,'').trim(); const start=raw.indexOf('{'), end=raw.lastIndexOf('}'); if(start!==-1&&end!==-1) raw=raw.slice(start,end+1); try{ onSuccess(JSON.parse(raw)); }catch(e){ onError('AI 回應格式錯誤，請重試（'+raw.slice(0,80)+'）'); } }).catch(e=>{ onError('連線失敗：'+e.message); }); }; doFetch(model,false); }


// ==================== 初始化 ====================
window.addEventListener('load',()=>{
  loadData(); rebuildUI();
  g('sortSelect').value=sortMode; g('sortSelect').addEventListener('change',()=>{ sortMode=g('sortSelect').value; gridPage=1; render(); });
  g('multiSelBtn').addEventListener('click',()=>multiSelMode?exitMultiSel():enterMultiSel());
  g('selAllBtn').addEventListener('click',selectAll); g('selDeleteBtn').addEventListener('click',deleteSelected); g('selCancelBtn').addEventListener('click',exitMultiSel);
  g('statsBtn')?.addEventListener('click',openStats); g('flashBtn')?.addEventListener('click',openFlash); g('flashBackBtn')?.addEventListener('click',closeFlash);
  g('flashShuffleBtn')?.addEventListener('click',()=>{ buildFlashDeck(); renderFlashCard(); }); g('flashRestartBtn')?.addEventListener('click',()=>{ buildFlashDeck(); renderFlashCard(); });
  g('flashFilter')?.addEventListener('change',()=>{ flashSubFilter=g('flashFilter').value; buildFlashDeck(); renderFlashCard(); });
  g('flashTypeFilter')?.addEventListener('change',()=>{ flashTypeFilter2=g('flashTypeFilter').value; buildFlashDeck(); renderFlashCard(); });
  g('ft')?.addEventListener('change',()=>{ toggleTemplate(g('ft').value==='case'); toggleDiaryTodo(g('ft').value==='diary'); });
  const si=g('searchInput'), sc=g('searchClear'); si.addEventListener('input',debounce(()=>{ searchQ=si.value; gridPage=1; sc.style.display=searchQ?'block':'none'; render(); },250)); sc.addEventListener('click',()=>{ si.value=''; searchQ=''; gridPage=1; sc.style.display='none'; render(); si.focus(); });
  g('addBtn').addEventListener('click',()=>openForm(false)); g('editBtn').addEventListener('click',()=>openForm(true));
  // 移除獨立 linkBtn 事件（已整合進編輯表單），改由 dp 的按鈕打開編輯
  g('linkBtn')?.addEventListener('click',()=>openForm(true));
  g('dpClose').addEventListener('click',closeDetail); g('fpClose').addEventListener('click',closeForm); g('fpCancel').addEventListener('click',closeForm);
  g('fpSave').addEventListener('click',saveNote); g('delBtn').addEventListener('click',deleteNote); g('exportBtn').addEventListener('click',exportData);
  g('tpClose').addEventListener('click',()=>g('tp').classList.remove('open')); g('addTypeBtn').addEventListener('click',()=>addTag('type')); g('addSubBtn').addEventListener('click',()=>addTag('sub'));
  loadExams(); g('examBtn')?.addEventListener('click',openExamPanel); g('examListClose')?.addEventListener('click',()=>g('examListPanel').classList.remove('open'));
  g('examAddBtn')?.addEventListener('click',()=>{ const esel=g('examSubSel'); if(esel) esel.innerHTML=subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join(''); g('examListPanel').classList.remove('open'); g('examAddForm').classList.add('open'); setTimeout(()=>g('examAddForm').scrollIntoView({behavior:'smooth',block:'nearest'}),60); });
  g('examFormClose')?.addEventListener('click',()=>{ g('examAddForm').classList.remove('open'); openExamPanel(); }); g('examFCancel')?.addEventListener('click',()=>{ g('examAddForm').classList.remove('open'); openExamPanel(); });
  g('examFSave')?.addEventListener('click',()=>{ const q=(g('examQInput').value||'').trim(); if(!q){ showToast('請輸入題目'); return; } const iss=(g('examIssInput').value||'').split(',').map(x=>x.trim()).filter(Boolean); const tl=parseInt(g('examTimeInput').value)||30; const sub=g('examSubSel').value||subjects[0]?.key; examList.push({id:Date.now(),subject:sub,question:q,issues:iss,timeLimit:tl}); saveExams(); g('examQInput').value=''; g('examIssInput').value=''; g('examTimeInput').value='30'; g('examAddForm').classList.remove('open'); openExamPanel(); showToast('題目已儲存！'); });
  g('examSubmitBtn')?.addEventListener('click',()=>doSubmit(false)); g('examCancelBtn')?.addEventListener('click',()=>{ clearInterval(examTimer); closeExamView(); });
  g('examRetryBtn')?.addEventListener('click',()=>{ closeExamView(); setTimeout(openExamPanel,100); }); g('examBackBtn2')?.addEventListener('click',closeExamView);
  g('examAnswerBox')?.addEventListener('input',()=>{ g('examWordCount').textContent=g('examAnswerBox').value.replace(/\s/g,'').length+' 字'; });
  g('aiSettingsBtn')?.addEventListener('click',openAiSettings); g('aiKeySave').addEventListener('click',()=>{ const k=(g('aiKeyInput').value||'').trim(); if(!k){ showToast('請輸入 OpenRouter API Key'); return; } saveAiKey(k); const sel=g('aiModelSel'); if(sel&&sel.value) saveAiModel(sel.value); g('aiKeyModal').classList.remove('open'); if(_aiPendingAction){ _aiPendingAction(k); _aiPendingAction=null; } else showToast('AI 設定已儲存！'); }); g('aiKeyCancel').addEventListener('click',()=>{ g('aiKeyModal').classList.remove('open'); _aiPendingAction=null; });
  g('importFile').addEventListener('change',e=>{ if(e.target.files&&e.target.files[0]) importData(e.target.files[0]); e.target.value=''; });
  g('shortcutMgrBtn').addEventListener('click',openShortcutMgr); g('scpClose').addEventListener('click',closeShortcutMgr); g('scpDone').addEventListener('click',closeShortcutMgr);
  g('scpReset').addEventListener('click',()=>{ shortcuts=DEFAULT_SHORTCUTS.map(s=>({...s})); saveShortcuts(); renderShortcutList(); showToast('已恢復預設快捷鍵'); });
  loadShortcuts(); document.addEventListener('keydown',handleGlobalKey);
  g('mapToggleBtn').addEventListener('click',()=>toggleMapView(true));
  g('mapBackBtn').addEventListener('click',()=>toggleMapView(false));
  g('mapSearchInput')?.addEventListener('input',debounce(()=>{ mapFilter.q=g('mapSearchInput').value; if(isMapOpen) drawMap(); },250));
  g('mapFilterSub')?.addEventListener('change',()=>{ mapFilter.sub=g('mapFilterSub').value; if(isMapOpen) drawMap(); });
  g('mapFilterType')?.addEventListener('change',()=>{ mapFilter.type=g('mapFilterType').value; if(isMapOpen) drawMap(); });
  const setZoom=z=>{ mapScale=Math.max(0.15,Math.min(3.5,z)); g('zoomLabel').textContent=Math.round(mapScale*100)+'%'; drawMap(); };
  g('zoomIn')?.addEventListener('click',()=>setZoom(mapScale+0.15)); g('zoomOut')?.addEventListener('click',()=>setZoom(mapScale-0.15));
  g('zoomFit')?.addEventListener('click',()=>{ if(!notes.length)return; const xs=notes.map(n=>nodePos[n.id]?nodePos[n.id].x:mapW/2), ys=notes.map(n=>nodePos[n.id]?nodePos[n.id].y:mapH/2); const minX=Math.min(...xs)-40, maxX=Math.max(...xs)+40, minY=Math.min(...ys)-40, maxY=Math.max(...ys)+40; const sc=Math.min(mapW/(maxX-minX||1),mapH/(maxY-minY||1),2.5); mapScale=sc; mapOffX=-minX*sc+(mapW-(maxX-minX)*sc)/2; mapOffY=-minY*sc+(mapH-(maxY-minY)*sc)/2; g('zoomLabel').textContent=Math.round(sc*100)+'%'; drawMap(); });
  g('mpClose')?.addEventListener('click',closeMapPopup);
  g('mapLinkedOnlyBtn')?.addEventListener('click',()=>{ mapLinkedOnly=!mapLinkedOnly; const btn=g('mapLinkedOnlyBtn'); if(btn){ btn.style.background=mapLinkedOnly?'#3B6D11':'#EAF3DE'; btn.style.color=mapLinkedOnly?'#fff':'#3B6D11'; btn.textContent=mapLinkedOnly?'✓ 只顯示關聯':'🔗 只顯示關聯'; } nodePos={}; forceLayout(); drawMap(); showToast(mapLinkedOnly?`顯示 ${visibleNotes().length} 個有關聯的節點`:'顯示全部節點'); });
  g('mapAutoBtn')?.addEventListener('click',()=>{ const btn=g('mapAutoBtn'), orig=btn.textContent; btn.textContent='排列中...'; btn.disabled=true; setTimeout(()=>{ nodePos={}; mapScale=1; mapOffX=mapOffY=0; forceLayout(); drawMap(); g('zoomLabel').textContent='100%'; btn.textContent=orig; btn.disabled=false; showToast('已自動排列'); },30); });
  g('mapResetBtn')?.addEventListener('click',()=>{ nodePos={}; mapScale=1; mapOffX=mapOffY=0; forceLayout(); drawMap(); g('zoomLabel').textContent='100%'; showToast('已重置'); });
  const canvas=g('mapCanvas'); let panStart=null, panOffXStart=0, panOffYStart=0;

  // ---- 拖曳移動節點（修復連線同步）----
  const onDragMove=(x,y)=>{
    if(!dragNode||!nodePos[dragNode]) return;
    const activeNodeId=dragNode;
    const rect=canvas.getBoundingClientRect();
    let cx=(x-rect.left-dragOffX-mapOffX)/mapScale, cy=(y-rect.top-dragOffY-mapOffY)/mapScale;
    nodePos[activeNodeId]={x:cx,y:cy};
    clampNodeToCanvas(activeNodeId);
    // 取得可視連線索引
    const visIds={}; visibleNotes().forEach(n=>visIds[n.id]=true);
    pushNodeOffLinks(activeNodeId, visibleLinks(visIds), 10);
    cx=nodePos[activeNodeId].x; cy=nodePos[activeNodeId].y;
    if(rafId) cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(()=>{
      // 1. 更新節點 DOM 位置
      moveNodeEl(activeNodeId,cx,cy);
      // 2. 重新計算並更新受影響的連線
      redrawLines(activeNodeId);
      rafId=null;
    });
  };

  const onPanMove=(x,y)=>{ if(!panStart)return; mapOffX=panOffXStart+(x-panStart.x); mapOffY=panOffYStart+(y-panStart.y); if(rafId)cancelAnimationFrame(rafId); rafId=requestAnimationFrame(()=>{ const gw=g('mapSvg').querySelector('#mapWrap'); if(gw)gw.setAttribute('transform',`translate(${mapOffX},${mapOffY}) scale(${mapScale})`); rafId=null; }); };
  canvas.addEventListener('click',e=>{ if(e.target===canvas||e.target.id==='mapSvg'||e.target.id==='linksLayer') closeMapPopup(); });
  canvas.addEventListener('mousedown',e=>{ if(!dragNode){ panStart={x:e.clientX,y:e.clientY}; panOffXStart=mapOffX; panOffYStart=mapOffY; canvas.style.cursor='grabbing'; } });
  canvas.addEventListener('mousemove',e=>{ if(dragNode) onDragMove(e.clientX,e.clientY); else if(panStart) onPanMove(e.clientX,e.clientY); });
  canvas.addEventListener('mouseup',()=>{ if(dragNode){ if(rafId)cancelAnimationFrame(rafId); saveDataDeferred(); dragNode=null; } panStart=null; canvas.style.cursor=''; });
  canvas.addEventListener('mouseleave',()=>{ panStart=null; canvas.style.cursor=''; });
  canvas.addEventListener('touchmove',e=>{ if(e.touches.length===1){ if(dragNode){ e.preventDefault(); onDragMove(e.touches[0].clientX,e.touches[0].clientY); } else if(panStart){ e.preventDefault(); onPanMove(e.touches[0].clientX,e.touches[0].clientY); } } },{passive:false});
  canvas.addEventListener('touchend',()=>{ if(dragNode){ if(rafId)cancelAnimationFrame(rafId); saveDataDeferred(); dragNode=null; } panStart=null; });
  canvas.addEventListener('touchstart',e=>{ if(e.touches.length===1&&!dragNode){ panStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; panOffXStart=mapOffX; panOffYStart=mapOffY; } },{passive:true});
  canvas.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(mapScale+(e.deltaY>0?-0.1:0.1)); },{passive:false});
  let pinchDist=0; canvas.addEventListener('touchstart',e=>{ if(e.touches.length===2){ const d=e.touches[0].clientX-e.touches[1].clientX, dd=e.touches[0].clientY-e.touches[1].clientY; pinchDist=Math.sqrt(d*d+dd*dd); } },{passive:true});
  canvas.addEventListener('touchmove',e=>{ if(e.touches.length===2&&pinchDist){ e.preventDefault(); const d=e.touches[0].clientX-e.touches[1].clientX, dd=e.touches[0].clientY-e.touches[1].clientY, nd=Math.sqrt(d*d+dd*dd); setZoom(mapScale*nd/pinchDist); pinchDist=nd; } },{passive:false});
  window.addEventListener('resize',()=>scheduleMapRedraw(100));
  window.addEventListener('orientationchange',()=>scheduleMapRedraw(120));
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') scheduleMapRedraw(100); });
  if(window.ResizeObserver){
    mapResizeObserver=new ResizeObserver(()=>scheduleMapRedraw(60));
    mapResizeObserver.observe(canvas);
  }
  g('syncBtn').addEventListener('click',()=>{ g('syncModal').classList.add('open'); });
  g('syncCancelBtn').addEventListener('click',()=>g('syncModal').classList.remove('open'));
  g('syncUploadBtn').addEventListener('click',async()=>{ const token=g('syncTokenInput').value.trim(), gistId=g('syncGistInput').value.trim(); if(!token||!gistId){ showToast('請填寫 Token 和 Gist ID'); return; } try{ const data=localStorage.getItem(SKEY); await fetch(`https://api.github.com/gists/${gistId}`,{ method:"PATCH", headers:{"Authorization":`token ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({files:{"klaws_data.json":{content:data}}}) }); showToast("已同步到 GitHub"); g('syncModal').classList.remove('open'); }catch(e){ showToast("同步失敗："+e.message); } });
  g('syncDownloadBtn').addEventListener('click',async()=>{ const token=g('syncTokenInput').value.trim(), gistId=g('syncGistInput').value.trim(); if(!token||!gistId){ showToast('請填寫 Token 和 Gist ID'); return; } try{ const res=await fetch(`https://api.github.com/gists/${gistId}`,{ headers:{"Authorization":`token ${token}`} }); const j=await res.json(); const content=j.files["klaws_data.json"].content; localStorage.setItem(SKEY,content); location.reload(); }catch(e){ showToast("載入失敗："+e.message); } });

  render();

  // ★ 修改1：預設進入體系圖模式
  setTimeout(()=>toggleMapView(true), 120);
});
