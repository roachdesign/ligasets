const STORAGE_KEY = "clasificacionTenisMesaSetsV2";
const initialTeams = [
  {id:"1",name:"Ateneo de Versailles B"},
  {id:"2",name:"Tomodachi B"},
  {id:"3",name:"Estacion Ping Pong"},
  {id:"4",name:"Nikkei TDM A"}
];

// Cada partido guarda sets ganados por A y B; no se cargan puntos de cada set.
const initialMatches = [
  {id:"initial-1",teamA:"1",teamB:"4",games:[[3,1],[1,3],[3,0],[3,0],[3,2]],wo:false},
  {id:"initial-2",teamA:"2",teamB:"3",games:[[1,3],[1,3],[3,1],[3,0],[3,2]],wo:false}
];

function freshState() {
  return {teams:initialTeams.map(t=>({...t})),matches:initialMatches.map(m=>({...m,games:m.games.map(g=>[...g])})),nextId:5};
}
function loadState() {
  try {
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved) {
      const parsed=JSON.parse(saved);
      if(Array.isArray(parsed.teams)&&Array.isArray(parsed.matches)) return parsed;
    }
  } catch(e) {}
  return freshState();
}
let state=loadState();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function teamName(id){return state.teams.find(t=>t.id===id)?.name||"Equipo eliminado";}

function summarize(m) {
  let setsA=0,setsB=0,pgA=0,pgB=0;
  if(m.wo) {
    const loser=m.woLoser;
    if(loser===m.teamA){pgB=5;pgA=0;}
    else {pgA=5;pgB=0;}
    // WO no contiene parciales reales; los sets no se computan como conocidos.
    return {setsA:0,setsB:0,pgA,pgB,wo:true,winner:pgA>pgB?m.teamA:m.teamB};
  }
  for(const g of m.games) {
    setsA+=g[0]; setsB+=g[1];
    if(g[0]===3) pgA++;
    else if(g[1]===3) pgB++;
  }
  return {setsA,setsB,pgA,pgB,wo:false,winner:pgA>pgB?m.teamA:m.teamB};
}
function calculateStandings() {
  const map=new Map(state.teams.map(t=>[t.id,{...t,points:0,wins:0,losses:0,wo:0,played:0,pg:0,pp:0,setsFor:0,setsAgainst:0}]));
  state.matches.forEach(m=>{
    const a=map.get(m.teamA),b=map.get(m.teamB); if(!a||!b)return;
    const s=summarize(m);
    a.played++;b.played++;
    a.pg+=s.pgA;a.pp+=s.pgB;b.pg+=s.pgB;b.pp+=s.pgA;
    if(!m.wo){a.setsFor+=s.setsA;a.setsAgainst+=s.setsB;b.setsFor+=s.setsB;b.setsAgainst+=s.setsA;}
    const winner=map.get(s.winner),loser=winner.id===a.id?b:a;
    winner.wins++;loser.losses++;winner.points+=2;loser.points+=1;
    if(m.wo) winner.wo++;
  });
  return [...map.values()].map(t=>({...t,diff:t.pg-t.pp,setDiff:t.setsFor-t.setsAgainst}))
    .sort((a,b)=>b.points-a.points||b.diff-a.diff||b.setDiff-a.setDiff||b.pg-a.pg||b.wins-a.wins||a.name.localeCompare(b.name,"es"));
}
function renderStandings(){
  document.getElementById("standings").innerHTML=calculateStandings().map((s,i)=>`
  <tr><td>${i+1}</td><td class="team">${esc(s.name)}</td><td>${s.points}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.wo}</td><td>${s.played}</td><td>${s.pg}</td><td>${s.pp}</td><td>${s.diff>0?"+":""}${s.diff}</td><td>${s.setDiff>0?"+":""}${s.setDiff}</td></tr>`).join("");
}
function fillSelect(el,selected){
  el.innerHTML=state.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
  if(selected&&state.teams.some(t=>t.id===selected))el.value=selected;
}
function renderTeamControls(){
  const a=document.getElementById("teamA").value,b=document.getElementById("teamB").value,w=document.getElementById("woLoser").value;
  fillSelect(document.getElementById("teamA"),a);fillSelect(document.getElementById("teamB"),b);fillSelect(document.getElementById("woLoser"),w);
  document.getElementById("teamList").innerHTML=state.teams.map(t=>`<li><span>${esc(t.name)}</span><button class="small-button" type="button" data-remove-team="${esc(t.id)}">Quitar</button></li>`).join("");
}
function renderGames(){
  document.getElementById("games").innerHTML=["Single 1","Single 2","Single 3","Single 4","Dobles"].map((name,i)=>`
    <div class="game-row">
      <label for="a${i}">${name}</label>
      <input id="a${i}" type="number" min="0" max="3" step="1" value="" placeholder="A" required>
      <span class="dash">–</span>
      <input id="b${i}" type="number" min="0" max="3" step="1" value="" placeholder="B" required>
      <div class="game-result" id="result${i}">Ingresá los sets ganados (el ganador debe tener 3).</div>
    </div>`).join("");
  for(let i=0;i<5;i++){
    ["a","b"].forEach(side=>document.getElementById(side+i).addEventListener("input",updatePreview));
  }
}
function getGamesFromForm(){
  const games=[];
  for(let i=0;i<5;i++){
    const a=document.getElementById("a"+i).value,b=document.getElementById("b"+i).value;
    if(a===""||b==="")return {error:"Completá los sets ganados en los cinco partidos."};
    const x=Number(a),y=Number(b);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>3||y>3||x===y||Math.max(x,y)!==3)
      return {error:`En ${["Single 1","Single 2","Single 3","Single 4","Dobles"][i]}, el resultado debe ser 3-0, 3-1, 3-2 o su inverso.`};
    games.push([x,y]);
  }
  return {games};
}
function updatePreview(){
  let aSets=0,bSets=0,aWins=0,bWins=0,complete=0;
  for(let i=0;i<5;i++){
    const a=document.getElementById("a"+i).value,b=document.getElementById("b"+i).value;
    let text="Ingresá los sets ganados (el ganador debe tener 3).";
    if(a!==""&&b!==""){
      const x=Number(a),y=Number(b);
      if(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<=3&&y<=3&&x!==y&&Math.max(x,y)===3){
        aSets+=x;bSets+=y;complete++;
        if(x===3)aWins++;else bWins++;
        text=x===3?"Gana Equipo A":"Gana Equipo B";
      }else text="Resultado inválido: debe ser 3-0, 3-1, 3-2 o inverso.";
    }
    document.getElementById("result"+i).textContent=text;
  }
  document.getElementById("preview").textContent=`Partidos ganados: Equipo A ${aWins} – ${bWins} Equipo B. Sets sumados en partidos completos: ${aSets} – ${bSets}. ${complete}/5 partidos completos.`;
}
function renderMatches(){
  const list=document.getElementById("matchList");
  document.getElementById("emptyMatches").style.display=state.matches.length?"none":"block";
  list.innerHTML=[...state.matches].reverse().map(m=>{
    const s=summarize(m);
    const details=m.wo?"WO (5-0 administrativo)":m.games.map((g,i)=>`${["S1","S2","S3","S4","Dobles"][i]} ${g[0]}-${g[1]}`).join(" · ");
    return `<div class="match-item"><div><strong>${esc(teamName(m.teamA))} ${s.pgA}–${s.pgB} ${esc(teamName(m.teamB))}</strong><br><span class="hint">${details}</span></div><button type="button" class="small-button" data-delete-match="${esc(m.id)}">Eliminar</button></div>`;
  }).join("");
}
function message(t,kind=""){const el=document.getElementById("formMessage");el.textContent=t;el.className="message "+kind;}
function render(){renderStandings();renderTeamControls();renderMatches();saveState();}

document.getElementById("matchForm").addEventListener("submit",e=>{
  e.preventDefault();
  const teamA=document.getElementById("teamA").value,teamB=document.getElementById("teamB").value,wo=document.getElementById("wo").checked;
  if(!teamA||!teamB||teamA===teamB)return message("Elegí dos equipos diferentes.","error");
  let match;
  if(wo){
    const loser=document.getElementById("woLoser").value;
    if(loser!==teamA&&loser!==teamB)return message("Elegí qué equipo no se presentó.","error");
    match={id:String(Date.now()),teamA,teamB,wo:true,woLoser:loser,games:[]};
  }else{
    const result=getGamesFromForm();if(result.error)return message(result.error,"error");
    match={id:String(Date.now()),teamA,teamB,wo:false,games:result.games};
  }
  state.matches.push(match);
  document.getElementById("matchForm").reset();
  document.getElementById("woOptions").classList.add("hidden");
  document.getElementById("games").classList.remove("hidden");
  document.querySelectorAll("#games input").forEach(i=>i.disabled=false);
  renderGames();updatePreview();message("Serie guardada. La clasificación se actualizó.","success");render();
});
document.getElementById("wo").addEventListener("change",e=>{
  const active=e.target.checked;
  document.getElementById("woOptions").classList.toggle("hidden",!active);
  document.getElementById("games").classList.toggle("hidden",active);
  document.querySelectorAll("#games input").forEach(i=>i.required=!active);
});
document.getElementById("teamForm").addEventListener("submit",e=>{
  e.preventDefault();const input=document.getElementById("newTeam"),name=input.value.trim();if(!name)return;
  if(state.teams.some(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return alert("Ya existe un equipo con ese nombre.");
  const next=state.nextId||state.teams.length+1;state.teams.push({id:String(next),name});state.nextId=next+1;input.value="";render();
});
document.addEventListener("click",e=>{
  const rt=e.target.closest("[data-remove-team]");
  if(rt){const id=rt.dataset.removeTeam;if(state.matches.some(m=>m.teamA===id||m.teamB===id))return alert("No se puede quitar: el equipo tiene series cargadas. Eliminá esos resultados primero.");
    if(confirm("¿Quitar este equipo?")){state.teams=state.teams.filter(t=>t.id!==id);render();}}
  const dm=e.target.closest("[data-delete-match]");
  if(dm&&confirm("¿Eliminar esta serie? La tabla se recalculará.")){state.matches=state.matches.filter(m=>m.id!==dm.dataset.deleteMatch);render();}
});
document.getElementById("resetAll").addEventListener("click",()=>{
  if(!confirm("¿Borrar todos los resultados y volver a las dos series iniciales?"))return;
  state=freshState();message("");render();renderGames();updatePreview();
});
renderGames();render();updatePreview();