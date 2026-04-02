'use strict';
// ============================================================
// db.js — Persistência local (DB) + autoSave
// TJMG Fiscal PWA — Fase 2 da modularização
// Dependências (globais): S, US, PhotoStore, Sync, Tt, el
//   normalizeFormState, syncDraftFromF (carregados depois,
//   chamados apenas em runtime pelo autosave)
// ============================================================

var autoSaveTimer=null,autoSaveLastHash='',autoSaveLastAt=0;
function activeScreenId(){var a=document.querySelector('.scr.act');return a?a.id:'';}
function computeDraftHash(){
  if(!F||!F.id)return '';
  try{normalizeFormState(F);return JSON.stringify(F);}catch(e){return '';}
}
function saveRascunhoAuto(force){
  if(!F||!F.id)return false;
  if(!S.sessao)return false; /* sessão expirada: não salva/sincroniza */
  if(!force&&activeScreenId()!=='s-form')return false;
  /* FALHA-6 fix: normalizeFormState e syncDraftFromF são definidas no script inline
     do index.html, que carrega APÓS db.js. Em runtime está OK (autosave dispara após
     5s), mas se o inline script falhar ao parsear, estas chamadas lançariam
     ReferenceError a cada 5s, poluindo o console e disparando window.onerror em loop. */
  if(typeof normalizeFormState!=='function'||typeof syncDraftFromF!=='function'){
    console.warn('[Autosave] normalizeFormState/syncDraftFromF ainda não disponíveis');
    return false;
  }
  try{
    normalizeFormState(F);
    var snap=JSON.stringify(F);
    if(!force&&snap===autoSaveLastHash)return false;
    syncDraftFromF(false);
    DB.sv();
    var _asEl=el('autosave-ind');if(_asEl){var _now=new Date();_asEl.textContent='Salvo '+_now.getHours().toString().padStart(2,'0')+':'+_now.getMinutes().toString().padStart(2,'0');}
    autoSaveLastHash=snap;
    autoSaveLastAt=Date.now();
    return true;
  }catch(e){console.warn('Autosave falhou',e);return false;}
}
function startAutoSave(){
  if(autoSaveTimer)return;
  autoSaveTimer=setInterval(function(){saveRascunhoAuto(false);},5000);
}
function stopAutoSave(){
  if(autoSaveTimer){clearInterval(autoSaveTimer);autoSaveTimer=null;}
}

/* ── PhotoStore: IndexedDB para fotos (ilimitado, offline) ──────────────── */
var DB={
  svLocal:function(){
    // PWA-3: setTimeout(0) removido — localStorage.setItem é síncrono por natureza.
    // Adiar para a próxima iteração do event loop criava risco de perda de dados
    // se o usuário fechasse o app imediatamente após uma ação.
    try{
        /* Salva fotos no IndexedDB e remove base64 do objeto antes do localStorage */
        var inspSemFotos=S.insp.map(function(insp){
          var clone=JSON.parse(JSON.stringify(insp));
          Object.keys(clone.itens||{}).forEach(function(k){
            var fotos=clone.itens[k].fotos||[];
            if(fotos.length){
              PhotoStore.put(insp.id+'::'+k,fotos);
              clone.itens[k].fotos=[];
            }
          });
          return clone;
        });
        /* Também move fotos de Subestação para o IndexedDB */
        inspSemFotos.forEach(function(clone,idx){
          var orig=S.insp[idx];
          if(!clone.sub)return;
          /* Remove fotos do sub no clone (localStorage) */
          PhotoStore.putSubAll(clone.id,orig.sub||{});
          if(clone.sub.chk)Object.keys(clone.sub.chk).forEach(function(k){clone.sub.chk[k].fotos=[];});
          if(clone.sub.trafos)clone.sub.trafos.forEach(function(t){t.fotos_ttr=[];t.fotos_iso=[];t.fotos_ohm=[];});
          if(clone.sub.disjs)clone.sub.disjs.forEach(function(d){d.fotos_iso=[];d.fotos_cr=[];});
          if(clone.sub.secc)clone.sub.secc.forEach(function(s){s.fotos_iso=[];s.fotos_cr=[];});
        });
        /* ── Persiste S.insp no IndexedDB (sem limite de quota) ── */
        PhotoStore.putAllInsp(inspSemFotos);
        /* ── Tenta também no localStorage (boot rápido); tolera quota cheia ── */
        try{
          localStorage.setItem('ti',JSON.stringify(inspSemFotos));
        }catch(qe){
          if(qe.name==='QuotaExceededError'||qe.code===22){
            console.warn('[DB] localStorage quota excedida — IDB é a fonte primária');
            localStorage.removeItem('ti');/* limpa dado obsoleto */
            Tt('Dados salvos com segurança ✓');
          }else{
            console.warn('Erro ao salvar local:',qe);
            Tt('Erro ao salvar. Tente novamente.');
          }
        }
        if(S.sessao){var s=JSON.parse(JSON.stringify(S.sessao));s._t=Date.now();localStorage.setItem('ts',JSON.stringify(s));}
        localStorage.setItem('tu',JSON.stringify(US));
      }catch(e){
        console.warn('Erro ao salvar local:',e);
        Tt('Erro ao salvar. Tente novamente.');
      }
  },
  sv:function(){
    this.svLocal();
    /* updated_at marcado individualmente em cada operação */
    Sync.schedulePush(600);
  },
  ld:async function(){
    /* ── PASSO 1 (SÍNCRONO): carrega usuários ANTES de qualquer async ────────
       Garante que US nunca fica vazio mesmo se IndexedDB rejeitar.
       Colocar antes do try/catch evita que erros async engulam este bloco. */
    var _defaultUS=[
      /* SEG-2: PINs armazenados como SHA-256 — nunca texto claro.
         ARQ-3: mat definida para todos os usuários (evita falha no reset por matrícula). */
      {id:'u1',nome:'Edenias Gonzaga Leão',mat:'P0155070',pin:'4b499d5423839527497bca679ab3f20b62a1c7f1373544a8f689f55ed96a7dbf',reg:'NORTE',cargo:'Apoio Técnico',polo:'Montes Claros',ativo:true},
      {id:'u2',nome:'Túlio Heleno L. Lobato',mat:'T2183-2',pin:'bc83cbb2d6dcba934deedb695609dd3ae689a72b210a8f1b86f6b1bc4c68d348',reg:'NORTE',cargo:'Fiscal',polo:'Montes Claros',ativo:true},
      {id:'u3',nome:'Jarém Guarany Gomes Jr.',mat:'T006387-5',pin:'d054bfc75d1f0b1e2ebd4e249e460a580fbe411b08a95c2a9edf151fe49f9cf7',reg:'CENTRAL',cargo:'Fiscal',polo:'Contagem',ativo:true},
      {id:'u4',nome:'Luís Cláudio F. Cunha',mat:'600.94701',pin:'75ca4e6929494268b763da43d07e19fa7c79f49413ea05202a6dfd375dc93bb0',reg:'CENTRAL',cargo:'Fiscal',polo:'Betim',ativo:true},
      {id:'u5',nome:'Márcia Gomes Alvarenga',mat:'T008172-9',pin:'281b13e30538ffbed3a18d7c24d537338a7b615cdd33aea5558bb1dd770ab0e8',reg:'LESTE',cargo:'Fiscal',polo:'Gov. Valadares',ativo:true},
      {id:'u6',nome:'Guilherme A. Alencar',mat:'P0094702',pin:'bbe814c133ff59125385ad6f42367268d5d17487d8e46089f07fca07837066b1',reg:'LESTE',cargo:'Fiscal',polo:'Ipatinga',ativo:true},
      {id:'u7',nome:'Rui Cassiano R. Lima',mat:'P0117128',pin:'2e2195595695ad1b86da7180e2921842c9434740987dcfec23c51c0506acc3b3',reg:'LESTE',cargo:'Fiscal',polo:'Itabira',ativo:true},
      {id:'u8',nome:'José Agostinho H. R. Assunção',mat:'ZM0001',pin:'242d1f9ba9fbda48e877c20dd4de8e9a0074e98add3de4856115ab61863786c5',reg:'ZONA_MATA',cargo:'Fiscal',polo:'Juiz de Fora',ativo:true},
      {id:'u9',nome:'Thiago Abreu',mat:'ZM0002',pin:'13b7994fae9387c2e1b598524ba1204ae404d02fa67016ed86c74183ab1aafca',reg:'ZONA_MATA',cargo:'Fiscal',polo:'Juiz de Fora',ativo:true},
      {id:'u10',nome:'Alisson Cruz Pereira',mat:'8546-4',pin:'604bdba4ae56af689c9c920d4b367e3c8935d567050efc6975cdbc098830af06',reg:'TRIANGULO',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u11',nome:'Flávio Ferreira Ribeiro',mat:'60130718',pin:'2e0b3dc70916553a1549804a2fe6b217cb102451fc29b3b6964f8bd2ecb65004',reg:'TRIANGULO',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u12',nome:'Raphael Alan Ferreira',mat:'P0115765',pin:'76bf061a545d61832da4a5cdb72f1fab5474aff86d62f0424ce1cf3f68b36420',reg:'SUL',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u13',nome:'Diego Henrique C. Oliveira',mat:'P0128696',pin:'37d03b4246ba25e6f2a5d2ce6c836fcb3ab0fcbd6e7955d85efff1dbd5c9ccca',reg:'SUL',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u14',nome:'Vanderlúcio de Jesus Ferreira',mat:'SW0001',pin:'b858460b54cc28b3e4e9c5f50b36baf44ccec41b1051d4a9f9ff662e194e6257',reg:'SUDOESTE',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u15',nome:'Taciano de Paula Costa Bastos',mat:'SW0002',pin:'b777f0d29a0ba4ce6cc6ee38b6a521fe3c72eee7f0a5ac1014024908a2c54765',reg:'SUDOESTE',cargo:'Fiscal',polo:'',ativo:true}
    ];
    US.splice(0,US.length);
    _defaultUS.forEach(function(d){US.push(d);});
    /* Aplica edições do admin (tu) se existirem */
    try{
      var _tu0=localStorage.getItem('tu');
      if(_tu0){var _tuArr0=JSON.parse(_tu0);if(Array.isArray(_tuArr0)){_tuArr0.forEach(function(x){if(!x||!x.id)return;var _idx=US.findIndex(function(u){return u.id===x.id;});var _safe={};
      /* FALHA-9 fix: aceita PIN legado 4 dígitos OU SHA-256 64 chars hex (padrão desde v72) */
      var _pinOk=x.pin&&(/^\d{4}$/.test(x.pin)||/^[0-9a-f]{64}$/.test(x.pin));
      if(_pinOk)_safe.pin=x.pin;if(x.nome&&x.nome.trim())_safe.nome=x.nome.trim();if(x.updated_at)_safe.updated_at=x.updated_at;if(x.cargo)_safe.cargo=x.cargo;if(x.reg)_safe.reg=x.reg;if(x.mat!==undefined)_safe.mat=x.mat;if(x.polo!==undefined)_safe.polo=x.polo;if(x.ativo!==undefined)_safe.ativo=x.ativo;if(_idx>=0)US[_idx]=Object.assign({},US[_idx],_safe);else US.push(x);});}}
    }catch(_e0){console.warn('tu parse erro (sync)',_e0);}

    /* ── PASSO 2 (ASYNC): carrega inspeções do IndexedDB/localStorage ────── */
    try{
    /* Carrega inspeções: localStorage (rápido) ou IDB (fallback quando quota excedida) */
    var rawInsp=localStorage.getItem('ti');
    if(!rawInsp){
      var idbInsp=await PhotoStore.getAllInsp();
      if(idbInsp&&idbInsp.length){
        rawInsp=JSON.stringify(idbInsp);
        console.log('[DB] Recuperado '+idbInsp.length+' insp. do IDB (localStorage vazio)');
      }
    }
    if(rawInsp){S.insp=JSON.parse(rawInsp);
    var _temAntigas=S.insp.some(function(insp){return Object.keys(insp.itens||{}).some(function(k){return(insp.itens[k].fotos||[]).length>0;});});
    if(_temAntigas){PhotoStore.migrate(S.insp).then(function(){DB.svLocal();console.log('[PhotoStore] Migracao concluida.');});}
    Promise.all(S.insp.map(function(insp){
      return PhotoStore.loadForInsp(insp).then(function(){
        if(insp.sub)return PhotoStore.loadSubAll(insp.id,insp.sub);
      });
    })).catch(function(){});}
    var s=localStorage.getItem('ts');if(s){var d=JSON.parse(s);if(Date.now()-(d._t||0)<28800000){S.sessao=d;}else{localStorage.removeItem('ts');setTimeout(function(){try{Tt('Sessão expirada. Faça login novamente.');}catch(e){}},1500);}}
    /* Atualiza US com dados do Supabase/pull que possam ter chegado via mergeRemoteUsers */
    }catch(e){console.warn('[DB.ld] erro async (inspeções/sessão):',e);}
  }
};



