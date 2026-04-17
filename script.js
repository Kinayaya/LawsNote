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
const LINK_COLOR = '#378ADD', SKEY = 'legal_notes_v4', PAGE_SIZE = 30;
const ARCHIVES_KEY = 'klaws_archives_v1';
const ARCHIVE_SNAPSHOT_LIMIT = 30;
const RECYCLE_BIN_KEY = 'klaws_recycle_bin_v1';
const UNUSED_TAG_TRACK_KEY = 'klaws_unused_tag_tracker_v1';
const RECYCLE_RETENTION_MS = 7*24*60*60*1000;
const UNUSED_TAG_PURGE_MS = 10*60*1000;
const SCOPE_LINKED_TOGGLE_KEY = 'klaws_scope_linked_toggle_v1';
const COMPACT_FILTER_KEY = 'klaws_compact_filters_v1';
const USAGE_START_KEY = 'klaws_usage_start_v1';
const FORM_TAXONOMY_PREF_KEY = 'klaws_form_taxonomy_pref_v1';
const LAST_VIEW_STATE_KEY = 'klaws_last_view_state_v1';
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
  {id:'link',label:'新增關聯',code:'KeyL',alt:true},{id:'export',label:'存檔管理',code:'KeyS',alt:true},
  {id:'shortcuts',label:'快捷鍵設定',code:'KeyK',alt:true},
  {id:'stats',label:'統計',code:'KeyI',alt:true}
];
const BUILTIN_FIELD_DEFS = {
  body:{key:'body',label:'摘要',kind:'textarea',placeholder:'條文或重點摘要...'},
  detail:{key:'detail',label:'詳細筆記',kind:'textarea',placeholder:'構成要件、學說、實務見解...'},
  todos:{key:'todos',label:'📝 待辦清單（每行一項，開頭 [x] 代表已完成）',kind:'textarea',placeholder:'[ ] 完成筆記整理\n[x] 複習例題第 3 題'}
};
const DEFAULT_TYPE_FIELD_KEYS = {diary:['body','todos']};
const DEFAULT_NORMAL_FIELD_KEYS = ['body','detail'];


const { safeStr, uniq, pad2, escapeHtml, hl, parseTodos, formatTodosForEdit, parseSearchDateVariants, formatDate, normalizeNoteSchema } = window.KLawsUtils;
const { readJSON, writeJSON } = window.KLawsStorage;
const { renderTodoHtml, sortedNotes } = window.KLawsRender;
const { MAP_NODE_RADIUS_MIN, MAP_NODE_RADIUS_MAX, MAP_NODE_RADIUS_DEFAULT, MAP_LIGHT_BUNDLING_STRENGTH, DEFAULT_LANE_NAMES, MIN_LANE_COUNT, MAX_LANE_COUNT, clampMapRadius, defaultLaneNameAt, normalizeLaneCount, splitMapTitleLines } = window.KLawsMap;
const { fmtDateKey, dueTimeText, relativeDateLabel } = window.KLawsCalendar;


// ==================== 全域變數 ====================
let notes=[], mapRelays=[], links=[], nid=10, lid=10, types=[], subjects=[], chapters=[], sections=[];
let recycleBin=[], unusedTagTracker={};
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
let mapLinkSourceId=null;
let touchRadialMenu=null, actionUndoTimer=null, lastCardTap={id:0,time:0};
let mapSubpages={}, mapPageStack=[];
let typeFieldConfigs={}, customFieldDefs={};
let undoSnapshotRaw='', lastSavedPayloadRaw='', isUndoApplying=false;
let calendarEvents=[], calendarSettings={emails:[]}, calendarCursor=new Date(), activeCalendarDate='';
let reminderTimer=null, reminderSent={};
let reminderDismissed={};
let editingCalendarEventId=null;
let focusTimerRemainingSec=1500, focusTimerInterval=null, focusTimerRunning=false;
let achievements={points:0,taskCompletions:0,unlocked:{},lastUsageMinuteReward:0}; // backward compatibility for legacy data
const XP_BOOST_MULTIPLIER = 2.5;
const BASE_XP_BY_DIFFICULTY = {E:12,N:22,H:36};
let levelSystem={skills:[],tasks:[],achievements:[],settings:{xpByDifficulty:{E:30,N:55,H:90},xpBoost150Applied:true}};
let levelTaskExpanded={}, levelEditorState={kind:'',idx:-1};
let linkModeActive=false, linkSourceId=null;
const LEVEL_STAGES=[
  {min:0,max:20,rank:'E'},{min:21,max:40,rank:'F'},{min:41,max:50,rank:'D'},
  {min:51,max:60,rank:'C'},{min:61,max:70,rank:'B'},{min:71,max:80,rank:'B+'},
  {min:81,max:85,rank:'A'},{min:86,max:90,rank:'A+'},{min:91,max:98,rank:'S'},
  {min:99,max:99,rank:'SS'},{min:100,max:100,rank:'SSS'}
];
const TITLE_LEVELS=[
  {level:1,min:0,name:'節點觀測員'},
  {level:2,min:120,name:'條文解析者'},
  {level:3,min:300,name:'脈絡梳理師'},
  {level:4,min:650,name:'邏輯鏈編織手'},
  {level:5,min:1100,name:'圖譜測繪員'},
  {level:6,min:1700,name:'法理結構家'},
  {level:7,min:2500,name:'維度跨越者'},
  {level:8,min:3500,name:'體系導航員'},
  {level:9,min:4800,name:'核心矩陣師'},
  {level:10,min:6200,name:'Klaws 終極奇點'}
];
const TASK_REPEAT_OPTIONS=[
  {key:'daily',label:'每日'},
  {key:'every3days',label:'每三日'},
  {key:'weekly',label:'每週'},
  {key:'monthly',label:'每月'},
  {key:'yearly',label:'每年'}
];

// ==================== 工具函數 ====================
const g = id => document.getElementById(id);
const on = (id, evt, fn) => { const el=g(id); if(el) el.addEventListener(evt,fn); return el; };
const val = id => { const el=g(id); return el?el.value:''; };
const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const showToast = m => { let t=g('toast'); t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',2200); };
function showActionToast(msg, undoFn=null){
  const wrap=g('actionToast'),txt=g('actionToastText'),undoBtn=g('actionToastUndoBtn');
  if(!wrap||!txt||!undoBtn){showToast(msg);return;}
  txt.textContent=msg;
  undoBtn.style.display=undoFn?'inline-flex':'none';
  undoBtn.onclick=()=>{
    if(typeof undoFn==='function') undoFn();
    wrap.classList.remove('open');
    clearTimeout(actionUndoTimer);
  };
  wrap.classList.add('open');
  clearTimeout(actionUndoTimer);
  actionUndoTimer=setTimeout(()=>wrap.classList.remove('open'),3200);
}
function loadFormTaxonomyPref(){
  try{
    const raw=JSON.parse(localStorage.getItem(FORM_TAXONOMY_PREF_KEY)||'{}');
    const subject=typeof raw.subject==='string'?raw.subject:'';
    const chapter=typeof raw.chapter==='string'?raw.chapter:'';
    const section=typeof raw.section==='string'?raw.section:'';
    return {subject,chapter,section};
  }catch(e){
    return {subject:'',chapter:'',section:''};
  }
}
function saveFormTaxonomyPref(subject='', chapter='', section=''){
  localStorage.setItem(FORM_TAXONOMY_PREF_KEY,JSON.stringify({
    subject:safeStr(subject),
    chapter:safeStr(chapter),
    section:safeStr(section)
  }));
}
function saveLastViewState(){
  const view=(currentView==='map'||currentView==='calendar'||currentView==='level')?currentView:'notes';
  const mapStack=(view==='map'&&Array.isArray(mapPageStack))?mapPageStack.filter(id=>mapNodeById(id)).slice(-12):[];
  localStorage.setItem(LAST_VIEW_STATE_KEY,JSON.stringify({view,mapPageStack:mapStack}));
}
function restoreLastViewState(){
  let state={view:'notes',mapPageStack:[]};
  try{
    const raw=JSON.parse(localStorage.getItem(LAST_VIEW_STATE_KEY)||'{}');
    if(['notes','map','calendar','level'].includes(raw.view)) state.view=raw.view;
    if(Array.isArray(raw.mapPageStack)) state.mapPageStack=raw.mapPageStack.map(v=>parseInt(v,10)).filter(id=>mapNodeById(id));
  }catch(e){}
  if(state.view==='map'){
    toggleMapView(true);
    if(state.mapPageStack.length){
      mapPageStack=state.mapPageStack.slice();
      updateMapPagePath();
      nodePos={};
      forceLayout();
      drawMap();
    }
    return;
  }
  if(state.view==='calendar'){
    toggleCalendarView(true);
    return;
  }
  if(state.view==='level'){
    toggleLevelSystemView(true);
    return;
  }
  toggleMapView(false);
}
function playFocusTimerAlarm(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx) return;
    const ctx=new Ctx();
    const now=ctx.currentTime;
    [0,0.18,0.36].forEach((offset,idx)=>{
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='sine';osc.frequency.value=idx%2===0?880:660;
      gain.gain.setValueAtTime(0.0001,now+offset);
      gain.gain.exponentialRampToValueAtTime(0.18,now+offset+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.15);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(now+offset);osc.stop(now+offset+0.16);
    });
    setTimeout(()=>ctx.close(),1200);
  }catch(e){}
}
function updateFocusTimerDisplay(){
  const m=Math.floor(focusTimerRemainingSec/60),s=focusTimerRemainingSec%60;
  const display=g('focusTimerDisplay');
  if(display) display.textContent=`${pad2(m)}:${pad2(s)}`;
}
function stopFocusTimer(){
  clearInterval(focusTimerInterval);
  focusTimerInterval=null;
  focusTimerRunning=false;
}
function resetFocusTimer(){
  stopFocusTimer();
  const min=Math.max(1,Math.min(180,parseInt(g('focusTimerMinutes')?.value,10)||25));
  focusTimerRemainingSec=min*60;
  updateFocusTimerDisplay();
}
function startFocusTimer(){
  if(focusTimerRunning) return;
  if(focusTimerRemainingSec<=0) resetFocusTimer();
  focusTimerRunning=true;
  focusTimerInterval=setInterval(()=>{
    focusTimerRemainingSec--;
    updateFocusTimerDisplay();
    if(focusTimerRemainingSec<=0){
      stopFocusTimer();
      const alertBox=g('focusTimerAlert');
      if(alertBox) alertBox.classList.add('open');
      playFocusTimerAlarm();
      showToast('⏰ 計時結束');
    }
  },1000);
}
function openFocusTimer(){
  resetFocusTimer();
  g('focusTimerModal')?.classList.add('open');
}
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
const typeByKey = k => k?(types.find(t=>t.key===k)||{key:k,label:k,color:'#888'}):{key:'',label:'無',color:'#888'};
const subByKey = k => k?(subjects.find(s=>s.key===k)||{key:k,label:k,color:'#888'}):{key:'',label:'無',color:'#888'};
const chapterByKey = k => k?(chapters.find(c=>c.key===k)||{key:k,label:k,subject:'all'}):{key:'',label:'無',subject:'all'};
const sectionByKey = k => k?(sections.find(s=>s.key===k)||{key:k,label:k,chapter:'all'}):{key:'',label:'無',chapter:'all'};
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
const mapHasTaxonomyFilter = () => mapFilter.sub!=='all'||mapFilter.chapter!=='all'||mapFilter.section!=='all';
const intersects = (arr1,arr2) => arr1.some(x=>arr2.includes(x));
const TAG_COLLECTIONS = {type:()=>types, sub:()=>subjects, subject:()=>subjects, chapter:()=>chapters, section:()=>sections};
const tagCollection = kind => (TAG_COLLECTIONS[kind]||(()=>[]))();
const tagUsageCount = (kind,key) => {
  if(kind==='type') return notes.filter(n=>n.type===key).length;
  if(kind==='sub') return notes.filter(n=>noteSubjects(n).includes(key)).length;
  if(kind==='section') return notes.filter(n=>noteSections(n).includes(key)).length;
  return notes.filter(n=>noteChapters(n).includes(key)).length;
};
const noteById = id => notes.find(n=>n.id===id);
const relayById = id => mapRelays.find(n=>n.id===id);
const mapNodeById = id => noteById(id)||relayById(id);
const isRelayNode = n => !!(n&&n.isRelay);
const noteTags = _n => [];
const noteHasVisibleContent = n => !!(safeStr(n.body).trim()||safeStr(n.detail).trim()||noteTags(n).length||(Array.isArray(n.todos)&&n.todos.length));
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
  return noteExtraFields(n)[key]||'';
};
const mapCardFieldText = (n,key) => {
  if(key==='todos'){
    const list=(Array.isArray(n&&n.todos)?n.todos:[]).filter(t=>t&&safeStr(t.text).trim());
    return list.map(t=>`${t.done?'✅':'⬜'} ${safeStr(t.text).trim()}`).join('\n');
  }
  return safeStr(renderFieldValue(n,key)).trim();
};
const renderMapCardPreview = n => {
  const keys=getTypeFieldKeys(n.type).filter(key=>key!=='tags');
  const sections=keys.map(key=>mapCardFieldText(n,key)).filter(text=>!!text);
  if(!sections.length) return '';
  return sections.map(text=>`<div class="map-card-body-segment"><div class="map-card-body-text">${escapeHtml(text)}</div></div>`).join('');
};
const noteFieldValueForEdit = (n,key) => {
  if(key==='body') return n.body||'';
  if(key==='detail') return n.detail||'';
  if(key==='todos') return formatTodosForEdit(n.todos);
  return noteExtraFields(n)[key]||'';
};
const hexRgb = hex => { if(hex.length===4) hex='#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; };
const lightC = hex => `rgba(${hexRgb(hex).join(',')},0.12)`;
const darkC = hex => { let r=hexRgb(hex); return `rgb(${Math.round(r[0]*.55)},${Math.round(r[1]*.55)},${Math.round(r[2]*.55)})`; };
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
const getMapCenterContextKey = () => {
  const pageRoot=mapPageStack.length?mapPageStack[mapPageStack.length-1]:'root';
  return `${mapFilter.sub||'all'}::${mapFilter.chapter||'all'}::${mapFilter.section||'all'}::${pageRoot}`;
};
const getMapCollapseContextKey = () => {
  const pageRoot=mapPageStack.length?mapPageStack[mapPageStack.length-1]:'root';
  return `${mapFilter.sub||'all'}::${mapFilter.chapter||'all'}::${mapFilter.section||'all'}::${pageRoot}`;
};
const mapCollapseKey = noteId => `${getMapCollapseContextKey()}::${noteId}`;
const getCollapsedNodesForCurrentContext = () => {
  const keyPrefix=`${getMapCollapseContextKey()}::`, collapsed={};
  Object.keys(mapCollapsed||{}).forEach(key=>{
    if(!mapCollapsed[key]||typeof key!=='string'||!key.startsWith(keyPrefix)) return;
    const id=parseInt(key.slice(keyPrefix.length),10);
    if(Number.isFinite(id)) collapsed[id]=true;
  });
  return collapsed;
};
const isMapNodeCollapsed = noteId => !!mapCollapsed[mapCollapseKey(noteId)];
const mapSubpageContextKey = () => 'global';
const mapSubpageKey = noteId => `${mapSubpageContextKey()}::${noteId}`;
const findSubpageKeyByNoteId = noteId => {
  const exactKey=mapSubpageKey(noteId);
  if(mapSubpages[exactKey]) return exactKey;
  const suffix=`::${noteId}`;
  return Object.keys(mapSubpages||{}).find(key=>key.endsWith(suffix))||null;
};
const hasSubpageForNode = noteId => !!findSubpageKeyByNoteId(noteId);
const removeSubpageForNode = noteId => {
  const key=findSubpageKeyByNoteId(noteId);
  if(!key) return false;
  delete mapSubpages[key];
  return true;
};
const normalizeMapSubpages = raw => {
  const src=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{}, next={};
  Object.keys(src).forEach(key=>{
    const noteId=parseInt(String(key).split('::').pop(),10);
    if(!Number.isFinite(noteId)) return;
    const item=(src[key]&&typeof src[key]==='object'&&!Array.isArray(src[key]))?src[key]:{};
    const normalizedKey=mapSubpageKey(noteId);
    if(next[normalizedKey]) return;
    next[normalizedKey]={...item,rootId:noteId,createdAt:item.createdAt||new Date().toISOString()};
  });
  return next;
};
const normalizeMapCollapsed = raw => {
  const src=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{}, next={};
  const legacyPrefix='all::all::all::root::';
  Object.keys(src).forEach(key=>{
    if(!src[key]) return;
    let normalizedKey=String(key);
    if(/^\d+$/.test(normalizedKey)) normalizedKey=`${legacyPrefix}${normalizedKey}`;
    const noteId=parseInt(normalizedKey.split('::').pop(),10);
    if(!Number.isFinite(noteId)) return;
    if(!normalizedKey.includes('::')) return;
    next[normalizedKey]=true;
  });
  return next;
};
const currentSubpageRootId = () => mapPageStack.length?mapPageStack[mapPageStack.length-1]:null;
const isInMapSubpage = () => !!currentSubpageRootId();
const isNodeInCurrentSubpage = noteId => {
  if(!isInMapSubpage()) return true;
  const currentRoot=currentSubpageRootId();
  if(!currentRoot) return false;
  return getDescendantIds(currentRoot).has(noteId);
};
const mapTitleMarkers = noteId => {
  const marks=[];
  if(getMapCenterFromScopes()===noteId) marks.push('⭐️');
  if(hasSubpageForNode(noteId)) marks.push('△');
  return marks.join('');
};
const getMapCenterFromScopes = () => {
  const key=getMapCenterContextKey();
  const scopedId=mapCenterNodeIds[key];
  if(scopedId&&mapNodeById(scopedId)) return scopedId;
  return (mapCenterNodeId&&mapNodeById(mapCenterNodeId))?mapCenterNodeId:null;
};
const setMapCenterForCurrentScope = id => {
  if(!Number.isFinite(id)) return;
  mapCenterNodeIds[getMapCenterContextKey()]=id;
  mapCenterNodeId=id;
};
const getPayload = () => ({notes,mapRelays,links,nid,lid,types,subjects,chapters,sections,nodePos,nodeSizes,sortMode,mapCenterNodeId,mapCenterNodeIds,mapFilter,mapLinkedOnly,mapDepth,mapFocusMode,mapLaneConfigs,mapCollapsed,mapSubpages,typeFieldConfigs,customFieldDefs,calendarEvents,calendarSettings,achievements,levelSystem,panelDir:getPanelDir(),updatedAt:new Date().toISOString()});
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
const laneContextKey = () => `${mapFilter.sub||'all'}::${mapFilter.section||'all'}`;
const getLaneConfig = () => {
  const key=laneContextKey();
const raw=mapLaneConfigs[key]||{};
  const count=normalizeLaneCount(raw.count||((Array.isArray(raw.names)&&raw.names.length)||DEFAULT_LANE_NAMES.length));
  const names=Array.from({length:count},(_,idx)=>((raw.names&&raw.names[idx])||'').trim()||defaultLaneNameAt(idx));
  mapLaneConfigs[key]={count,names};
  return {key,count,names};
};
const estimateMapTextLines = (text, charsPerLine) => {
  const rows=safeStr(text).split('\n');
  return rows.reduce((sum,row)=>sum+Math.max(1,Math.ceil((row.length||1)/charsPerLine)),0);
};
const getMapCardBox = id => {
  const scale=Math.max(0.7,Math.min(2.3,getNodeRadius(id)/MAP_NODE_RADIUS_DEFAULT));
  const width=Math.round(250*scale);
  const note=mapNodeById(id)||{};
  const keys=getTypeFieldKeys(note.type).filter(key=>key!=='tags');
  const previewTexts=keys.map(key=>mapCardFieldText(note,key)).filter(text=>!!text);
  if(!previewTexts.length) return {width,height:86,bodyLines:0};
  const charsPerLine=Math.max(9,Math.floor((width-24)/10));
  const bodyLines=previewTexts.reduce((sum,text)=>sum+estimateMapTextLines(text,charsPerLine),0);
  const segmentExtra=Math.max(0,previewTexts.length-1)*9;
  const height=86+bodyLines*18+segmentExtra;
  return {width,height,bodyLines};
};
const ensureUsageStart = () => {
  const raw=localStorage.getItem(USAGE_START_KEY);
  if(raw&&Number.isFinite(Date.parse(raw))) return raw;
  const now=new Date().toISOString();
  localStorage.setItem(USAGE_START_KEY,now);
  return now;
};
const formatUsageDuration = (startRaw,endRaw=new Date()) => {
  const start=new Date(startRaw),end=new Date(endRaw);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start) return '0分鐘';
  const mins=Math.floor((end-start)/60000);
  if(mins<60) return `${mins}分鐘`;
  const years=end.getFullYear()-start.getFullYear();
  const months=end.getMonth()-start.getMonth();
  const days=end.getDate()-start.getDate();
  const hours=end.getHours()-start.getHours();
  const minutes=end.getMinutes()-start.getMinutes();
  let y=years,m=months,d=days,h=hours,min=minutes;
  if(min<0){min+=60;h--;}
  if(h<0){h+=24;d--;}
  if(d<0){
    const prevMonthEnd=new Date(end.getFullYear(),end.getMonth(),0).getDate();
    d+=prevMonthEnd;m--;
  }
  if(m<0){m+=12;y--;}
  const parts=[];
  if(y>0) parts.push(`${y}年`);
  if(m>0) parts.push(`${m}月`);
  if(d>0) parts.push(`${d}天`);
  if(!parts.length&&h>0) parts.push(`${h}小時`);
  if(!parts.length&&min>=0) parts.push(`${min}分鐘`);
  return parts.join('');
};

const usageMinutesSinceStart = () => Math.max(0,Math.floor((new Date()-new Date(ensureUsageStart()))/60000));
const doneTodoCount = todos => (Array.isArray(todos)?todos:[]).filter(t=>t&&t.done&&safeStr(t.text).trim()).length;
function getCurrentTitle(){
  const pts=Math.max(0,Number(getLevelAchievementPoints())||0);
  return TITLE_LEVELS.reduce((pick,lvl)=>pts>=lvl.min?lvl:pick,TITLE_LEVELS[0]);
}
function applyBrandTitle(){
  const el=g('brandTitleBadge');
  if(!el) return;
  const lvl=getCurrentTitle();
  el.textContent=`LV${lvl.level}・${lvl.name}`;
}
function normalizeAchievements(){
  const base=(achievements&&typeof achievements==='object')?achievements:{};
  achievements={
    points:Math.max(0,parseInt(base.points,10)||0),
    taskCompletions:Math.max(0,parseInt(base.taskCompletions,10)||0),
    unlocked:(base.unlocked&&typeof base.unlocked==='object'&&!Array.isArray(base.unlocked))?base.unlocked:{},
    lastUsageMinuteReward:Math.max(0,parseInt(base.lastUsageMinuteReward,10)||0)
  };
}
const difficultyRank=d=>({E:1,N:2,H:3}[d]||1);
const skillXpRequired=level=>Math.round(28+Math.max(1,level)*10);
const getSkillStage=(lvl=0)=>LEVEL_STAGES.find(s=>lvl>=s.min&&lvl<=s.max)?.rank||'E';
const getLevelAchievementPoints=()=>((levelSystem.achievements||[]).filter(a=>a.unlocked).reduce((sum,a)=>sum+(Number(a.points)||0),0));
function normalizeLevelSystem(){
  const base=(levelSystem&&typeof levelSystem==='object')?levelSystem:{};
  const settings=(base.settings&&typeof base.settings==='object')?base.settings:{};
  const rawXp=settings.xpByDifficulty||{};
  const wasBoostApplied=!!settings.xpBoost150Applied;
  const normalizeXp=key=>{
    const baseXp=Math.max(1,parseInt(rawXp[key],10)||BASE_XP_BY_DIFFICULTY[key]);
    return wasBoostApplied?baseXp:Math.max(1,Math.round(baseXp*XP_BOOST_MULTIPLIER));
  };
  levelSystem={
    skills:Array.isArray(base.skills)?base.skills:[],
    tasks:Array.isArray(base.tasks)?base.tasks:[],
    achievements:Array.isArray(base.achievements)?base.achievements:[],
    settings:{
      xpByDifficulty:{
        E:normalizeXp('E'),
        N:normalizeXp('N'),
        H:normalizeXp('H')
      },
      xpBoost150Applied:true
    }
  };
  levelSystem.skills=levelSystem.skills.map(s=>({id:s.id||Date.now()+Math.random(),name:safeStr(s.name||'未命名技能'),level:Math.max(0,Math.min(100,parseInt(s.level,10)||1)),xp:Math.max(0,parseInt(s.xp,10)||0),lastDoneByDiff:(s.lastDoneByDiff&&typeof s.lastDoneByDiff==='object')?s.lastDoneByDiff:{},lastDecayAt:s.lastDecayAt||new Date().toISOString()}));
  levelSystem.tasks=levelSystem.tasks.map(t=>({
    id:t.id||Date.now()+Math.random(),
    name:safeStr(t.name||'未命名任務'),
    difficulty:['E','N','H'].includes(t.difficulty)?t.difficulty:'N',
    repeatCycle:TASK_REPEAT_OPTIONS.some(opt=>opt.key===t.repeatCycle)?t.repeatCycle:'daily',
    completions:Math.max(0,parseInt(t.completions,10)||0),
    lastCompletedAt:t.lastCompletedAt||'',
    lastReward:(t.lastReward&&typeof t.lastReward==='object')?t.lastReward:null,
    subtasks:Array.isArray(t.subtasks)?t.subtasks.map(sub=>({
      id:sub.id||Date.now()+Math.random(),
      text:safeStr(sub.text||'').trim(),
      difficulty:['E','N','H'].includes(sub.difficulty)?sub.difficulty:(['E','N','H'].includes(t.difficulty)?t.difficulty:'N'),
      completions:Math.max(0,parseInt(sub.completions,10)||0),
      lastCompletedAt:sub.lastCompletedAt||'',
      lastReward:(sub.lastReward&&typeof sub.lastReward==='object')?sub.lastReward:null
    })).filter(sub=>sub.text):[]
  }));
  levelSystem.achievements=levelSystem.achievements.map(a=>({id:a.id||Date.now()+Math.random(),name:safeStr(a.name||'未命名成就'),target:Math.max(1,parseInt(a.target,10)||1),condition:safeStr(a.condition||'累積完成任務次數'),difficulty:['E','N','H'].includes(a.difficulty)?a.difficulty:'N',points:Math.max(0,parseInt(a.points,10)||0),progress:Math.max(0,parseInt(a.progress,10)||0),unlocked:!!a.unlocked}));
}
function migrateLegacyAchievements(){
  if(levelSystem.achievements.length) return;
  normalizeAchievements();
  const legacyDefs=[
    {name:'任務啟程',target:1,condition:'累積完成任務次數',difficulty:'N',points:10,progress:achievements.taskCompletions},
    {name:'十連達成',target:10,condition:'累積完成任務次數',difficulty:'N',points:30,progress:achievements.taskCompletions},
    {name:'專注一小時',target:60,condition:'累積使用分鐘',difficulty:'N',points:20,progress:usageMinutesSinceStart()}
  ];
  levelSystem.achievements=legacyDefs.map((d,i)=>({id:`legacy_${i}`,...d,unlocked:d.progress>=d.target}));
}
function refreshAchievementProgress(){
  normalizeLevelSystem();
  const usageMins=usageMinutesSinceStart();
  const completionByDifficulty={E:0,N:0,H:0};
  (levelSystem.tasks||[]).forEach(task=>{
    const cnt=Number(task.completions)||0;
    if(difficultyRank(task.difficulty)>=difficultyRank('E')) completionByDifficulty.E+=cnt;
    if(difficultyRank(task.difficulty)>=difficultyRank('N')) completionByDifficulty.N+=cnt;
    if(difficultyRank(task.difficulty)>=difficultyRank('H')) completionByDifficulty.H+=cnt;
  });
  levelSystem.achievements.forEach(def=>{
    const value=def.condition.includes('分鐘')?usageMins:completionByDifficulty[def.difficulty||'N'];
    def.progress=Math.max(def.progress||0,value);
    if(!def.unlocked&&def.progress>=def.target) def.unlocked=true;
  });
}
const getTaskRepeatLabel=cycle=>TASK_REPEAT_OPTIONS.find(opt=>opt.key===cycle)?.label||'每日';
const getSubtaskXpGain = difficulty => Math.max(1,levelSystem.settings.xpByDifficulty[difficulty]||Math.round(BASE_XP_BY_DIFFICULTY[difficulty||'N']*XP_BOOST_MULTIPLIER));
function snapshotSkill(skill){
  return {level:skill.level||1,xp:skill.xp||0,lastDoneByDiff:{...(skill.lastDoneByDiff||{})},lastDecayAt:skill.lastDecayAt||''};
}
function restoreSkill(skill,state){
  if(!skill||!state) return;
  skill.level=Math.max(0,Math.min(100,parseInt(state.level,10)||1));
  skill.xp=Math.max(0,parseInt(state.xp,10)||0);
  skill.lastDoneByDiff=(state.lastDoneByDiff&&typeof state.lastDoneByDiff==='object')?{...state.lastDoneByDiff}:{};
  skill.lastDecayAt=state.lastDecayAt||skill.lastDecayAt||new Date().toISOString();
}
function getTaskCycleKey(task,date=new Date()){
  const dt=new Date(date);
  if(!Number.isFinite(dt.getTime())) return '';
  if(task.repeatCycle==='every3days') return `3d-${Math.floor(dt.getTime()/86400000/3)}`;
  if(task.repeatCycle==='weekly'){
    const copy=new Date(dt);
    const day=(copy.getDay()+6)%7;
    copy.setDate(copy.getDate()-day);
    return `w-${copy.getFullYear()}-${pad2(copy.getMonth()+1)}-${pad2(copy.getDate())}`;
  }
  if(task.repeatCycle==='monthly') return `m-${dt.getFullYear()}-${pad2(dt.getMonth()+1)}`;
  if(task.repeatCycle==='yearly') return `y-${dt.getFullYear()}`;
  return `d-${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
}
function isTaskCompletedInCurrentCycle(task){
  const last=Date.parse(task.lastCompletedAt||'');
  if(!Number.isFinite(last)) return false;
  return getTaskCycleKey(task,new Date(last))===getTaskCycleKey(task,new Date());
}
function isSubtaskCompletedInCurrentCycle(task,subtask){
  const last=Date.parse(subtask.lastCompletedAt||'');
  if(!Number.isFinite(last)) return false;
  return getTaskCycleKey(task,new Date(last))===getTaskCycleKey(task,new Date());
}
function getSkillDecayRule(skillLevel){
  const stage=getSkillStage(skillLevel);
  if(stage==='E'||stage==='F') return {days:1,levels:1,difficulty:'E'};
  if(stage==='D') return {days:1,levels:1,difficulty:'N'};
  if(stage==='C') return {days:3,levels:3,difficulty:'N'};
  if(stage==='B'||stage==='B+') return {days:7,levels:5,difficulty:'H'};
  if(stage==='A'||stage==='A+') return {days:30,levels:10,difficulty:'H'};
  return {days:365,levels:20,difficulty:'H'};
}
function getSkillDecayStatus(skill){
  const rule=getSkillDecayRule(skill.level);
  const lastBy=skill.lastDoneByDiff||{};
  const candidates=['E','N','H'].filter(d=>difficultyRank(d)>=difficultyRank(rule.difficulty)).map(d=>Date.parse(lastBy[d]||0)).filter(Number.isFinite);
  if(!candidates.length) return {...rule,daysLeft:rule.days,lastActiveAt:null};
  const lastActive=Math.max(...candidates);
  const elapsedDays=Math.floor((Date.now()-lastActive)/86400000);
  return {...rule,daysLeft:Math.max(0,rule.days-elapsedDays),lastActiveAt:lastActive};
}
function applySkillDecay(){
  const now=Date.now();
  levelSystem.skills.forEach(skill=>{
    const rule=getSkillDecayRule(skill.level);
    const needMs=rule.days*86400000;
    const lastBy=skill.lastDoneByDiff||{};
    const candidates=['E','N','H'].filter(difficulty=>difficultyRank(difficulty)>=difficultyRank(rule.difficulty)).map(difficulty=>Date.parse(lastBy[difficulty]||0)).filter(Number.isFinite);
    const lastActive=candidates.length?Math.max(...candidates):0;
    if(!lastActive) return;
    const elapsed=now-lastActive;
    const passed=Math.floor(elapsed/needMs);
    if(passed<=0) return;
    const lastDecayAt=Date.parse(skill.lastDecayAt||0);
    if(Number.isFinite(lastDecayAt)&&now-lastDecayAt<needMs) return;
    skill.level=Math.max(0,skill.level-passed*rule.levels);
    skill.xp=0;
    skill.lastDecayAt=new Date(now).toISOString();
  });
}
function gainSkillXp(skill,difficulty,gain){
  const nowIso=new Date().toISOString();
  skill.xp=(skill.xp||0)+Math.max(1,parseInt(gain,10)||0);
  skill.lastDoneByDiff=skill.lastDoneByDiff||{};
  skill.lastDoneByDiff[difficulty]=nowIso;
  while(skill.level<100){
    const need=skillXpRequired(skill.level);
    if(skill.xp<need) break;
    skill.xp-=need;
    skill.level++;
  }
  if(skill.level>=100){skill.level=100;skill.xp=0;}
}
function completeLevelTask(taskId,skillId,gainOverride=0){
  const task=levelSystem.tasks.find(t=>String(t.id)===String(taskId));
  const skill=levelSystem.skills.find(s=>String(s.id)===String(skillId));
  if(!task||!skill) return false;
  const nowIso=new Date().toISOString();
  task.completions=(task.completions||0)+1;
  task.lastCompletedAt=nowIso;
  const gain=gainOverride>0?gainOverride:(levelSystem.settings.xpByDifficulty[task.difficulty]||Math.round(BASE_XP_BY_DIFFICULTY[task.difficulty||'N']*XP_BOOST_MULTIPLIER));
  task.lastReward={cycleKey:getTaskCycleKey(task,new Date()),skillId:String(skill.id),skillPrev:snapshotSkill(skill),gain};
  gainSkillXp(skill,task.difficulty,gain);
  refreshAchievementProgress();
  applyBrandTitle();
  return true;
}
function rollbackTaskCompletion(task,skill){
  if(!task||!skill||!task.lastReward) return false;
  restoreSkill(skill,task.lastReward.skillPrev);
  task.completions=Math.max(0,(task.completions||0)-1);
  task.lastCompletedAt='';
  task.lastReward=null;
  refreshAchievementProgress();
  applyBrandTitle();
  return true;
}

function normalizeNoteIds(forceReindexAll=false) {
  const seen={}, duplicates=new Set();
  [...notes,...mapRelays].forEach(n=>{
    if(!Number.isFinite(n.id) || seen[n.id]) duplicates.add(n.id);
    seen[n.id]=true;
  });
  if(!forceReindexAll && !duplicates.size) {
    nid=Math.max(nid||1,[...notes,...mapRelays].reduce((m,n)=>Math.max(m,n.id||0),0)+1);
    lid=Math.max(lid||1,links.reduce((m,l)=>Math.max(m,l.id||0),0)+1);
    return false;
  }
  const fromBuckets={}, toBuckets={}, firstMap={}, remapPos={}, remapSize={}, remapSelected={};
  let nextId=1;
  const assignNodeId = n => {
    const oldId=n.id, newId=nextId++;
    n.id=newId;
    if(!fromBuckets[oldId]) fromBuckets[oldId]=[];
    if(!toBuckets[oldId]) toBuckets[oldId]=[];
    fromBuckets[oldId].push(newId);
    toBuckets[oldId].push(newId);
    if(firstMap[oldId]===undefined) firstMap[oldId]=newId;
  };
  notes.forEach(assignNodeId);
  mapRelays.forEach(assignNodeId);
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
  const remappedCollapsed={};
  Object.keys(mapCollapsed||{}).forEach(key=>{
    if(!mapCollapsed[key]) return;
    const parts=String(key).split('::');
    const oldId=parseInt(parts.pop(),10);
    const newId=firstMap[oldId];
    if(newId===undefined) return;
    remappedCollapsed[`${parts.join('::')}::${newId}`]=true;
  });
  mapCollapsed=remappedCollapsed;
  const remappedSubpages={};
  Object.keys(mapSubpages||{}).forEach(key=>{
    const item=(mapSubpages[key]&&typeof mapSubpages[key]==='object'&&!Array.isArray(mapSubpages[key]))?mapSubpages[key]:{};
    const oldId=parseInt(String(key).split('::').pop(),10);
    const newId=firstMap[oldId];
    if(newId===undefined||!mapNodeById(newId)) return;
    remappedSubpages[mapSubpageKey(newId)]={...item,rootId:newId,createdAt:item.createdAt||new Date().toISOString()};
  });
  mapSubpages=remappedSubpages;
  mapPageStack=(Array.isArray(mapPageStack)?mapPageStack:[]).map(id=>firstMap[id]).filter(id=>Number.isFinite(id)&&mapNodeById(id));
  mapFocusedNodeId=firstMap[mapFocusedNodeId]??null;
  openId=firstMap[openId]??null;
  nid=nextId;
  lid=Math.max(lid||1,links.reduce((m,l)=>Math.max(m,l.id||0),0)+1);
  return true;
}

// ==================== 資料儲存 ====================
function loadData() {
  try {
    const d=readJSON(SKEY,null);
    if(d) {
      notes=(Array.isArray(d.notes)?d.notes:DEFAULTS.notes.slice()).map(normalizeNoteSchema);
      mapRelays=(Array.isArray(d.mapRelays)?d.mapRelays:[]).map(r=>{
        const base=normalizeNoteSchema({...r,id:Number(r.id)});
        return {
          ...base,
          title:base.title||'未命名中繼站',
          isRelay:true,
          type:'relay',
          noteTypeBackup:safeStr(r.noteTypeBackup)||safeStr(r.type)||'article'
        };
      }).filter(r=>Number.isFinite(r.id));
      links=Array.isArray(d.links)?d.links:DEFAULTS.links.slice();
      links.forEach(l=>{l.rel='關聯';l.color=LINK_COLOR;});
      nid=Number.isFinite(d.nid)?d.nid:Math.max(10,[...notes,...mapRelays].reduce((m,n)=>Math.max(m,n.id||0),0)+1);
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
      const rawMapCollapsed=(d.mapCollapsed&&typeof d.mapCollapsed==='object'&&!Array.isArray(d.mapCollapsed))?d.mapCollapsed:{};
      mapCollapsed=normalizeMapCollapsed(rawMapCollapsed);
      const rawMapSubpages=(d.mapSubpages&&typeof d.mapSubpages==='object'&&!Array.isArray(d.mapSubpages))?d.mapSubpages:{};
      mapSubpages=normalizeMapSubpages(rawMapSubpages);
      customFieldDefs=(d.customFieldDefs&&typeof d.customFieldDefs==='object'&&!Array.isArray(d.customFieldDefs))?d.customFieldDefs:{};
      calendarEvents=Array.isArray(d.calendarEvents)?d.calendarEvents:[];
      calendarSettings=(d.calendarSettings&&typeof d.calendarSettings==='object'&&!Array.isArray(d.calendarSettings))?d.calendarSettings:{emails:[]};
      if(!Array.isArray(calendarSettings.emails)) calendarSettings.emails=[];
      if(typeof calendarSettings.smtpToken!=='string') calendarSettings.smtpToken='';
      if(typeof calendarSettings.emailFrom!=='string') calendarSettings.emailFrom='';
      achievements=(d.achievements&&typeof d.achievements==='object'&&!Array.isArray(d.achievements))?d.achievements:{points:0,taskCompletions:0,unlocked:{},lastUsageMinuteReward:0};
      levelSystem=(d.levelSystem&&typeof d.levelSystem==='object'&&!Array.isArray(d.levelSystem))?d.levelSystem:{skills:[],tasks:[],achievements:[],settings:{xpByDifficulty:{E:30,N:55,H:90},xpBoost150Applied:true}};
      normalizeLevelSystem();
      migrateLegacyAchievements();
      applySkillDecay();
      normalizeAchievements();
      calendarEvents=calendarEvents.map(ev=>({ ...ev, dueHour:Math.min(23,Math.max(0,parseInt(ev.dueHour,10)||9)), dueMinute:Math.min(59,Math.max(0,parseInt(ev.dueMinute,10)||0)) }));
      Object.keys(customFieldDefs).forEach(key=>{
        const item=customFieldDefs[key]||{};
        customFieldDefs[key]={key,label:item.label||key,kind:item.kind==='text'?'text':'textarea',placeholder:item.placeholder||''};
      });
      typeFieldConfigs=(d.typeFieldConfigs&&typeof d.typeFieldConfigs==='object'&&!Array.isArray(d.typeFieldConfigs))?d.typeFieldConfigs:{};
      types.forEach(t=>{ typeFieldConfigs[t.key]=getTypeFieldKeys(t.key); });
      let repaired=false,chapterMigrated=false;
      if(JSON.stringify(rawMapCollapsed)!==JSON.stringify(mapCollapsed)) repaired=true;
      if(JSON.stringify(rawMapSubpages)!==JSON.stringify(mapSubpages)) repaired=true;
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
      normalizeNotesTaxonomy();
      if(normalizeNoteIds(true)) repaired=true;
      if(repaired||chapterMigrated) saveData();
      mapPageStack=[];
      applyPanelDir(d.panelDir||getPanelDir());
      lastSavedPayloadRaw=JSON.stringify(getPayload());
    } else {
      notes=DEFAULTS.notes.slice();mapRelays=[];links=DEFAULTS.links.slice();types=DEFAULTS.types.slice();subjects=DEFAULTS.subjects.slice();chapters=DEFAULTS.chapters.slice();sections=DEFAULTS.sections.slice();nodeSizes={};typeFieldConfigs={};customFieldDefs={};calendarEvents=[];calendarSettings={emails:[]};achievements={points:0,taskCompletions:0,unlocked:{},lastUsageMinuteReward:0};levelSystem={skills:[],tasks:[],achievements:[],settings:{xpByDifficulty:{E:30,N:55,H:90},xpBoost150Applied:true}};types.forEach(t=>{typeFieldConfigs[t.key]=getTypeFieldKeys(t.key);});applyPanelDir(getPanelDir());saveData();
    }
  } catch(e) {
    notes=DEFAULTS.notes.slice();mapRelays=[];links=DEFAULTS.links.slice();types=DEFAULTS.types.slice();subjects=DEFAULTS.subjects.slice();chapters=DEFAULTS.chapters.slice();sections=DEFAULTS.sections.slice();nodeSizes={};typeFieldConfigs={};customFieldDefs={};calendarEvents=[];calendarSettings={emails:[]};achievements={points:0,taskCompletions:0,unlocked:{},lastUsageMinuteReward:0};levelSystem={skills:[],tasks:[],achievements:[],settings:{xpByDifficulty:{E:30,N:55,H:90},xpBoost150Applied:true}};types.forEach(t=>{typeFieldConfigs[t.key]=getTypeFieldKeys(t.key);});applyPanelDir(getPanelDir());
  }
}
function saveData() {
  try {
    const nextRaw=JSON.stringify(getPayload());
    if(!isUndoApplying&&lastSavedPayloadRaw&&lastSavedPayloadRaw!==nextRaw) undoSnapshotRaw=lastSavedPayloadRaw;
    localStorage.setItem(SKEY,nextRaw);
    lastSavedPayloadRaw=nextRaw;
    autoPushIfEnabled();
  } catch(e){}
}
function applySnapshotRaw(raw){
  if(!raw) return false;
  try{
    isUndoApplying=true;
    localStorage.setItem(SKEY,raw);
    loadData();
    rebuildUI();
    render();
    if(isMapOpen){buildMapFilters();forceLayout();drawMap();}
    return true;
  }catch(e){
    return false;
  }finally{
    isUndoApplying=false;
  }
}
function undoLastAction(){
  if(!undoSnapshotRaw){showToast('目前沒有可恢復的上一步');return;}
  const currentRaw=lastSavedPayloadRaw||localStorage.getItem(SKEY)||'';
  if(applySnapshotRaw(undoSnapshotRaw)){
    undoSnapshotRaw=currentRaw;
    showToast('已恢復上一步');
  }else showToast('恢復失敗');
}
function loadArchives(){
  const raw=readJSON(ARCHIVES_KEY,[]);
  if(Array.isArray(raw)) return raw;
  if(raw&&typeof raw==='object'&&raw.payload){
    return [{...raw,id:raw.id||Date.now(),name:raw.name||'舊版存檔',createdAt:raw.createdAt||new Date().toISOString()}];
  }
  return [];
}

function saveArchives(arr){
  const next=Array.isArray(arr)?arr:[];
  writeJSON(ARCHIVES_KEY,next.slice(0,ARCHIVE_SNAPSHOT_LIMIT));
}
function loadRecycleBin(){
  const arr=readJSON(RECYCLE_BIN_KEY,[]);
  recycleBin=Array.isArray(arr)?arr:[];
}
function saveRecycleBin(){
  writeJSON(RECYCLE_BIN_KEY,recycleBin);
}
function purgeRecycleBin(){
  const now=Date.now();
  const before=recycleBin.length;
  recycleBin=recycleBin.filter(item=>now-Date.parse(item.deletedAt||0)<RECYCLE_RETENTION_MS);
  if(before!==recycleBin.length) saveRecycleBin();
}
function normalizeNotesTaxonomy(){
  const tSet=new Set(types.map(t=>t.key));
  const sSet=new Set(subjects.map(s=>s.key));
  const cSet=new Set(chapters.map(c=>c.key));
  const secSet=new Set(sections.map(s=>s.key));
  notes.forEach(n=>{
    if(!tSet.has(n.type)) n.type='';
    n.subjects=noteSubjects(n).filter(k=>sSet.has(k));
    n.subject=n.subjects[0]||'';
    n.chapters=noteChapters(n).filter(k=>cSet.has(k));
    n.chapter=n.chapters[0]||'';
    n.sections=noteSections(n).filter(k=>secSet.has(k));
    n.section=n.sections[0]||'';
  });
}
function createArchiveSnapshot(){
  const archives=loadArchives();
  const name=(prompt('請輸入存檔名稱：',`存檔 ${new Date().toLocaleString('zh-TW')}`)||'').trim();
  if(!name){showToast('存檔名稱不可空白');return;}
  archives.unshift({id:Date.now()+Math.floor(Math.random()*1000),name,createdAt:new Date().toISOString(),payload:getPayload()});
  saveArchives(archives);
  renderArchivePanel();
  showToast('已儲存存檔');
}
function removeNotesToRecycle(noteIds){
  const idSet=new Set((noteIds||[]).map(Number).filter(Number.isFinite));
  if(!idSet.size) return 0;
  const removedNotes=notes.filter(n=>idSet.has(n.id));
  if(!removedNotes.length) return 0;
  const removedLinks=links.filter(l=>idSet.has(l.from)||idSet.has(l.to));
  recycleBin.unshift({id:Date.now()+Math.floor(Math.random()*1000),deletedAt:new Date().toISOString(),notes:removedNotes,links:removedLinks});
  recycleBin=recycleBin.slice(0,200);
  notes=notes.filter(n=>!idSet.has(n.id));
  links=links.filter(l=>!idSet.has(l.from)&&!idSet.has(l.to));
  saveRecycleBin();
  return removedNotes.length;
}
function restoreRecycleItem(itemId){
  const idx=recycleBin.findIndex(x=>String(x.id)===String(itemId));
  if(idx<0) return;
  const item=recycleBin[idx];
  const idMap={};
  (item.notes||[]).forEach(n=>{
    const newId=nid++;
    idMap[n.id]=newId;
    notes.push(normalizeNoteSchema({...n,id:newId}));
  });
  (item.links||[]).forEach(l=>{
    const from=idMap[l.from]??l.from;
    const to=idMap[l.to]??l.to;
    if(!noteById(from)||!noteById(to)||from===to) return;
    links.push({id:lid++,from,to,rel:'關聯',color:LINK_COLOR});
  });
  recycleBin.splice(idx,1);
  normalizeNotesTaxonomy();
  saveRecycleBin();
  saveData();
  renderArchivePanel();
  rebuildUI();
  render();
  showToast('已復原筆記');
}
function deleteRecycleItem(itemId){
  recycleBin=recycleBin.filter(x=>String(x.id)!==String(itemId));
  saveRecycleBin();
  renderArchivePanel();
}
function renderArchivePanel(){
  const archiveRoot=g('archiveList'), recycleRoot=g('recycleList');
  if(!archiveRoot||!recycleRoot) return;
  const archives=loadArchives();
  archiveRoot.innerHTML=archives.length?archives.map(a=>`<div class="archive-item"><div class="archive-item-title">${escapeHtml(a.name||'未命名存檔')}</div><div class="archive-item-sub">${new Date(a.createdAt||Date.now()).toLocaleString('zh-TW')}</div><div class="archive-item-actions"><button class="tool-btn" data-archive-load="${a.id}">載入</button><button class="tool-btn" data-archive-del="${a.id}">刪除</button></div></div>`).join(''):'<div class="archive-empty">目前沒有存檔</div>';
  recycleRoot.innerHTML=recycleBin.length?recycleBin.map(r=>`<div class="archive-item"><div class="archive-item-title">${(r.notes||[]).length} 筆筆記</div><div class="archive-item-sub">刪除於 ${new Date(r.deletedAt||Date.now()).toLocaleString('zh-TW')}</div><div class="archive-item-actions"><button class="tool-btn" data-recycle-restore="${r.id}">復原</button><button class="tool-btn" data-recycle-del="${r.id}">清除此項</button></div></div>`).join(''):'<div class="archive-empty">回收區是空的</div>';
  archiveRoot.querySelectorAll('[data-archive-load]').forEach(btn=>btn.addEventListener('click',()=>{
    const pick=archives.find(a=>String(a.id)===String(btn.dataset.archiveLoad));
    if(!pick) return;
    if(!confirm(`確定載入「${pick.name}」？\n載入後會完整取代目前所有筆記資料。`)) return;
    if(applySnapshotRaw(JSON.stringify(pick.payload||{}))) showToast('已載入存檔');
    else showToast('載入存檔失敗');
  }));
  archiveRoot.querySelectorAll('[data-archive-del]').forEach(btn=>btn.addEventListener('click',()=>{
    const filtered=archives.filter(a=>String(a.id)!==String(btn.dataset.archiveDel));
    saveArchives(filtered);
    renderArchivePanel();
  }));
  recycleRoot.querySelectorAll('[data-recycle-restore]').forEach(btn=>btn.addEventListener('click',()=>restoreRecycleItem(btn.dataset.recycleRestore)));
  recycleRoot.querySelectorAll('[data-recycle-del]').forEach(btn=>btn.addEventListener('click',()=>deleteRecycleItem(btn.dataset.recycleDel)));
}
function manageArchives(){
  g('ap')?.classList.add('open');
  ['dp','fp','tp'].forEach(p=>g(p)?.classList.remove('open'));
  renderArchivePanel();
  syncSidePanelState();
}

// ==================== UI 建構 ====================
function buildTypeRow() {
  const row=g('typeRow');
  row.innerHTML=`<button class="tab ${cv==='all'?'on':''}" data-v="all">全部</button>`+types.map(t=>`<button class="tab ${cv===t.key?'on':''}" data-v="${t.key}" style="${cv===t.key?`background:${t.color};`:''}">${t.label}</button>`).join('');
  row.querySelectorAll('.tab[data-v]').forEach(btn=>btn.addEventListener('click',()=>{cv=btn.dataset.v;gridPage=1;buildTypeRow();render();}));
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
  fc.innerHTML=`<option value="">無</option>`+available.map(ch=>`<option value="${ch.key}">${ch.label}</option>`).join('');
  const selectedKeys=(Array.isArray(selected)?selected.filter(Boolean):(selected?[selected]:[])).slice(0,1);
  const validSelected=selectedKeys.filter(k=>available.some(ch=>ch.key===k));
  if(validSelected.length) setSelectedValues('fc',validSelected);
  else fc.value='';
}
function syncSectionSelect(chapterKeys, selected=[], subjectKeys=[]){
  const sec=g('fsec'); if(!sec) return;
  const chKeys=Array.isArray(chapterKeys)?chapterKeys.filter(Boolean):(chapterKeys?[chapterKeys]:[]);
  const subKeys=Array.isArray(subjectKeys)?subjectKeys.filter(Boolean):(subjectKeys?[subjectKeys]:[]);
  const availableChapterKeys=chKeys.length
    ? chKeys
    : (subKeys.length?chaptersBySubjects(subKeys).map(ch=>ch.key):chapters.map(ch=>ch.key));
  const available=availableChapterKeys.length?sectionsByChapters(availableChapterKeys):[];
  sec.innerHTML=`<option value="">無</option>`+available.map(item=>`<option value="${item.key}">${item.label}</option>`).join('');
  const selectedKeys=(Array.isArray(selected)?selected.filter(Boolean):(selected?[selected]:[])).slice(0,1);
  const validSelected=selectedKeys.filter(k=>available.some(item=>item.key===k));
  if(validSelected.length) setSelectedValues('fsec',validSelected);
  else sec.value='';
}
function buildFormSelects() {
  g('ft').innerHTML=types.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');
  g('fs2').innerHTML=`<option value="">無</option>`+subjects.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  syncChapterSelect(selectedValues('fs2'));
  syncSectionSelect(selectedValues('fc'),[],selectedValues('fs2'));
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
function noteMatchesSearch(note, q, normalizedDate='') {
  if(!q) return true;
  const subs=noteSubjects(note), chs=noteChapters(note), secs=noteSections(note);
  const hay=`${note.title} ${note.body} ${subs.join(' ')} ${chs.join(' ')} ${secs.join(' ')} ${note.date||''}`.toLowerCase();
  return hay.includes(q)||(normalizedDate&&formatDate(note.date)===normalizedDate);
}
function relayMatchesSearch(relay, q) {
  if(!q) return true;
  const subs=noteSubjects(relay), chs=noteChapters(relay), secs=noteSections(relay);
  const hay=`${relay.title} ${relay.body||''} ${subs.join(' ')} ${chs.join(' ')} ${secs.join(' ')}`.toLowerCase();
  return hay.includes(q);
}
function expandWithLinkedNotes(seedIds) {
  const expanded=new Set(seedIds), queue=[...expanded];
  while(queue.length){
    const current=queue.shift();
    links.forEach(l=>{
      if(l.from===current&&!expanded.has(l.to)){expanded.add(l.to);queue.push(l.to);}
      if(l.to===current&&!expanded.has(l.from)){expanded.add(l.from);queue.push(l.from);}
    });
  }
  return expanded;
}
function expandWithChildLinkedNotes(seedIds) {
  const expanded=new Set(seedIds), queue=[...expanded];
  while(queue.length){
    const current=queue.shift();
    links.forEach(l=>{
      if(l.from===current&&!expanded.has(l.to)){expanded.add(l.to);queue.push(l.to);}
    });
  }
  return expanded;
}

// ==================== 渲染 ====================
function render() {
  const q=searchQ.trim().toLowerCase();
  const normalizedDate=parseSearchDateVariants(searchQ);
  const seedIds=new Set(notes.filter(n=>baseScopeMatch(n)).map(n=>n.id));
  const shouldExpand=scopeLinkedEnabled&&hasTaxonomyFilter();
  const visibleIds=shouldExpand?expandWithLinkedNotes(seedIds):seedIds;
  const filtered=sortedNotes(notes,{sortMode,safeStr,noteSubjectText,noteChapterText}).filter(n=>visibleIds.has(n.id)&&noteMatchesSearch(n,q,normalizedDate));
  const sb=g('search-results-bar');
  if(q){sb.style.display='block';sb.textContent=`搜尋「${searchQ}」：找到 ${filtered.length} 筆筆記`;}
  else if(shouldExpand){
    const linkedCount=Math.max(0,filtered.length-seedIds.size);
    sb.style.display='block';
    sb.textContent=linkedCount>0?`已額外顯示 ${linkedCount} 筆跨科目關聯筆記`:'已啟用跨科目關聯顯示（目前無新增筆記）';
  }else sb.style.display='none';
  const grid=g('grid');
  const pager=g('gridPager'); if(pager) pager.remove();
  const reminderHits=(q||normalizedDate)?calendarEvents.filter(ev=>{
    if(ev.type!=='reminder') return false;
    const hay=`${ev.title||''} ${ev.body||''} ${ev.date||''}`.toLowerCase();
    return hay.includes(q)||(normalizedDate&&formatDate(ev.date)===normalizedDate);
  }).map(ev=>({__isReminder:true,id:`r_${ev.id}`,title:ev.title||'未命名提醒',body:ev.body||'',date:ev.date,type:'reminder',eventId:ev.id,dueHour:ev.dueHour||0,dueMinute:ev.dueMinute||0})) : [];
  const mixed=[...filtered,...reminderHits];
  if(!mixed.length){grid.innerHTML='<div class="empty">沒有符合的筆記</div>';return;}
  const maxPg=Math.ceil(mixed.length/PAGE_SIZE)||1;
  if(gridPage>maxPg) gridPage=maxPg;
  const pgF=mixed.slice((gridPage-1)*PAGE_SIZE,gridPage*PAGE_SIZE);
  grid.innerHTML=pgF.map(n=>{
    const isReminder=!!n.__isReminder;
    const tp=isReminder?{label:'提醒',color:'#b91c1c'}:typeByKey(n.type),subs=isReminder?[]:noteSubjects(n),chs=isReminder?[]:noteChapters(n),secs=isReminder?[]:noteSections(n);
    const subChips=subs.map(sk=>{const sb2=subByKey(sk);return `<span class="chip" style="background:${lightC(sb2.color)};color:${darkC(sb2.color)}">${sb2.label}</span>`;}).join('');
    const chapterChips=chs.map(chk=>`<span class="chip">${chapterByKey(chk).label}</span>`).join('');
    const sectionChips=secs.map(sk=>`<span class="chip">${sectionByKey(sk).label}</span>`).join('');
    const noteActionChips=isReminder?'':`<span class="chip card-action-chip" data-action="duplicate">建立副本</span><span class="chip card-action-chip" data-action="copy">複製內容</span><span class="chip card-action-chip" data-action="delete">刪除</span>`;
    const linkedChip=(shouldExpand&&!seedIds.has(n.id))?'<span class="chip" style="background:#EAF3DE;color:#3B6D11;border-color:#97C459">跨科關聯</span>':'';
    const hasContent=isReminder?!!safeStr(n.body):noteHasVisibleContent(n);
    const linkModeClass=linkModeActive?'link-mode':'';
    const linkSourceClass=linkSourceId===n.id?'link-source':'';
    return `<div class="card ${hasContent?'':'card-empty-content'} ${isReminder?'calendar-reminder-card':''} ${linkModeClass} ${linkSourceClass}" data-id="${n.id}" data-reminder-id="${isReminder?n.eventId:''}" style="--type-color:${tp.color}"><button class="sel-check" type="button" aria-label="勾選筆記"></button><div class="ctop"><span class="ctag">${tp.label}</span><div class="ctitle-inline">${hl(n.title,q)}</div></div>${hasContent?`<div class="cbody">${escapeHtml(n.body)}</div>`:''}<div class="cfoot">${subChips}${chapterChips}${sectionChips}${linkedChip}${noteActionChips}</div></div>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(c=>{
    const rid=c.dataset.reminderId?parseInt(c.dataset.reminderId,10):0;
    const id=parseInt(c.dataset.id);
    if(rid){
      c.addEventListener('click',()=>{const ev=calendarEvents.find(e=>e.id===rid);if(ev) openCalendarEventModal(ev.date,ev);});
      return;
    }
    if(multiSelMode) c.classList.add('selectable');
    if(selectedIds[id]){c.classList.add('selected');c.querySelector('.sel-check').textContent='✓';}
    bindCardInteractions(c,id);
  });
  if(mixed.length>PAGE_SIZE){
    const totalPg=Math.ceil(mixed.length/PAGE_SIZE),pager=document.createElement('div');
    pager.id='gridPager';pager.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 14px 28px;';
    if(gridPage>1){const pb=document.createElement('button');pb.className='tool-btn';pb.textContent='← 上一頁';pb.onclick=()=>{gridPage--;render();window.scrollTo(0,0);};pager.appendChild(pb);}
    const pi=document.createElement('span');pi.style.cssText='font-size:12px;color:#7b8492;';pi.textContent=`${gridPage} / ${totalPg}`;pager.appendChild(pi);
    if(gridPage<totalPg){const nb=document.createElement('button');nb.className='tool-btn';nb.textContent='下一頁 →';nb.onclick=()=>{gridPage++;render();window.scrollTo(0,0);};pager.appendChild(nb);}
    g('content').appendChild(pager);
  }
}
function applyCompactFilterMode(enabled){
  document.body.classList.toggle('compact-filters',!!enabled);
  localStorage.setItem(COMPACT_FILTER_KEY,enabled?'1':'0');
  const btn=g('compactToggleBtn');
  if(btn) btn.textContent=enabled?'☰ 顯示分類':'☰ 收合分類';
}
function createRelationLink(fromId,toId){
  const a=parseInt(fromId,10),b=parseInt(toId,10);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a===b) return false;
  if(!mapNodeById(a)||!mapNodeById(b)) return false;
  if(links.some(l=>(l.from===a&&l.to===b)||(l.from===b&&l.to===a))) return false;
  links.push({id:lid++,from:a,to:b,rel:'關聯',color:LINK_COLOR});
  return true;
}
function clearMapLinkSource(opts={}){
  const {silent=false}=opts;
  if(!mapLinkSourceId) return;
  mapLinkSourceId=null;
  if(isMapOpen) drawMap();
  if(!silent) showToast('已取消地圖連線起點');
}
function setMapLinkSource(id){
  if(!mapNodeById(id)) return;
  mapLinkSourceId=id;
  if(isMapOpen) drawMap();
  showToast('已選擇地圖連線起點，請再點一個節點建立關聯');
}
function handleMapNodeLinkTap(targetId){
  if(!mapLinkSourceId) return false;
  if(mapLinkSourceId===targetId){
    clearMapLinkSource();
    return true;
  }
  const src=mapLinkSourceId;
  const created=createRelationLink(src,targetId);
  if(!created){
    showToast('關聯已存在或無效');
    return true;
  }
  mapLinkSourceId=targetId;
  saveData();
  drawMap();
  if(openId===src||openId===targetId) renderLinksForNote(openId);
  showToast('已建立關聯，可繼續點下一個節點串接');
  return true;
}
function findMapNodesByKeyword(keyword,excludeId){
  const q=safeStr(keyword).replace(/^@/,'').trim().toLowerCase();
  if(!q) return [];
  const blocked=Number(excludeId);
  return [...notes,...mapRelays].filter(n=>n.id!==blocked&&`${n.title} ${noteSubjectText(n)} ${isRelayNode(n)?'中繼站':typeByKey(n.type).label}`.toLowerCase().includes(q)).slice(0,18);
}
function openMapNodeFromLink(id){
  if(!relayById(id)){ showToast('中繼站已被刪除'); return; }
  if(!isMapOpen) toggleMapView(true);
  setTimeout(()=>{
    if(!nodePos[id]) initNodePos();
    showMapInfo(id);
    openMapPopup(id);
    highlightNode(id);
  },130);
}
function renderDetailQuickLinkSearch(){
  const root=g('dp-link-results');
  if(!root||!openId) return;
  const q=(g('dp-link-search')?.value||'').trim();
  if(!q){root.innerHTML='<div class="dp-link-empty">輸入關鍵字即可快速建立關聯</div>';return;}
  const existingIds=new Set(links.filter(l=>l.from===openId||l.to===openId).map(l=>l.from===openId?l.to:l.from));
  const pool=findMapNodesByKeyword(q,openId).filter(n=>!existingIds.has(n.id));
  if(!pool.length){root.innerHTML='<div class="dp-link-empty">找不到可關聯的筆記</div>';return;}
  root.innerHTML=pool.map(n=>{
    const tp=isRelayNode(n)?{label:'中繼站',color:'#A855F7'}:typeByKey(n.type);
    return `<div class="fl-result-item quick-add" data-quick-link-id="${n.id}"><span class="fl-result-type" style="background:${tp.color}">${tp.label}</span><span class="fl-result-title">${escapeHtml(n.title)}</span><button class="tool-btn" type="button">+ 關聯</button></div>`;
  }).join('');
  root.querySelectorAll('[data-quick-link-id]').forEach(row=>row.addEventListener('click',()=>{
    const targetId=parseInt(row.dataset.quickLinkId,10);
    if(!openId||!targetId) return;
    if(createRelationLink(openId,targetId)){
      saveData();renderLinksForNote(openId);render();showToast('已建立關聯');
      renderDetailQuickLinkSearch();
      if(isMapOpen) scheduleMapRedraw(100);
    }else showToast('此關聯已存在或無效');
  }));
}
function renderMapPopupQuickLinkSearch(sourceId=null){
  const input=g('mp-link-search'),root=g('mp-link-results');
  if(!input||!root) return;
  const srcId=parseInt(sourceId??input.dataset.sourceId,10);
  if(!srcId||!relayById(srcId)){root.innerHTML='';return;}
  input.dataset.sourceId=String(srcId);
  const q=(input.value||'').trim();
  if(!q){root.innerHTML='<div class="dp-link-empty">輸入關鍵字即可快速建立關聯</div>';return;}
  const existingIds=new Set(links.filter(l=>l.from===srcId||l.to===srcId).map(l=>l.from===srcId?l.to:l.from));
  const pool=findMapNodesByKeyword(q,srcId).filter(n=>!existingIds.has(n.id)&&!isRelayNode(n));
  if(!pool.length){root.innerHTML='<div class="dp-link-empty">找不到可關聯的筆記</div>';return;}
  root.innerHTML=pool.map(n=>{
    const tp=typeByKey(n.type);
    return `<div class="fl-result-item quick-add" data-mp-quick-link-id="${n.id}"><span class="fl-result-type" style="background:${tp.color}">${tp.label}</span><span class="fl-result-title">${escapeHtml(n.title)}</span><button class="tool-btn" type="button">+ 關聯</button></div>`;
  }).join('');
  root.querySelectorAll('[data-mp-quick-link-id]').forEach(row=>row.addEventListener('click',()=>{
    const targetId=parseInt(row.dataset.mpQuickLinkId,10);
    if(!srcId||!targetId) return;
    if(createRelationLink(srcId,targetId)){
      saveData();
      showMapInfo(srcId);
      if(isMapOpen) drawMap();
      if(openId&&(openId===srcId||openId===targetId)) renderLinksForNote(openId);
      showToast('已建立關聯');
      renderMapPopupQuickLinkSearch(srcId);
    }else showToast('此關聯已存在或無效');
  }));
}
function setLinkMode(enabled){
  linkModeActive=!!enabled;
  if(!linkModeActive) linkSourceId=null;
  const btn=g('linkModeBtn');
  if(btn){
    btn.classList.toggle('active',linkModeActive);
    btn.textContent=linkModeActive?'🔗 連線中':'🔗 連線模式';
  }
  render();
}
function handleLinkModeCardTap(id){
  if(!linkSourceId){
    linkSourceId=id;
    render();
    showToast('已選擇起點，請再點一張卡片建立關聯');
    return;
  }
  if(linkSourceId===id){
    linkSourceId=null;
    render();
    showToast('已取消起點選擇');
    return;
  }
  const created=createRelationLink(linkSourceId,id);
  if(created){
    const src=linkSourceId;
    linkSourceId=id;
    saveData();
    render();
    if(openId===src||openId===id) renderLinksForNote(openId);
    if(isMapOpen) scheduleMapRedraw(100);
    showToast('已建立關聯，可繼續點下一張卡片快速串接');
  }else{
    showToast('關聯已存在或無效');
  }
}
function extractMentionTargets(raw,selfId){
  const text=safeStr(raw);
  const matches=[...text.matchAll(/@([^\s@#，。；、,.!?！？:：()（）\[\]【】]+)/g)].map(m=>safeStr(m[1]).trim()).filter(Boolean);
  const uniqMatches=uniq(matches);
  const ids=[];
  uniqMatches.forEach(token=>{
    const lower=token.toLowerCase();
    const exact=notes.find(n=>n.id!==selfId&&safeStr(n.title).toLowerCase()===lower);
    if(exact){ids.push(exact.id);return;}
    const fuzzy=notes.find(n=>n.id!==selfId&&safeStr(n.title).toLowerCase().includes(lower));
    if(fuzzy) ids.push(fuzzy.id);
  });
  return uniq(ids);
}
function autoLinkMentionsForNote(note){
  if(!note||!note.id) return 0;
  const blocks=[note.title,note.body,note.detail];
  Object.values(noteExtraFields(note)).forEach(v=>blocks.push(safeStr(v)));
  const mentionIds=extractMentionTargets(blocks.join('\n'),note.id);
  let added=0;
  mentionIds.forEach(id=>{ if(createRelationLink(note.id,id)) added++; });
  return added;
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
  const customHtml=fields.filter(k=>!BUILTIN_FIELD_DEFS[k]).map(k=>{
    const v=renderFieldValue(n,k);
    return `<span class="chip" title="${getFieldDef(k).label}">${getFieldDef(k).label}：${String(v).slice(0,20)||'（空）'}</span>`;
  }).join('');
  g('dp-chips').innerHTML=subChips+chapterChips+sectionChips+customHtml;
  g('dp-inline-actions').innerHTML=`<button class="inline-note-action" data-action="edit">✏️ 編輯</button><button class="inline-note-action" data-action="duplicate">📄 建立副本</button><button class="inline-note-action" data-action="copy">📋 複製內容</button><button class="inline-note-action" data-action="delete">🗑️ 刪除</button>`;
  g('dp-inline-actions').querySelectorAll('.inline-note-action').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const action=btn.dataset.action;
      if(action==='edit') openForm(true);
      else if(action==='duplicate') duplicateNote(id);
      else if(action==='copy') copyNoteToClipboard(id);
      else if(action==='delete') deleteNote(id);
    });
  });
  const quickInput=g('dp-link-search');
  if(quickInput) quickInput.value='';
  renderLinksForNote(id);
  renderDetailQuickLinkSearch();
  g('dp').classList.add('open');['fp','tp','ap'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
}

function renderLinksForNote(id) {
  const related=links.filter(l=>l.from===id||l.to===id);
  const el=g('dp-links');
  if(!related.length){el.innerHTML='<span style="font-size:12px;color:#bbb">尚無關聯</span>';return;}
  el.innerHTML=related.map(l=>{
    const otherId=l.from===id?l.to:l.from,other=mapNodeById(otherId),dir=l.from===id?'→':'←';
    return `<div class="link-item"><div class="link-dot" style="background:${LINK_COLOR}"></div><span class="link-rel" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="link-title link-jump" data-nid="${otherId}" style="cursor:pointer;color:#007AFF;text-decoration:underline;">${other?other.title:'（已刪除）'}</span><button class="link-del" data-lid="${l.id}">✕</button></div>`;
  }).join('');
  el.querySelectorAll('.link-jump').forEach(btn=>btn.addEventListener('click',()=>{
    const nid2=parseInt(btn.dataset.nid,10);
    if(noteById(nid2)){ openNote(nid2); return; }
    openMapNodeFromLink(nid2);
  }));
  el.querySelectorAll('.link-del').forEach(btn=>btn.addEventListener('click',()=>{links=links.filter(l=>l.id!==parseInt(btn.dataset.lid));saveData();renderLinksForNote(id);renderDetailQuickLinkSearch();render();showToast('關聯已刪除');}));
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
  if(linkModeActive) setLinkMode(false);
  editMode=isEdit; buildFormSelects();
  if(editMode) {
    const n=noteById(openId); if(!n) return;
    g('form-title').textContent='編輯筆記';
    g('ft').value=n.type;setSelectedValues('fs2',noteSubjects(n));syncChapterSelect(noteSubjects(n),noteChapters(n));syncSectionSelect(noteChapters(n),noteSections(n),noteSubjects(n));g('fti').value=n.title;
    renderDynamicFields(n.type,n);
  } else {
    g('form-title').textContent='新增筆記';
  ['fti'].forEach(id=>{const el=g(id);if(el)el.value='';});
    const pref=loadFormTaxonomyPref();
    const defaultSub=(pref.subject&&subjects.some(s=>s.key===pref.subject))?pref.subject:(subjects[0]?subjects[0].key:null);
    if(defaultSub){
      setSelectedValues('fs2',[defaultSub]);
      const defaultChapter=(pref.chapter&&chaptersBySubjects([defaultSub]).some(ch=>ch.key===pref.chapter))?pref.chapter:'';
      syncChapterSelect([defaultSub],defaultChapter?[defaultChapter]:[]);
      const defaultSection=(pref.section&&sectionsByChapters(defaultChapter?[defaultChapter]:[]).some(sec=>sec.key===pref.section))?pref.section:'';
      syncSectionSelect(defaultChapter?[defaultChapter]:[],defaultSection?[defaultSection]:[],[defaultSub]);
    }
    else{setSelectedValues('fs2',[]);syncChapterSelect([],[]);syncSectionSelect([],[],[]);}
    renderDynamicFields(g('ft').value,null);
  }
  buildInlineLinksPanel();
  g('fp').classList.add('open');['dp','tp'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
}
function closeForm() { g('fp').classList.remove('open'); syncSidePanelState(); }

function detachSidePanelsFromNotesView(){
  const host=document.body;
  ['dp','fp','tp','ap'].forEach(id=>{
    const panel=g(id);
    if(panel&&panel.parentElement!==host) host.appendChild(panel);
  });
}
function syncSidePanelState(){
  const hasOpen=['dp','fp','tp','ap'].some(id=>g(id)?.classList.contains('open'));
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
  el.innerHTML=related.map(l=>{const otherId=l.from===openId?l.to:l.from,other=mapNodeById(otherId),tag=isRelayNode(other)?'<span class="chip" style="margin-right:6px;background:#F2E8FF;color:#7A34B0;border-color:#D4B5EF">中繼站</span>':'';return `<div class="fl-item">${tag}<span class="fl-item-title">${other?other.title:'（已刪除）'}</span><button class="fl-del" data-lid="${l.id}">✕</button></div>`;}).join('');
  el.querySelectorAll('.fl-del').forEach(btn=>btn.addEventListener('click',()=>{links=links.filter(l=>l.id!==parseInt(btn.dataset.lid));saveData();renderFormLinks();if(isMapOpen)scheduleMapRedraw(100);showToast('關聯已刪除');}));
}
function renderFormLinkSearch() {
  const el=g('fl-results'); if(!el) return;
  const q=(val('fl-search')||'').toLowerCase().trim();
  if(!q){el.innerHTML='';updateFormLinkBulkActions();return;}
  const existIds=links.filter(l=>openId&&(l.from===openId||l.to===openId)).map(l=>l.from===openId?l.to:l.from);
  const pool=[...notes,...mapRelays].filter(n=>n.id!==openId&&!existIds.includes(n.id)&&`${n.title} ${noteSubjectText(n)} ${isRelayNode(n)?'中繼站':typeByKey(n.type).label}`.toLowerCase().includes(q)).slice(0,24);
  if(!pool.length){el.innerHTML='<div style="font-size:12px;color:#bbb;padding:4px 0;">找不到符合的筆記</div>';updateFormLinkBulkActions();return;}
  el.innerHTML=pool.map(n=>{const tp=isRelayNode(n)?{label:'中繼站',color:'#A855F7'}:typeByKey(n.type);return `<div class="fl-result-item ${formLinkSelections[n.id]?'selected':''}" data-nid="${n.id}"><input type="checkbox" ${formLinkSelections[n.id]?'checked':''}><span class="fl-result-type" style="background:${tp.color}">${tp.label}</span><span class="fl-result-title">${n.title}</span></div>`;}).join('');
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
  targetIds.forEach(toId=>{ if(createRelationLink(openId,toId)) added++; });
  formLinkSelections={};saveData();renderFormLinks();renderFormLinkSearch();showToast(`已建立 ${added} 筆關聯`);if(isMapOpen)scheduleMapRedraw(100);
}

function collectFormValuesByType(typeKey){
  const result={body:'',detail:'',todos:[],extraFields:{}};
  getTypeFieldKeys(typeKey).forEach(key=>{
    const el=g(`f-field-${key}`);
    if(!el) return;
    const raw=(el.value||'').trim();
    if(key==='body') result.body=raw;
    else if(key==='detail') result.detail=raw;
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
  saveFormTaxonomyPref(primarySubject,primaryChapter,primarySection);
  if(editMode&&openId) {
    const idx=notes.findIndex(n=>n.id===openId);
    const selectedIdNums=Object.keys(selectedIds||{}).map(Number).filter(id=>selectedIds[id]);
    const shouldSyncMeta=multiSelMode&&selectedIds[openId]&&selectedIdNums.length>1;
    const prevDone=idx!==-1?doneTodoCount(notes[idx].todos):0;
    if(idx!==-1) notes[idx]=normalizeNoteSchema({...notes[idx],type:typeKey,subject:primarySubject,subjects:selectedSubs,chapter:primaryChapter,chapters:selectedChs,section:primarySection,sections:selectedSecs,title,body:fieldData.body,detail:fieldData.detail,todos:fieldData.todos,extraFields:fieldData.extraFields});
    const mentionAdded=idx!==-1?autoLinkMentionsForNote(notes[idx]):0;
    const nextDone=idx!==-1?doneTodoCount(notes[idx].todos):0;
    if(nextDone>prevDone&&levelSystem.tasks.length&&levelSystem.skills.length){
      completeLevelTask(levelSystem.tasks[0].id,levelSystem.skills[0].id);
    }
    refreshAchievementProgress();
    if(shouldSyncMeta){
      selectedIdNums.forEach(id=>{
        if(id===openId) return;
        const target=noteById(id);
        if(!target) return;
        Object.assign(target,{type:typeKey,subject:primarySubject,subjects:[...selectedSubs],chapter:primaryChapter,chapters:[...selectedChs],section:primarySection,sections:[...selectedSecs]});
      });
    }
    saveData();closeForm();render();if(isMapOpen) scheduleMapRedraw(0);showToast(`筆記已更新！${mentionAdded?`（@ 自動建立 ${mentionAdded} 筆關聯）`:''}`);
    setTimeout(()=>openNote(openId),150);
  } else {
    const d=new Date(),dt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newNote=normalizeNoteSchema({id:nid++,type:typeKey,subject:primarySubject,subjects:selectedSubs,chapter:primaryChapter,chapters:selectedChs,section:primarySection,sections:selectedSecs,title,body:fieldData.body,detail:fieldData.detail,date:dt,todos:fieldData.todos,extraFields:fieldData.extraFields});
    if(doneTodoCount(newNote.todos)>0&&levelSystem.tasks.length&&levelSystem.skills.length){
      completeLevelTask(levelSystem.tasks[0].id,levelSystem.skills[0].id);
    }
    refreshAchievementProgress();
    notes.unshift(newNote);openId=newNote.id;
    const mentionAdded=autoLinkMentionsForNote(newNote);
    saveData();closeForm();render();if(isMapOpen) scheduleMapRedraw(0);showToast(`筆記已儲存！${mentionAdded?`（@ 自動建立 ${mentionAdded} 筆關聯）`:''}`);
    if(isMapOpen) setTimeout(()=>openNote(newNote.id),120);
    else setTimeout(()=>{window.scrollTo(0,0);setTimeout(()=>openNote(notes[0].id),300);},100);
  }
}
function saveNoteDraftFromForm(){
  if(!(editMode&&openId)) return;
  const target=noteById(openId);
  if(!target) return;
  const title=(g('fti').value||'').trim();
  if(!title) return;
  const typeKey=g('ft').value;
  const fieldData=collectFormValuesByType(typeKey);
  const selectedSubs=selectedValues('fs2').slice(0,1),selectedChs=selectedValues('fc').slice(0,1),selectedSecs=selectedValues('fsec').slice(0,1);
  Object.assign(target,normalizeNoteSchema({...target,type:typeKey,subject:selectedSubs[0]||'',subjects:selectedSubs,chapter:selectedChs[0]||'',chapters:selectedChs,section:selectedSecs[0]||'',sections:selectedSecs,title,body:fieldData.body,detail:fieldData.detail,todos:fieldData.todos,extraFields:fieldData.extraFields}));
  saveDataDeferred();
}
function duplicateNote(targetId=openId) {
  if(!targetId){showToast('請先開啟要複製的筆記');return;}
  const src=noteById(targetId);
  if(!src){showToast('找不到要複製的筆記');return;}
  const d=new Date(),dt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const copyTitle=`${src.title}（複製）`;
  const newNote=normalizeNoteSchema({
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
    date:dt,
    todos:Array.isArray(src.todos)?src.todos.map(t=>({text:t.text||'',done:!!t.done})):[],
    extraFields:{...noteExtraFields(src)}
  });
  notes.unshift(newNote);
  openId=newNote.id;
  saveData();
  render();
  showToast('已複製筆記');
  setTimeout(()=>{window.scrollTo(0,0);setTimeout(()=>openNote(newNote.id),220);},80);
}
async function copyNoteToClipboard(targetId=openId) {
  if(!targetId){showToast('請先開啟要複製的筆記');return;}
  const n=noteById(targetId);
  if(!n){showToast('找不到要複製的筆記');return;}
  const text=[
    n.title||'（未命名）',
    '',
    '摘要',
    n.body||'',
    '',
    '詳細筆記',
    n.detail||''
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
function deleteNote(targetId=openId) {
  if(!targetId||!confirm('確定刪除這筆筆記？可到回收區復原（保留 7 天）。')) return;
  const removed=removeNotesToRecycle([targetId]);
  if(!removed) return;
  const recycleId=recycleBin[0]?.id;
  saveData();
  if(openId===targetId) closeDetail();
  renderArchivePanel();
  render();
  showActionToast('已移至回收區',recycleId?()=>restoreRecycleItem(recycleId):null);
}
// ==================== 標籤管理 ====================
function openTagMgr() {
  chapterSubjectFilter='';
  sectionChapterFilter='';
  activeTagCategory='type';
  g('tp').classList.add('open');
  ['dp','fp','ap'].forEach(p=>g(p).classList.remove('open'));
  renderTagLists();
  renderTagStats();
  syncSidePanelState();
}
function renderTagStats(){
  const box=g('tagStatsPanel');
  if(!box) return;
  const total=notes.length,byT={},byS={};
  notes.forEach(n=>{byT[n.type]=(byT[n.type]||0)+1;noteSubjects(n).forEach(sk=>{byS[sk]=(byS[sk]||0)+1;});});
  const lnk={};links.forEach(l=>{lnk[l.from]=true;lnk[l.to]=true;});
  const usageText=formatUsageDuration(ensureUsageStart());
  let html=`<div class="stats-grid"><div class="stat-card"><div class="stat-num">${total}</div><div class="stat-lbl">筆記總數</div></div><div class="stat-card"><div class="stat-num">${Object.keys(lnk).length}</div><div class="stat-lbl">有關聯筆記</div></div><div class="stat-card"><div class="stat-num">${subjects.length}</div><div class="stat-lbl">科目數</div></div><div class="stat-card"><div class="stat-num">${chapters.length}</div><div class="stat-lbl">章數</div></div><div class="stat-card"><div class="stat-num">${sections.length}</div><div class="stat-lbl">節數</div></div></div><div class="usage-time">已使用 KLaws：${usageText}</div>`;
  html+=`<div style="font-size:11px;font-weight:700;color:#888;margin:10px 0 6px;">各科目筆記數</div>`;
  Object.keys(byS).sort((a,b)=>byS[b]-byS[a]).forEach(sk=>{const s=subByKey(sk),c=byS[sk],p=total?Math.round(c/total*100):0;html+=`<div class="stats-bar-row"><span class="stats-bar-label">${s.label}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${p}%;background:${s.color}"></div></div><span class="stats-bar-count">${c}</span></div>`;});
  box.innerHTML=html;
}
function moveLevelItem(kind,idx,dir){
  const arr=levelSystem[kind];
  const target=idx+dir;
  if(!arr?.[idx]||target<0||target>=arr.length) return;
  [arr[idx],arr[target]]=[arr[target],arr[idx]];
  saveData();renderLevelSystemPage();
}
function deleteLevelItem(kind,idx){
  const mapLabel={skills:'技能',tasks:'任務',achievements:'成就'};
  const arr=levelSystem[kind];
  const item=arr?.[idx];
  if(!item) return;
  if(!confirm(`確定刪除${mapLabel[kind]}「${item.name||'未命名'}」？`)) return;
  arr.splice(idx,1);
  refreshAchievementProgress();
  saveData();
  applyBrandTitle();
  renderLevelSystemPage();
  showToast(`${mapLabel[kind]}已刪除`);
}
function renderLevelRows(kind){
  const arr=levelSystem[kind]||[];
  if(!arr.length) return '<div style="color:#9aa3b2;font-size:12px;">尚無資料，請先新增。</div>';
  if(kind==='skills') return arr.map((skill,idx)=>{const need=skill.level>=100?0:skillXpRequired(skill.level);const pct=need?Math.round((skill.xp||0)/need*100):100;const decay=getSkillDecayStatus(skill);const decayText=`距離衰退還有 ${decay.daysLeft} 日，需完成 ${decay.difficulty} 難度（逾期衰退 ${decay.levels} 級）`;return `<div class="stats-bar-row"><span class="stats-bar-label" style="min-width:112px;">${escapeHtml(skill.name)} Lv.${skill.level} (${getSkillStage(skill.level)})</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${Math.max(0,Math.min(100,pct))}%;background:#3B6D11"></div></div><span class="stats-bar-count" style="min-width:64px;">${skill.level>=100?'MAX':`${skill.xp||0}/${need}`}</span><span class="level-list-row-actions"><button class="tool-btn" data-level-move="skills" data-idx="${idx}" data-dir="-1">↑</button><button class="tool-btn" data-level-move="skills" data-idx="${idx}" data-dir="1">↓</button><button class="tool-btn" data-level-del="skills" data-idx="${idx}">移除</button></span></div><div class="level-subtext">${decayText}</div>`;}).join('');
  if(kind==='tasks') return arr.map((task,idx)=>renderTaskRow(task,idx)).join('');
  return arr.map((def,idx)=>{const unlocked=!!def.unlocked;const pct=Math.max(0,Math.min(100,Math.round((def.progress||0)/def.target*100)));return `<div class="stats-bar-row"><span class="stats-bar-label" style="min-width:92px;">${escapeHtml(def.name)}</span><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${unlocked?100:pct}%;background:${unlocked?'#3B6D11':'#9cb8d8'}"></div></div><span class="stats-bar-count" style="min-width:64px;">${unlocked?'✓':'+'+(def.points||0)}</span><span class="level-list-row-actions"><button class="tool-btn" data-achievement-edit="${idx}">編輯</button><button class="tool-btn" data-level-move="achievements" data-idx="${idx}" data-dir="-1">↑</button><button class="tool-btn" data-level-move="achievements" data-idx="${idx}" data-dir="1">↓</button><button class="tool-btn" data-level-del="achievements" data-idx="${idx}">移除</button></span></div><div class="level-subtext">${escapeHtml(def.condition)}（${Math.min(def.progress||0,def.target)}/${def.target}）・難度 ${def.difficulty||'N'}</div>`;}).join('');
}
function renderTaskRow(task,idx){
  const doneInCycle=isTaskCompletedInCurrentCycle(task);
  const expanded=!!levelTaskExpanded[task.id];
  const selectedSkill=levelSystem.skills.some(s=>String(s.id)===String(levelTaskExpanded[`skill_${task.id}`]))?String(levelTaskExpanded[`skill_${task.id}`]):String(levelSystem.skills[0]?.id||'');
  const skillOptions=levelSystem.skills.map(skill=>`<option value="${skill.id}" ${String(skill.id)===selectedSkill?'selected':''}>${escapeHtml(skill.name)}（Lv.${skill.level}）</option>`).join('');
  const subtasks=Array.isArray(task.subtasks)?task.subtasks:[];
  const subtasksHtml=subtasks.length?subtasks.map((sub,subIdx)=>{
    const subDone=isSubtaskCompletedInCurrentCycle(task,sub);
    return `<div class="level-subtask-item"><label class="level-subtask-left"><input type="checkbox" data-task-subtask-check="${idx}" data-sub-idx="${subIdx}" ${subDone?'checked':''}><span class="level-subtask-text ${subDone?'done':''}">${escapeHtml(sub.text)} [${sub.difficulty||task.difficulty}]</span></label><span class="level-subtask-actions"><button class="tool-btn" data-task-subtask-edit="${idx}" data-sub-idx="${subIdx}">編輯</button><button class="tool-btn" data-task-subtask-del="${idx}" data-sub-idx="${subIdx}">移除</button></span></div>`;
  }).join(''):'<div style="font-size:12px;color:#94a3b8;">尚未建立小任務</div>';
  return `<div class="level-task-card"><div class="stats-bar-row"><label style="display:flex;align-items:center;gap:8px;min-width:112px;"><input type="checkbox" data-task-check="${idx}" ${doneInCycle?'checked':''}><span class="level-task-name">${escapeHtml(task.name)} [${task.difficulty}]</span></label><div class="stats-bar-bg"><div class="stats-bar-fill" style="width:${Math.min(100,(task.completions||0)*8)}%;background:#9cb8d8"></div></div><span class="stats-bar-count" style="min-width:64px;">${task.completions||0} 次</span><span class="level-list-row-actions"><button class="tool-btn" data-task-expand="${idx}">${expanded?'收合':'展開'}</button><button class="tool-btn" data-task-edit="${idx}">編輯</button><button class="tool-btn" data-level-move="tasks" data-idx="${idx}" data-dir="-1">↑</button><button class="tool-btn" data-level-move="tasks" data-idx="${idx}" data-dir="1">↓</button><button class="tool-btn" data-level-del="tasks" data-idx="${idx}">移除</button></span></div><div class="level-subtext">重複：${getTaskRepeatLabel(task.repeatCycle)}</div>${expanded?`<div class="level-task-subtasks"><div class="level-skill-row"><span style="font-size:12px;color:#64748b;">完成後升級技能：</span>${skillOptions?`<select class="fs" data-task-skill="${idx}">${skillOptions}</select>`:'<span style="font-size:12px;color:#94a3b8;">請先新增技能</span>'}</div>${subtasksHtml}<div class="level-subtask-add"><input class="fi" data-task-subtask-input="${idx}" placeholder="新增小任務內容"><select class="fs" data-task-subtask-difficulty="${idx}"><option value="E" ${task.difficulty==='E'?'selected':''}>E</option><option value="N" ${task.difficulty==='N'?'selected':''}>N</option><option value="H" ${task.difficulty==='H'?'selected':''}>H</option></select><button class="tool-btn" data-task-subtask-add="${idx}">+ 小任務</button></div><div style="font-size:11px;color:#94a3b8;">完成小任務可獲得與其難度相同的 EXP</div></div>`:''}</div>`;
}
function resetSkillLevels(){
  if(!levelSystem.skills.length){showToast('目前沒有技能可重置');return;}
  if(!confirm('確定要重置全部技能等級與經驗值嗎？此動作無法復原。')) return;
  levelSystem.skills.forEach(skill=>{skill.level=1;skill.xp=0;skill.lastDoneByDiff={};skill.lastDecayAt=new Date().toISOString();});
  saveData();
  renderLevelSystemPage();
  showToast('已重置技能等級');
}
function renderLevelSystemPage(){
  const box=g('levelSystemPanel');
  if(!box) return;
  normalizeLevelSystem();
  applySkillDecay();
  refreshAchievementProgress();
  const titleInfo=getCurrentTitle();
  const unlockedCount=(levelSystem.achievements||[]).filter(a=>a.unlocked).length;
  const allTaskCount=(levelSystem.tasks||[]).reduce((sum,t)=>sum+(Number(t.completions)||0),0);
  let html=`<div style="margin-top:2px;padding:10px;border:1px solid #e8edf6;border-radius:10px;background:#f8fbff;"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;"><span class="brand-title">LV${titleInfo.level}・${titleInfo.name}</span><span style="font-size:12px;color:#445;">成就點數：<b>${getLevelAchievementPoints()}</b></span><span style="font-size:12px;color:#445;">任務完成：<b>${allTaskCount}</b> 次</span><span style="font-size:12px;color:#445;">已解鎖：<b>${unlockedCount}</b> 項</span></div></div>`;
  html+=`<div class="level-toolbar"><button class="tool-btn" id="addSkillBtn">+ 技能</button><button class="tool-btn" id="addTaskBtn">+ 任務</button><button class="tool-btn" id="addAchievementBtn">+ 成就</button><button class="tool-btn" id="resetSkillLevelBtn">重置技能等級</button></div>`;
  html+=`<div class="level-section-title">技能（最高 100 級）</div>${renderLevelRows('skills')}`;
  html+=`<div class="level-section-title">任務（E/N/H）</div>${renderLevelRows('tasks')}`;
  html+=`<div class="level-section-title">成就進度</div>${renderLevelRows('achievements')}`;
  box.innerHTML=html;
  g('addSkillBtn')?.addEventListener('click',addSkillItem);
  g('addTaskBtn')?.addEventListener('click',addTaskItem);
  g('addAchievementBtn')?.addEventListener('click',addAchievementItem);
  g('resetSkillLevelBtn')?.addEventListener('click',resetSkillLevels);
  box.querySelectorAll('[data-level-move]').forEach(btn=>btn.addEventListener('click',()=>moveLevelItem(btn.dataset.levelMove,Number(btn.dataset.idx),Number(btn.dataset.dir))));
  box.querySelectorAll('[data-level-del]').forEach(btn=>btn.addEventListener('click',()=>deleteLevelItem(btn.dataset.levelDel,Number(btn.dataset.idx))));
  box.querySelectorAll('[data-task-edit]').forEach(btn=>btn.addEventListener('click',()=>editTaskItem(Number(btn.dataset.taskEdit))));
  box.querySelectorAll('[data-achievement-edit]').forEach(btn=>btn.addEventListener('click',()=>editAchievementItem(Number(btn.dataset.achievementEdit))));
  box.querySelectorAll('[data-task-expand]').forEach(btn=>btn.addEventListener('click',()=>toggleTaskExpand(Number(btn.dataset.taskExpand))));
  box.querySelectorAll('[data-task-check]').forEach(checkbox=>checkbox.addEventListener('change',()=>toggleTaskCompletionFromCheckbox(Number(checkbox.dataset.taskCheck),checkbox.checked)));
  box.querySelectorAll('[data-task-skill]').forEach(sel=>sel.addEventListener('change',()=>{
    const task=levelSystem.tasks[Number(sel.dataset.taskSkill)];
    if(task) levelTaskExpanded[`skill_${task.id}`]=sel.value;
  }));
  box.querySelectorAll('[data-task-subtask-add]').forEach(btn=>btn.addEventListener('click',()=>addTaskSubtask(Number(btn.dataset.taskSubtaskAdd))));
  box.querySelectorAll('[data-task-subtask-edit]').forEach(btn=>btn.addEventListener('click',()=>editTaskSubtask(Number(btn.dataset.taskSubtaskEdit),Number(btn.dataset.subIdx))));
  box.querySelectorAll('[data-task-subtask-del]').forEach(btn=>btn.addEventListener('click',()=>deleteTaskSubtask(Number(btn.dataset.taskSubtaskDel),Number(btn.dataset.subIdx))));
  box.querySelectorAll('[data-task-subtask-check]').forEach(checkbox=>checkbox.addEventListener('change',()=>toggleSubtaskCompletion(Number(checkbox.dataset.taskSubtaskCheck),Number(checkbox.dataset.subIdx),checkbox.checked)));
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
  g('tagCategoryNav')?.querySelectorAll('.tag-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===activeTagCategory));
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
  const arr=tagCollection(kind);
  if(!arr[fromIdx]||!arr[toIdx]) return;
  const [item]=arr.splice(fromIdx,1);
  arr.splice(toIdx,0,item);
  saveData();renderTagLists();rebuildUI();render();
}
function moveTag(idx,kind,dir){
  const arr=tagCollection(kind);
  const target=idx+dir;
  if(!arr[idx]||target<0||target>=arr.length) return;
  [arr[idx],arr[target]]=[arr[target],arr[idx]];
  saveData();renderTagLists();rebuildUI();render();
}
function autoCleanupUnusedTags(){
  const now=Date.now();
  const usage={
    type:new Set(notes.map(n=>n.type).filter(Boolean)),
    subject:new Set(notes.flatMap(n=>noteSubjects(n)).filter(Boolean)),
    chapter:new Set(notes.flatMap(n=>noteChapters(n)).filter(Boolean)),
    section:new Set(notes.flatMap(n=>noteSections(n)).filter(Boolean))
  };
  const nextTracker={};
  const keepOrTrack=(kind,key)=>{
    if(usage[kind].has(key)) return true;
    const trackerKey=`${kind}:${key}`;
    const since=unusedTagTracker[trackerKey]||now;
    nextTracker[trackerKey]=since;
    return now-since<UNUSED_TAG_PURGE_MS;
  };
  const before=types.length+subjects.length+chapters.length+sections.length;
  types=types.filter(t=>keepOrTrack('type',t.key));
  subjects=subjects.filter(s=>keepOrTrack('subject',s.key));
  chapters=chapters.filter(c=>keepOrTrack('chapter',c.key));
  sections=sections.filter(s=>keepOrTrack('section',s.key));
  unusedTagTracker=nextTracker;
  localStorage.setItem(UNUSED_TAG_TRACK_KEY,JSON.stringify(unusedTagTracker));
  normalizeNotesTaxonomy();
  const after=types.length+subjects.length+chapters.length+sections.length;
  if(after!==before){
    saveData();
    if(g('tp')?.classList.contains('open')) renderTagLists();
    rebuildUI();
    render();
    showToast(`已自動清理 ${before-after} 個未使用標籤`);
  }
}
function clearUnusedTags(){
  const usedTypes=new Set(notes.map(n=>n.type)),usedSubs=new Set(notes.flatMap(n=>noteSubjects(n))),usedChapters=new Set(notes.flatMap(n=>noteChapters(n))),usedSections=new Set(notes.flatMap(n=>noteSections(n)));
  const before={types:types.length,subs:subjects.length,chapters:chapters.length,sections:sections.length};
  types=types.filter(t=>usedTypes.has(t.key));
  subjects=subjects.filter(s=>usedSubs.has(s.key));
  chapters=chapters.filter(c=>usedChapters.has(c.key));
  sections=sections.filter(s=>usedSections.has(s.key));
  normalizeNotesTaxonomy();
  unusedTagTracker={};
  localStorage.setItem(UNUSED_TAG_TRACK_KEY,JSON.stringify(unusedTagTracker));
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
  const arr=tagCollection(kind);
  if(kind==='chapter'){
    const removed=arr[idx]; if(!removed) return;
    if(!confirm(`確定刪除章「${removed.label}」？已使用此章的筆記會改為未分類。`)) return;
    const removedSectionKeys=sections.filter(s=>s.chapter===removed.key).map(s=>s.key);
    arr.splice(idx,1);notes.forEach(n=>{
      n.chapters=noteChapters(n).filter(ch=>ch!==removed.key);n.chapter=n.chapters[0]||'';
      n.sections=noteSections(n).filter(sec=>!removedSectionKeys.includes(sec));n.section=n.sections[0]||'';
    });
    sections=sections.filter(s=>s.chapter!==removed.key);
    if(cch===removed.key)cch='all';if(mapFilter.chapter===removed.key)mapFilter.chapter='all';
    if(sectionChapterFilter===removed.key) sectionChapterFilter='';
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
  if(kind==='type'&&removed){
    delete typeFieldConfigs[removed.key];
    notes.forEach(n=>{if(n.type===removed.key)n.type='';});
    if(cv===removed.key) cv='all';
  }
  if(kind==='sub'&&removed){
    const removedChapterKeys=chapters.filter(ch=>ch.subject===removed.key).map(ch=>ch.key);
    const removedSectionKeys=sections.filter(sec=>removedChapterKeys.includes(sec.chapter)).map(sec=>sec.key);
    chapters=chapters.filter(ch=>ch.subject!==removed.key);
    sections=sections.filter(sec=>!removedChapterKeys.includes(sec.chapter));
    notes.forEach(n=>{
      n.subjects=noteSubjects(n).filter(sk=>sk!==removed.key);n.subject=n.subjects[0]||'';
      n.chapters=noteChapters(n).filter(ch=>!removedChapterKeys.includes(ch));n.chapter=n.chapters[0]||'';
      n.sections=noteSections(n).filter(sec=>!removedSectionKeys.includes(sec));n.section=n.sections[0]||'';
    });
    if(selectedSubjects.includes(removed.key)) selectedSubjects=selectedSubjects.filter(k=>k!==removed.key);
    if(chapterSubjectFilter===removed.key) chapterSubjectFilter='';
  }
  normalizeNotesTaxonomy();
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
function addSkillItem(){
  const name=safeStr(prompt('技能名稱：','法條理解力')||'').trim();
  if(!name) return;
  levelSystem.skills.push({id:Date.now()+Math.random(),name,level:1,xp:0,lastDoneByDiff:{},lastDecayAt:new Date().toISOString()});
  saveData();renderLevelSystemPage();applyBrandTitle();showToast('技能已新增');
}
function addTaskItem(){
  openLevelEditor('task');
}
function addAchievementItem(){
  openLevelEditor('achievement');
}
function editTaskItem(idx){
  openLevelEditor('task',idx);
}
function editAchievementItem(idx){
  openLevelEditor('achievement',idx);
}
function openLevelEditor(kind,idx=-1){
  const modal=g('levelEditorModal'),box=g('levelEditorBox');
  if(!modal||!box) return;
  levelEditorState={kind,idx};
  box.classList.toggle('task-mode',kind==='task');
  box.classList.toggle('achievement-mode',kind==='achievement');
  if(kind==='task'){
    const task=idx>=0?levelSystem.tasks[idx]:null;
    g('levelEditorTitle').textContent=task?'編輯任務':'新增任務';
    g('levelTaskName').value=task?.name||'';
    g('levelTaskDifficulty').value=task?.difficulty||'N';
    g('levelTaskRepeat').innerHTML=TASK_REPEAT_OPTIONS.map(opt=>`<option value="${opt.key}" ${(task?.repeatCycle||'daily')===opt.key?'selected':''}>${opt.label}</option>`).join('');
    g('levelTaskSubtasks').value=(task?.subtasks||[]).map(sub=>sub.text).join('\n');
  }else{
    const item=idx>=0?levelSystem.achievements[idx]:null;
    g('levelEditorTitle').textContent=item?'編輯成就':'新增成就';
    g('levelAchievementName').value=item?.name||'';
    g('levelAchievementTarget').value=String(item?.target||10);
    g('levelAchievementCondition').value=item?.condition||'累積完成任務次數';
    g('levelAchievementDifficulty').value=item?.difficulty||'N';
    g('levelAchievementPoints').value=String(item?.points||30);
  }
  modal.classList.add('open');
}
function closeLevelEditor(){ g('levelEditorModal')?.classList.remove('open'); }
function saveLevelEditor(){
  if(levelEditorState.kind==='task'){
    const name=safeStr(g('levelTaskName')?.value||'').trim();
    const difficulty=safeStr(g('levelTaskDifficulty')?.value||'N').toUpperCase();
    const repeatCycle=safeStr(g('levelTaskRepeat')?.value||'daily');
    if(!name){showToast('請輸入任務名稱');return;}
    if(!['E','N','H'].includes(difficulty)){showToast('難度需為 E / N / H');return;}
    if(!TASK_REPEAT_OPTIONS.some(opt=>opt.key===repeatCycle)){showToast('重複週期無效');return;}
    const lines=(g('levelTaskSubtasks')?.value||'').split('\n').map(v=>v.trim()).filter(Boolean);
    const idx=levelEditorState.idx;
    const oldTask=idx>=0?levelSystem.tasks[idx]:null;
    const oldByText={};
    (oldTask?.subtasks||[]).forEach(sub=>{oldByText[sub.text]=sub;});
    const subtasks=lines.map(text=>{
      const prev=oldByText[text];
      return prev?{...prev,text}:{id:Date.now()+Math.random(),text,difficulty,completions:0,lastCompletedAt:'',lastReward:null};
    });
    const payload={id:oldTask?.id||Date.now()+Math.random(),name,difficulty,repeatCycle,completions:oldTask?.completions||0,lastCompletedAt:oldTask?.lastCompletedAt||'',lastReward:oldTask?.lastReward||null,subtasks};
    if(idx>=0) levelSystem.tasks[idx]=payload;
    else levelSystem.tasks.push(payload);
    saveData();renderLevelSystemPage();closeLevelEditor();showToast(idx>=0?'任務已更新':'任務已新增');
    return;
  }
  const name=safeStr(g('levelAchievementName')?.value||'').trim();
  const target=Math.max(1,parseInt(g('levelAchievementTarget')?.value||'1',10)||1);
  const condition=safeStr(g('levelAchievementCondition')?.value||'').trim()||'累積完成任務次數';
  const difficulty=safeStr(g('levelAchievementDifficulty')?.value||'N').toUpperCase();
  const points=Math.max(0,parseInt(g('levelAchievementPoints')?.value||'0',10)||0);
  if(!name){showToast('請輸入成就名稱');return;}
  if(!['E','N','H'].includes(difficulty)){showToast('難度需為 E / N / H');return;}
  const idx=levelEditorState.idx;
  const old=idx>=0?levelSystem.achievements[idx]:null;
  const payload={id:old?.id||Date.now()+Math.random(),name,target,condition,difficulty,points,progress:old?.progress||0,unlocked:!!old?.unlocked};
  if(idx>=0) levelSystem.achievements[idx]=payload;
  else levelSystem.achievements.push(payload);
  refreshAchievementProgress();
  saveData();renderLevelSystemPage();applyBrandTitle();closeLevelEditor();showToast(idx>=0?'成就已更新':'成就已新增');
}
function getSelectedSkillForTaskIdx(taskIdx){
  const task=levelSystem.tasks[taskIdx];
  if(!task||!levelSystem.skills.length) return null;
  const sel=g('levelSystemPanel')?.querySelector(`[data-task-skill="${taskIdx}"]`);
  const selected=sel?.value||String(levelTaskExpanded[`skill_${task.id}`]||levelSystem.skills[0].id);
  levelTaskExpanded[`skill_${task.id}`]=selected;
  return levelSystem.skills.find(skill=>String(skill.id)===String(selected))||null;
}
function toggleTaskCompletionFromCheckbox(taskIdx,checked){
  const task=levelSystem.tasks[taskIdx];
  if(!task) return;
  if(!checked){
    if(!isTaskCompletedInCurrentCycle(task)){renderLevelSystemPage();return;}
    const cycleKey=getTaskCycleKey(task,new Date());
    const reward=task.lastReward;
    if(!reward||reward.cycleKey!==cycleKey){showToast('無法返還：缺少本週期紀錄');renderLevelSystemPage();return;}
    const skill=levelSystem.skills.find(s=>String(s.id)===String(reward.skillId));
    if(!skill||!rollbackTaskCompletion(task,skill)){showToast('返還失敗');renderLevelSystemPage();return;}
    saveData();renderLevelSystemPage();
    showToast(`已返還 ${reward.gain||0} EXP 與任務進度`);
    return;
  }
  if(isTaskCompletedInCurrentCycle(task)){showToast('此任務在本週期已完成');renderLevelSystemPage();return;}
  if(!levelSystem.skills.length){showToast('請先新增至少 1 個技能');renderLevelSystemPage();return;}
  const skill=getSelectedSkillForTaskIdx(taskIdx);
  if(!skill){showToast('請先選擇技能');renderLevelSystemPage();return;}
  if(!completeLevelTask(task.id,skill.id)){showToast('任務完成失敗');renderLevelSystemPage();return;}
  saveData();renderLevelSystemPage();
  showToast(`+${levelSystem.settings.xpByDifficulty[task.difficulty]||0} EXP → ${skill.name}`);
}
function toggleTaskExpand(taskIdx){
  const task=levelSystem.tasks[taskIdx];
  if(!task) return;
  levelTaskExpanded[task.id]=!levelTaskExpanded[task.id];
  renderLevelSystemPage();
}
function addTaskSubtask(taskIdx){
  const task=levelSystem.tasks[taskIdx];
  if(!task) return;
  const input=g('levelSystemPanel')?.querySelector(`[data-task-subtask-input="${taskIdx}"]`);
  const difficultySel=g('levelSystemPanel')?.querySelector(`[data-task-subtask-difficulty="${taskIdx}"]`);
  const text=safeStr(input?.value||'').trim();
  if(!text){showToast('請輸入小任務內容');return;}
  const difficulty=['E','N','H'].includes(difficultySel?.value)?difficultySel.value:'N';
  task.subtasks=Array.isArray(task.subtasks)?task.subtasks:[];
  task.subtasks.push({id:Date.now()+Math.random(),text,difficulty,completions:0,lastCompletedAt:'',lastReward:null});
  if(input) input.value='';
  saveData();renderLevelSystemPage();showToast('小任務已新增');
}
function editTaskSubtask(taskIdx,subIdx){
  const task=levelSystem.tasks[taskIdx],sub=task?.subtasks?.[subIdx];
  if(!sub) return;
  const next=safeStr(prompt('小任務內容：',sub.text)||'').trim();
  if(!next) return;
  const diffInput=safeStr(prompt('小任務難度（E / N / H）：',sub.difficulty||task.difficulty||'N')||'').toUpperCase();
  const nextDifficulty=['E','N','H'].includes(diffInput)?diffInput:(sub.difficulty||task.difficulty||'N');
  sub.text=next;
  sub.difficulty=nextDifficulty;
  saveData();renderLevelSystemPage();showToast('小任務已更新');
}
function deleteTaskSubtask(taskIdx,subIdx){
  const task=levelSystem.tasks[taskIdx],sub=task?.subtasks?.[subIdx];
  if(!sub) return;
  if(!confirm(`確定刪除小任務「${sub.text}」？`)) return;
  task.subtasks.splice(subIdx,1);
  saveData();renderLevelSystemPage();showToast('小任務已刪除');
}
function toggleSubtaskCompletion(taskIdx,subIdx,checked){
  const task=levelSystem.tasks[taskIdx],sub=task?.subtasks?.[subIdx];
  if(!task||!sub) return;
  if(!checked){
    if(!isSubtaskCompletedInCurrentCycle(task,sub)){renderLevelSystemPage();return;}
    const cycleKey=getTaskCycleKey(task,new Date());
    const reward=sub.lastReward;
    if(!reward||reward.cycleKey!==cycleKey){showToast('無法返還：缺少本週期紀錄');renderLevelSystemPage();return;}
    const skill=levelSystem.skills.find(s=>String(s.id)===String(reward.skillId));
    if(!skill){showToast('返還失敗：找不到技能');renderLevelSystemPage();return;}
    restoreSkill(skill,reward.skillPrev);
    sub.completions=Math.max(0,(sub.completions||0)-1);
    sub.lastCompletedAt='';
    sub.lastReward=null;
    refreshAchievementProgress();
    applyBrandTitle();
    saveData();renderLevelSystemPage();
    showToast(`已返還 ${reward.gain||0} EXP 與小任務進度`);
    return;
  }
  if(isSubtaskCompletedInCurrentCycle(task,sub)){showToast('此小任務在本週期已完成');renderLevelSystemPage();return;}
  const skill=getSelectedSkillForTaskIdx(taskIdx);
  if(!skill){showToast('請先新增技能並選擇');renderLevelSystemPage();return;}
  const diff=['E','N','H'].includes(sub.difficulty)?sub.difficulty:task.difficulty;
  const gain=getSubtaskXpGain(diff);
  sub.lastReward={cycleKey:getTaskCycleKey(task,new Date()),skillId:String(skill.id),skillPrev:snapshotSkill(skill),gain};
  gainSkillXp(skill,diff,gain);
  sub.completions=(sub.completions||0)+1;
  sub.lastCompletedAt=new Date().toISOString();
  refreshAchievementProgress();
  applyBrandTitle();
  saveData();renderLevelSystemPage();
  showToast(`小任務完成：+${gain} EXP → ${skill.name}`);
}

// ==================== 匯入/匯出 ====================
function exportData() {
  const json=JSON.stringify({notes,mapRelays,links,nid,lid,types,subjects,chapters,sections,nodeSizes,mapCenterNodeId,mapCenterNodeIds,mapCollapsed,mapSubpages,exported:new Date().toISOString()},null,2);
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
        if(!n.detail)n.detail='';if(!Array.isArray(n.todos))n.todos=[];
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
        mapRelays=Array.isArray(d.mapRelays)?d.mapRelays.map(r=>({...r,isRelay:true,type:'relay'})):[];
        nodeSizes=d.nodeSizes||{};mapCenterNodeId=d.mapCenterNodeId||null;mapCenterNodeIds=(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object')?d.mapCenterNodeIds:{};mapCollapsed=(d.mapCollapsed&&typeof d.mapCollapsed==='object')?d.mapCollapsed:{};
        mapSubpages=(d.mapSubpages&&typeof d.mapSubpages==='object')?d.mapSubpages:{};
        nid=d.nid||Math.max([...notes,...mapRelays].reduce((m,n)=>Math.max(m,n.id||0),0)+1,10);lid=d.lid||10;notes.sort((a,b)=>b.id-a.id);
        normalizeNoteIds(true);
        saveData();rebuildUI();render();showToast(`已覆蓋，共 ${notes.length} 筆筆記`);
      } else {
        // ★ 合併模式：同樣不覆蓋 types/subjects/chapters
        const existing=new Set(notes.map(n=>n.id));let added=0;
        let maxNoteId=[...notes,...mapRelays].reduce((m,x)=>Math.max(m,x.id||0),0);
        const importedIdMap={};
        d.notes.forEach(n=>{
          const oldId=Number(n.id);
          let nextId=oldId;
          if(existing.has(nextId)||!Number.isFinite(nextId)){
            nextId=Math.max(nid,maxNoteId+1);
          }
          existing.add(nextId);
          if(Number.isFinite(oldId)) importedIdMap[oldId]=nextId;
          if(nextId>maxNoteId) maxNoteId=nextId;
          notes.push({...n,id:nextId});
          added++;
          if(nextId>=nid) nid=nextId+1;
        });
        if(Array.isArray(d.mapRelays)){
          d.mapRelays.forEach(r=>{
            const oldId=Number(r.id);
            let nextId=oldId;
            if(existing.has(nextId)||!Number.isFinite(nextId)) nextId=Math.max(nid,maxNoteId+1);
            existing.add(nextId);
            if(Number.isFinite(oldId)) importedIdMap[oldId]=nextId;
            if(nextId>maxNoteId) maxNoteId=nextId;
            mapRelays.push({...r,id:nextId,isRelay:true,type:'relay'});
            if(nextId>=nid) nid=nextId+1;
          });
        }
        if(Array.isArray(d.links)){
          const edgeSet=new Set(links.map(l=>`${Math.min(l.from,l.to)}-${Math.max(l.from,l.to)}`));
          d.links.forEach(l=>{
            const from=importedIdMap[Number(l.from)],to=importedIdMap[Number(l.to)];
            if(!Number.isFinite(from)||!Number.isFinite(to)||from===to) return;
            const edgeKey=`${Math.min(from,to)}-${Math.max(from,to)}`;
            if(edgeSet.has(edgeKey)) return;
            links.push({id:lid++,from,to,rel:'關聯',color:LINK_COLOR});
            edgeSet.add(edgeKey);
          });
        }
        if(d.nodeSizes&&typeof d.nodeSizes==='object'){
          const remappedSizes={};
          Object.keys(d.nodeSizes).forEach(k=>{
            const nk=importedIdMap[Number(k)];
            if(nk!==undefined&&remappedSizes[nk]===undefined) remappedSizes[nk]=d.nodeSizes[k];
          });
          nodeSizes={...nodeSizes,...remappedSizes};
        }
        if(d.mapCenterNodeId&&importedIdMap[Number(d.mapCenterNodeId)]!==undefined) mapCenterNodeId=importedIdMap[Number(d.mapCenterNodeId)];
        if(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object'){
          const remappedCenters={};
          Object.keys(d.mapCenterNodeIds).forEach(k=>{
            const nk=importedIdMap[Number(d.mapCenterNodeIds[k])];
            if(nk!==undefined) remappedCenters[k]=nk;
          });
          mapCenterNodeIds={...mapCenterNodeIds,...remappedCenters};
        }
        if(d.mapCollapsed&&typeof d.mapCollapsed==='object'){
          const remappedCollapsed={};
          Object.keys(d.mapCollapsed).forEach(k=>{
            const nk=importedIdMap[Number(k)];
            if(nk!==undefined) remappedCollapsed[nk]=d.mapCollapsed[k];
          });
          mapCollapsed={...mapCollapsed,...remappedCollapsed};
        }
        if(d.mapSubpages&&typeof d.mapSubpages==='object'){
          const remappedSubpages={};
          Object.keys(d.mapSubpages).forEach(k=>{
            const parentId=importedIdMap[Number(k)];
            const arr=Array.isArray(d.mapSubpages[k])?d.mapSubpages[k]:[];
            if(parentId===undefined) return;
            remappedSubpages[parentId]=arr.map(v=>importedIdMap[Number(v)]).filter(Number.isFinite);
          });
          mapSubpages={...mapSubpages,...remappedSubpages};
        }
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
    close:()=>{if(g('scp').style.display==='block')closeShortcutMgr();else if(g('ap').classList.contains('open')){g('ap').classList.remove('open');syncSidePanelState();}else if(g('tp').classList.contains('open')){g('tp').classList.remove('open');syncSidePanelState();}else if(g('fp').classList.contains('open'))closeForm();else if(g('dp').classList.contains('open'))closeDetail();},
    edit:()=>{if(openId)openForm(true);},link:()=>{if(openId)openForm(true);},
    export:()=>manageArchives(),stats:()=>{if(!isMapOpen)openStats();},shortcuts:()=>openShortcutMgr()
  };
  if(map[id]) map[id]();
  showShortcutHint({new:'新增筆記',search:'搜尋',map:'開啟體系圖',back:'返回筆記列表',close:'關閉',edit:'編輯筆記',link:'新增關聯',export:'存檔管理',stats:'統計',shortcuts:'快捷鍵設定'}[id]);
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
  if(mapFilter.chapter==='none'){el.textContent='章：無章';return;}
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
  g('calendarView')?.classList.remove('open');
  g('levelSystemView')?.classList.remove('open');
  g('mapView').classList.toggle('open',open);
  g('subbar').style.display=open?'none':'flex';
  const advanced=g('filterAdvanced');
  if(advanced) advanced.style.display=open?'none':'block';
  if(open){
    mapPageStack=[];
    setMapAdvanced(false);
    if(cch!=='all') mapFilter.chapter=cch;
    else if(selectedChapters.length) mapFilter.chapter=selectedChapters[0];
    buildMapFilters();
    updateMapPinnedChapter();
    const mapSearch=g('mapSearchInput');if(mapSearch)mapSearch.value=mapFilter.q||'';
    g('zoomLabel').textContent=Math.round(mapScale*100)+'%';
    setMapLinkedOnlyBtnStyle();
    updateMapPagePath();
    setTimeout(()=>{const hadNodePos=Object.keys(nodePos).length>0;initNodePos();drawMap();if(!hadNodePos)saveData();},80);
  } else { mapPageStack=[];updateMapPagePath();closeLanePanel();closeMapPopup(); }
  saveLastViewState();
}

// ==================== 統計 ====================
function openStats() {
  openTagMgr();
  setTimeout(()=>g('tagStatsPanel')?.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
}

function toggleCalendarView(open){
  currentView=open?'calendar':'notes';
  g('notesView').style.display=open?'none':'block';
  g('mapView').classList.remove('open');
  g('levelSystemView').classList.remove('open');
  ['dp','fp','tp'].forEach(id=>g(id)?.classList.remove('open'));
  g('calendarView').classList.toggle('open',open);
  if(open) renderCalendar();
  saveLastViewState();
}
function toggleLevelSystemView(open){
  currentView=open?'level':'notes';
  isMapOpen=false;
  g('notesView').style.display=open?'none':'block';
  g('mapView').classList.remove('open');
  g('calendarView').classList.remove('open');
  ['dp','fp','tp'].forEach(id=>g(id)?.classList.remove('open'));
  g('levelSystemView').classList.toggle('open',open);
  g('subbar').style.display=open?'none':'flex';
  const advanced=g('filterAdvanced');
  if(advanced) advanced.style.display=open?'none':'block';
  if(open) renderLevelSystemPage();
  saveLastViewState();
}
function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  g('calendarTitle').textContent=`${y}年${m+1}月`;
  const grid=g('calendarGrid');
  const first=new Date(y,m,1), startOffset=(first.getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const prevDays=new Date(y,m,0).getDate();
  const todayKey=fmtDateKey(new Date());
  const list=[];
  for(let i=0;i<42;i++){
    let dayNum=0,cellDate=null,muted=false;
    if(i<startOffset){ dayNum=prevDays-startOffset+i+1; cellDate=new Date(y,m-1,dayNum); muted=true; }
    else if(i>=startOffset+days){ dayNum=i-(startOffset+days)+1; cellDate=new Date(y,m+1,dayNum); muted=true; }
    else { dayNum=i-startOffset+1; cellDate=new Date(y,m,dayNum); }
    const key=fmtDateKey(cellDate);
    const items=calendarEvents.filter(e=>e.date===key).slice(0,2);
    list.push(`<div class="calendar-cell ${muted?'muted':''} ${key===todayKey?'today':''}" data-date="${key}"><div class="calendar-day">${dayNum}</div>${items.map(ev=>`<span class="calendar-event-chip ${ev.type==='reminder'?'reminder':''}">${ev.type==='diary'?'📝':'⏰'} ${escapeHtml(ev.title||'未命名')}</span>`).join('')}</div>`);
  }
  grid.innerHTML=list.join('');
  grid.querySelectorAll('.calendar-cell').forEach(cell=>cell.addEventListener('click',()=>toggleCalendarDayDetail(cell.dataset.date)));
}
function toggleCalendarDayDetail(dateKey){
  activeCalendarDate=dateKey;
  const box=g('calendarDayDetail');
  if(!box) return;
  const entries=calendarEvents.filter(e=>e.date===dateKey);
  if(!entries.length){
    openCalendarEventModal(dateKey);
    return;
  }
  box.classList.add('open');
  box.innerHTML=`<div class="calendar-day-title">${dateKey}（${entries.length} 筆）</div>`+entries.map(ev=>`<div class="calendar-day-item"><div class="calendar-day-item-head"><span class="calendar-day-item-type">${ev.type==='diary'?'📝 日記':'⏰ 提醒（到期 '+dueTimeText(ev)+'）'}</span><div class="calendar-day-item-actions"><button data-eid="${ev.id}">編輯</button><button class="calendar-delete-btn" data-delete-eid="${ev.id}">刪除</button></div></div><div style="font-weight:700;margin-bottom:4px;">${escapeHtml(ev.title||'未命名')}</div><pre>${escapeHtml(ev.body||'（無內容）')}</pre></div>`).join('')+`<button class="tool-btn" id="calendarAddNewBtn">+ 新增</button>`;
  box.querySelectorAll('button[data-eid]').forEach(btn=>btn.addEventListener('click',()=>{
    const ev=calendarEvents.find(e=>String(e.id)===btn.dataset.eid);
    if(ev) openCalendarEventModal(dateKey,ev);
  }));
  box.querySelectorAll('button[data-delete-eid]').forEach(btn=>btn.addEventListener('click',()=>{
    const ev=calendarEvents.find(e=>String(e.id)===btn.dataset.deleteEid);
    if(ev) deleteCalendarEvent(ev.id);
  }));
  const addBtn=g('calendarAddNewBtn');
  if(addBtn) addBtn.addEventListener('click',()=>openCalendarEventModal(dateKey));
}
function openCalendarEventModal(dateKey, eventItem=null){
  activeCalendarDate=dateKey;
  editingCalendarEventId=eventItem?eventItem.id:null;
  g('calendarEventDateLabel').textContent=`日期：${dateKey}`;
  g('calendarEventType').value=eventItem?.type||'diary';
  g('calendarEventName').value=eventItem?.title||'';
  g('calendarEventBody').value=eventItem?.body||'';
  g('remindDays').value=eventItem?.remindBefore?.days??0;g('remindHours').value=eventItem?.remindBefore?.hours??0;g('remindMinutes').value=eventItem?.remindBefore?.minutes??10;
  g('dueHour').value=eventItem?.dueHour??9;g('dueMinute').value=eventItem?.dueMinute??0;
  g('remindPopup').checked=eventItem?.channels?.popup??true;g('remindEmail').checked=eventItem?.channels?.email??false;
  g('calendarEventDelete').style.display=eventItem?'inline-flex':'none';
  g('calendarReminderWrap').style.display=g('calendarEventType').value==='reminder'?'block':'none';
  g('calendarEventModal').classList.add('open');
}
function deleteCalendarEvent(eventId){
  const idx=calendarEvents.findIndex(e=>e.id===eventId);
  if(idx<0) return;
  const ev=calendarEvents[idx];
  if(!confirm(`確定刪除這筆${ev.type==='diary'?'日記':'提醒'}？`)) return;
  calendarEvents.splice(idx,1);
  saveData();rebuildUI();renderCalendar();
  const dayBox=g('calendarDayDetail');
  if(dayBox?.classList.contains('open')) toggleCalendarDayDetail(activeCalendarDate);
  g('calendarEventModal').classList.remove('open');
  editingCalendarEventId=null;
  showToast('已刪除日程');
}
function saveCalendarEvent(){
  const type=g('calendarEventType').value,title=(g('calendarEventName').value||'').trim(),body=(g('calendarEventBody').value||'').trim();
  if(!title){showToast('請輸入標題');return;}
  const ev={id:editingCalendarEventId||Date.now()+Math.random(),date:activeCalendarDate,type,title,body};
  if(type==='reminder'){
    ev.dueHour=Math.min(23,Math.max(0,parseInt(g('dueHour').value,10)||0));
    ev.dueMinute=Math.min(59,Math.max(0,parseInt(g('dueMinute').value,10)||0));
    ev.remindBefore={
      days:Math.max(0,parseInt(g('remindDays').value,10)||0),
      hours:Math.max(0,parseInt(g('remindHours').value,10)||0),
      minutes:Math.max(0,parseInt(g('remindMinutes').value,10)||0)
    };
    ev.channels={popup:!!g('remindPopup').checked,email:!!g('remindEmail').checked};
  }
  const idx=calendarEvents.findIndex(x=>x.id===ev.id);
  if(idx>=0) calendarEvents[idx]=ev;
  else calendarEvents.push(ev);
  if(type==='diary'&&idx<0){
    const d=activeCalendarDate;
    notes.unshift({id:nid++,type:'diary',subject:'',subjects:[],chapter:'',chapters:[],section:'',sections:[],title,body,detail:body,date:d,todos:[],extraFields:{}});
  }
  saveData();rebuildUI();renderCalendar();g('calendarEventModal').classList.remove('open');
  const dayBox=g('calendarDayDetail');if(dayBox?.classList.contains('open')) toggleCalendarDayDetail(activeCalendarDate);
  showToast(editingCalendarEventId?'已更新日程':'已新增日程');
  editingCalendarEventId=null;
}
async function sendReminderEmail(ev){
  const to=(calendarSettings.emails||[]).join(',');
  if(!to) return false;
  const token=safeStr(calendarSettings.smtpToken||'').trim();
  const from=safeStr(calendarSettings.emailFrom||'').trim();
  const title=`KLaws 提醒：${ev.title}`;
  const content=`提醒事項：${ev.title}\n到期日：${ev.date} ${dueTimeText(ev)}\n內容：${ev.body||''}`;
  if(token&&from&&window.Email&&window.Email.send){
    try{
      await window.Email.send({SecureToken:token,To:to,From:from,Subject:title,Body:content.replace(/\n/g,'<br>')});
      return true;
    }catch(e){console.warn('smtp send fail',e);}
  }
  try{
    window.location.href=`mailto:${to}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(content)}`;
    return true;
  }catch(e){
    return false;
  }
}
function checkReminders(){
  const now=Date.now();
  calendarEvents.filter(e=>e.type==='reminder').forEach(async e=>{
    const due=new Date(`${e.date}T${pad2(e.dueHour||9)}:${pad2(e.dueMinute||0)}:00`).getTime();
    const before=e.remindBefore||{days:0,hours:0,minutes:0};
    const remindAt=due-(before.days*86400000+before.hours*3600000+before.minutes*60000);
    if(now<remindAt||reminderSent[e.id]||reminderDismissed[e.id]) return;
    const channels=e.channels||{};
    if(channels.popup!==false){
      const pop=g('reminderPopup');
      pop.innerHTML=`<button id="reminderCloseBtn">✕</button><div style="font-weight:700;margin-bottom:10px;">提醒：${escapeHtml(e.title)}</div><div style="font-size:.45em;color:#d1d5db;">到期 ${e.date} ${dueTimeText(e)}</div><div style="font-size:.5em;margin-top:8px;">${escapeHtml(e.body||'')}</div>`;
      pop.classList.add('open');
      g('reminderCloseBtn').onclick=()=>{
        pop.classList.remove('open');
        reminderDismissed[e.id]=true;
        localStorage.setItem('klaws_reminder_dismissed_v1',JSON.stringify(reminderDismissed));
      };
    }
    if(channels.email&&calendarSettings.emails.length){
      const ok=await sendReminderEmail(e);
      if(!ok) showToast('Email 提醒寄送失敗，已改用 mailto');
    }
    reminderSent[e.id]=true;
  });
}

// ==================== 多選 ====================
function enterMultiSel() {
  if(linkModeActive) setLinkMode(false);
  multiSelMode=true;selectedIds={};
  g('selectBar').classList.add('open');
  ['dp','fp','ap'].forEach(p=>g(p).classList.remove('open'));
  syncSidePanelState();
  updateSelBar();
  render();
}
function exitMultiSel() { multiSelMode=false;selectedIds={};g('selectBar').classList.remove('open');render(); }
function updateSelBar() { const cnt=Object.keys(selectedIds).length;g('selectCount').textContent=`已選 ${cnt} 筆`;g('selDeleteBtn').disabled=cnt===0;g('selDeleteBtn').style.opacity=cnt===0?'0.4':'1'; }
function toggleCardSelect(id) { selectedIds[id]?delete selectedIds[id]:selectedIds[id]=true;updateSelBar();const c=g('grid').querySelector(`.card[data-id="${id}"]`);if(c){if(selectedIds[id]){c.classList.add('selected');c.querySelector('.sel-check').textContent='✓';}else{c.classList.remove('selected');c.querySelector('.sel-check').textContent='';}} }
function selectAll() {
  const cards=[...g('grid').querySelectorAll('.card')];
  const cardIds=cards.map(c=>parseInt(c.dataset.id));
  const allCurrentPageSelected=cardIds.length>0&&cardIds.every(id=>selectedIds[id]);
  if(allCurrentPageSelected) cardIds.forEach(id=>delete selectedIds[id]);
  else cardIds.forEach(id=>{selectedIds[id]=true;});
  updateSelBar();
  render();
}
async function copySelectedNotes(){
  const ids=Object.keys(selectedIds).map(Number).filter(id=>selectedIds[id]);
  if(!ids.length){showToast('請先選擇筆記');return;}
  const text=ids.map(id=>{
    const n=noteById(id);
    return n?`${n.title}\n${n.body||''}\n${n.detail||''}`:'';
  }).filter(Boolean).join('\n\n----------------\n\n');
  try{
    await navigator.clipboard.writeText(text);
    showToast(`已複製 ${ids.length} 筆`);
  }catch(e){showToast('複製失敗');}
}
function deleteSelected() {
  const ids=Object.keys(selectedIds);
  if(!ids.length) return;
  if(!confirm(`確定刪除這 ${ids.length} 筆筆記？可到回收區復原（保留 7 天）。`)) return;
  const removed=removeNotesToRecycle(ids.map(Number));
  const recycleId=recycleBin[0]?.id;
  saveData();
  renderArchivePanel();
  exitMultiSel();
  showActionToast(`已移至回收區 ${removed} 筆`,recycleId?()=>restoreRecycleItem(recycleId):null);
}
function bindCardInteractions(card,id){
  const checkBtn=card.querySelector('.sel-check');
  card.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    const action=btn.dataset.action;
    if(action==='duplicate') duplicateNote(id);
    else if(action==='copy') copyNoteToClipboard(id);
    else if(action==='delete') deleteNote(id);
  }));
  let pressTimer=null;
  let longPressed=false;
  let startX=0,startY=0,trackingSwipe=false;
  const closeRadialMenu=()=>touchRadialMenu?.classList.remove('open');
  const openRadialMenu=(x,y)=>{
    if(!('ontouchstart' in window)) return;
    if(!touchRadialMenu){
      touchRadialMenu=document.createElement('div');
      touchRadialMenu.className='touch-radial-menu';
      touchRadialMenu.innerHTML='<button data-radial="edit">✏️ 編輯</button><button data-radial="copy">📋 複製</button><button data-radial="duplicate">📄 副本</button><button data-radial="delete">🗑️ 刪除</button><button data-radial="select">☑️ 多選</button>';
      document.body.appendChild(touchRadialMenu);
      touchRadialMenu.querySelectorAll('[data-radial]').forEach(btn=>btn.addEventListener('click',()=>{
        const action=btn.dataset.radial;
        if(action==='edit'){openId=id;openForm(true);}
        if(action==='copy') copyNoteToClipboard(id);
        if(action==='duplicate') duplicateNote(id);
        if(action==='delete') deleteNote(id);
        if(action==='select'){enterMultiSel();selectedIds[id]=true;updateSelBar();render();}
        closeRadialMenu();
      }));
      document.addEventListener('click',closeRadialMenu,{passive:true});
    }
    touchRadialMenu.style.left=`${Math.max(8,Math.min(window.innerWidth-220,x-100))}px`;
    touchRadialMenu.style.top=`${Math.max(8,y-56)}px`;
    touchRadialMenu.classList.add('open');
  };
  const clearPress=()=>{ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} };
  const triggerLongPress=()=>{
    if(multiSelMode) return;
    longPressed=true;
    openRadialMenu(startX||window.innerWidth/2,startY||120);
  };
  card.addEventListener('mousedown',()=>{longPressed=false;clearPress();pressTimer=setTimeout(triggerLongPress,450);});
  card.addEventListener('touchstart',e=>{
    const t=e.touches&&e.touches[0];
    if(t){startX=t.clientX;startY=t.clientY;trackingSwipe=true;}
    longPressed=false;clearPress();pressTimer=setTimeout(triggerLongPress,420);
  },{passive:true});
  card.addEventListener('touchmove',e=>{
    if(!trackingSwipe) return;
    const t=e.touches&&e.touches[0];if(!t) return;
    const dx=t.clientX-startX,dy=t.clientY-startY;
    if(Math.abs(dy)>26){trackingSwipe=false;card.classList.remove('swipe-left','swipe-right');return;}
    if(Math.abs(dx)>16){
      clearPress();
      card.classList.toggle('swipe-left',dx<-26);
      card.classList.toggle('swipe-right',dx>26);
    }
  },{passive:true});
  card.addEventListener('mouseup',clearPress);
  card.addEventListener('mouseleave',clearPress);
  card.addEventListener('touchend',e=>{
    clearPress();
    const changed=e.changedTouches&&e.changedTouches[0];
    const dx=changed?changed.clientX-startX:0;
    if(card.classList.contains('swipe-left')&&dx<-72){card.classList.remove('swipe-left');card.dataset.touchActionTaken='1';deleteNote(id);return;}
    if(card.classList.contains('swipe-right')&&dx>72){card.classList.remove('swipe-right');card.dataset.touchActionTaken='1';duplicateNote(id);return;}
    card.classList.remove('swipe-left','swipe-right');
    trackingSwipe=false;
  },{passive:true});
  card.addEventListener('touchcancel',clearPress,{passive:true});
  if(checkBtn){
    const stopCardEvent=(e)=>{e.stopPropagation();};
    checkBtn.addEventListener('mousedown',stopCardEvent);
    checkBtn.addEventListener('touchstart',stopCardEvent,{passive:true});
    checkBtn.addEventListener('click',e=>{
      e.stopPropagation();
      if(!multiSelMode) return;
      toggleCardSelect(id);
    });
  }
  card.addEventListener('click',()=>{
    if(card.dataset.touchActionTaken==='1'){card.dataset.touchActionTaken='0';return;}
    if(longPressed) return;
    if(linkModeActive){handleLinkModeCardTap(id);return;}
    const now=Date.now();
    if(('ontouchstart' in window)&&lastCardTap.id===id&&(now-lastCardTap.time)<360){
      openId=id;
      openForm(true);
      lastCardTap={id:0,time:0};
      return;
    }
    if('ontouchstart' in window){
      openId=id;
      openNote(id);
      lastCardTap={id,time:now};
      return;
    }
    openId=id;
    openForm(true);
  });
}

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
function clampNodeToCanvas(id){
  if(!nodePos[id])return;
  const box=getMapCardBox(id);
  const pad=12,halfW=box.width/2+pad,halfH=box.height/2+pad;
  nodePos[id].x=Math.max(halfW,Math.min(mapW-halfW,nodePos[id].x));
  nodePos[id].y=Math.max(halfH,Math.min(mapH-halfH,nodePos[id].y));
}
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
const chapterIndexMap = () => {
  const map={};
  chapters.forEach((ch,idx)=>{ if(ch&&ch.key) map[ch.key]=idx; });
  return map;
};
const sectionIndexMap = () => {
  const map={};
  sections.forEach((sec,idx)=>{ if(sec&&sec.key) map[sec.key]=idx; });
  return map;
};
const nodePreferredRank = (nodeId,chIdxMap,secIdxMap) => {
  const note=mapNodeById(nodeId)||{};
  const chIdxs=noteChapters(note).map(key=>chIdxMap[key]).filter(idx=>Number.isFinite(idx));
  const secIdxs=noteSections(note).map(key=>secIdxMap[key]).filter(idx=>Number.isFinite(idx));
  const minChIdx=chIdxs.length?Math.min(...chIdxs):9999;
  const minSecIdx=secIdxs.length?Math.min(...secIdxs):9999;
  const title=safeStr(note.title).trim();
  return {minChIdx,minSecIdx,title,nodeId};
};
function forceLayout() {
  const canvas=g('mapCanvas');mapW=canvas.offsetWidth||800;mapH=canvas.offsetHeight||600;
  const layoutNotes=visibleNotes(),visIds={};layoutNotes.forEach(n=>visIds[n.id]=true);
  const visLinks=visibleLinks(visIds),n2=layoutNotes.length;if(!n2)return;
  const scopedCenterId=getMapCenterFromScopes();
  const hasStoredCenter=!!scopedCenterId&&!!mapNodeById(scopedCenterId);
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
  const LANE_CARD_GAP_Y=34,TOP_PAD=72,BOT_PAD=40;
  const laneLeft=Math.max(80,mapW*.1),laneRight=Math.min(mapW-80,mapW*.9);
  const laneGapX=laneCount>1?(laneRight-laneLeft)/(laneCount-1):0;
  const chIdxMap=chapterIndexMap(),secIdxMap=sectionIndexMap();
  const adj={};layoutNotes.forEach(n=>adj[n.id]=[]);visLinks.forEach(lk=>{if(adj[lk.from])adj[lk.from].push(lk.to);if(adj[lk.to])adj[lk.to].push(lk.from);});
  const layers={},visited=new Set(),queue=[layoutCenterNodeId];layers[layoutCenterNodeId]=0;visited.add(layoutCenterNodeId);
  while(queue.length){const current=queue.shift(),cl=layers[current];(adj[current]||[]).forEach(neighbor=>{if(!visited.has(neighbor)){visited.add(neighbor);layers[neighbor]=cl+1;queue.push(neighbor);}});}
  const connectedMaxLayer=Object.values(layers).reduce((m,v)=>Math.max(m,v),0);
  layoutNotes.forEach(n=>{if(!visited.has(n.id))layers[n.id]=connectedMaxLayer+1;});
  const laneGroups={};Object.keys(layers).forEach(nodeId=>{const lane=Math.max(0,Math.min(laneCount-1,layers[nodeId]||0));if(!laneGroups[lane])laneGroups[lane]=[];laneGroups[lane].push(parseInt(nodeId,10));});
  const byPreferredRank=(a,b)=>{
    const ra=nodePreferredRank(a,chIdxMap,secIdxMap),rb=nodePreferredRank(b,chIdxMap,secIdxMap);
    return ra.minChIdx-rb.minChIdx||ra.minSecIdx-rb.minSecIdx||ra.title.localeCompare(rb.title,'zh')||ra.nodeId-rb.nodeId;
  };
  const laneOrder={};Object.keys(laneGroups).forEach(lane=>{laneOrder[lane]=laneGroups[lane].slice().sort((a,b)=>byPreferredRank(a,b)||(adj[b]||[]).length-(adj[a]||[]).length||a-b);});
  for(let pass=0;pass<6;pass++){
    for(let lane=1;lane<laneCount;lane++){
      const arr=laneOrder[lane]||[],prev=laneOrder[lane-1]||[],prevIdx={};prev.forEach((id,idx)=>prevIdx[id]=idx);
      arr.sort((a,b)=>{
        const an=(adj[a]||[]).map(id=>prevIdx[id]).filter(v=>v!==undefined);
        const bn=(adj[b]||[]).map(id=>prevIdx[id]).filter(v=>v!==undefined);
        const am=an.length?an.reduce((s,v)=>s+v,0)/an.length:9999,bm=bn.length?bn.reduce((s,v)=>s+v,0)/bn.length:9999;
        return am-bm||byPreferredRank(a,b)||a-b;
      });
    }
  }
  mapNodeMeta={};
  for(let lane=0;lane<laneCount;lane++){
    const arr=laneOrder[lane]||[],x=laneLeft+lane*laneGapX;
    const usableHeight=Math.max(120,mapH-TOP_PAD-BOT_PAD);
    const boxes=arr.map(nodeId=>getMapCardBox(nodeId));
    const totalCardsHeight=boxes.reduce((sum,box)=>sum+box.height,0);
    const totalGap=Math.max(0,(arr.length-1)*LANE_CARD_GAP_Y);
    const requiredHeight=totalCardsHeight+totalGap;
    let yCursor=TOP_PAD+(requiredHeight<usableHeight?(usableHeight-requiredHeight)/2:0);
    arr.forEach((nodeId,idx)=>{
      const cardH=boxes[idx].height;
      const y=yCursor+cardH/2;
      nodePos[nodeId]={x,y};
      mapNodeMeta[nodeId]={lane,order:idx};
      clampNodeToCanvas(nodeId);
      yCursor+=cardH+LANE_CARD_GAP_Y;
    });
  }
  saveDataDeferred();
}
function visibleLinks(visIds){ return links.filter(lk=>visIds[lk.from]&&visIds[lk.to]); }
function getDescendantIds(rootId,limitIds=null){
  const seen=new Set([rootId]),queue=[rootId];
  while(queue.length){
    const current=queue.shift();
    links.forEach(lk=>{
      if(lk.from!==current) return;
      if(limitIds&& !limitIds[lk.to]) return;
      if(seen.has(lk.to)) return;
      seen.add(lk.to);queue.push(lk.to);
    });
  }
  return seen;
}
function updateMapPagePath(){
  const el=g('mapPagePath'); if(!el) return;
  if(!mapPageStack.length){el.textContent='主頁';return;}
  const labels=mapPageStack.map(id=>mapNodeById(id)?.title||`節點#${id}`);
  el.textContent=`主頁 / ${labels.join(' / ')}`;
}
function enterMapSubpage(rootId){
  if(!mapNodeById(rootId)) return;
  if(mapPageStack[mapPageStack.length-1]===rootId) return;
  mapPageStack.push(rootId);
  setMapCenterForCurrentScope(rootId);
  nodePos={};
  updateMapPagePath();
  forceLayout();
  drawMap();
  saveDataDeferred();
  saveLastViewState();
}
function leaveMapSubpage(){
  if(!mapPageStack.length) return false;
  mapPageStack.pop();
  nodePos={};
  updateMapPagePath();
  forceLayout();
  drawMap();
  saveDataDeferred();
  saveLastViewState();
  return true;
}
function removeRootFromPageStack(rootId){
  const idx=mapPageStack.indexOf(rootId);
  if(idx===-1) return false;
  mapPageStack=mapPageStack.slice(0,idx);
  return true;
}
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
  const fromBox=getMapCardBox(lk.from),toBox=getMapCardBox(lk.to);
  const rf=Math.max(fromBox.width,fromBox.height)*0.32;
  const rt=Math.max(toBox.width,toBox.height)*0.32;
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
  const card=grp.querySelector('rect.node-card');
  const info=getMapCardBox(id);
  const halfW=info.width/2,halfH=info.height/2;
  if(card){card.setAttribute('x',String(x-halfW));card.setAttribute('y',String(y-halfH));}
  const cardBody=grp.querySelector('foreignObject.node-card-body');
  if(cardBody){cardBody.setAttribute('x',String(x-halfW));cardBody.setAttribute('y',String(y-halfH));cardBody.setAttribute('width',String(info.width));cardBody.setAttribute('height',String(info.height));}
  const foldBtn=grp.querySelector('circle.node-fold-btn');
  if(foldBtn){
    const foldBtnR=parseFloat(foldBtn.getAttribute('r')||'9')||9;
    foldBtn.setAttribute('cx',String(x+halfW-foldBtnR-5));
    foldBtn.setAttribute('cy',String(y-halfH+foldBtnR+5));
  }
  const foldSign=grp.querySelector('text.node-fold-sign');
  if(foldSign&&foldBtn){
    const cx=parseFloat(foldBtn.getAttribute('cx')||String(x+halfW-12))||x+halfW-12;
    const cy=parseFloat(foldBtn.getAttribute('cy')||String(y-halfH+12))||y-halfH+12;
    foldSign.setAttribute('x',String(cx));foldSign.setAttribute('y',String(cy+1));
  }
  const subEnterBtn=grp.querySelector('circle.node-sub-enter-btn');
  const subEnterSign=grp.querySelector('text.node-sub-enter-sign');
  if(subEnterBtn){
    const subEnterBtnR=parseFloat(subEnterBtn.getAttribute('r')||'9')||9;
    const subEnterX=x-halfW+subEnterBtnR+6;
    const subEnterY=y+halfH-subEnterBtnR-6;
    subEnterBtn.setAttribute('cx',String(subEnterX));
    subEnterBtn.setAttribute('cy',String(subEnterY));
    if(subEnterSign){
      subEnterSign.setAttribute('x',String(subEnterX));
      subEnterSign.setAttribute('y',String(subEnterY+1));
    }
  }
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
  const baseFiltered=notes.filter(n=>{
    const subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
    const chapterMatch=mapFilter.chapter==='all'?true:(mapFilter.chapter==='none'?!chs.length:chs.includes(mapFilter.chapter));
    const sectionMatch=mapFilter.section==='all'?true:(mapFilter.section==='none'?!secs.length:secs.includes(mapFilter.section));
    return (mapFilter.sub==='all'||subs.includes(mapFilter.sub))
      &&chapterMatch
      &&sectionMatch
      &&(!q||`${n.title}${subs.join('')}${chs.join('')}${secs.join('')}${noteTags(n).join('')}`.toLowerCase().includes(q));
  });
  const relayFiltered=mapRelays.filter(n=>{
    const subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
    const chapterMatch=mapFilter.chapter==='all'?true:(mapFilter.chapter==='none'?!chs.length:chs.includes(mapFilter.chapter));
    const sectionMatch=mapFilter.section==='all'?true:(mapFilter.section==='none'?!secs.length:secs.includes(mapFilter.section));
    return (mapFilter.sub==='all'||subs.includes(mapFilter.sub))
      &&chapterMatch
      &&sectionMatch
      &&relayMatchesSearch(n,q);
  });
  const shouldExpandLinked=scopeLinkedEnabled&&mapHasTaxonomyFilter();
  let filtered=baseFiltered, relayVisible=relayFiltered;
  if(shouldExpandLinked){
    const expandedIds=expandWithChildLinkedNotes(new Set([...baseFiltered,...relayFiltered].map(n=>n.id)));
    filtered=notes.filter(n=>expandedIds.has(n.id)&&noteMatchesSearch(n,q));
    relayVisible=mapRelays.filter(n=>expandedIds.has(n.id)&&relayMatchesSearch(n,q));
  }
  let base=[...filtered,...relayVisible].filter(n=>!mapLinkedOnly||linkedIds[n.id]);
  if(isInMapSubpage()){
    const rootId=currentSubpageRootId();
    const allowed=getDescendantIds(rootId);
    base=base.filter(n=>allowed.has(n.id));
  }else{
    const baseIds0={};base.forEach(n=>baseIds0[n.id]=true);
    Object.keys(mapSubpages||{}).forEach(key=>{
      const [ctx,nidRaw]=key.split('::').slice(-2);
      const ctxKey=key.slice(0,key.lastIndexOf('::'));
      const nid=parseInt(nidRaw,10);
      if(ctxKey!==mapSubpageContextKey()||!baseIds0[nid]) return;
      const hidden=getDescendantIds(nid,baseIds0);
      hidden.delete(nid);
      base=base.filter(item=>!hidden.has(item.id));
    });
  }
  if(mapLinkedOnly&&!base.length&&filtered.length){
    mapLinkedOnly=false;setMapLinkedOnlyBtnStyle();
    showToast('目前沒有關聯節點，已自動顯示全部節點');saveDataDeferred();base=filtered;
  }
  const baseIds={};base.forEach(n=>baseIds[n.id]=true);
  if(base.length){
    const collapsedNodes=getCollapsedNodesForCurrentContext();
    const hiddenByCollapse={},stack=[];
    Object.keys(collapsedNodes).forEach(key=>{
      const id=parseInt(key,10);
      if(collapsedNodes[id]&&baseIds[id]) stack.push(id);
    });
    while(stack.length){
      const current=stack.pop();
      links.forEach(lk=>{
        if(lk.from!==current||!baseIds[lk.to]||hiddenByCollapse[lk.to]||collapsedNodes[lk.to]) return;
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
function createMapRelay(){
  const title=prompt('中繼站名稱：','新中繼站');
  if(title===null) return;
  const name=title.trim();
  if(!name){showToast('中繼站名稱不能空白');return;}
  const subpageRootId=currentSubpageRootId();
  const subpageRoot=subpageRootId?mapNodeById(subpageRootId):null;
  const defaultSubjects=subpageRoot?noteSubjects(subpageRoot):(mapFilter.sub==='all'?[]:[mapFilter.sub]);
  const defaultChapters=subpageRoot?noteChapters(subpageRoot):((mapFilter.chapter==='all'||mapFilter.chapter==='none')?[]:[mapFilter.chapter]);
  const defaultSections=subpageRoot?noteSections(subpageRoot):((mapFilter.section==='all'||mapFilter.section==='none')?[]:[mapFilter.section]);
  const relay={
    id:nid++,
    type:'relay',
    isRelay:true,
    title:name,
    body:'',
    subject:defaultSubjects[0]||'',
    subjects:defaultSubjects,
    chapter:defaultChapters[0]||'',
    chapters:defaultChapters,
    section:defaultSections[0]||'',
    sections:defaultSections
  };
  mapRelays.push(relay);
  saveData();
  if(isMapOpen){
    if(!nodePos[relay.id]){
      if(subpageRootId&&nodePos[subpageRootId]) nodePos[relay.id]={x:nodePos[subpageRootId].x+120,y:nodePos[subpageRootId].y+70};
      else nodePos[relay.id]={x:mapW/2,y:mapH/2};
    }
    scheduleMapRedraw(30);
  }
  showToast(subpageRootId?'已新增中繼站（已放入目前子頁面）':'已新增中繼站');
}
function switchMapNodeType(id){
  const relay=relayById(id);
  if(relay){
    const nextType=(safeStr(relay.noteTypeBackup)&&types.some(t=>t.key===relay.noteTypeBackup))?relay.noteTypeBackup:(types[0]?.key||'article');
    const note=normalizeNoteSchema({...relay,isRelay:false,type:nextType});
    mapRelays=mapRelays.filter(r=>r.id!==id);
    notes.unshift(note);
    openId=note.id;
    closeMapPopup();
    saveData();
    render();
    if(isMapOpen) scheduleMapRedraw(0);
    showToast('已切換為筆記');
    return;
  }
  const note=noteById(id);
  if(!note) return;
  const relayData={...note,isRelay:true,type:'relay',noteTypeBackup:safeStr(note.type)||'article'};
  notes=notes.filter(n=>n.id!==id);
  mapRelays.push(relayData);
  if(openId===id){
    openId=null;
    g('dp')?.classList.remove('open');
    syncSidePanelState();
  }
  closeMapPopup();
  saveData();
  render();
  if(isMapOpen) scheduleMapRedraw(0);
  showToast('已切換為中繼站');
}
function editMapRelay(id){
  const relay=relayById(id);
  if(!relay) return;
  const title=prompt('編輯中繼站名稱：',relay.title||'');
  if(title===null) return;
  const name=title.trim();
  if(!name){showToast('中繼站名稱不能空白');return;}
  relay.title=name;
  saveData();
  if(isMapOpen) scheduleMapRedraw(0);
  showToast('中繼站已更新');
}
function deleteMapRelay(id){
  const relay=relayById(id);
  if(!relay) return;
  if(!confirm(`確定刪除中繼站「${relay.title||'未命名'}」？`)) return;
  if(mapLinkSourceId===id) mapLinkSourceId=null;
  mapRelays=mapRelays.filter(r=>r.id!==id);
  links=links.filter(l=>l.from!==id&&l.to!==id);
  delete nodePos[id];
  delete nodeSizes[id];
  closeMapPopup();
  saveData();
  if(isMapOpen) scheduleMapRedraw(0);
  showToast('已刪除中繼站');
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
    path.setAttribute('d',pathData.d);path.setAttribute('stroke',LINK_COLOR);path.setAttribute('stroke-width','1.35');path.setAttribute('fill','none');path.setAttribute('marker-end','url(#arrowBlue)');path.style.opacity='0.3';linksLayer.appendChild(path);linkElsMap[lk.id]={p:path};
  });
  visNotes.forEach(n=>{
    const pos=nodePos[n.id];if(!pos)return;
    const type=isRelayNode(n)?{label:'中繼站',color:'#A855F7'}:typeByKey(n.type),box=getMapCardBox(n.id),halfW=box.width/2,halfH=box.height/2;
    const grp=document.createElementNS('http://www.w3.org/2000/svg','g');grp.classList.add('map-node');grp.dataset.id=String(n.id);
    if(mapLinkSourceId===n.id) grp.classList.add('map-link-source');
    const card=document.createElementNS('http://www.w3.org/2000/svg','rect');
    card.classList.add('node-card');
    card.setAttribute('x',String(pos.x-halfW));card.setAttribute('y',String(pos.y-halfH));
    card.setAttribute('rx','12');card.setAttribute('ry','12');
    card.setAttribute('width',String(box.width));card.setAttribute('height',String(box.height));
    card.setAttribute('fill','#ffffff');card.setAttribute('stroke',type.color);card.setAttribute('stroke-width','1.8');
    const cardBody=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
    cardBody.classList.add('node-card-body');
    cardBody.setAttribute('x',String(pos.x-halfW));cardBody.setAttribute('y',String(pos.y-halfH));
    cardBody.setAttribute('width',String(box.width));cardBody.setAttribute('height',String(box.height));
    cardBody.style.pointerEvents='none';
    const previewHtml=renderMapCardPreview(n);
    const markedTitle=`${mapTitleMarkers(n.id)}${n.title||'（未命名）'}`;
    cardBody.innerHTML=`<div xmlns="http://www.w3.org/1999/xhtml" class="map-card-inner">
      <div class="map-card-head"><span class="map-card-type" style="background:${lightC(type.color)};color:${darkC(type.color)}">${type.label}</span><span class="map-card-title">${escapeHtml(markedTitle)}</span></div>
      ${previewHtml}
    </div>`;
    const hasChildren=links.some(l=>l.from===n.id&&mapNodeById(l.to));
    grp.appendChild(card);grp.appendChild(cardBody);
    if(hasChildren){
      const foldBtnR=9;
      const foldX=pos.x+halfW-foldBtnR-5,foldY=pos.y-halfH+foldBtnR+5;
      const foldBtn=document.createElementNS('http://www.w3.org/2000/svg','circle');
      foldBtn.classList.add('node-fold-btn');
      foldBtn.setAttribute('cx',String(foldX));foldBtn.setAttribute('cy',String(foldY));foldBtn.setAttribute('r',String(foldBtnR));
      foldBtn.setAttribute('fill','#ffffff');foldBtn.setAttribute('stroke',type.color);foldBtn.setAttribute('stroke-width','1.5');
      foldBtn.style.cursor='pointer';
      const foldSign=document.createElementNS('http://www.w3.org/2000/svg','text');
      foldSign.classList.add('node-fold-sign');
      foldSign.setAttribute('x',String(foldX));foldSign.setAttribute('y',String(foldY+1));
      foldSign.setAttribute('text-anchor','middle');foldSign.setAttribute('dominant-baseline','middle');
      foldSign.setAttribute('font-size','14');
      foldSign.setAttribute('font-weight','700');foldSign.setAttribute('fill',type.color);
      foldSign.style.cursor='pointer';
      foldSign.textContent=isMapNodeCollapsed(n.id)?'+':'−';
      const toggleFold=e=>{e.stopPropagation();toggleMapFold(n.id);};
      foldBtn.addEventListener('click',toggleFold);
      foldSign.addEventListener('click',toggleFold);
      grp.appendChild(foldBtn);grp.appendChild(foldSign);
    }
    const hasSubpage=hasSubpageForNode(n.id);
    if(hasSubpage&&isNodeInCurrentSubpage(n.id)){
      const subEnterBtnR=9;
      const subEnterX=pos.x-halfW+subEnterBtnR+6;
      const subEnterY=pos.y+halfH-subEnterBtnR-6;
      const subEnterBtn=document.createElementNS('http://www.w3.org/2000/svg','circle');
      subEnterBtn.classList.add('node-sub-enter-btn');
      subEnterBtn.setAttribute('cx',String(subEnterX));subEnterBtn.setAttribute('cy',String(subEnterY));subEnterBtn.setAttribute('r',String(subEnterBtnR));
      subEnterBtn.setAttribute('fill','#ffffff');subEnterBtn.setAttribute('stroke',type.color);subEnterBtn.setAttribute('stroke-width','1.5');
      subEnterBtn.style.cursor='pointer';
      const subEnterSign=document.createElementNS('http://www.w3.org/2000/svg','text');
      subEnterSign.classList.add('node-sub-enter-sign');
      subEnterSign.setAttribute('x',String(subEnterX));subEnterSign.setAttribute('y',String(subEnterY+1));
      subEnterSign.setAttribute('text-anchor','middle');subEnterSign.setAttribute('dominant-baseline','middle');
      subEnterSign.setAttribute('font-size','13');
      subEnterSign.setAttribute('font-weight','700');subEnterSign.setAttribute('fill',type.color);
      subEnterSign.style.cursor='pointer';
      subEnterSign.textContent='↙';
      const enterSubpage=e=>{e.stopPropagation();closeMapPopup();enterMapSubpage(n.id);};
      subEnterBtn.addEventListener('click',enterSubpage);
      subEnterSign.addEventListener('click',enterSubpage);
      grp.appendChild(subEnterBtn);grp.appendChild(subEnterSign);
    }
    grp.addEventListener('click',e=>{
      e.stopPropagation();
      if(handleMapNodeLinkTap(n.id)) return;
      if(!isRelayNode(n)){
        openId=n.id;
        openForm(true);
        closeMapPopup();
        return;
      }
      showMapInfo(n.id);openMapPopup(n.id);highlightNode(n.id);
    });
    grp.addEventListener('mousedown',e=>startDrag(e,n.id));grp.addEventListener('touchstart',e=>startDragTouch(e,n.id),{passive:true});
    nodesLayer.appendChild(grp);nodeEls[n.id]=grp;
  });
  applyFocusStyles();
}
function toggleMapFold(id){
  const key=mapCollapseKey(id);
  if(mapCollapsed[key]) delete mapCollapsed[key];
  else mapCollapsed[key]=true;
  closeMapPopup();
  drawMap();
  saveDataDeferred();
}
function openMapPopup(id){
  const popup=g('mapPopup'),pos=nodePos[id];if(!popup||!pos)return;
  const maxLeft=Math.max(8,mapW-320),maxTop=Math.max(8,mapH-250);
  const left=Math.max(8,Math.min(maxLeft,pos.x*mapScale+mapOffX+14)),top=Math.max(8,Math.min(maxTop,pos.y*mapScale+mapOffY+14));
  popup.style.left=`${left}px`;popup.style.top=`${top}px`;popup.classList.add('open');
  const goBtn=g('mpGoto');
  const node=mapNodeById(id);
  if(goBtn){
    if(isRelayNode(node)){
      goBtn.style.display='none';
    }else{
      goBtn.style.display='block';
      goBtn.onclick=()=>{openNote(id);closeMapPopup();};
    }
  }
}
function showMapInfo(id){
  const n=mapNodeById(id);if(!n)return;
  const relay=isRelayNode(n);
  const tp=relay?{label:'中繼站',color:'#A855F7'}:typeByKey(n.type),sb=subByKey(n.subject),related=links.filter(l=>l.from===id||l.to===id);
  const quickWrap=g('mp-link-quick-wrap');
  const quickInput=g('mp-link-search');
  const switchBtn=g('mpSwitch');
  g('mpBadge').textContent=tp.label;g('mpBadge').style.background=tp.color;g('mpTitle').textContent=n.title;
  g('mpSubject').textContent=sb.label;g('mpSubject').style.background=sb.color+'22';g('mpSubject').style.color=sb.color;
  if(switchBtn){
    switchBtn.textContent='切換';
    switchBtn.title=relay?'切換為筆記':'切換為中繼站';
    switchBtn.onclick=()=>switchMapNodeType(id);
  }
  if(quickWrap){
    quickWrap.style.display=relay?'flex':'none';
    if(quickInput){
      quickInput.value='';
      quickInput.dataset.sourceId=relay?String(id):'';
    }
    renderMapPopupQuickLinkSearch(relay?id:null);
  }
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
  const hasSubpage=hasSubpageForNode(id);
  const subpageBtn=document.createElement('button');
  subpageBtn.className='mp-subpage-btn';
  subpageBtn.textContent=hasSubpage?'📄 進入子頁面':'📄 設定子頁面';
  subpageBtn.style.cssText='width:100%;padding:8px;margin:4px 0;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #ddd;background:#f5f5f5;color:#555;';
  subpageBtn.onclick=()=>{
    if(!hasSubpage){
      mapSubpages[mapSubpageKey(id)]={rootId:id,createdAt:new Date().toISOString()};
      saveData();
      drawMap();
      showToast('已設定子頁面');
      showMapInfo(id);
      return;
    }
    closeMapPopup();
    enterMapSubpage(id);
  };
  const cancelSubpageBtn=document.createElement('button');
  cancelSubpageBtn.className='mp-subpage-btn mp-subpage-cancel-btn';
  cancelSubpageBtn.textContent='🗑️ 取消子頁面';
  cancelSubpageBtn.style.cssText='width:100%;padding:8px;margin:4px 0 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #f3c7c7;background:#fff2f2;color:#c43d3d;';
  cancelSubpageBtn.onclick=()=>{
    if(!removeSubpageForNode(id)) return;
    removeRootFromPageStack(id);
    saveData();
    closeMapPopup();
    drawMap();
    updateMapPagePath();
    showToast('已取消子頁面設定');
  };
  const linkStartBtn=document.createElement('button');
  linkStartBtn.className='mp-link-start-btn';
  linkStartBtn.textContent=mapLinkSourceId===id?'✖ 取消連線起點':'🔗 以此為連線起點';
  linkStartBtn.style.cssText='width:100%;padding:8px;margin:4px 0;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #ddd;'+(mapLinkSourceId===id?'background:#fff2f2;color:#c43d3d;border-color:#f3c7c7;':'background:#eef6ff;color:#0C447C;border-color:#b5d4f4;');
  linkStartBtn.onclick=()=>{
    if(mapLinkSourceId===id) clearMapLinkSource({silent:true});
    else setMapLinkSource(id);
    closeMapPopup();
  };
  if(goBtn&&goBtn.parentNode){
    goBtn.parentNode.querySelectorAll('.mp-set-center,.mp-subpage-btn,.mp-subpage-cancel-btn,.mp-link-start-btn').forEach(el=>el.remove());
    goBtn.parentNode.insertBefore(setCenterBtn,goBtn);
    goBtn.parentNode.insertBefore(linkStartBtn,goBtn);
    if(isNodeInCurrentSubpage(id)) goBtn.parentNode.insertBefore(subpageBtn,goBtn);
    if(hasSubpage&&isNodeInCurrentSubpage(id)) goBtn.parentNode.insertBefore(cancelSubpageBtn,goBtn);
    let relayEditBtn=goBtn.parentNode.querySelector('.mp-relay-edit-btn');
    let relayDeleteBtn=goBtn.parentNode.querySelector('.mp-relay-delete-btn');
    relayEditBtn?.remove();relayDeleteBtn?.remove();
    if(relay){
      relayEditBtn=document.createElement('button');
      relayEditBtn.className='mp-relay-edit-btn';
      relayEditBtn.textContent='✏️ 編輯中繼站';
      relayEditBtn.style.cssText='width:100%;padding:8px;margin:4px 0;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #ddd;background:#f5f5f5;color:#555;';
      relayEditBtn.onclick=()=>editMapRelay(id);
      relayDeleteBtn=document.createElement('button');
      relayDeleteBtn.className='mp-relay-delete-btn';
      relayDeleteBtn.textContent='🗑️ 刪除中繼站';
      relayDeleteBtn.style.cssText='width:100%;padding:8px;margin:4px 0 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #f3c7c7;background:#fff2f2;color:#c43d3d;';
      relayDeleteBtn.onclick=()=>deleteMapRelay(id);
      goBtn.parentNode.insertBefore(relayEditBtn,goBtn);
      goBtn.parentNode.insertBefore(relayDeleteBtn,goBtn);
    }
  }
  const linksEl=g('mpLinks');
  if(!related.length){linksEl.innerHTML='<span class="mp-no-links">尚無關聯</span>';}
  else{
    linksEl.innerHTML=related.map(l=>{const otherId=l.from===id?l.to:l.from,other=mapNodeById(otherId),dir=l.from===id?'→':'←',name=other?other.title:'（已刪除）';return `<div class="mp-link-row"><span class="mp-link-badge" style="background:${LINK_COLOR}">${dir} 關聯</span><span class="mp-link-name" data-nid="${otherId}">${name}</span></div>`;}).join('');
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
    path.style.opacity=isSelectedRelated?'0.95':(active?'0.3':'0.12');
    path.setAttribute('stroke-width',isSelectedRelated?'3.2':(active?'1.35':'1'));
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
    if(!['all','none'].includes(mapFilter.chapter)&&!mapChapters.some(ch=>ch.key===mapFilter.chapter)) mapFilter.chapter=preferredChapter;
    if(!['all','none'].includes(mapFilter.chapter)&&!mapChapters.some(ch=>ch.key===mapFilter.chapter)) mapFilter.chapter='all';
    sch.innerHTML='<option value="all">全部章</option><option value="none">無章</option>'+mapChapters.map(ch=>`<option value="${ch.key}">${ch.label}</option>`).join('');
  }else{
    mapFilter.chapter='all';
    sch.innerHTML='<option value="all">全部章</option><option value="none">無章</option>';
  }
  const mapSections=sections.filter(sec=>mapFilter.chapter==='all'||sec.chapter===mapFilter.chapter||sec.chapter==='all');
  if(mapSections.length){
    if(!['all','none'].includes(mapFilter.section)&&!mapSections.some(sec=>sec.key===mapFilter.section)) mapFilter.section='all';
    ssc.innerHTML='<option value="all">全部節</option><option value="none">無節</option>'+mapSections.map(sec=>`<option value="${sec.key}">${sec.label}</option>`).join('');
  }else{
    mapFilter.section='all';
    ssc.innerHTML='<option value="all">全部節</option><option value="none">無節</option>';
  }
  ss.value=mapFilter.sub;sch.value=mapFilter.chapter;ssc.value=mapFilter.section;
  if(sd)sd.value=['all','1','2','3'].includes(mapDepth)?mapDepth:'all';
  updateMapPinnedChapter();
}
function laneContextLabelText(){ const s=mapFilter.sub==='all'?'全部科目':subByKey(mapFilter.sub).label,sec=mapFilter.section==='all'?'全部節':(mapFilter.section==='none'?'無節':sectionByKey(mapFilter.section).label);return `目前篩選：${s} / ${sec}`; }
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
function openCommandSheet(){ g('commandSheet')?.classList.add('open'); }
function closeCommandSheet(){ g('commandSheet')?.classList.remove('open'); }
function openQuickAddSheet(){ g('quickAddSheet')?.classList.add('open'); }
function closeQuickAddSheet(){ g('quickAddSheet')?.classList.remove('open'); }
function openQuickTemplate(typeKey){
  closeQuickAddSheet();
  openForm(false);
  if(g('ft')&&typeKey){
    g('ft').value=typeKey;
    renderDynamicFields(typeKey,null);
  }
}
function bindTouchQuickActions(){
  on('quickAddCloseBtn','click',closeQuickAddSheet);
  on('commandSheetCloseBtn','click',closeCommandSheet);
  g('quickAddSheet')?.addEventListener('click',e=>{if(e.target.id==='quickAddSheet') closeQuickAddSheet();});
  g('commandSheet')?.addEventListener('click',e=>{if(e.target.id==='commandSheet') closeCommandSheet();});
  g('quickAddSheet')?.querySelectorAll('[data-template]').forEach(btn=>btn.addEventListener('click',()=>openQuickTemplate(btn.dataset.template)));
  g('commandSheet')?.querySelectorAll('[data-cmd]').forEach(btn=>btn.addEventListener('click',()=>{
    const cmd=btn.dataset.cmd;
    if(cmd==='search') g('searchInput')?.focus();
    else if(cmd==='new') openQuickAddSheet();
    else if(cmd==='map') toggleMapView(!isMapOpen);
    else if(cmd==='calendar') toggleCalendarView(currentView!=='calendar');
    else if(cmd==='duplicate') duplicateNote();
    else if(cmd==='delete') deleteNote();
    closeCommandSheet();
  }));
  on('touchQuickAddBtn','click',openQuickAddSheet);
  on('touchQuickSearchBtn','click',()=>g('searchInput')?.focus());
  on('touchQuickRecentBtn','click',()=>{sortMode='date_desc';g('sortSelect').value='date_desc';render();});
  on('touchQuickMoreBtn','click',openCommandSheet);
  g('touchQuickFilters')?.querySelectorAll('[data-qf]').forEach(btn=>btn.addEventListener('click',()=>{
    const kind=btn.dataset.qf;
    if(kind==='today'){
      const d=new Date();searchQ=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;g('searchInput').value=searchQ;
    }else if(kind==='todo'){
      searchQ='[ ]';g('searchInput').value=searchQ;
    }else{
      sortMode='date_desc';g('sortSelect').value='date_desc';searchQ='';g('searchInput').value='';
    }
    render();
  }));
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.altKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandSheet();}
  });
  let edgeStartX=0;
  document.addEventListener('touchstart',e=>{
    const t=e.touches&&e.touches[0];if(!t) return;
    edgeStartX=t.clientX;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    const t=e.changedTouches&&e.changedTouches[0];if(!t) return;
    if(edgeStartX>window.innerWidth-22&&(edgeStartX-t.clientX)>30) openCommandSheet();
  },{passive:true});
}

function bindCoreButtons(){
  const bind=(id,fn)=>{const el=g(id);if(el)el.onclick=fn;};
  bind('addBtn',()=>{ if('ontouchstart' in window) openQuickAddSheet(); else openForm(false); });
  bind('linkModeBtn',()=>setLinkMode(!linkModeActive));
  bind('editBtn',()=>{if(!openId){showToast('請先開啟一筆筆記');return;}openForm(true);});
  bind('copyBtn',copyNoteToClipboard);
  bind('dupBtn',duplicateNote);
  bind('dpClose',closeDetail);bind('fpClose',closeForm);bind('fpCancel',closeForm);
  bind('fpSave',saveNote);bind('delBtn',deleteNote);
}
function bindTagManagerNav(){
  g('tagCategoryNav')?.addEventListener('click',ev=>{
    const btn=ev.target.closest('.tag-nav-btn');
    if(!btn) return;
    activeTagCategory=btn.dataset.category||'type';
    renderTagLists();
  });
  on('tagSettingsBtn','click',()=>g('tagGlobalOptions')?.classList.toggle('open'));
}

// ==================== AI 功能 ====================
function requireAiKey(action){ const k=getAiKey();if(k){action(k);return;}_aiPendingAction=action;g('aiKeyInput').value='';const sel=g('aiModelSel');if(sel)sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join('');g('aiKeyModal').classList.add('open'); }
function openAiSettings(){ g('aiKeyInput').value=getAiKey();const sel=g('aiModelSel');if(sel)sel.innerHTML=AI_MODELS.map(m=>`<option value="${m.id}"${m.id===getAiModel()?' selected':''}>${m.label}</option>`).join('');_aiPendingAction=null;g('aiKeyModal').classList.add('open'); }

// ==================== 初始化 ====================
  window.addEventListener('load',()=>{
  detachSidePanelsFromNotesView();
  ensureUsageStart();
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
  if(g('selAllBtn')) g('selAllBtn').textContent='複製';
  g('selAllBtn').addEventListener('click',copySelectedNotes);g('selDeleteBtn').addEventListener('click',deleteSelected);g('selCancelBtn').addEventListener('click',exitMultiSel);
  on('dp-link-search','input',debounce(renderDetailQuickLinkSearch,180));
  on('mp-link-search','input',debounce(()=>renderMapPopupQuickLinkSearch(),180));
  on('calendarBtn','click',()=>toggleCalendarView(true));
  on('levelSystemBtn','click',()=>toggleLevelSystemView(true));
  on('ft','change',()=>renderDynamicFields(g('ft').value,editMode&&openId?noteById(openId):null));
  on('fs2','change',()=>{
    syncChapterSelect(selectedValues('fs2'),selectedValues('fc'));
    syncSectionSelect(selectedValues('fc'),selectedValues('fsec'),selectedValues('fs2'));
  });
  on('fc','change',()=>syncSectionSelect(selectedValues('fc'),selectedValues('fsec'),selectedValues('fs2')));
  const si=g('searchInput'),sc=g('searchClear');
  si.addEventListener('input',debounce(()=>{searchQ=si.value;gridPage=1;sc.style.display=searchQ?'block':'none';render();},250));
  sc.addEventListener('click',()=>{si.value='';searchQ='';gridPage=1;sc.style.display='none';render();si.focus();});
  const compactDefault=localStorage.getItem(COMPACT_FILTER_KEY);
  applyCompactFilterMode(compactDefault===null?true:compactDefault==='1');
  on('compactToggleBtn','click',()=>applyCompactFilterMode(!document.body.classList.contains('compact-filters')));
  on('tagMgrBtn','click',openTagMgr);
  bindCoreButtons();
  bindTouchQuickActions();
  const draftSaver=debounce(saveNoteDraftFromForm,900);
  g('fp')?.addEventListener('input',()=>{ if(editMode) draftSaver(); });
  g('fp')?.addEventListener('focusout',()=>{ if(editMode) saveNoteDraftFromForm(); });
  applyBrandTitle();
  bindTagManagerNav();
  on('undoBtn','click',undoLastAction);
  on('archiveBtn','click',manageArchives);
  on('apClose','click',()=>{g('ap').classList.remove('open');syncSidePanelState();});
  on('archiveSaveBtn','click',createArchiveSnapshot);
  on('archiveExportBtn','click',exportData);
  on('archiveImportBtn','click',()=>g('importFile')?.click());
  g('tpClose').addEventListener('click',()=>{g('tp').classList.remove('open');syncSidePanelState();});
  on('tagSearchInput','input',debounce(()=>{tagSearchQ=(val('tagSearchInput')||'').toLowerCase().trim();renderTagLists();},150));
  on('tagUnusedOnly','change',()=>{tagUnusedOnly=!!g('tagUnusedOnly').checked;renderTagLists();});
  on('clearUnusedTagsBtn','click',clearUnusedTags);
  g('addTypeBtn').addEventListener('click',()=>addTag('type'));g('addSubBtn').addEventListener('click',()=>addTag('sub'));g('addChapterBtn').addEventListener('click',()=>addTag('chapter'));g('addSectionBtn').addEventListener('click',()=>addTag('section'));
  on('panelDirBtn','click',togglePanelDir);
  on('addTypeFieldBtn','click',addTypeFieldForCurrentType);
  on('removeTypeFieldBtn','click',removeTypeFieldForCurrentType);
  loadExams();on('examBtn','click',openExamPanel);on('examListClose','click',()=>g('examListPanel').classList.remove('open'));
  on('focusTimerBtn','click',openFocusTimer);
  on('focusTimerMinutes','change',resetFocusTimer);
  on('focusTimerStartBtn','click',startFocusTimer);
  on('focusTimerPauseBtn','click',stopFocusTimer);
  on('focusTimerResetBtn','click',resetFocusTimer);
  on('focusTimerCloseBtn','click',()=>{stopFocusTimer();g('focusTimerModal')?.classList.remove('open');});
  on('focusTimerAlertOkBtn','click',()=>g('focusTimerAlert')?.classList.remove('open'));
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
  loadRecycleBin();
  purgeRecycleBin();
  try{unusedTagTracker=JSON.parse(localStorage.getItem(UNUSED_TAG_TRACK_KEY)||'{}')||{};}catch(e){unusedTagTracker={};}
  setInterval(()=>{purgeRecycleBin();autoCleanupUnusedTags();},60000);
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
  g('mapToggleBtn').addEventListener('click',()=>toggleMapView(true));
  g('mapBackBtn').addEventListener('click',()=>{if(isMapOpen&&leaveMapSubpage())return;toggleMapView(false);});
  on('mapAddNoteBtn','click',()=>openForm(false));
  on('mapAddRelayBtn','click',createMapRelay);
  on('mapSearchInput','input',debounce(()=>{mapFilter.q=g('mapSearchInput').value;saveDataDeferred();if(isMapOpen)drawMap();},250));
  on('mapFilterSub','change',()=>{mapFilter.sub=g('mapFilterSub').value;mapPageStack=[];updateMapPagePath();buildMapFilters();nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapFilterChapter','change',()=>{mapFilter.chapter=g('mapFilterChapter').value;mapPageStack=[];updateMapPagePath();buildMapFilters();nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapFilterSection','change',()=>{mapFilter.section=g('mapFilterSection').value;mapPageStack=[];updateMapPagePath();nodePos={};saveDataDeferred();if(g('lanePanel')&&g('lanePanel').classList.contains('open'))renderLanePanel();if(isMapOpen){forceLayout();drawMap();}});
  on('mapAdvancedToggleBtn','click',()=>setMapAdvanced(!mapAdvancedOpen));
  mapDepth='all';
  mapFocusMode=false;
  const setZoom=z=>{mapScale=Math.max(.15,Math.min(3.5,z));g('zoomLabel').textContent=Math.round(mapScale*100)+'%';drawMap();};
  on('zoomIn','click',()=>setZoom(mapScale+.15));on('zoomOut','click',()=>setZoom(mapScale-.15));
  on('zoomFit','click',()=>{const vis=visibleNotes();if(!vis.length)return;const xs=vis.map(n=>nodePos[n.id]?nodePos[n.id].x:mapW/2),ys=vis.map(n=>nodePos[n.id]?nodePos[n.id].y:mapH/2);const minX=Math.min(...xs)-40,maxX=Math.max(...xs)+40,minY=Math.min(...ys)-40,maxY=Math.max(...ys)+40;const sc=Math.min(mapW/(maxX-minX||1),mapH/(maxY-minY||1),2.5);mapScale=sc;mapOffX=-minX*sc+(mapW-(maxX-minX)*sc)/2;mapOffY=-minY*sc+(mapH-(maxY-minY)*sc)/2;g('zoomLabel').textContent=Math.round(sc*100)+'%';drawMap();});
  on('mpClose','click',closeMapPopup);
  on('mapLinkedOnlyBtn','click',()=>{mapLinkedOnly=!mapLinkedOnly;setMapLinkedOnlyBtnStyle();nodePos={};forceLayout();drawMap();saveDataDeferred();showToast(mapLinkedOnly?`顯示 ${visibleNotes().length} 個有關聯節點`:'顯示全部節點');});
  on('mapAutoBtn','click',()=>{const btn=g('mapAutoBtn'),orig=btn.textContent;btn.textContent='排列中...';btn.disabled=true;setTimeout(()=>{nodePos={};mapScale=1;mapOffX=mapOffY=0;forceLayout();drawMap();saveDataDeferred();g('zoomLabel').textContent='100%';btn.textContent=orig;btn.disabled=false;showToast('已自動排列（保留核心節點）');},30);});
  on('mapLaneBtn','click',()=>{const panel=ensureLanePanel();if(!panel){showToast('泳道面板載入失敗');return;}if(panel.classList.contains('open'))closeLanePanel();else openLanePanel();});
  on('calendarBackBtn','click',()=>toggleCalendarView(false));
  on('levelSystemBackBtn','click',()=>toggleLevelSystemView(false));
  on('levelEditorClose','click',closeLevelEditor);
  on('levelEditorCancel','click',closeLevelEditor);
  on('levelEditorSave','click',saveLevelEditor);
  on('calendarPrevBtn','click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();});
  on('calendarNextBtn','click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();});
  on('calendarTodayBtn','click',()=>{calendarCursor=new Date();renderCalendar();});
  on('calendarSettingsBtn','click',()=>{g('calendarEmailsInput').value=(calendarSettings.emails||[]).join('\n');g('calendarSmtpToken').value=calendarSettings.smtpToken||'';g('calendarEmailFrom').value=calendarSettings.emailFrom||'';g('calendarSettingsModal').classList.add('open');});
  on('calendarSettingsCancel','click',()=>g('calendarSettingsModal').classList.remove('open'));
  on('calendarSettingsSave','click',()=>{
    const emails=(g('calendarEmailsInput').value||'').split('\n').map(v=>v.trim()).filter(Boolean);
    calendarSettings.emails=emails;calendarSettings.smtpToken=(g('calendarSmtpToken').value||'').trim();calendarSettings.emailFrom=(g('calendarEmailFrom').value||'').trim();saveData();g('calendarSettingsModal').classList.remove('open');showToast(`已儲存 ${emails.length} 個 Email`);
  });
  on('calendarEventType','change',()=>{g('calendarReminderWrap').style.display=g('calendarEventType').value==='reminder'?'block':'none';});
  on('calendarEventCancel','click',()=>g('calendarEventModal').classList.remove('open'));
  on('calendarEventSave','click',saveCalendarEvent);
  on('calendarEventDelete','click',()=>{ if(editingCalendarEventId!=null) deleteCalendarEvent(editingCalendarEventId); });
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
  try{reminderDismissed=JSON.parse(localStorage.getItem('klaws_reminder_dismissed_v1')||'{}')||{};}catch(e){reminderDismissed={};}
  if(!window.Email){const sc=document.createElement('script');sc.src='https://smtpjs.com/v3/smtp.js';document.head.appendChild(sc);}
  clearInterval(reminderTimer); reminderTimer=setInterval(checkReminders,30000); checkReminders();
  render();
  setTimeout(restoreLastViewState,120);
});
