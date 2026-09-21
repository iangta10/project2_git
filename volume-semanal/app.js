(() => {
  "use strict";

  const STORAGE_KEY = "volume-semanal-github-v2";
  const app = document.getElementById("content");
  const modalRoot = document.getElementById("modalRoot");
  const toastEl = document.getElementById("toast");
  const pageTitle = document.getElementById("pageTitle");
  const addWorkoutTop = document.getElementById("addWorkoutTop");

  const DEFAULT_GROUPS = [
    ["chest","Peito"],["back","Costas"],["delt-front","Deltoide anterior"],["delt-side","Deltoide lateral"],
    ["delt-rear","Deltoide posterior"],["biceps","Bíceps"],["triceps","Tríceps"],["quads","Quadríceps"],
    ["hamstrings","Posteriores de coxa"],["glutes","Glúteos"],["calves","Panturrilhas"],["core","Abdômen/Core"],
    ["adductors","Adutores"],["abductors","Abdutores"]
  ].map((x,i) => ({id:x[0],name:x[1],order:i,hidden:false,isDefault:true}));

  const GOAL_DEFS = [
    {id:"goal-chest",name:"Peito",target:12,visible:true,aliases:["Peito"]},
    {id:"goal-back",name:"Costas",target:12,visible:true,aliases:["Costas"]},
    {id:"goal-shoulders",name:"Ombros",target:12,visible:true,aliases:["Deltoide anterior","Deltoide lateral","Deltoide posterior"]},
    {id:"goal-biceps",name:"Bíceps",target:8,visible:true,aliases:["Bíceps"]},
    {id:"goal-triceps",name:"Tríceps",target:8,visible:true,aliases:["Tríceps"]},
    {id:"goal-quads",name:"Quadríceps",target:12,visible:true,aliases:["Quadríceps"]},
    {id:"goal-hamstrings",name:"Posteriores",target:10,visible:true,aliases:["Posteriores de coxa"]},
    {id:"goal-glutes",name:"Glúteos",target:10,visible:true,aliases:["Glúteos"]},
    {id:"goal-calves",name:"Panturrilhas",target:8,visible:true,aliases:["Panturrilhas"]},
    {id:"goal-core",name:"Core",target:6,visible:true,aliases:["Abdômen/Core"]},
    {id:"goal-adductors",name:"Adutores",target:6,visible:false,aliases:["Adutores"]},
    {id:"goal-abductors",name:"Abdutores",target:6,visible:false,aliases:["Abdutores"]}
  ];

  let state = loadState();
  let route = getRoute();
  let draftWorkout = null;
  let toastTimer = null;

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2); }
  function h(v){ return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function norm(v){ return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase(); }
  function clampHalf(v){
    const n = Number(String(v).replace(",","."));
    if(!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n*2)/2;
  }
  function fmt(v){
    const n = clampHalf(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".",",");
  }
  function todayISO(){
    const d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function parseISO(s){
    const p=String(s).split("-").map(Number);
    return new Date(p[0]||1970,(p[1]||1)-1,p[2]||1);
  }
  function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function addDays(s,n){ const d=parseISO(s); d.setDate(d.getDate()+n); return iso(d); }
  function weekStartOf(s){ const d=parseISO(s); const diff=(d.getDay()+6)%7; d.setDate(d.getDate()-diff); return iso(d); }
  function shortDate(s){ const d=parseISO(s); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0"); }
  function longDate(s){ return parseISO(s).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}); }
  function dayName(s){ return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][parseISO(s).getDay()]; }
  function weekLabel(ws){ return shortDate(ws)+" – "+shortDate(addDays(ws,6)); }

  function makeGoals(groups){
    return GOAL_DEFS.map((g,order) => {
      const ids = groups.filter(x => g.aliases.some(a => norm(a)===norm(x.name))).map(x => x.id);
      return {id:g.id,name:g.name,target:g.target,visible:g.visible,order:order,sourceIds:ids};
    });
  }

  function defaultState(){
    const groups=clone(DEFAULT_GROUPS);
    return {version:2,muscleGroups:groups,workouts:[],goals:makeGoals(groups)};
  }

  function sanitizeState(raw){
    if(!raw || typeof raw!=="object") return defaultState();
    let groups = Array.isArray(raw.muscleGroups) ? raw.muscleGroups.map((g,i)=>({
      id:String(g.id||uid()),name:String(g.name||"Grupamento"),order:Number.isFinite(Number(g.order))?Number(g.order):i,
      hidden:!!g.hidden,isDefault:g.isDefault!==false
    })) : clone(DEFAULT_GROUPS);
    let workouts = Array.isArray(raw.workouts) ? raw.workouts.map(w => ({
      id:String(w.id||uid()),date:String(w.date||todayISO()),title:w.title?String(w.title):"",
      entries:Array.isArray(w.entries)?w.entries.map(e=>({
        id:String(e.id||uid()),exerciseName:e.exerciseName?String(e.exerciseName):"",
        muscleGroupId:String(e.muscleGroupId||""),sets:clampHalf(e.sets)
      })).filter(e=>e.muscleGroupId&&e.sets>0):[],
      createdAt:w.createdAt||new Date().toISOString(),updatedAt:w.updatedAt||new Date().toISOString()
    })) : [];
    let goals;
    if(Array.isArray(raw.goals) && raw.goals.length){
      goals=raw.goals.map((g,i)=>({
        id:String(g.id||uid()),name:String(g.name||"Meta"),target:clampHalf(g.target||0),
        visible:g.visible!==false,order:Number.isFinite(Number(g.order))?Number(g.order):i,
        sourceIds:Array.isArray(g.sourceIds)?g.sourceIds.map(String):[]
      }));
    }else{
      goals=makeGoals(groups);
    }
    return {version:2,muscleGroups:groups,workouts:workouts,goals:goals};
  }

  function loadState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      return raw ? sanitizeState(JSON.parse(raw)) : defaultState();
    }catch(e){ return defaultState(); }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
  function toast(msg){
    clearTimeout(toastTimer); toastEl.textContent=msg; toastEl.classList.add("show");
    toastTimer=setTimeout(()=>toastEl.classList.remove("show"),2200);
  }
  function getRoute(){
    const r=location.hash.replace("#","").split("/")[0];
    return ["week","records","history","settings"].includes(r)?r:"week";
  }
  function setRoute(r){ location.hash="#"+r; }
  function groupById(id){ return state.muscleGroups.find(g=>g.id===id); }
  function activeGroups(){ return state.muscleGroups.filter(g=>!g.hidden).sort((a,b)=>a.order-b.order); }
  function weekWorkouts(ws){ return state.workouts.filter(w=>weekStartOf(w.date)===ws).sort((a,b)=>a.date.localeCompare(b.date)); }
  function workoutTotal(w){ return w.entries.reduce((s,e)=>s+clampHalf(e.sets),0); }
  function totalSets(list){ return list.reduce((s,w)=>s+workoutTotal(w),0); }
  function goalTotal(goal,list){
    const ids=new Set(goal.sourceIds||[]);
    let sum=0;
    list.forEach(w=>w.entries.forEach(e=>{ if(ids.has(e.muscleGroupId)) sum+=clampHalf(e.sets); }));
    return Math.round(sum*2)/2;
  }
  function allWeeks(){
    return [...new Set(state.workouts.map(w=>weekStartOf(w.date)))].sort((a,b)=>b.localeCompare(a));
  }
  function visibleGoals(){ return state.goals.filter(g=>g.visible).sort((a,b)=>a.order-b.order); }

  function render(){
    route=getRoute();
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===route));
    addWorkoutTop.style.display=route==="settings"?"none":"grid";
    if(route==="week"){ pageTitle.textContent="Volume Semanal"; renderWeek(); }
    if(route==="records"){ pageTitle.textContent="Registros"; renderRecords(); }
    if(route==="history"){ pageTitle.textContent="Histórico"; renderHistory(); }
    if(route==="settings"){ pageTitle.textContent="Ajustes"; renderSettings(); }
  }

  function goalRow(goal,list){
    const done=goalTotal(goal,list), target=Math.max(0,clampHalf(goal.target));
    const pct=target>0?Math.min(100,(done/target)*100):100;
    let status="";
    if(target<=0) status="Sem meta definida";
    else if(done<target) status="Faltam "+fmt(target-done);
    else if(done===target) status="Meta atingida";
    else status="+"+fmt(done-target)+" acima da meta";
    return '<div class="goal-row '+(done>=target&&target>0?'done':'')+'">'+
      '<div class="goal-top"><div class="goal-name">'+h(goal.name)+'</div><div class="goal-value">'+fmt(done)+' / '+fmt(target)+' séries</div></div>'+
      '<div class="progress"><span style="width:'+pct+'%"></span></div><div class="goal-status">'+h(status)+'</div></div>';
  }

  function renderWeek(){
    const ws=weekStartOf(todayISO()), list=weekWorkouts(ws), goals=visibleGoals();
    const days=new Set(list.map(w=>w.date)).size;
    app.innerHTML=
      '<div class="card"><div class="small muted">SEMANA ATUAL</div><h2 style="margin-top:4px">'+weekLabel(ws)+'</h2>'+
      '<div class="week-range">'+days+' '+(days===1?'dia treinado':'dias treinados')+'</div>'+
      '<div class="hero-actions"><button class="btn primary" data-action="new-workout">Registrar treino</button><button class="btn" data-route="records">Ver registros</button></div></div>'+
      '<section class="section"><div class="section-head"><h2>Metas semanais</h2><button class="btn ghost small" data-route="settings">Editar metas</button></div>'+
      (goals.length?'<div class="goal-list">'+goals.map(g=>goalRow(g,list)).join("")+'</div>':'<div class="card empty">Nenhum grupamento selecionado para o painel.</div>')+
      '</section>';
  }

  function renderRecords(){
    const ws=weekStartOf(todayISO());
    let html='<div class="card"><div class="small muted">SEMANA ATUAL</div><h2 style="margin-top:4px">'+weekLabel(ws)+'</h2></div><section class="section"><div class="day-list">';
    for(let i=0;i<7;i++){
      const date=addDays(ws,i), list=state.workouts.filter(w=>w.date===date), d=parseISO(date);
      html+='<div class="day-card"><div class="day-head"><div class="day-date"><div class="day-badge"><b>'+d.getDate()+'</b><small>'+dayName(date)+'</small></div><div><h3>'+dayName(date)+'</h3><div class="tiny muted">'+longDate(date)+'</div></div></div><button class="icon-btn" data-action="new-workout" data-date="'+date+'">＋</button></div>';
      if(list.length){
        list.forEach(w=>{ html+='<div class="workout-mini" data-action="edit-workout" data-id="'+h(w.id)+'"><div><b>'+h(w.title||"Treino")+'</b><div class="tiny muted">'+w.entries.length+' lançamentos</div></div><div class="strong accent">'+fmt(workoutTotal(w))+' séries</div></div>'; });
      }else html+='<div class="tiny muted" style="padding-top:10px">Nenhum treino registrado.</div>';
      html+='</div>';
    }
    html+='</div></section>';
    app.innerHTML=html;
  }

  function groupPills(list){
    const totals=new Map();
    list.forEach(w=>w.entries.forEach(e=>totals.set(e.muscleGroupId,(totals.get(e.muscleGroupId)||0)+clampHalf(e.sets))));
    return [...totals.entries()].filter(x=>x[1]>0).slice(0,6).map(x=>{
      const g=groupById(x[0]); return '<span class="pill">'+h(g?g.name:"Removido")+' '+fmt(x[1])+'</span>';
    }).join("");
  }

  function renderHistory(){
    const current=weekStartOf(todayISO()), weeks=allWeeks().filter(w=>w!==current);
    app.innerHTML='<div class="small muted" style="margin-bottom:10px">Semanas anteriores ficam salvas automaticamente.</div>'+
      (weeks.length?'<div class="history-list">'+weeks.map(ws=>{
        const list=weekWorkouts(ws);
        return '<div class="history-card" data-action="open-history" data-week="'+ws+'"><div class="history-top"><div><b>'+weekLabel(ws)+'</b><div class="tiny muted">'+list.length+' '+(list.length===1?'treino':'treinos')+'</div></div><div class="history-total">'+fmt(totalSets(list))+'</div></div><div class="pills">'+groupPills(list)+'</div></div>';
      }).join("")+'</div>':'<div class="card empty"><div class="emoji">↶</div>Nenhuma semana anterior ainda.</div>');
  }

  function renderSettings(){
    const goals=[...state.goals].sort((a,b)=>a.order-b.order);
    const groups=[...state.muscleGroups].sort((a,b)=>a.order-b.order);
    app.innerHTML=
      '<section><div class="section-head"><div><h2>Metas semanais</h2><div class="tiny muted">Escolha o que aparece no painel e defina a meta.</div></div></div>'+
      '<div class="settings-list">'+goals.map((g,i)=>
        '<div class="setting-row"><div class="goal-config"><div><b>'+h(g.name)+'</b><div class="tiny muted">Meta semanal</div></div>'+
        '<div class="goal-controls"><input class="target-input" inputmode="decimal" step="0.5" min="0" value="'+fmt(g.target).replace(",",".")+'" data-goal-target="'+h(g.id)+'">'+
        '<label class="switch" title="Mostrar no painel"><input type="checkbox" data-goal-visible="'+h(g.id)+'" '+(g.visible?'checked':'')+'><span class="slider"></span></label></div></div>'+
        '<div class="setting-line" style="margin-top:8px"><span class="tiny muted">'+(g.visible?'Visível no painel':'Oculto do painel')+'</span><div class="setting-actions"><button class="move-btn" data-action="move-goal" data-id="'+h(g.id)+'" data-dir="-1" '+(i===0?'disabled':'')+'>↑</button><button class="move-btn" data-action="move-goal" data-id="'+h(g.id)+'" data-dir="1" '+(i===goals.length-1?'disabled':'')+'>↓</button></div></div></div>'
      ).join("")+'</div></section>'+
      '<section class="section"><div class="section-head"><div><h2>Grupamentos detalhados</h2><div class="tiny muted">Usados no lançamento dos treinos.</div></div><button class="btn small" data-action="add-group">＋ Novo</button></div>'+
      '<div class="settings-list">'+groups.map((g,i)=>
        '<div class="setting-row"><div class="setting-line"><input class="input" style="min-height:42px" value="'+h(g.name)+'" data-group-name="'+h(g.id)+'"><label class="switch"><input type="checkbox" data-group-visible="'+h(g.id)+'" '+(!g.hidden?'checked':'')+'><span class="slider"></span></label></div>'+
        '<div class="setting-line" style="margin-top:8px"><span class="tiny muted">'+(g.hidden?'Oculto no registro':'Disponível no registro')+'</span><div class="setting-actions"><button class="move-btn" data-action="move-group" data-id="'+h(g.id)+'" data-dir="-1" '+(i===0?'disabled':'')+'>↑</button><button class="move-btn" data-action="move-group" data-id="'+h(g.id)+'" data-dir="1" '+(i===groups.length-1?'disabled':'')+'>↓</button>'+(g.isDefault?'':'<button class="move-btn" data-action="delete-group" data-id="'+h(g.id)+'">×</button>')+'</div></div></div>'
      ).join("")+'</div></section>'+
      '<section class="section"><div class="section-head"><div><h2>Backup</h2><div class="tiny muted">Inclui treinos, grupamentos e metas.</div></div></div><div class="card"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-action="export-backup">Exportar JSON</button><button class="btn" data-action="import-backup">Importar JSON</button></div><input id="backupInput" type="file" accept=".json,application/json" hidden></div></section>'+
      '<section class="section"><div class="card danger-zone"><h3 style="color:#ff9191">Apagar dados</h3><p class="small muted">Remove todos os treinos e restaura as configurações padrão.</p><button class="btn danger" data-action="wipe-data">Apagar tudo</button></div></section>';
  }

  function openWorkout(id,date){
    const existing=id?state.workouts.find(w=>w.id===id):null;
    const first=activeGroups()[0];
    draftWorkout=existing?clone(existing):{
      id:uid(),date:date||todayISO(),title:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      entries:[{id:uid(),exerciseName:"",muscleGroupId:first?first.id:"",sets:3}]
    };
    renderWorkoutModal(!!existing);
  }

  function entryHtml(e){
    const groups=activeGroups();
    return '<div class="entry-card" data-entry="'+h(e.id)+'">'+
      '<input class="input" placeholder="Exercício (opcional)" value="'+h(e.exerciseName||"")+'" data-entry-exercise="'+h(e.id)+'">'+
      '<div class="entry-grid"><select class="select" data-entry-group="'+h(e.id)+'">'+groups.map(g=>'<option value="'+h(g.id)+'" '+(g.id===e.muscleGroupId?'selected':'')+'>'+h(g.name)+'</option>').join("")+'</select>'+
      '<input class="input" inputmode="decimal" step="0.5" min="0" value="'+fmt(e.sets).replace(",",".")+'" data-entry-sets="'+h(e.id)+'"></div>'+
      '<div class="entry-actions"><div class="stepper"><button data-action="entry-minus" data-id="'+h(e.id)+'">−</button><button data-action="entry-plus" data-id="'+h(e.id)+'">＋</button></div>'+
      '<div class="entry-tools"><button data-action="entry-duplicate" data-id="'+h(e.id)+'">Duplicar</button><button data-action="entry-delete" data-id="'+h(e.id)+'">Excluir</button></div></div></div>';
  }

  function renderWorkoutModal(isEdit){
    modalRoot.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">'+(isEdit?'EDITAR':'NOVO')+'</div><h2>Treino</h2></div><button class="close-btn" data-action="close-modal">×</button></div>'+
      '<div class="field"><label>Data</label><input class="input" type="date" id="draftDate" value="'+h(draftWorkout.date)+'"></div>'+
      '<div class="field"><label>Nome do treino (opcional)</label><input class="input" id="draftTitle" placeholder="Ex.: Push A" value="'+h(draftWorkout.title||"")+'"></div>'+
      '<div class="section-head"><h3>Séries contabilizadas</h3><b class="accent" id="draftTotal">'+fmt(workoutTotal(draftWorkout))+' séries</b></div>'+
      '<div id="entryList">'+draftWorkout.entries.map(entryHtml).join("")+'</div>'+
      '<button class="btn" style="width:100%" data-action="add-entry">＋ Adicionar linha</button>'+
      '<div class="modal-footer '+(isEdit?'':'single')+'">'+(isEdit?'<button class="btn danger" data-action="delete-workout" data-id="'+h(draftWorkout.id)+'">Excluir treino</button>':'')+'<button class="btn primary" data-action="save-workout">Salvar treino</button></div></div></div>';
  }

  function rerenderWorkoutModalPreserveScroll(isEdit){
    const currentModal=document.querySelector(".modal");
    const scrollTop=currentModal?currentModal.scrollTop:0;
    renderWorkoutModal(isEdit);
    const nextModal=document.querySelector(".modal");
    if(nextModal) nextModal.scrollTop=scrollTop;
  }

  function syncDraftInputs(){
    const d=document.getElementById("draftDate"), t=document.getElementById("draftTitle");
    if(d) draftWorkout.date=d.value||todayISO();
    if(t) draftWorkout.title=t.value.trim();
    draftWorkout.entries.forEach(e=>{
      const ex=document.querySelector('[data-entry-exercise="'+CSS.escape(e.id)+'"]');
      const gr=document.querySelector('[data-entry-group="'+CSS.escape(e.id)+'"]');
      const st=document.querySelector('[data-entry-sets="'+CSS.escape(e.id)+'"]');
      if(ex) e.exerciseName=ex.value;
      if(gr) e.muscleGroupId=gr.value;
      if(st) e.sets=clampHalf(st.value);
    });
  }

  function saveWorkout(){
    syncDraftInputs();
    draftWorkout.entries=draftWorkout.entries.filter(e=>e.muscleGroupId&&clampHalf(e.sets)>0);
    if(!draftWorkout.entries.length){ toast("Adicione ao menos uma série."); return; }
    draftWorkout.updatedAt=new Date().toISOString();
    const idx=state.workouts.findIndex(w=>w.id===draftWorkout.id);
    if(idx>=0) state.workouts[idx]=clone(draftWorkout); else state.workouts.push(clone(draftWorkout));
    saveState(); closeModal(); render(); toast("Treino salvo.");
  }

  function closeModal(){ modalRoot.innerHTML=""; draftWorkout=null; }

  function openHistory(ws){
    const list=weekWorkouts(ws), goals=visibleGoals();
    modalRoot.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">SEMANA</div><h2>'+weekLabel(ws)+'</h2></div><button class="close-btn" data-action="close-modal">×</button></div>'+
      '<div class="summary-grid"><div class="summary-cell"><span class="tiny muted">Treinos</span><b>'+list.length+'</b></div><div class="summary-cell"><span class="tiny muted">Séries totais</span><b>'+fmt(totalSets(list))+'</b></div></div>'+
      '<section class="section"><div class="goal-list">'+goals.map(g=>goalRow(g,list)).join("")+'</div></section>'+
      '<section class="section"><h3 style="margin-bottom:10px">Treinos</h3><div class="workout-list">'+list.map(w=>'<div class="workout-card" style="padding:12px;cursor:pointer" data-action="history-edit-workout" data-id="'+h(w.id)+'"><div class="setting-line"><div><b>'+h(w.title||"Treino")+'</b><div class="tiny muted">'+longDate(w.date)+'</div></div><b class="accent">'+fmt(workoutTotal(w))+'</b></div><div class="pills">'+groupPills([w])+'</div></div>').join("")+'</div></section></div></div>';
  }

  function moveItem(arr,id,dir){
    const sorted=[...arr].sort((a,b)=>a.order-b.order);
    const i=sorted.findIndex(x=>x.id===id), j=i+dir;
    if(i<0||j<0||j>=sorted.length) return;
    const tmp=sorted[i]; sorted[i]=sorted[j]; sorted[j]=tmp;
    sorted.forEach((x,k)=>x.order=k);
  }

  function exportBackup(){
    const data={app:"volume-semanal-github",version:2,exportedAt:new Date().toISOString(),muscleGroups:state.muscleGroups,workouts:state.workouts,goals:state.goals};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download="volume-semanal-backup-"+todayISO()+".json"; a.click(); URL.revokeObjectURL(url);
  }

  async function importBackup(file){
    try{
      const raw=JSON.parse(await file.text());
      state=sanitizeState(raw); saveState(); render(); toast("Backup importado.");
    }catch(e){ toast("Arquivo de backup inválido."); }
  }

  document.addEventListener("click",e=>{
    const routeBtn=e.target.closest("[data-route]");
    if(routeBtn){ setRoute(routeBtn.dataset.route); return; }
    const el=e.target.closest("[data-action]"); if(!el) return;
    const action=el.dataset.action;

    if(action==="new-workout"){ openWorkout(null,el.dataset.date||todayISO()); return; }
    if(action==="edit-workout"){ openWorkout(el.dataset.id); return; }
    if(action==="close-modal"){ closeModal(); return; }
    if(action==="open-history"){ openHistory(el.dataset.week); return; }
    if(action==="history-edit-workout"){ const id=el.dataset.id; closeModal(); openWorkout(id); return; }

    if(action==="add-entry" && draftWorkout){
      syncDraftInputs(); const g=activeGroups()[0];
      draftWorkout.entries.push({id:uid(),exerciseName:"",muscleGroupId:g?g.id:"",sets:3});
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }
    if((action==="entry-minus"||action==="entry-plus"||action==="entry-duplicate"||action==="entry-delete")&&draftWorkout){
      syncDraftInputs(); const i=draftWorkout.entries.findIndex(x=>x.id===el.dataset.id); if(i<0)return;
      if(action==="entry-minus") draftWorkout.entries[i].sets=Math.max(0,clampHalf(draftWorkout.entries[i].sets)-.5);
      if(action==="entry-plus") draftWorkout.entries[i].sets=clampHalf(draftWorkout.entries[i].sets)+.5;
      if(action==="entry-duplicate"){ const cp=clone(draftWorkout.entries[i]); cp.id=uid(); draftWorkout.entries.splice(i+1,0,cp); }
      if(action==="entry-delete") draftWorkout.entries.splice(i,1);
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }
    if(action==="save-workout"){ saveWorkout(); return; }
    if(action==="delete-workout"){
      if(confirm("Excluir este treino?")){ state.workouts=state.workouts.filter(w=>w.id!==el.dataset.id); saveState(); closeModal(); render(); toast("Treino excluído."); } return;
    }

    if(action==="move-goal"){ moveItem(state.goals,el.dataset.id,Number(el.dataset.dir)); saveState(); renderSettings(); return; }
    if(action==="move-group"){ moveItem(state.muscleGroups,el.dataset.id,Number(el.dataset.dir)); saveState(); renderSettings(); return; }
    if(action==="add-group"){
      const name=prompt("Nome do novo grupamento:");
      if(name&&name.trim()){ state.muscleGroups.push({id:uid(),name:name.trim(),order:state.muscleGroups.length,hidden:false,isDefault:false}); saveState(); renderSettings(); } return;
    }
    if(action==="delete-group"){
      const used=state.workouts.some(w=>w.entries.some(x=>x.muscleGroupId===el.dataset.id));
      if(used){ toast("Esse grupamento possui registros e não pode ser excluído."); return; }
      if(confirm("Excluir este grupamento?")){ state.muscleGroups=state.muscleGroups.filter(g=>g.id!==el.dataset.id); saveState(); renderSettings(); } return;
    }
    if(action==="export-backup"){ exportBackup(); return; }
    if(action==="import-backup"){ const input=document.getElementById("backupInput"); if(input) input.click(); return; }
    if(action==="wipe-data"){
      const typed=prompt('Digite APAGAR para confirmar:');
      if(typed&&typed.trim().toUpperCase()==="APAGAR"){ state=defaultState(); saveState(); render(); toast("Dados apagados."); } return;
    }
  });

  document.addEventListener("change",e=>{
    const t=e.target;
    if(t.matches("[data-goal-visible]")){
      const g=state.goals.find(x=>x.id===t.dataset.goalVisible); if(g){g.visible=t.checked;saveState();renderSettings();} return;
    }
    if(t.matches("[data-goal-target]")){
      const g=state.goals.find(x=>x.id===t.dataset.goalTarget); if(g){g.target=clampHalf(t.value);saveState();t.value=String(g.target);toast("Meta atualizada.");} return;
    }
    if(t.matches("[data-group-visible]")){
      const g=state.muscleGroups.find(x=>x.id===t.dataset.groupVisible); if(g){g.hidden=!t.checked;saveState();} return;
    }
    if(t.matches("[data-group-name]")){
      const g=state.muscleGroups.find(x=>x.id===t.dataset.groupName); if(g&&t.value.trim()){g.name=t.value.trim();saveState();toast("Nome atualizado.");} return;
    }
    if(t.id==="backupInput" && t.files && t.files[0]){ importBackup(t.files[0]); t.value=""; return; }
    if(draftWorkout && t.matches("[data-entry-group]")){ const x=draftWorkout.entries.find(y=>y.id===t.dataset.entryGroup); if(x)x.muscleGroupId=t.value; }
  });

  document.addEventListener("input",e=>{
    const t=e.target;
    if(!draftWorkout) return;
    if(t.id==="draftTitle"){ draftWorkout.title=t.value; return; }
    if(t.id==="draftDate"){ draftWorkout.date=t.value; return; }
    if(t.matches("[data-entry-exercise]")){ const x=draftWorkout.entries.find(y=>y.id===t.dataset.entryExercise); if(x)x.exerciseName=t.value; return; }
    if(t.matches("[data-entry-sets]")){
      const x=draftWorkout.entries.find(y=>y.id===t.dataset.entrySets); if(x){x.sets=clampHalf(t.value);const total=document.getElementById("draftTotal");if(total)total.textContent=fmt(workoutTotal(draftWorkout))+" séries";} return;
    }
  });

  addWorkoutTop.addEventListener("click",()=>openWorkout(null,todayISO()));
  window.addEventListener("hashchange",render);
  if(!location.hash) location.hash="#week"; else render();
})();