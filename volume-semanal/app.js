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

  const DEFAULT_EXERCISES = [
    {id:"ex-supino-maquina",name:"Supino máquina",allocations:[["chest",3],["triceps",1.5],["delt-front",1]]},
    {id:"ex-supino-reto",name:"Supino reto — barra",allocations:[["chest",3],["triceps",1.5],["delt-front",1]]},
    {id:"ex-supino-inclinado",name:"Supino inclinado — halteres",allocations:[["chest",3],["delt-front",1.5],["triceps",1]]},
    {id:"ex-crucifixo-maquina",name:"Crucifixo — máquina",allocations:[["chest",3]]},
    {id:"ex-desenvolvimento-maquina",name:"Desenvolvimento — máquina",allocations:[["delt-front",3],["triceps",1.5]]},
    {id:"ex-elevacao-lateral",name:"Elevação lateral — halteres",allocations:[["delt-side",3]]},
    {id:"ex-crucifixo-inverso",name:"Crucifixo inverso — máquina",allocations:[["delt-rear",3]]},
    {id:"ex-face-pull",name:"Face pull — polia",allocations:[["delt-rear",3],["back",1]]},
    {id:"ex-puxada-aberta",name:"Puxada aberta — máquina articulada",allocations:[["back",3],["biceps",1.5]]},
    {id:"ex-remada-baixa",name:"Remada baixa — pegada pronada",allocations:[["back",3],["biceps",1.5]]},
    {id:"ex-remada-aberta",name:"Remada aberta — máquina",allocations:[["back",3],["delt-rear",1.5]]},
    {id:"ex-rosca-direta",name:"Rosca direta",allocations:[["biceps",3]]},
    {id:"ex-rosca-alternada",name:"Rosca alternada — halteres",allocations:[["biceps",3]]},
    {id:"ex-triceps-frances",name:"Tríceps francês — halter",allocations:[["triceps",3]]},
    {id:"ex-triceps-polia",name:"Tríceps polia — barra W",allocations:[["triceps",3]]},
    {id:"ex-agachamento",name:"Agachamento livre",allocations:[["quads",3],["glutes",1.5]]},
    {id:"ex-leg-press",name:"Leg press 45°",allocations:[["quads",3],["glutes",1.5]]},
    {id:"ex-extensora",name:"Cadeira extensora",allocations:[["quads",3]]},
    {id:"ex-flexora",name:"Mesa flexora",allocations:[["hamstrings",3]]},
    {id:"ex-stiff",name:"Stiff / RDL",allocations:[["hamstrings",3],["glutes",1.5]]},
    {id:"ex-elevacao-pelvica",name:"Elevação pélvica",allocations:[["glutes",3],["hamstrings",1]]},
    {id:"ex-panturrilha",name:"Panturrilha em pé",allocations:[["calves",3]]},
    {id:"ex-abdominal",name:"Abdominal — máquina",allocations:[["core",3]]}
  ].map((e,i)=>({id:e.id,name:e.name,order:i,allocations:e.allocations.map(a=>({muscleGroupId:a[0],sets:a[1]}))}));

  let state = loadState();
  let route = getRoute();
  let draftWorkout = null;
  let draftExercise = null;
  let quickExerciseKey = null;
  let settingsTab = "goals";
  let exerciseSearch = "";
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
    return {version:4,muscleGroups:groups,workouts:[],goals:makeGoals(groups),exerciseLibrary:clone(DEFAULT_EXERCISES)};
  }

  function sanitizeState(raw){
    if(!raw || typeof raw!=="object") return defaultState();
    let groups = Array.isArray(raw.muscleGroups) ? raw.muscleGroups.map((g,i)=>({
      id:String(g.id||uid()),name:String(g.name||"Grupamento"),order:Number.isFinite(Number(g.order))?Number(g.order):i,
      hidden:!!g.hidden,isDefault:g.isDefault!==false
    })) : clone(DEFAULT_GROUPS);
    let workouts = Array.isArray(raw.workouts) ? raw.workouts.map(w => ({
      id:String(w.id||uid()),date:String(w.date||todayISO()),title:w.title?String(w.title):"",
      entries:Array.isArray(w.entries)?w.entries.map(e=>{
        const entryId=String(e.id||uid());
        return {
          id:entryId,exerciseKey:String(e.exerciseKey||entryId),exerciseName:e.exerciseName?String(e.exerciseName):"",
          muscleGroupId:String(e.muscleGroupId||""),sets:clampHalf(e.sets)
        };
      }).filter(e=>e.muscleGroupId&&e.sets>0):[],
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
    let exerciseLibrary;
    if(Array.isArray(raw.exerciseLibrary)){
      exerciseLibrary=raw.exerciseLibrary.map((e,i)=>({
        id:String(e.id||uid()),name:String(e.name||"Exercício"),
        order:Number.isFinite(Number(e.order))?Number(e.order):i,
        allocations:Array.isArray(e.allocations)?e.allocations.map(a=>({
          muscleGroupId:String(a.muscleGroupId||""),sets:clampHalf(a.sets)
        })).filter(a=>a.muscleGroupId&&a.sets>0):[]
      })).filter(e=>e.name&&e.allocations.length);
    }else exerciseLibrary=clone(DEFAULT_EXERCISES);
    return {version:4,muscleGroups:groups,workouts:workouts,goals:goals,exerciseLibrary:exerciseLibrary};
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
  function libraryExercises(){ return [...(state.exerciseLibrary||[])].sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name,"pt-BR")); }
  function libraryExerciseByName(name){ return libraryExercises().find(e=>norm(e.name)===norm(name)); }
  function libraryExerciseById(id){ return (state.exerciseLibrary||[]).find(e=>e.id===id); }
  function weekWorkouts(ws){ return state.workouts.filter(w=>weekStartOf(w.date)===ws).sort((a,b)=>a.date.localeCompare(b.date)); }
  function workoutTotal(w){ return w.entries.reduce((s,e)=>s+clampHalf(e.sets),0); }
  function workoutExerciseCount(w){ return new Set(w.entries.map(e=>e.exerciseKey||e.id)).size; }
  function exerciseBlocks(w){
    const map=new Map();
    w.entries.forEach(e=>{
      const key=e.exerciseKey||e.id;
      if(!map.has(key)) map.set(key,{key:key,exerciseName:e.exerciseName||"",entries:[]});
      map.get(key).entries.push(e);
    });
    return [...map.values()];
  }
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
        list.forEach(w=>{ html+='<div class="workout-mini" data-action="edit-workout" data-id="'+h(w.id)+'"><div><b>'+h(w.title||"Treino")+'</b><div class="tiny muted">'+workoutExerciseCount(w)+' '+(workoutExerciseCount(w)===1?'exercício':'exercícios')+'</div></div><div class="strong accent">'+fmt(workoutTotal(w))+' séries</div></div>'; });
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
    const allExercises=libraryExercises();
    const filteredExercises=exerciseSearch.trim()
      ? allExercises.filter(ex=>norm(ex.name).includes(norm(exerciseSearch)))
      : allExercises;

    const tabs=
      '<div class="settings-tabs" role="tablist">'+
        '<button class="settings-tab '+(settingsTab==="goals"?"active":"")+'" data-action="settings-tab" data-tab="goals"><span>◎</span><small>Metas</small></button>'+
        '<button class="settings-tab '+(settingsTab==="exercises"?"active":"")+'" data-action="settings-tab" data-tab="exercises"><span>▤</span><small>Exercícios</small></button>'+
        '<button class="settings-tab '+(settingsTab==="groups"?"active":"")+'" data-action="settings-tab" data-tab="groups"><span>◉</span><small>Grupamentos</small></button>'+
        '<button class="settings-tab '+(settingsTab==="data"?"active":"")+'" data-action="settings-tab" data-tab="data"><span>↕</span><small>Dados</small></button>'+
      '</div>';

    let body="";

    if(settingsTab==="goals"){
      const visibleCount=goals.filter(g=>g.visible).length;
      body=
        '<section class="settings-panel"><div class="settings-panel-head"><div><div class="eyebrow">PAINEL SEMANAL</div><h2>Metas</h2><div class="small muted">'+visibleCount+' de '+goals.length+' grupamentos aparecem no painel.</div></div></div>'+
        '<div class="settings-list">'+goals.map((g,i)=>
          '<div class="setting-row"><div class="goal-config"><div><b>'+h(g.name)+'</b><div class="tiny muted">Meta semanal</div></div>'+
          '<div class="goal-controls"><input class="target-input" inputmode="decimal" step="0.5" min="0" value="'+fmt(g.target).replace(",",".")+'" data-goal-target="'+h(g.id)+'">'+
          '<label class="switch" title="Mostrar no painel"><input type="checkbox" data-goal-visible="'+h(g.id)+'" '+(g.visible?'checked':'')+'><span class="slider"></span></label></div></div>'+
          '<div class="setting-line setting-row-footer"><span class="tiny muted">'+(g.visible?'Visível no painel':'Oculto do painel')+'</span><div class="setting-actions"><button class="move-btn" data-action="move-goal" data-id="'+h(g.id)+'" data-dir="-1" '+(i===0?'disabled':'')+'>↑</button><button class="move-btn" data-action="move-goal" data-id="'+h(g.id)+'" data-dir="1" '+(i===goals.length-1?'disabled':'')+'>↓</button></div></div></div>'
        ).join("")+'</div></section>';
    }

    if(settingsTab==="exercises"){
      body=
        '<section class="settings-panel"><div class="settings-panel-head"><div><div class="eyebrow">BIBLIOTECA</div><h2>Exercícios</h2><div class="small muted">'+allExercises.length+' exercícios cadastrados.</div></div><button class="btn primary compact-btn" data-action="add-library-exercise">＋ Novo</button></div>'+
        '<div class="exercise-search-wrap"><input class="input" id="exerciseLibrarySearch" type="search" placeholder="Buscar exercício..." value="'+h(exerciseSearch)+'"><span class="exercise-search-count">'+filteredExercises.length+'</span></div>'+
        (filteredExercises.length
          ? '<div class="settings-list exercise-settings-list">'+filteredExercises.map(ex=>
              '<div class="setting-row library-exercise-row"><div class="setting-line"><div class="library-exercise-main"><b>'+h(ex.name)+'</b><div class="pills">'+ex.allocations.map(a=>{const g=groupById(a.muscleGroupId);return '<span class="pill">'+h(g?g.name:"Removido")+' '+fmt(a.sets)+'</span>';}).join("")+'</div></div>'+
              '<div class="setting-actions"><button class="move-btn library-edit-btn" data-action="edit-library-exercise" data-id="'+h(ex.id)+'" aria-label="Editar exercício">✎</button><button class="move-btn library-delete-btn" data-action="delete-library-exercise" data-id="'+h(ex.id)+'" aria-label="Excluir exercício">×</button></div></div></div>'
            ).join("")+'</div>'
          : '<div class="card empty">Nenhum exercício encontrado.</div>')+
        '</section>';
    }

    if(settingsTab==="groups"){
      body=
        '<section class="settings-panel"><div class="settings-panel-head"><div><div class="eyebrow">CADASTRO</div><h2>Grupamentos</h2><div class="small muted">Controle os grupamentos disponíveis ao registrar uma série.</div></div><button class="btn primary compact-btn" data-action="add-group">＋ Novo</button></div>'+
        '<div class="settings-list">'+groups.map((g,i)=>
          '<div class="setting-row"><div class="setting-line"><input class="input group-name-input" value="'+h(g.name)+'" data-group-name="'+h(g.id)+'"><label class="switch"><input type="checkbox" data-group-visible="'+h(g.id)+'" '+(!g.hidden?'checked':'')+'><span class="slider"></span></label></div>'+
          '<div class="setting-line setting-row-footer"><span class="tiny muted">'+(g.hidden?'Oculto no registro':'Disponível no registro')+'</span><div class="setting-actions"><button class="move-btn" data-action="move-group" data-id="'+h(g.id)+'" data-dir="-1" '+(i===0?'disabled':'')+'>↑</button><button class="move-btn" data-action="move-group" data-id="'+h(g.id)+'" data-dir="1" '+(i===groups.length-1?'disabled':'')+'>↓</button>'+(g.isDefault?'':'<button class="move-btn library-delete-btn" data-action="delete-group" data-id="'+h(g.id)+'">×</button>')+'</div></div></div>'
        ).join("")+'</div></section>';
    }

    if(settingsTab==="data"){
      body=
        '<section class="settings-panel"><div class="settings-panel-head"><div><div class="eyebrow">SEGURANÇA</div><h2>Dados e backup</h2><div class="small muted">Faça backup antes de mudanças grandes ou troca de aparelho.</div></div></div>'+
        '<div class="data-actions-grid"><button class="data-action-card" data-action="export-backup"><span class="data-action-icon">↓</span><div><b>Exportar backup</b><small>Baixar todos os treinos, metas e biblioteca em JSON.</small></div></button>'+
        '<button class="data-action-card" data-action="import-backup"><span class="data-action-icon">↑</span><div><b>Importar backup</b><small>Restaurar um arquivo JSON salvo anteriormente.</small></div></button></div>'+
        '<input id="backupInput" type="file" accept=".json,application/json" hidden>'+
        '<div class="card danger-zone data-danger"><div><h3>Apagar todos os dados</h3><p class="small muted">Remove treinos, histórico e configurações locais deste aparelho.</p></div><button class="btn danger" data-action="wipe-data">Apagar tudo</button></div>'+
        '</section>';
    }

    app.innerHTML=tabs+body;
  }

  function openWorkout(id,date){
    const existing=id?state.workouts.find(w=>w.id===id):null;
    const first=activeGroups()[0];
    draftWorkout=existing?clone(existing):{
      id:uid(),date:date||todayISO(),title:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      entries:(()=>{ const key=uid(); return [{id:uid(),exerciseKey:key,exerciseName:"",muscleGroupId:first?first.id:"",sets:3}]; })()
    };
    renderWorkoutModal(!!existing);
  }

  function allocationHtml(e){
    const groups=activeGroups();
    return '<div class="allocation-row" data-allocation="'+h(e.id)+'">'+
      '<select class="select allocation-group" data-entry-group="'+h(e.id)+'">'+groups.map(g=>'<option value="'+h(g.id)+'" '+(g.id===e.muscleGroupId?'selected':'')+'>'+h(g.name)+'</option>').join("")+'</select>'+
      '<div class="allocation-counter"><button data-action="entry-minus" data-id="'+h(e.id)+'">−</button>'+
      '<input class="input allocation-sets" inputmode="decimal" step="0.5" min="0" value="'+fmt(e.sets).replace(",",".")+'" data-entry-sets="'+h(e.id)+'">'+
      '<button data-action="entry-plus" data-id="'+h(e.id)+'">＋</button></div>'+
      '<button class="allocation-remove" data-action="allocation-delete" data-id="'+h(e.id)+'" aria-label="Remover grupamento">×</button>'+
      '</div>';
  }

  function entryHtml(block){
    return '<div class="entry-card" data-exercise-key="'+h(block.key)+'">'+
      '<div class="exercise-picker">'+
        '<input class="input exercise-name-input" placeholder="Digite ou escolha um exercício" autocomplete="off" autocapitalize="sentences" value="'+h(block.exerciseName||"")+'" data-exercise-name="'+h(block.key)+'">'+
        '<button class="exercise-picker-toggle" type="button" data-action="toggle-exercise-suggestions" data-key="'+h(block.key)+'" aria-label="Mostrar exercícios">⌄</button>'+
        '<div class="exercise-suggestions" data-exercise-suggestions="'+h(block.key)+'"></div>'+
      '</div>'+
      '<div class="allocation-label"><span>Grupamentos e séries</span><span class="tiny muted">'+block.entries.length+' '+(block.entries.length===1?'grupamento':'grupamentos')+'</span></div>'+
      '<div class="allocation-list">'+block.entries.map(allocationHtml).join("")+'</div>'+
      '<button class="add-muscle-btn" data-action="add-allocation" data-key="'+h(block.key)+'">＋ Adicionar grupamento</button>'+
      '<div class="entry-actions exercise-actions"><div></div><div class="entry-tools">'+
      '<button data-action="entry-duplicate" data-key="'+h(block.key)+'">Duplicar exercício</button>'+
      '<button data-action="entry-delete" data-key="'+h(block.key)+'">Excluir exercício</button>'+
      '</div></div></div>';
  }

  function renderWorkoutModal(isEdit){
    modalRoot.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">'+(isEdit?'EDITAR':'NOVO')+'</div><h2>Treino</h2></div><button class="close-btn" data-action="close-modal">×</button></div>'+
      '<div class="field"><label>Data</label><input class="input" type="date" id="draftDate" value="'+h(draftWorkout.date)+'"></div>'+
      '<div class="field"><label>Nome do treino (opcional)</label><input class="input" id="draftTitle" placeholder="Ex.: Push A" value="'+h(draftWorkout.title||"")+'"></div>'+
      '<div class="section-head"><h3>Séries contabilizadas</h3><b class="accent" id="draftTotal">'+fmt(workoutTotal(draftWorkout))+' séries</b></div>'+

      '<div id="entryList">'+exerciseBlocks(draftWorkout).map(entryHtml).join("")+'</div>'+
      '<button class="btn" style="width:100%" data-action="add-entry">＋ Adicionar exercício</button>'+
      '<div class="modal-footer '+(isEdit?'':'single')+'">'+(isEdit?'<button class="btn danger" data-action="delete-workout" data-id="'+h(draftWorkout.id)+'">Excluir treino</button>':'')+'<button class="btn primary" data-action="save-workout">Salvar treino</button></div></div></div>';
  }

  function rerenderWorkoutModalPreserveScroll(isEdit){
    const currentModal=document.querySelector(".modal");
    const modalScroll=currentModal?currentModal.scrollTop:0;
    const pageScroll=window.scrollY||document.documentElement.scrollTop||0;
    renderWorkoutModal(isEdit);
    const restore=()=>{
      const nextModal=document.querySelector(".modal");
      if(nextModal) nextModal.scrollTop=modalScroll;
      window.scrollTo(0,pageScroll);
    };
    restore();
    requestAnimationFrame(()=>{ restore(); requestAnimationFrame(restore); });
  }

  function exerciseSuggestions(query){
    const q=norm(query);
    return libraryExercises()
      .filter(ex=>!q||norm(ex.name).includes(q))
      .sort((a,b)=>{
        if(!q) return (a.order||0)-(b.order||0);
        const an=norm(a.name), bn=norm(b.name);
        const as=an.startsWith(q)?0:1, bs=bn.startsWith(q)?0:1;
        return as-bs || an.indexOf(q)-bn.indexOf(q) || a.name.localeCompare(b.name,"pt-BR");
      });
  }

  function hideExerciseSuggestions(exceptKey){
    document.querySelectorAll("[data-exercise-suggestions]").forEach(box=>{
      if(!exceptKey||box.dataset.exerciseSuggestions!==exceptKey){
        box.classList.remove("open");
        box.innerHTML="";
      }
    });
  }

  function showExerciseSuggestions(exerciseKey,query){
    const box=document.querySelector('[data-exercise-suggestions="'+CSS.escape(exerciseKey)+'"]');
    if(!box) return;
    hideExerciseSuggestions(exerciseKey);
    const typed=String(query||"").trim();
    const matches=exerciseSuggestions(typed);
    const exact=typed&&libraryExerciseByName(typed);
    let html=matches.map(ex=>
      '<button type="button" class="exercise-suggestion" data-action="select-library-exercise" data-key="'+h(exerciseKey)+'" data-exercise-id="'+h(ex.id)+'">'+
        '<span class="exercise-suggestion-name">'+h(ex.name)+'</span>'+
        '<span class="exercise-suggestion-muscles">'+ex.allocations.map(a=>{const g=groupById(a.muscleGroupId);return h(g?g.name:"");}).filter(Boolean).join(" · ")+'</span>'+
      '</button>'
    ).join("");

    if(typed&&!exact){
      html+='<button type="button" class="exercise-suggestion create-exercise-suggestion" data-action="create-exercise-from-workout" data-key="'+h(exerciseKey)+'">'+
        '<span class="create-exercise-icon">＋</span><span><span class="exercise-suggestion-name">Criar “'+h(typed)+'”</span>'+
        '<span class="exercise-suggestion-muscles">Adicionar à biblioteca ou usar apenas neste treino</span></span></button>';
    }

    if(!html) html='<div class="exercise-suggestion-empty">Comece a digitar para buscar um exercício.</div>';
    box.innerHTML=html;
    box.classList.add("open");
  }

  function applyExerciseTemplate(exerciseKey,template){
    if(!draftWorkout||!template) return false;
    syncDraftInputs();
    const indices=[];
    draftWorkout.entries.forEach((e,i)=>{ if((e.exerciseKey||e.id)===exerciseKey) indices.push(i); });
    if(!indices.length) return false;
    const fresh=(template.allocations||[]).filter(a=>groupById(a.muscleGroupId)&&clampHalf(a.sets)>0).map(a=>({
      id:uid(),exerciseKey:exerciseKey,exerciseName:template.name,muscleGroupId:a.muscleGroupId,sets:clampHalf(a.sets)
    }));
    if(!fresh.length) return false;
    draftWorkout.entries.splice(indices[0],indices.length,...fresh);
    return true;
  }

  function syncDraftInputs(){
    const d=document.getElementById("draftDate"), t=document.getElementById("draftTitle");
    if(d) draftWorkout.date=d.value||todayISO();
    if(t) draftWorkout.title=t.value.trim();

    exerciseBlocks(draftWorkout).forEach(block=>{
      const ex=document.querySelector('[data-exercise-name="'+CSS.escape(block.key)+'"]');
      if(ex){
        draftWorkout.entries.filter(e=>(e.exerciseKey||e.id)===block.key).forEach(e=>e.exerciseName=ex.value);
      }
    });

    draftWorkout.entries.forEach(e=>{
      const gr=document.querySelector('[data-entry-group="'+CSS.escape(e.id)+'"]');
      const st=document.querySelector('[data-entry-sets="'+CSS.escape(e.id)+'"]');
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

  function closeModal(){ modalRoot.innerHTML=""; draftWorkout=null; draftExercise=null; quickExerciseKey=null; }

  function libraryAllocationHtml(a){
    const groups=activeGroups();
    return '<div class="allocation-row library-allocation-row">'+
      '<select class="select allocation-group" data-lib-group="'+h(a.id)+'">'+groups.map(g=>'<option value="'+h(g.id)+'" '+(g.id===a.muscleGroupId?'selected':'')+'>'+h(g.name)+'</option>').join("")+'</select>'+
      '<div class="allocation-counter"><button data-action="lib-minus" data-id="'+h(a.id)+'">−</button>'+
      '<input class="input allocation-sets" inputmode="decimal" step="0.5" min="0" value="'+fmt(a.sets).replace(",",".")+'" data-lib-sets="'+h(a.id)+'">'+
      '<button data-action="lib-plus" data-id="'+h(a.id)+'">＋</button></div>'+
      '<button class="allocation-remove" data-action="lib-delete-allocation" data-id="'+h(a.id)+'">×</button></div>';
  }

  function openQuickExerciseCreator(exerciseKey,name){
    if(!draftWorkout) return;
    syncDraftInputs();
    const block=exerciseBlocks(draftWorkout).find(b=>b.key===exerciseKey);
    if(!block) return;
    quickExerciseKey=exerciseKey;
    draftExercise={
      id:uid(),
      name:String(name||block.exerciseName||"").trim(),
      order:(state.exerciseLibrary||[]).length,
      allocations:block.entries.map(e=>({id:uid(),muscleGroupId:e.muscleGroupId,sets:clampHalf(e.sets)}))
    };
    if(!draftExercise.allocations.length){
      const first=activeGroups()[0];
      draftExercise.allocations=[{id:uid(),muscleGroupId:first?first.id:"",sets:3}];
    }
    hideExerciseSuggestions();
    renderQuickExerciseCreator();
  }

  function renderQuickExerciseCreator(){
    const old=document.getElementById("quickExerciseCreator");
    if(old) old.remove();
    modalRoot.insertAdjacentHTML("beforeend",
      '<div class="quick-exercise-backdrop" id="quickExerciseCreator"><div class="quick-exercise-modal">'+
        '<div class="modal-head"><div><div class="eyebrow">NOVO EXERCÍCIO</div><h2>'+h(draftExercise.name||"Exercício")+'</h2></div><button class="close-btn" data-action="quick-exercise-close">×</button></div>'+
        '<div class="field"><label>Nome do exercício</label><input class="input" id="libraryExerciseName" placeholder="Ex.: Pullover na polia" value="'+h(draftExercise.name||"")+'"></div>'+
        '<div class="quick-create-info"><b>Defina o padrão</b><span>Escolha quais grupamentos esse exercício trabalha e quanto volume ele deve sugerir inicialmente.</span></div>'+
        '<div>'+draftExercise.allocations.map(libraryAllocationHtml).join("")+'</div>'+
        '<button class="btn" style="width:100%" data-action="lib-add-allocation">＋ Adicionar grupamento</button>'+
        '<div class="quick-create-actions">'+
          '<button class="btn" data-action="quick-exercise-use-once">Usar só neste treino</button>'+
          '<button class="btn primary" data-action="quick-exercise-save-use">Salvar e usar no treino</button>'+
        '</div>'+
      '</div></div>'
    );
  }

  function rerenderQuickExerciseCreatorPreserveScroll(){
    const current=document.querySelector("#quickExerciseCreator .quick-exercise-modal");
    const top=current?current.scrollTop:0;
    renderQuickExerciseCreator();
    const next=document.querySelector("#quickExerciseCreator .quick-exercise-modal");
    if(next) next.scrollTop=top;
  }

  function closeQuickExerciseCreator(){
    const quick=document.getElementById("quickExerciseCreator");
    if(quick) quick.remove();
    draftExercise=null;
    quickExerciseKey=null;
  }

  function useQuickExercise(saveToLibrary){
    if(!draftWorkout||!draftExercise||!quickExerciseKey) return;
    syncDraftExercise();
    const name=String(draftExercise.name||"").trim();
    const allocations=draftExercise.allocations
      .filter(a=>a.muscleGroupId&&clampHalf(a.sets)>0)
      .map(a=>({muscleGroupId:a.muscleGroupId,sets:clampHalf(a.sets)}));
    if(!name){ toast("Digite o nome do exercício."); return; }
    if(!allocations.length){ toast("Adicione ao menos um grupamento."); return; }

    if(saveToLibrary){
      const duplicate=(state.exerciseLibrary||[]).find(e=>norm(e.name)===norm(name));
      if(duplicate){ toast("Esse exercício já existe na biblioteca."); return; }
      state.exerciseLibrary.push({
        id:draftExercise.id||uid(),
        name:name,
        order:(state.exerciseLibrary||[]).length,
        allocations:clone(allocations)
      });
      saveState();
    }

    const key=quickExerciseKey;
    const template={name:name,allocations:allocations};
    const applied=applyExerciseTemplate(key,template);
    closeQuickExerciseCreator();
    if(applied){
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id));
      toast(saveToLibrary?"Exercício salvo e aplicado.":"Exercício aplicado só neste treino.");
    }
  }

  function openExerciseEditor(id){
    quickExerciseKey=null;
    const existing=id?libraryExerciseById(id):null, first=activeGroups()[0];
    draftExercise=existing?{
      id:existing.id,name:existing.name,order:existing.order,
      allocations:existing.allocations.map(a=>({id:uid(),muscleGroupId:a.muscleGroupId,sets:a.sets}))
    }:{id:uid(),name:"",order:(state.exerciseLibrary||[]).length,allocations:[{id:uid(),muscleGroupId:first?first.id:"",sets:3}]};
    renderExerciseEditorModal(!!existing);
  }

  function renderExerciseEditorModal(isEdit){
    modalRoot.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><div class="eyebrow">'+(isEdit?'EDITAR':'NOVO')+'</div><h2>Exercício da biblioteca</h2></div><button class="close-btn" data-action="close-modal">×</button></div>'+
      '<div class="field"><label>Nome do exercício</label><input class="input" id="libraryExerciseName" placeholder="Ex.: Supino inclinado" value="'+h(draftExercise.name||"")+'"></div>'+
      '<div class="section-head"><div><h3>Grupamentos padrão</h3><div class="tiny muted">Esse volume é só o ponto de partida e pode ser alterado no treino.</div></div></div>'+
      '<div>'+draftExercise.allocations.map(libraryAllocationHtml).join("")+'</div>'+
      '<button class="btn" style="width:100%" data-action="lib-add-allocation">＋ Adicionar grupamento</button>'+
      '<div class="modal-footer single"><button class="btn primary" data-action="save-library-exercise">Salvar exercício</button></div></div></div>';
  }

  function syncDraftExercise(){
    if(!draftExercise) return;
    const n=document.getElementById("libraryExerciseName"); if(n) draftExercise.name=n.value.trim();
    draftExercise.allocations.forEach(a=>{
      const g=document.querySelector('[data-lib-group="'+CSS.escape(a.id)+'"]');
      const s=document.querySelector('[data-lib-sets="'+CSS.escape(a.id)+'"]');
      if(g) a.muscleGroupId=g.value;
      if(s) a.sets=clampHalf(s.value);
    });
  }

  function rerenderExerciseEditorPreserveScroll(isEdit){
    const current=document.querySelector(".modal"), top=current?current.scrollTop:0;
    renderExerciseEditorModal(isEdit);
    const next=document.querySelector(".modal"); if(next) next.scrollTop=top;
  }

  function saveLibraryExercise(){
    syncDraftExercise();
    if(!draftExercise.name){ toast("Digite o nome do exercício."); return; }
    draftExercise.allocations=draftExercise.allocations.filter(a=>a.muscleGroupId&&clampHalf(a.sets)>0);
    if(!draftExercise.allocations.length){ toast("Adicione ao menos um grupamento."); return; }
    const duplicate=(state.exerciseLibrary||[]).find(e=>e.id!==draftExercise.id&&norm(e.name)===norm(draftExercise.name));
    if(duplicate){ toast("Já existe um exercício com esse nome."); return; }
    const clean={id:draftExercise.id,name:draftExercise.name,order:draftExercise.order,
      allocations:draftExercise.allocations.map(a=>({muscleGroupId:a.muscleGroupId,sets:clampHalf(a.sets)}))};
    const idx=(state.exerciseLibrary||[]).findIndex(e=>e.id===clean.id);
    if(idx>=0) state.exerciseLibrary[idx]=clean; else state.exerciseLibrary.push(clean);
    saveState(); closeModal(); renderSettings(); toast("Exercício salvo na biblioteca.");
  }

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
    const data={app:"volume-semanal-github",version:4,exportedAt:new Date().toISOString(),muscleGroups:state.muscleGroups,workouts:state.workouts,goals:state.goals,exerciseLibrary:state.exerciseLibrary};
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

    if(action==="toggle-exercise-suggestions"&&draftWorkout){
      const key=el.dataset.key;
      const box=document.querySelector('[data-exercise-suggestions="'+CSS.escape(key)+'"]');
      if(box&&box.classList.contains("open")) hideExerciseSuggestions();
      else{
        const input=document.querySelector('[data-exercise-name="'+CSS.escape(key)+'"]');
        showExerciseSuggestions(key,input?input.value:"");
        if(input) input.focus();
      }
      return;
    }
    if(action==="create-exercise-from-workout"&&draftWorkout){
      const key=el.dataset.key;
      const input=document.querySelector('[data-exercise-name="'+CSS.escape(key)+'"]');
      const name=input?input.value.trim():"";
      if(!name){ toast("Digite o nome do exercício."); return; }
      openQuickExerciseCreator(key,name);
      return;
    }
    if(action==="quick-exercise-close"){
      closeQuickExerciseCreator();
      return;
    }
    if(action==="quick-exercise-use-once"){
      useQuickExercise(false);
      return;
    }
    if(action==="quick-exercise-save-use"){
      useQuickExercise(true);
      return;
    }

    if(action==="select-library-exercise"&&draftWorkout){
      const template=libraryExerciseById(el.dataset.exerciseId);
      const key=el.dataset.key;
      if(template&&applyExerciseTemplate(key,template)){
        hideExerciseSuggestions();
        rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id));
        toast(template.name+" aplicado.");
      }
      return;
    }

    if(action==="settings-tab"){
      settingsTab=el.dataset.tab||"goals";
      renderSettings();
      window.scrollTo(0,0);
      return;
    }
    if(action==="new-workout"){ openWorkout(null,el.dataset.date||todayISO()); return; }
    if(action==="edit-workout"){ openWorkout(el.dataset.id); return; }
    if(action==="close-modal"){ closeModal(); return; }
    if(action==="open-history"){ openHistory(el.dataset.week); return; }
    if(action==="history-edit-workout"){ const id=el.dataset.id; closeModal(); openWorkout(id); return; }

    if(action==="add-entry" && draftWorkout){
      syncDraftInputs(); const g=activeGroups()[0], key=uid();
      draftWorkout.entries.push({id:uid(),exerciseKey:key,exerciseName:"",muscleGroupId:g?g.id:"",sets:3});
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }

    if(action==="add-allocation" && draftWorkout){
      syncDraftInputs();
      const key=el.dataset.key;
      const block=exerciseBlocks(draftWorkout).find(b=>b.key===key); if(!block)return;
      const used=new Set(block.entries.map(x=>x.muscleGroupId));
      const group=activeGroups().find(g=>!used.has(g.id))||activeGroups()[0];
      const name=block.exerciseName||"";
      draftWorkout.entries.push({id:uid(),exerciseKey:key,exerciseName:name,muscleGroupId:group?group.id:"",sets:3});
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }

    if(action==="allocation-delete" && draftWorkout){
      syncDraftInputs();
      const item=draftWorkout.entries.find(x=>x.id===el.dataset.id); if(!item)return;
      const key=item.exerciseKey||item.id;
      const same=draftWorkout.entries.filter(x=>(x.exerciseKey||x.id)===key);
      if(same.length<=1){ toast("O exercício precisa ter ao menos um grupamento."); return; }
      draftWorkout.entries=draftWorkout.entries.filter(x=>x.id!==el.dataset.id);
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }

    if((action==="entry-minus"||action==="entry-plus")&&draftWorkout){
      syncDraftInputs(); const i=draftWorkout.entries.findIndex(x=>x.id===el.dataset.id); if(i<0)return;
      const delta=action==="entry-plus"?.5:-.5;
      draftWorkout.entries[i].sets=Math.max(0,clampHalf(draftWorkout.entries[i].sets)+delta);
      const input=document.querySelector('[data-entry-sets="'+CSS.escape(draftWorkout.entries[i].id)+'"]');
      if(input) input.value=String(draftWorkout.entries[i].sets);
      const total=document.getElementById("draftTotal");
      if(total) total.textContent=fmt(workoutTotal(draftWorkout))+" séries";
      return;
    }

    if((action==="entry-duplicate"||action==="entry-delete")&&draftWorkout){
      syncDraftInputs(); const key=el.dataset.key;
      const block=exerciseBlocks(draftWorkout).find(b=>b.key===key); if(!block)return;
      if(action==="entry-duplicate"){
        const newKey=uid();
        const copies=block.entries.map(e=>({...clone(e),id:uid(),exerciseKey:newKey}));
        draftWorkout.entries.push(...copies);
      }
      if(action==="entry-delete") draftWorkout.entries=draftWorkout.entries.filter(e=>(e.exerciseKey||e.id)!==key);
      rerenderWorkoutModalPreserveScroll(state.workouts.some(w=>w.id===draftWorkout.id)); return;
    }
    if(action==="save-workout"){ saveWorkout(); return; }
    if(action==="delete-workout"){
      if(confirm("Excluir este treino?")){ state.workouts=state.workouts.filter(w=>w.id!==el.dataset.id); saveState(); closeModal(); render(); toast("Treino excluído."); } return;
    }

    if(action==="add-library-exercise"){ openExerciseEditor(null); return; }
    if(action==="edit-library-exercise"){ openExerciseEditor(el.dataset.id); return; }
    if(action==="delete-library-exercise"){
      const ex=libraryExerciseById(el.dataset.id); if(!ex)return;
      if(confirm('Excluir "'+ex.name+'" da biblioteca? Isso não altera treinos salvos.')){
        state.exerciseLibrary=state.exerciseLibrary.filter(x=>x.id!==ex.id); saveState(); renderSettings(); toast("Exercício removido.");
      }
      return;
    }
    if(action==="lib-add-allocation"&&draftExercise){
      syncDraftExercise();
      const used=new Set(draftExercise.allocations.map(a=>a.muscleGroupId));
      const g=activeGroups().find(x=>!used.has(x.id))||activeGroups()[0];
      draftExercise.allocations.push({id:uid(),muscleGroupId:g?g.id:"",sets:3});
      if(quickExerciseKey) rerenderQuickExerciseCreatorPreserveScroll();
      else rerenderExerciseEditorPreserveScroll(!!libraryExerciseById(draftExercise.id));
      return;
    }
    if((action==="lib-minus"||action==="lib-plus")&&draftExercise){
      syncDraftExercise(); const a=draftExercise.allocations.find(x=>x.id===el.dataset.id); if(!a)return;
      a.sets=Math.max(0,clampHalf(a.sets)+(action==="lib-plus"?.5:-.5));
      const input=document.querySelector('[data-lib-sets="'+CSS.escape(a.id)+'"]'); if(input)input.value=String(a.sets); return;
    }
    if(action==="lib-delete-allocation"&&draftExercise){
      syncDraftExercise();
      if(draftExercise.allocations.length<=1){ toast("O exercício precisa ter ao menos um grupamento."); return; }
      draftExercise.allocations=draftExercise.allocations.filter(a=>a.id!==el.dataset.id);
      if(quickExerciseKey) rerenderQuickExerciseCreatorPreserveScroll();
      else rerenderExerciseEditorPreserveScroll(!!libraryExerciseById(draftExercise.id));
      return;
    }
    if(action==="save-library-exercise"){ saveLibraryExercise(); return; }

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
    if(t.matches("[data-lib-group]")&&draftExercise){
      const a=draftExercise.allocations.find(x=>x.id===t.dataset.libGroup); if(a)a.muscleGroupId=t.value; return;
    }
    if(t.id==="backupInput" && t.files && t.files[0]){ importBackup(t.files[0]); t.value=""; return; }
    if(draftWorkout && t.matches("[data-entry-group]")){ const x=draftWorkout.entries.find(y=>y.id===t.dataset.entryGroup); if(x)x.muscleGroupId=t.value; }
  });

  document.addEventListener("input",e=>{
    const t=e.target;
    if(t.id==="exerciseLibrarySearch"){
      exerciseSearch=t.value;
      const cursor=t.selectionStart;
      renderSettings();
      const next=document.getElementById("exerciseLibrarySearch");
      if(next){ next.focus(); if(cursor!=null) next.setSelectionRange(cursor,cursor); }
      return;
    }
    if(draftExercise){
      if(t.id==="libraryExerciseName"){ draftExercise.name=t.value; return; }
      if(t.matches("[data-lib-sets]")){ const a=draftExercise.allocations.find(x=>x.id===t.dataset.libSets); if(a)a.sets=clampHalf(t.value); return; }
    }
    if(!draftWorkout) return;
    if(t.id==="draftTitle"){ draftWorkout.title=t.value; return; }
    if(t.id==="draftDate"){ draftWorkout.date=t.value; return; }
    if(t.matches("[data-exercise-name]")){
      const key=t.dataset.exerciseName;
      draftWorkout.entries.filter(y=>(y.exerciseKey||y.id)===key).forEach(x=>x.exerciseName=t.value);
      showExerciseSuggestions(key,t.value);
      return;
    }
    if(t.matches("[data-entry-sets]")){
      const x=draftWorkout.entries.find(y=>y.id===t.dataset.entrySets); if(x){x.sets=clampHalf(t.value);const total=document.getElementById("draftTotal");if(total)total.textContent=fmt(workoutTotal(draftWorkout))+" séries";} return;
    }
  });

  document.addEventListener("focusin",e=>{
    const t=e.target;
    if(t.matches&&t.matches("[data-exercise-name]")&&draftWorkout){
      showExerciseSuggestions(t.dataset.exerciseName,t.value);
    }
  });

  document.addEventListener("pointerdown",e=>{
    if(!e.target.closest(".exercise-picker")) hideExerciseSuggestions();
  });

  addWorkoutTop.addEventListener("click",()=>openWorkout(null,todayISO()));
  window.addEventListener("hashchange",render);
  if(!location.hash) location.hash="#week"; else render();
})();