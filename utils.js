'use strict';
// ============================================================
// utils.js — Utilitários, controle de acesso, PCI helpers
// TJMG Fiscal PWA — Fase 4 da modularização
// Dependências: state.js (S), data.js (PCI_DATA)
// window-exports: el, cm, cf, Tt, uid (usados em onclick inline)
// ============================================================

function ini(n){if(!n)return'';var p=(n+'').split(' ').filter(function(x){return x.length>0;}).slice(0,2);return p.map(function(x){return x[0].toUpperCase();}).join('');}
function fdt(x){try{return new Date(x).toLocaleDateString('pt-BR');}catch(e){return'-';}}
function fdth(x){try{return new Date(x).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return'-';}}
function uid(){if(crypto&&crypto.randomUUID)return crypto.randomUUID();return Math.random().toString(36).slice(2)+Date.now().toString(36);}
function Tt(m){var e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(function(){e.classList.remove('show');},2500);}
function cm(id){document.getElementById(id).style.display='none';}
function el(id){return document.getElementById(id);}
function cf(ico,tit,msg,cb){el('ci').textContent=ico;el('ct').textContent=tit;el('cm_t').textContent=msg;el('cok').onclick=function(){cm('m-cf');cb();};el('m-cf').style.display='flex';}
// ── Controle de acesso por região ────────────────────────────────────────────
// Retorna true se o usuário logado tem acesso global (admin ou coordenador)
function isGlobal(s){
  s=s||S.sessao;
  return !!(s&&(s.tipo==='admin'||s.tipo==='coordenador'));
}
/* Regra de exclusão:
   - fiscal (usuario) : pode excluir qualquer inspeção da sua região
   - admin            : só pode excluir finalizadas (rascunhos pertencem ao fiscal)
   - coordenador      : sem permissão de exclusão */
function canDelInsp(i){
  var s=S.sessao;
  if(!s)return false;
  if(s.tipo==='coordenador')return false;
  if(s.tipo==='admin')return !!(i&&i.st==='finalizada');
  /* fiscal: só pode deletar inspeções da própria região */
  return !!(i&&(!i.reg||i.reg===s.reg));
}
// Filtra uma lista de inspeções pelo acesso da sessão atual.
// Admin/coordenador vêem tudo; usuário vê apenas da própria região (reg obrigatório).
function filterByReg(lista){
  var s=S.sessao;
  if(isGlobal(s))return lista;
  var reg=s.reg;
  if(!reg)return lista;
  return lista.filter(function(i){return !i.reg||i.reg===reg;});
}
// ── Mapeamento de PCI por região ─────────────────────────────────────────────
// PCI_DATA contém os registros da Região Norte.
// Quando CENTRAL e LESTE tiverem seus dados, adicione aqui os arrays correspondentes.
var PCI_BY_REG={
  NORTE:     PCI_DATA,   // 161 registros – carregados
  CENTRAL:   [],         // ⚠️ A definir
  LESTE:     [],         // ⚠️ A definir
  ZONA_MATA: [],         // ⚠️ A definir
  TRIANGULO: [],         // ⚠️ A definir
  SUL:       [],         // ⚠️ A definir
  SUDOESTE:  []          // ⚠️ A definir
};
// Indica quais regiões já têm PCI configurado
var PCI_READY={NORTE:true,CENTRAL:false,LESTE:false,ZONA_MATA:false,TRIANGULO:false,SUL:false,SUDOESTE:false};

// Retorna os dados PCI visíveis para o usuário/sessão atual
function pciDataForUser(){
  var s=S.sessao;
  // Admin e coordenador vêem todas as regiões concatenadas
  if(isGlobal(s)){
    var all=[];
    Object.keys(PCI_BY_REG).forEach(function(k){all=all.concat(PCI_BY_REG[k]||[]);});
    return all;
  }
  return PCI_BY_REG[s.reg]||[];
}
// ─────────────────────────────────────────────────────────────────────────────

function pciSt(val){
  if(!val)return{s:'SEM DATA',bg:'#f1f5f9',c:'#64748b'};
  var h=new Date();h.setHours(0,0,0,0);
  var v=new Date(val+'T00:00:00');var d=Math.floor((v-h)/86400000);
  if(d<0)return{s:'VENCIDO',bg:'#fee2e2',c:'#dc2626'};
  if(d<=30)return{s:'30d',bg:'#ffedd5',c:'#ea580c'};
  if(d<=60)return{s:'60d',bg:'#fef9c3',c:'#ca8a04'};
  return{s:'VIGENTE',bg:'#dcfce7',c:'#16a34a'};
}
function ovals(o){return Object.keys(o).map(function(k){return o[k];});}
function oentries(o){return Object.keys(o).map(function(k){return[k,o[k]];});}


// ── Expor para onclick inline (necessário enquanto index.html não for module) ──
window.el  = el;
window.cm  = cm;
window.cf  = cf;
window.Tt  = Tt;
window.uid = uid;
