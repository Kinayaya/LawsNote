// ==================== 資料儲存 ====================
function loadData() {
  try {
    const d=readJSON(SKEY,null);
    if(d) {
      notes=mergeRelaysIntoNotes(Array.isArray(d.notes)?d.notes:DEFAULTS.notes.slice(),Array.isArray(d.mapRelays)?d.mapRelays:[]);
      mapRelays=[];
      links=Array.isArray(d.links)?d.links:DEFAULTS.links.slice();
      links.forEach(l=>{l.rel='關聯';l.color=LINK_COLOR;});
      nid=Number.isFinite(d.nid)?d.nid:Math.max(10,[...notes].reduce((m,n)=>Math.max(m,n.id||0),0)+1);
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
      subjects.forEach(s=>{if(/^tag_s_/.test(s.key)){let old=s.key;s.key=s.label;allMapNodes().forEach(n=>{n.subjects=noteSubjects(n).map(x=>x===old?s.label:x);n.subject=n.subjects[0]||'';});repaired=true;}});
      allMapNodes().forEach(n=>{
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
  mapRelays.forEach(n=>{
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

