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
  updateNotesHomeVisibility();
  if(currentView==='notes'&&!searchQ.trim()) return;
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
  const src=mapNodeById(a),target=mapNodeById(b);
  if(!src||!target) return false;
  if((isRelayNode(src)||isRelayNode(target))&&(!isNodeInCurrentMapPage(a)||!isNodeInCurrentMapPage(b))) return false;
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
function mapPageRootOptions(){
  return [...notes,...mapRelays]
    .filter(n=>hasSubpageForNode(n.id))
    .map(n=>({id:n.id,title:n.title||`節點#${n.id}`}));
}
function ensureMapSubpageRoot(rootId){
  if(!Number.isFinite(rootId)||!mapNodeById(rootId)) return false;
  const key=findSubpageKeyByNoteId(rootId)||mapSubpageKey(rootId);
  const existed=(mapSubpages[key]&&typeof mapSubpages[key]==='object'&&!Array.isArray(mapSubpages[key]))?mapSubpages[key]:null;
  const noteIds=Array.isArray(existed&&existed.noteIds)?[...new Set(existed.noteIds.map(v=>parseInt(v,10)).filter(Number.isFinite).filter(v=>v!==rootId))]:[];
  mapSubpages[key]={...(existed||{}),rootId,createdAt:(existed&&existed.createdAt)||new Date().toISOString(),noteIds};
  return true;
}
function getMapSubpageAssignedIds(rootId){
  const key=findSubpageKeyByNoteId(rootId);
  const item=key?mapSubpages[key]:null;
  if(!item||typeof item!=='object'||Array.isArray(item)) return new Set();
  const arr=Array.isArray(item.noteIds)?item.noteIds:[];
  return new Set(arr.map(v=>parseInt(v,10)).filter(Number.isFinite).filter(v=>v!==rootId));
}
function ensureMapAssignPanel(){
  const canvas=g('mapCanvas');if(!canvas) return null;
  let panel=g('mapAssignPanel');
  if(panel) return panel;
  panel=document.createElement('div');
  panel.id='mapAssignPanel';
  panel.style.cssText='display:none;position:absolute;top:74px;right:10px;z-index:38;width:320px;max-width:calc(100% - 20px);max-height:70%;overflow:auto;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,.14);padding:12px;';
  panel.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><b style="font-size:14px;color:#0C447C;">加入筆記到頁面</b><button class="pcls" id="mapAssignCloseBtn">×</button></div>
  <div style="font-size:12px;color:#667;margin-bottom:8px;">可在任何體系圖頁面執行，不需切回主頁。</div>
  <label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px;">目標頁面</label>
  <select id="mapAssignPageSel" class="fs" style="margin-bottom:8px;"></select>
  <label style="font-size:12px;font-weight:700;color:#555;display:block;margin-bottom:4px;">搜尋筆記</label>
  <input id="mapAssignSearchInput" class="fi" placeholder="輸入關鍵字找筆記..." style="margin-bottom:8px;">
  <div id="mapAssignSearchResult" style="display:flex;flex-direction:column;gap:6px;"></div>`;
  canvas.appendChild(panel);
  on('mapAssignCloseBtn','click',closeMapAssignPanel);
  on('mapAssignPageSel','change',()=>renderMapAssignSearch());
  on('mapAssignSearchInput','input',debounce(renderMapAssignSearch,160));
  return panel;
}
function closeMapAssignPanel(){ const panel=g('mapAssignPanel');if(panel){panel.classList.remove('open');panel.style.display='none';} }
function renderMapAssignSearch(){
  const result=g('mapAssignSearchResult'),sel=g('mapAssignPageSel'),input=g('mapAssignSearchInput');
  if(!result||!sel||!input) return;
  const rootId=parseInt(sel.value,10);
  if(!Number.isFinite(rootId)||!mapNodeById(rootId)){
    result.innerHTML='<div class="dp-link-empty">請先建立至少一個子頁面（在節點資訊內按「設定子頁面」）。</div>';
    return;
  }
  const q=(input.value||'').trim().toLowerCase();
  if(!q){ result.innerHTML='<div class="dp-link-empty">輸入關鍵字即可快速加入筆記</div>'; return; }
  const alreadyInPage=getDescendantIds(rootId);
  const pool=notes.filter(n=>{
    if(n.id===rootId) return false;
    if(alreadyInPage.has(n.id)) return false;
    const hay=`${n.title||''} ${noteSubjectText(n)} ${noteTags(n).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }).slice(0,24);
  if(!pool.length){ result.innerHTML='<div class="dp-link-empty">找不到可加入的筆記</div>'; return; }
  result.innerHTML=pool.map(n=>`<div class="fl-result-item quick-add" data-map-assign-note-id="${n.id}" style="display:flex;align-items:center;gap:8px;"><span class="fl-result-title" style="flex:1;">${escapeHtml(n.title||'（未命名）')}</span><button class="tool-btn" type="button">+ 加入</button></div>`).join('');
  result.querySelectorAll('[data-map-assign-note-id]').forEach(row=>row.addEventListener('click',()=>{
    const noteId=parseInt(row.dataset.mapAssignNoteId,10);
    const pageRootId=parseInt(sel.value,10);
    if(!Number.isFinite(noteId)||!Number.isFinite(pageRootId)) return;
    if(addNoteToMapPage(pageRootId,noteId)){
      renderMapAssignSearch();
      if(isMapOpen) scheduleMapRedraw(80);
    }
  }));
}
function addNoteToMapPage(pageRootId,noteId){
  const root=mapNodeById(pageRootId),note=noteById(noteId);
  if(!root||!note||root.id===note.id){showToast('加入失敗：頁面或筆記無效');return false;}
  if(!ensureMapSubpageRoot(root.id)){showToast('頁面不存在');return false;}
  const assignedIds=getMapSubpageAssignedIds(root.id);
  if(getDescendantIds(root.id).has(note.id)||assignedIds.has(note.id)){showToast('這筆筆記已在該頁面');return false;}
  assignedIds.add(note.id);
  const key=findSubpageKeyByNoteId(root.id)||mapSubpageKey(root.id);
  mapSubpages[key]={...(mapSubpages[key]||{}),rootId:root.id,createdAt:(mapSubpages[key]&&mapSubpages[key].createdAt)||new Date().toISOString(),noteIds:[...assignedIds]};
  saveData();
  showToast(`已加入「${note.title||'（未命名）'}」到「${root.title||'（未命名）'}」頁面（不建立關聯線）`);
  return true;
}
function openMapAssignPanel(){
  const panel=ensureMapAssignPanel(),sel=g('mapAssignPageSel'),input=g('mapAssignSearchInput');
  if(!panel||!sel||!input) return;
  const pages=mapPageRootOptions();
  if(!pages.length){
    sel.innerHTML='<option value="">尚無子頁面</option>';
  }else{
    sel.innerHTML=pages.map(p=>`<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    const currentRoot=currentSubpageRootId();
    if(currentRoot&&pages.some(p=>p.id===currentRoot)) sel.value=String(currentRoot);
  }
  input.value='';
  renderMapAssignSearch();
  panel.classList.add('open');
  panel.style.display='block';
  setTimeout(()=>input.focus(),0);
}
function openMapNodeFromLink(id){
  if(!mapNodeById(id)){ showToast('節點已被刪除'); return; }
  openNote(id);
}
function renderDetailQuickLinkSearch(){
  const root=g('dp-link-results');
  if(!root||!openId) return;
  const q=(g('dp-link-search')?.value||'').trim();
  if(!q){root.innerHTML='<div class="dp-link-empty">輸入關鍵字即可快速建立關聯</div>';return;}
  const existingIds=new Set(links.filter(l=>l.from===openId||l.to===openId).map(l=>l.from===openId?l.to:l.from));
  const pool=findMapNodesByKeyword(q,openId).filter(n=>!existingIds.has(n.id)&&(!isRelayNode(n)||isNodeInCurrentMapPage(n.id)));
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
  const pool=findMapNodesByKeyword(q,srcId).filter(n=>!existingIds.has(n.id)&&!isRelayNode(n)&&isNodeInCurrentMapPage(n.id));
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
  const n=mapNodeById(id); if(!n) return;
  const relay=isRelayNode(n);
  openId=id;
  const tp=typeByKey(n.type),subs=noteSubjects(n),chs=noteChapters(n),secs=noteSections(n);
  g('dp-badge').textContent=relay?'中繼站':tp.label; g('dp-badge').style.background=relay?'#A855F7':tp.color;
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
      else if(action==='duplicate') duplicateMapNode(id);
      else if(action==='copy') copyNoteToClipboard(id);
      else if(action==='delete') deleteMapNode(id);
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

