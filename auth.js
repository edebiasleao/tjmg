'use strict';
// ============================================================
// auth.js — Autenticação: PIN, Admin, Coordenador, Logout
// TJMG Fiscal PWA — Fase 4 da modularização
// Dependências: state.js (S, US, ADM, COORD), utils.js (el, cm, cf),
//               router.js (G, Gb, bH), db.js (DB)
// window-exports: openPin, kp, kpOK, openAdm, loginAdm,
//                 logout, openCoord, loginCoord, rLogin
// ============================================================

function rLogin(){
  var por={};
  US.filter(function(u){return u.ativo;}).forEach(function(u){
    if(!por[u.reg])por[u.reg]=[];
    por[u.reg].push(u);
  });
  var h='';
  Object.keys(por).forEach(function(r){
    var us=por[r];
    var R=REG[r]||{l:r,c:'#64748b',bg:'#f1f5f9'};
    h+='<div style="border-left:4px solid '+R.c+';padding-left:10px;margin:10px 0 6px;">';
    h+='<div style="font-size:10px;font-weight:700;color:'+R.c+';text-transform:uppercase;letter-spacing:1px;">';
    h+='Regiao '+R.l+'</div></div>';
    us.forEach(function(u){
      h+='<div class="card" onclick="openPin(\''+u.id+'\')" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer;">';
      h+='<div class="av" style="width:42px;height:42px;font-size:14px;background:'+R.c+';">'+ini(u.nome)+'</div>';
      h+='<div style="flex:1;">';
      h+='<div style="font-size:13px;font-weight:700;">'+u.nome+'</div>';
      h+='<div style="font-size:11px;color:#64748b;">'+u.cargo+' - '+u.polo+'</div>';
      h+='</div>';
      h+='<span class="bdg" style="background:'+R.bg+';color:'+R.c+';">'+R.l+'</span>';
      h+='</div>';
    });
  });
  el('ll').innerHTML=h;
}
var _pid='',_pbuf='';
function openPin(id){
  var u=US.find(function(x){return x.id===id;});if(!u)return;
  var R=REG[u.reg]||{c:'#003580'};_pid=id;_pbuf='';
  el('mav').textContent=ini(u.nome);el('mav').style.background=R.c;
  el('mnm').textContent=u.nome;el('mcg').textContent=u.cargo;
  el('perr').textContent='';rpd();el('m-pin').style.display='flex';
}
function rpd(){for(var i=0;i<4;i++)el('pd'+i).classList.toggle('on',i<_pbuf.length);}
function kp(n){if(n===-1){_pbuf=_pbuf.slice(0,-1);rpd();el('perr').textContent='';return;}if(_pbuf.length<4){_pbuf+=String(n);rpd();if(_pbuf.length===4)setTimeout(doLogin,120);}}
function kpOK(){doLogin();}
function doLogin(){
  var u=US.find(function(x){return x.id===_pid;});if(!u)return;
  if(_pbuf!==u.pin){el('perr').textContent='PIN incorreto. Tente novamente.';_pbuf='';rpd();return;}
  S.sessao={tipo:'usuario',userId:u.id,nome:u.nome,mat:u.mat,reg:u.reg,cargo:u.cargo,polo:u.polo||'',_t:Date.now()};
  DB.sv();cm('m-pin');rHome();G('s-home');BNS.forEach(function(id){var e=el(id);if(e)e.innerHTML=bH('home');});
}
function openAdm(){el('au').value='';el('ap').value='';el('ae').textContent='';el('m-adm').style.display='flex';}
function loginAdm(){
  var u=el('au').value.trim();var p=el('ap').value.trim();
  if(u===ADM.u&&p===ADM.p){S.sessao={tipo:'admin',userId:'admin',nome:'Administrador',reg:null,cargo:'Admin',polo:'',_t:Date.now()};DB.sv();cm('m-adm');rAdm();G('s-admin');}
  else el('ae').textContent='Usuario ou PIN incorretos.';
}
function logout(){cf('X','Sair','Encerrar sua sessao?',function(){S.sessao=null;localStorage.removeItem('ts');rLogin();Gb('s-login');});}
function openCoord(){el('cu').value='';el('cp').value='';el('ce').textContent='';el('m-coord').style.display='flex';}
function loginCoord(){
  var u=el('cu').value.trim();var p=el('cp').value.trim();
  if(u===COORD.u&&p===COORD.p){
    S.sessao={tipo:'coordenador',userId:'coord',nome:'Coordenador',reg:null,cargo:'Coordenador',polo:'',_t:Date.now()};
    DB.sv();cm('m-coord');rCoord();G('s-coord');
  } else el('ce').textContent='Usuário ou PIN incorretos.';
}
function rCoord(){
  var sub=el('coord-sub');
  if(sub)sub.textContent=S.insp.length+' relatório(s) no sistema';

// ── Expor para onclick inline ──────────────────────────────────────────────
window.rLogin    = rLogin;
window.openPin   = openPin;
window.kp        = kp;
window.kpOK      = kpOK;
window.openAdm   = openAdm;
window.loginAdm  = loginAdm;
window.logout    = logout;
window.openCoord = openCoord;
window.loginCoord= loginCoord;
