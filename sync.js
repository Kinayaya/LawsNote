// ==================== 匯入/匯出 ====================
function exportData() {
  const json=JSON.stringify({notes,mapRelays:[],links,nid,lid,types,subjects,chapters,sections,nodeSizes,mapCenterNodeId,mapCenterNodeIds,mapCollapsed,mapSubpages,mapPageNotes,exported:new Date().toISOString()},null,2);
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
        notes=mergeRelaysIntoNotes(d.notes,Array.isArray(d.mapRelays)?d.mapRelays:[]);
        links=d.links||[];
        mapRelays=[];
        nodeSizes=d.nodeSizes||{};mapCenterNodeId=d.mapCenterNodeId||null;mapCenterNodeIds=(d.mapCenterNodeIds&&typeof d.mapCenterNodeIds==='object')?d.mapCenterNodeIds:{};mapCollapsed=(d.mapCollapsed&&typeof d.mapCollapsed==='object')?d.mapCollapsed:{};
        mapSubpages=(d.mapSubpages&&typeof d.mapSubpages==='object')?d.mapSubpages:{};
        mapPageNotes=(d.mapPageNotes&&typeof d.mapPageNotes==='object')?normalizeMapPageNotes(d.mapPageNotes):{root:notes.map(n=>n.id)};
        nid=d.nid||Math.max([...notes,...mapRelays].reduce((m,n)=>Math.max(m,n.id||0),0)+1,10);lid=d.lid||10;notes.sort((a,b)=>b.id-a.id);
        normalizeNoteIds(true);
        saveData();rebuildUI();render();showToast(`已覆蓋，共 ${notes.length} 筆筆記`);
      } else {
        // ★ 合併模式：同樣不覆蓋 types/subjects/chapters
        const existing=new Set(notes.map(n=>n.id));let added=0;
        let maxNoteId=[...notes].reduce((m,x)=>Math.max(m,x.id||0),0);
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
            const backupType=safeStr(r&&r.noteTypeBackup)||safeStr(r&&r.type)||'article';
            notes.push(normalizeNoteSchema({...r,id:nextId,isRelay:false,type:backupType,noteTypeBackup:''}));
            if(nextId>=nid) nid=nextId+1;
            added++;
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
