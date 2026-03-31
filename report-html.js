/* ============================================================
   TJMG Fiscal PWA — report-html.js
   Fase 3 da modularização: geração de relatórios HTML locais.

   Funções exportadas (globais):
     exportHTML(id)         — ponto de entrada principal
     exportHTMLSub(id)      — ponto de entrada subestação

   Funções internas:
     _gerarHTMLStr(id)      — monta HTML do relatório principal
     _doExportHTML(id)      — executa download do relatório principal
     _gerarHTMLSubStr(id)   — monta HTML do relatório de subestação
     _doExportHTMLSub(id)   — executa download do relatório de subestação

   Funções auxiliares movidas para cá:
     normProt(s)
     gerarProtocolo(i)
     gerarTipoLbl(tipo)

   Dependências (globais em index.html):
     S, US, REG, TIPOS, SIS, TCOR, ST, SUB_SECOES,
     PhotoStore, Tt, fdt, oentries, ovals, _spf

   v68: Fase 3 — Drive/e-mail removidos; page-break corrigido;
        subestação redesenhada com identidade TJMG.
   ============================================================ */

/* ── Helpers de protocolo ─────────────────────────────────── */

function normProt(s) {
  return (s || '').toUpperCase()
    .replace(/[ÀÁÂÃÄ]/g,'A').replace(/[ÈÉÊË]/g,'E')
    .replace(/[ÌÍÎÏ]/g,'I').replace(/[ÒÓÔÕÖ]/g,'O')
    .replace(/[ÙÚÛÜ]/g,'U').replace(/Ç/g,'C')
    .replace(/Ã/g,'A').replace(/Õ/g,'O')
    .replace(/Â/g,'A').replace(/Ê/g,'E').replace(/Ô/g,'O')
    .replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function gerarProtocolo(i) {
  var _dt = (i.dtVistoria || i.data || new Date().toISOString().slice(0,10));
  var _dtFmt = _dt.replace(/-/g,'');
  if (_dtFmt.length === 8 && _dtFmt.indexOf('-') < 0) {
    _dtFmt = _dtFmt.slice(6,8) + _dtFmt.slice(4,6) + _dtFmt.slice(0,4);
  } else {
    try { var _p = fdt(i.dtVistoria || i.data); _dtFmt = _p.replace(/\//g,''); } catch(e) {}
  }
  var _com  = normProt(i.com);
  var _edif = normProt(i.edif);
  var _COMP = ['fachada','spda','prontuario','subestacao'];
  if (_COMP.indexOf(i.tipo) >= 0) return 'RITMP-COMPLEMENTAR-' + _dtFmt + '-' + _com + '-' + _edif;
  if (i.tipo === 'periodica')     return 'RITMP-' + _dtFmt + '-' + _com + '-' + _edif;
  var _osRaw = (i.os || '').trim().toUpperCase();
  var _osNum = _osRaw.replace(/[^0-9]/g,'');
  var _osStr = i.tipo === 'ose'
    ? (_osRaw.startsWith('OSE') ? _osRaw : (_osNum ? 'OSE' + _osNum.padStart(3,'0') : ''))
    : (_osRaw.startsWith('OSP') ? _osRaw : (_osNum ? 'OSP' + _osNum.padStart(3,'0') : ''));
  if (i.tipo === 'ose') return 'RITE-' + _dtFmt + (_osStr ? '-' + _osStr : '') + '-' + _com + '-' + _edif;
  if (i.tipo === 'osp') {
    var _ospN = (i.os || '').trim().toUpperCase().replace(/[^0-9]/g,'');
    var _ospS = _ospN ? 'OSP' + _ospN.padStart(3,'0') : '';
    return 'OSP-' + _dtFmt + (_ospS ? '-' + _ospS : '') + '-' + _com + '-' + _edif;
  }
  return 'RITP-' + _dtFmt + (_osStr ? '-' + _osStr : '') + '-' + _com + '-' + _edif;
}

function gerarTipoLbl(tipo) {
  var _COMP = ['fachada','spda','prontuario','subestacao'];
  if (_COMP.indexOf(tipo) >= 0) return 'RITMP \u2014 COMPLEMENTAR DE MANUTEN\u00c7\u00c3O PERI\u00d3DICA';
  if (tipo === 'periodica')     return 'RITMP \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA DE MANUTEN\u00c7\u00c3O PERI\u00d3DICA';
  if (tipo === 'ose')           return 'RITE \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA EMERGENCIAL';
  if (tipo === 'osp')           return 'OSP \u2014 ORDEM DE SERVI\u00c7O PROGRAMADA';
  return                               'RITP \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA PROGRAMADA';
}

/* ── Ponto de entrada principal ───────────────────────────── */

function exportHTML(id) {
  var i = S.insp.find(function(x){ return x.id === id; }); if (!i) return;
  if (i.tipo === 'subestacao') { exportHTMLSub(id); return; }
  var _hasEmptyFotos = Object.keys(i.itens || {}).some(function(k){ return !(i.itens[k].fotos || []).length; });
  if (_hasEmptyFotos) {
    Tt('Carregando fotos...');
    PhotoStore.loadForInsp(i).then(function(){ _doExportHTML(id); }).catch(function(){ _doExportHTML(id); });
    return;
  }
  _doExportHTML(id);
}

/* ── Gerador do HTML principal ────────────────────────────── */

function _gerarHTMLStr(id) {
  var i = S.insp.find(function(x){ return x.id === id; }); if (!i) return null;
  if (i.tipo === 'subestacao') return null;

  var t     = TIPOS[i.tipo] || TIPOS.periodica;
  var _osp  = i.tipo === 'ose' || i.tipo === 'programada' || i.tipo === 'osp';
  var _ativSelKeys = i.ativSel || {};
  var _hasSel = _osp && Object.keys(_ativSelKeys).some(function(k){ return !!_ativSelKeys[k]; });

  var its = oentries(i.itens || {}).filter(function(e){
    if (!_osp) return true;
    if (!_hasSel) return e[1].s !== 'nao_aplicavel';
    var _aid = e[0].replace(/^[^_]*_/,'');
    return !!_ativSelKeys[_aid];
  }).map(function(e){ return e[1]; });

  /* ── Estatísticas ── */
  var stats = { total:0,exec:0,nexec:0,conf:0,nc:0,na:0,pend:0,emexec:0,fp:0,prog:0,fotos:0,mats:0 };
  stats.total = its.length;
  its.forEach(function(it){
    var s = it.s || 'pendente';
    if (s==='executado')      stats.exec++;
    else if (s==='nao_executado') stats.nexec++;
    else if (s==='conforme')  stats.conf++;
    else if (s==='nao_conforme') stats.nc++;
    else if (s==='nao_aplicavel') stats.na++;
    else if (s==='pendente')  stats.pend++;
    else if (s==='em_execucao') stats.emexec++;
    else if (s==='fora_periodo') stats.fp++;
    else if (s==='programado') stats.prog++;
    if (it.fotos && it.fotos.length) stats.fotos += it.fotos.length;
    if (it.mats  && it.mats.length)  stats.mats  += it.mats.length;
  });
  if (i.mats && i.mats.length) stats.mats += i.mats.length;

  var _isOse  = i.tipo === 'ose';
  var _pct    = _isOse
    ? (stats.total ? Math.round(stats.exec  / stats.total * 100) : 0)
    : (stats.total ? Math.round(stats.conf  / stats.total * 100) : 0);
  var _pctCor = _pct >= 80 ? '#15803d' : _pct >= 50 ? '#d97706' : '#b91c1c';
  var _pctG   = _pct >= 80 ? '#15803d,#22c55e' : _pct >= 50 ? '#b45309,#f59e0b' : '#b91c1c,#ef4444';

  /* ── Monta seções do checklist ── */
  var sim = {};
  its.forEach(function(v){
    var k = v.sk || '?';
    if (!sim[k]) sim[k] = { n: v.sn || '', nn: v.snn || '', its: [] };
    sim[k].its.push(v);
  });

  var _sIco = {
    conforme:'✅', nao_conforme:'❌', nao_aplicavel:'➖', pendente:'⏳',
    fora_periodo:'🔄', programado:'📋', executado:'✅', nao_executado:'❌', em_execucao:'⚙️'
  };
  var _sCls = {
    conforme:'st-ok', nao_conforme:'st-nc', nao_aplicavel:'st-na', pendente:'st-pend',
    fora_periodo:'st-fp', programado:'st-prog', executado:'st-ok', nao_executado:'st-nc', em_execucao:'st-prog'
  };

  var secoes = '';
  Object.keys(sim).forEach(function(sk){
    var s    = sim[sk];
    var sPos = _osp
      ? s.its.filter(function(x){ return x.s === 'executado'; }).length
      : s.its.filter(function(x){ return x.s === 'conforme'; }).length;
    var sNeg = _osp
      ? s.its.filter(function(x){ return x.s === 'nao_executado'; }).length
      : s.its.filter(function(x){ return x.s === 'nao_conforme'; }).length;

    var linhas = s.its.map(function(it){
      var stv  = ST[it.s || 'pendente'] || ST.pendente;
      var sIco = _sIco[it.s || 'pendente'] || '⏳';
      var sC   = _sCls[it.s || 'pendente'] || 'st-pend';

      /* Fotos: cada foto-item tem break-inside:avoid individualmente;
         o grid em si pode quebrar entre páginas naturalmente */
      var fotosHtml = '';
      if (it.fotos && it.fotos.length) {
        fotosHtml = '<div class="foto-grid">';
        it.fotos.forEach(function(f){
          fotosHtml += '<figure class="foto-item" onclick="abrirLB(this)">'
            + '<img src="' + f.b64 + '" alt="' + (f.leg || 'Foto') + '" loading="lazy">'
            + '<figcaption>' + (f.leg || '') + '</figcaption></figure>';
        });
        fotosHtml += '</div>';
      }

      var matsHtml = '';
      if (it.mats && it.mats.length) {
        matsHtml = '<div class="mat-blk">🔧 '
          + it.mats.map(function(m){ return '<span class="mat-tag">' + m.d + ' &times;' + m.q + ' ' + m.u + '</span>'; }).join('')
          + '</div>';
      }
      var obsHtml = it.obs ? '<div class="obs-blk">💬 ' + it.obs + '</div>' : '';

      return '<tr class="item-row ' + (it.s === 'nao_conforme' || it.s === 'nao_executado' ? 'row-nc' : '') + '">'
        + '<td class="td-n">' + (it.n || '') + '</td>'
        + '<td class="td-d"><div class="item-nm">' + (it.nm || '') + '</div>' + obsHtml + fotosHtml + matsHtml + '</td>'
        + '<td class="td-s"><span class="st-badge ' + sC + '">' + sIco + ' ' + stv.l + '</span></td>'
        + '</tr>';
    }).join('');

    secoes += '<div class="secao">'
      + '<div class="sec-hdr"><div class="sec-hdr-inner">'
      + '<div class="sec-hdr-nm"><span class="sec-hdr-num">' + s.nn + '</span> ' + s.n + '</div>'
      + '</div>'
      + '<div class="sec-badges">'
      + (sPos ? '<span class="sbdg sbdg-ok">' + sPos + ' ✅</span>' : '')
      + (sNeg ? '<span class="sbdg sbdg-nc">' + sNeg + ' ❌</span>' : '')
      + '</div></div>'
      + '<table class="check-table"><thead><tr>'
      + '<th class="th-n">Nº</th>'
      + '<th class="th-d">Item / Observações / Registros</th>'
      + '<th class="th-s">Status</th>'
      + '</tr></thead><tbody>' + linhas + '</tbody></table>'
      + '</div>';
  });

  /* ── Painel OSE / Programada ── */
  var ospPanel = '';
  if (_osp && (i.os || i.descricao || (i.sistemas && i.sistemas.length))) {
    ospPanel = '<div class="osp-panel">'
      + '<div class="osp-title">📋 '
      + (i.tipo==='ose' ? 'Dados da Emergência' : i.tipo==='osp' ? 'Ordem de Serviço Programada — Abertura' : 'Dados da OS Programada')
      + '</div>'
      + (i.os ? '<div class="osp-num">' + (i.tipo==='ose'?'OSE':'OSP') + ' ' + i.os + '</div>' : '')
      + (i.descricao ? '<div class="osp-desc">' + i.descricao + '</div>' : '')
      + ((i.sistemas && i.sistemas.length)
          ? '<div class="sist-chips">'
            + i.sistemas.map(function(sid){
                var _s = SIS.find(function(x){ return x.id === sid; });
                return _s ? '<span class="sist-chip">' + _s.n + ' ' + _s.nm + '</span>' : '';
              }).join('')
            + '</div>'
          : '')
      + '</div>';
  }

  /* ── Materiais consolidados ── */
  var _matsMap = {};
  (i.mats || []).forEach(function(m){
    if (!m || !m.c) return;
    if (_matsMap[m.c]) _matsMap[m.c].q = parseFloat(_matsMap[m.c].q || 0) + parseFloat(m.q || 0);
    else               _matsMap[m.c] = { c:m.c, d:m.d, u:m.u, q:parseFloat(m.q || 0) };
  });
  ovals(i.itens || {}).forEach(function(it){
    (it.mats || []).forEach(function(m){
      if (!m || !m.c) return;
      if (_matsMap[m.c]) _matsMap[m.c].q = parseFloat(_matsMap[m.c].q || 0) + parseFloat(m.q || 0);
      else               _matsMap[m.c] = { c:m.c, d:m.d, u:m.u, q:parseFloat(m.q || 0) };
    });
  });
  var _matsC = Object.keys(_matsMap).map(function(k){ return _matsMap[k]; });
  var matsGerais = '';
  if (_matsC.length) {
    matsGerais = '<div class="mat-sec">'
      + '<div class="mat-sec-hdr">🔧 Materiais e Peças Utilizadas <span style="font-size:11px;font-weight:400;opacity:.7;">' + _matsC.length + ' item(ns)</span></div>'
      + '<table class="mat-table"><thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Un.</th></tr></thead><tbody>'
      + _matsC.map(function(m, ix){
          var _q = parseFloat(m.q || 0);
          var _qs = Number.isInteger(_q) ? _q : parseFloat(_q.toFixed(2));
          return '<tr class="' + (ix%2===0 ? 'mat-even' : 'mat-odd') + '">'
            + '<td class="mat-cod">'  + m.c  + '</td>'
            + '<td class="mat-desc">' + m.d  + '</td>'
            + '<td class="mat-qty">'  + _qs  + '</td>'
            + '<td class="mat-un">'   + m.u  + '</td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  /* ── Metadados ── */
  var geradoEm    = new Date().toLocaleString('pt-BR', { dateStyle:'full', timeStyle:'short' });
  var _dataVist   = i.dtVistoria || i.data;
  var numDoc      = i.protocolo || gerarProtocolo(i);
  var tipoLbl     = gerarTipoLbl(i.tipo);
  var tipoCorHex  = TCOR[i.tipo] || '#003580';
  var fiscalNome  = i.fiscal || (S.sessao && S.sessao.nome) || '—';
  var fiscalCargo = (S.sessao && S.sessao.cargo)
    ? S.sessao.cargo + ' – TJMG / COMAP-GEMAP-DENGEP'
    : 'Fiscal de Contrato – TJMG / COMAP-GEMAP-DENGEP';
  var regLbl = i.reg && REG[i.reg] ? 'Região ' + REG[i.reg].l : '';

  /* ── CSS ── */
  var css = [
    '*{box-sizing:border-box;margin:0;padding:0;}',
    'body{font-family:"Inter",system-ui,sans-serif;background:#f4f6f9;color:#1a2332;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;min-height:0;}',

    /* Botões flutuantes */
    '.btn-bar{position:fixed;bottom:28px;right:28px;z-index:999;display:flex;flex-direction:column;gap:10px;align-items:flex-end;}',
    '.print-btn{background:' + tipoCorHex + ';color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:"Inter",sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;letter-spacing:.3px;white-space:nowrap;}',
    '.pdf-btn{background:#1a2332;color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:"Inter",sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;letter-spacing:.3px;white-space:nowrap;}',
    '.pdf-btn:disabled{opacity:.6;cursor:wait;}',

    /* Layout */
    '.page{width:730px;max-width:730px;margin:20px auto;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.12);word-break:break-word;overflow:visible;}',

    /* Topo institucional */
    '.topo{background:' + tipoCorHex + ';padding:0;overflow:hidden;}',
    '.topo-strip{height:5px;background:rgba(255,255,255,.25);}',
    '.topo-body{padding:14px 18px 12px;display:flex;align-items:center;gap:10px;}',
    '.topo-brasao{width:42px;height:42px;min-width:42px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}',
    '.topo-inst{flex:1;min-width:0;overflow:hidden;}',
    '.topo-estado{font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:2px;}',
    '.topo-nome{font-size:14px;font-weight:800;color:#fff;line-height:1.2;}',
    '.topo-sub{font-size:9px;color:rgba(255,255,255,.7);margin-top:2px;}',
    '.topo-doc{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:7px;padding:5px 8px;text-align:right;flex-shrink:0;max-width:200px;min-width:0;}',
    '.doc-label{font-size:8px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.6);}',
    '.doc-num{font-family:"JetBrains Mono",monospace;font-size:8px;font-weight:600;color:#fff;margin-top:2px;word-break:break-all;line-height:1.5;}',

    /* Faixa tipo */
    '.tipo-faixa{background:#1a2332;padding:7px 18px;display:flex;align-items:center;justify-content:space-between;gap:6px;overflow:hidden;}',
    '.tipo-badge{background:' + tipoCorHex + ';color:#fff;border-radius:5px;padding:4px 10px;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap;flex-shrink:0;}',
    '.tipo-data{font-size:9px;color:rgba(255,255,255,.5);font-family:"JetBrains Mono",monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* Corpo */
    '.corpo{padding:24px;}',

    /* Ficha técnica */
    '.ficha{border:1px solid #dde3ec;border-radius:10px;overflow:hidden;margin-bottom:24px;}',
    '.ficha-title{background:#f0f4f9;padding:10px 16px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;}',
    '.ficha-grid{display:grid;grid-template-columns:repeat(2,1fr);}',
    '.ficha-item{padding:12px 16px;border-right:1px solid #eef1f6;border-bottom:1px solid #eef1f6;}',
    '.ficha-item:nth-child(2n){border-right:none;}',
    '.ficha-label{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;}',
    '.ficha-val{font-size:13px;font-weight:600;color:#1a2332;}',
    '.ficha-val.mono{font-family:"JetBrains Mono",monospace;font-size:12px;color:' + tipoCorHex + ';}',

    /* KPIs */
    '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}',
    '.kpi{border-radius:10px;padding:12px 14px;border:1px solid #dde3ec;}',
    '.kpi-num{font-size:26px;font-weight:800;line-height:1;margin-bottom:4px;}',
    '.kpi-lbl{font-size:10px;font-weight:600;letter-spacing:.5px;color:#64748b;}',
    '.kpi-total{background:#1a2332;border-color:#1a2332;}.kpi-total .kpi-num,.kpi-total .kpi-lbl{color:#fff;}',
    '.kpi-ok{background:#f0fdf4;border-color:#bbf7d0;}.kpi-ok .kpi-num{color:#16a34a;}',
    '.kpi-nc{background:#fff1f2;border-color:#fecdd3;}.kpi-nc .kpi-num{color:#dc2626;}',
    '.kpi-pend{background:#fffbeb;border-color:#fde68a;}.kpi-pend .kpi-num{color:#d97706;}',

    /* Barra progresso */
    '.prog-wrap{background:#f8fafc;border:1px solid #dde3ec;border-radius:10px;padding:16px 20px;margin-bottom:24px;}',
    '.prog-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}',
    '.prog-title{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;}',
    '.prog-pct{font-size:22px;font-weight:800;}',
    '.prog-track{height:8px;background:#e2e8f0;border-radius:20px;overflow:hidden;}',
    '.prog-fill{height:100%;border-radius:20px;}',

    /* Painel OSE */
    '.osp-panel{background:#f8fafc;border:1px solid #dde3ec;border-radius:10px;padding:18px 22px;margin-bottom:24px;}',
    '.osp-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:14px;}',
    '.osp-num{font-family:"JetBrains Mono",monospace;font-size:22px;font-weight:700;color:' + tipoCorHex + ';margin-bottom:12px;}',
    '.osp-desc{font-size:12px;color:#1a2332;line-height:1.7;background:#fff;border-radius:8px;padding:12px 16px;border:1px solid #e2e8f0;}',
    '.sist-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}',
    '.sist-chip{background:#fff;color:' + tipoCorHex + ';border:1px solid ' + tipoCorHex + '44;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;}',

    /* Seções checklist */
    '.sec-titulo{background:#1a2332;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px;margin-top:24px;border-radius:8px 8px 0 0;}',
    '.sec-titulo-txt{font-size:14px;font-weight:700;flex:1;}',
    '.sec-count{font-size:10px;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;}',
    '.secao{margin-bottom:0;}',
    '.sec-hdr{padding:10px 16px;display:flex;align-items:center;gap:10px;border-top:1px solid #eef1f6;background:#f8fafc;}',
    '.sec-hdr-inner{flex:1;}',
    '.sec-hdr-nm{font-size:12px;font-weight:700;}',
    '.sec-hdr-num{font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:600;background:#e2e8f0;color:#64748b;border-radius:5px;padding:2px 8px;white-space:nowrap;margin-right:6px;}',
    '.sec-badges{display:flex;gap:4px;flex-shrink:0;}',
    '.sbdg{font-size:10px;font-weight:700;border-radius:20px;padding:2px 8px;}',
    '.sbdg-ok{background:#f0fdf4;color:#16a34a;}.sbdg-nc{background:#fff1f2;color:#dc2626;}',
    '.check-table{width:100%;border-collapse:collapse;}',
    '.check-table thead tr{background:#f8fafc;}',
    '.th-n,.th-d,.th-s{padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:1px solid #e2e8f0;text-align:left;}',
    '.th-n{width:55px;}.th-s{width:125px;text-align:center;}',
    '.item-row{border-bottom:1px solid #f1f5f9;vertical-align:top;}',
    '.item-row:last-child{border-bottom:none;}',
    '.row-nc{background:#fff8f8;}',
    '.td-n{padding:10px 12px;font-family:"JetBrains Mono",monospace;font-size:11px;color:#94a3b8;font-weight:500;vertical-align:top;white-space:nowrap;}',
    '.td-d{padding:10px 14px;vertical-align:top;}',
    '.td-s{padding:10px 12px;text-align:center;vertical-align:top;}',
    '.item-nm{font-size:12px;font-weight:600;color:#1a2332;margin-bottom:3px;}',
    '.st-badge{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:4px 10px;font-size:10px;font-weight:700;white-space:nowrap;}',
    '.st-ok{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}',
    '.st-nc{background:#fff1f2;color:#dc2626;border:1px solid #fecdd3;}',
    '.st-na{background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;}',
    '.st-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a;}',
    '.st-fp,.st-prog{background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;}',
    '.obs-blk{display:flex;align-items:flex-start;gap:6px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;margin:5px 0;font-size:11px;color:#78350f;line-height:1.5;}',

    /* Fotos — grade adaptável; cada foto não quebra, mas a grade pode fluir */
    '.foto-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:10px 0 6px;}',
    '.foto-item{display:flex;flex-direction:column;border-radius:10px;overflow:hidden;border:1px solid #dde3ec;background:#f8fafc;cursor:zoom-in;box-shadow:0 1px 4px rgba(0,0,0,.07);}',
    '.foto-item img{width:100%;height:190px;object-fit:cover;display:block;transition:opacity .15s;}',
    '.foto-item img:hover{opacity:.88;}',
    '.foto-item figcaption{font-size:11px;color:#64748b;padding:6px 10px;text-align:center;background:#f8fafc;min-height:26px;}',

    /* Lightbox */
    '#foto-lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;}',
    '#foto-lb.open{display:flex;}',
    '#foto-lb img{max-width:94vw;max-height:90vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);}',
    '#foto-lb-cap{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;padding:7px 20px;border-radius:20px;font-size:13px;pointer-events:none;white-space:nowrap;}',

    /* Materiais inline */
    '.mat-blk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}',
    '.mat-tag{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;}',

    /* Materiais consolidados */
    '.mat-sec{margin-top:24px;border:1px solid #dde3ec;border-radius:10px;overflow:hidden;}',
    '.mat-sec-hdr{background:#1a2332;color:#fff;padding:12px 18px;font-size:13px;font-weight:700;}',
    '.mat-table{width:100%;border-collapse:collapse;}',
    '.mat-table thead tr{background:#f0f4f9;}',
    '.mat-table th{padding:9px 14px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #dde3ec;text-align:left;}',
    '.mat-table th:nth-child(3),.mat-table th:nth-child(4){text-align:center;}',
    '.mat-even{background:#fff;}.mat-odd{background:#f8fafc;}',
    '.mat-cod{padding:10px 14px;font-family:"JetBrains Mono",monospace;font-size:11px;color:' + tipoCorHex + ';font-weight:600;}',
    '.mat-desc{padding:10px 14px;font-size:12px;}',
    '.mat-qty{padding:10px 14px;text-align:center;font-size:13px;font-weight:700;}',
    '.mat-un{padding:10px 14px;text-align:center;font-size:11px;color:#64748b;}',

    /* Assinatura */
    '.ass-wrap{margin-top:40px;padding-top:24px;border-top:2px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:20px;}',
    '.ass-box{flex:1;min-width:200px;}',
    '.ass-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:16px;}',
    '.ass-linha{border-top:1px solid #94a3b8;margin:40px 0 10px;}',
    '.ass-nome{font-size:13px;font-weight:700;color:#1a2332;}',
    '.ass-cargo{font-size:11px;color:#64748b;margin-top:2px;}',
    '.ass-mat{font-family:"JetBrains Mono",monospace;font-size:10px;color:#94a3b8;margin-top:2px;}',

    /* Rodapé */
    '.rodape-rit{margin-top:32px;padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;line-height:1.7;}',

    /* ── IMPRESSÃO ──
       Regra principal:  itens individuais da checklist (item-row) NÃO têm break-inside:avoid
       para que tabelas longas ou linhas com muitas fotos possam fluir entre páginas sem gerar
       páginas em branco.  Apenas cada foto-item individual é protegida para não ser cortada. */
    '@page{size:A4 portrait;margin:10mm;}',
    '@media print{',
    'html{height:auto!important;overflow:visible!important;background:#fff!important;}',
    'body{height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important;margin:0!important;padding:0!important;}',
    '.btn-bar{display:none!important;}',
    '#foto-lb{display:none!important;}',
    '.page{width:100%!important;max-width:100%!important;box-shadow:none!important;margin:0!important;padding:0!important;overflow:visible!important;}',
    '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',

    /* Blocos que nunca devem ser cortados ao meio */
    '.ficha-item,.kpi,.ass-box,.osp-panel,.prog-wrap,.sec-hdr{break-inside:avoid;}',

    /* Cada foto individual não é cortada; o grid pode quebrar livremente */
    '.foto-item{break-inside:avoid;}',

    /* Tabela e linhas fluem naturalmente entre páginas */
    '.check-table{break-inside:auto;}',
    '.item-row{break-inside:auto;}',

    /* Forçar nova página antes de cada seção de sistema quando há muitas fotos */
    /* (descomente a linha abaixo se preferir separação forçada por seção)   */
    /* .sec-titulo{break-before:page;}                                         */

    '.foto-grid{grid-template-columns:repeat(2,1fr)!important;}',
    '.foto-item img{height:110px!important;object-fit:cover!important;}',
    '.ficha-grid{grid-template-columns:repeat(2,1fr)!important;}',
    '.kpis{grid-template-columns:repeat(4,1fr)!important;}',
    '.corpo{padding:16px!important;}',
    '}'
  ].join('');

  /* ── KPIs HTML ── */
  var kpisHtml = _isOse
    ? '<div class="kpi kpi-total"><div class="kpi-num">' + stats.total + '</div><div class="kpi-lbl">Total de Itens</div></div>'
      + '<div class="kpi kpi-ok"><div class="kpi-num" style="color:#16a34a;">' + stats.exec + '</div><div class="kpi-lbl">Executados</div></div>'
      + '<div class="kpi kpi-nc"><div class="kpi-num" style="color:#dc2626;">' + stats.nexec + '</div><div class="kpi-lbl">Não Executados</div></div>'
      + '<div class="kpi kpi-pend"><div class="kpi-num" style="color:#d97706;">' + stats.pend + '</div><div class="kpi-lbl">Pendentes</div></div>'
    : i.tipo === 'programada'
    ? '<div class="kpi kpi-total"><div class="kpi-num">' + stats.total + '</div><div class="kpi-lbl">Total de Itens</div></div>'
      + '<div class="kpi kpi-ok"><div class="kpi-num" style="color:#16a34a;">' + stats.conf + '</div><div class="kpi-lbl">Conformes</div></div>'
      + '<div class="kpi kpi-nc"><div class="kpi-num" style="color:#dc2626;">' + stats.nc + '</div><div class="kpi-lbl">Não Conformes</div></div>'
      + '<div class="kpi kpi-pend"><div class="kpi-num" style="color:#d97706;">' + stats.emexec + '</div><div class="kpi-lbl">⚙️ Em Exec.</div></div>'
    : '<div class="kpi kpi-total"><div class="kpi-num">' + stats.total + '</div><div class="kpi-lbl">Total de Itens</div></div>'
      + '<div class="kpi kpi-ok"><div class="kpi-num" style="color:#16a34a;">' + stats.conf + '</div><div class="kpi-lbl">Conformes</div></div>'
      + '<div class="kpi kpi-nc"><div class="kpi-num" style="color:#dc2626;">' + stats.nc + '</div><div class="kpi-lbl">Não Conformes</div></div>'
      + '<div class="kpi"><div class="kpi-num" style="color:#64748b;">' + stats.na + '</div><div class="kpi-lbl">N/A</div></div>';

  /* ── Bloco de assinaturas ── */
  var assHtml = (function(){
    var _inspReg = i.reg || (S.sessao && S.sessao.reg) || '';
    var _signers = US.filter(function(u){ return u.ativo && (!_inspReg || u.reg === _inspReg); });
    var _fiscais = _signers.filter(function(u){
      var c = (u.cargo || '').toLowerCase();
      return c.indexOf('fiscal') >= 0 || c.indexOf('apoio') >= 0 || c.indexOf('engenheiro') >= 0;
    });
    if (!_fiscais.length) _fiscais = [{ nome: fiscalNome, cargo: fiscalCargo, mat: S.sessao && S.sessao.mat || '' }];
    return '<div class="ass-wrap">'
      + _fiscais.map(function(u){
          var _cargo = (u.cargo || 'Fiscal') + ' – TJMG / COMAP-GEMAP-DENGEP';
          var _mat   = u.mat ? 'Mat. ' + u.mat : '';
          return '<div class="ass-box">'
            + '<div class="ass-title">' + (u.cargo || 'Fiscal de Contrato') + '</div>'
            + '<div class="ass-linha"></div>'
            + '<div class="ass-nome">' + u.nome + '</div>'
            + '<div class="ass-cargo">' + _cargo + '</div>'
            + (_mat ? '<div class="ass-mat">' + _mat + '</div>' : '')
            + '</div>';
        }).join('')
      + '</div>';
  })();

  /* ── Ficha técnica extra OSP ── */
  var fichaOspExtra = '';
  if (i.tipo !== 'ose' && i.tipo !== 'programada' && i.tipo !== 'osp') {
    fichaOspExtra = '<div class="ficha-item"><div class="ficha-label">Periodicidade</div><div class="ficha-val">'
      + ({trimestral:'Trimestral',semestral:'Semestral',anual:'Anual'}[i.tv || 'trimestral'] || 'Trimestral')
      + '</div></div>';
  }

  /* ── Montagem final do HTML ── */
  var html = '<!DOCTYPE html><html lang="pt-BR"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + numDoc + ' \u2013 ' + tipoLbl + ' \u2013 ' + i.edif + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">'
    + '<style>' + css + '</style>'
    + '</head><body>'
    + '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>'
    + '<div class="btn-bar">'
    + '<button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>'
    + '<button class="pdf-btn" id="btn-pdf" onclick="gerarPDF(this)">📄 Exportar PDF A4</button>'
    + '</div>'
    + '<div class="page">'

    /* Topo */
    + '<div class="topo">'
    + '<div class="topo-body">'
    + '<div class="topo-brasao">⚖️</div>'
    + '<div class="topo-inst">'
    + '<div class="topo-estado">Estado de Minas Gerais</div>'
    + '<div class="topo-nome">Tribunal de Justiça do Estado de Minas Gerais</div>'
    + '<div class="topo-sub">COMAP-GEMAP-DENGEP' + (regLbl ? ' · ' + regLbl : '') + '</div>'
    + '</div>'
    + '<div class="topo-doc"><div class="doc-label">Protocolo</div><div class="doc-num">' + numDoc + '</div></div>'
    + '</div>'
    + '<div class="topo-strip"></div>'
    + '</div>'

    /* Faixa tipo */
    + '<div class="tipo-faixa">'
    + '<span class="tipo-badge">' + tipoLbl + '</span>'
    + '<span class="tipo-data">' + geradoEm + '</span>'
    + '</div>'

    /* Corpo */
    + '<div class="corpo">'

    /* Ficha técnica */
    + '<div class="ficha"><div class="ficha-title">Identificação da Edificação</div>'
    + '<div class="ficha-grid">'
    + '<div class="ficha-item"><div class="ficha-label">Edificação</div><div class="ficha-val">' + i.edif + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Comarca</div><div class="ficha-val">' + (i.com || '—') + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Polo</div><div class="ficha-val">' + (i.polo || '—') + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Grupo de Manutenção</div><div class="ficha-val">Grupo ' + (i.grupo || 'B') + '</div></div>'
    + fichaOspExtra
    + '<div class="ficha-item"><div class="ficha-label">' + (i.tipo === 'osp' ? 'Data de Abertura' : 'Data da Vistoria') + '</div><div class="ficha-val">' + fdt(_dataVist) + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Fiscal Responsável</div><div class="ficha-val">' + fiscalNome + '</div></div>'
    + (_osp && i.os ? '<div class="ficha-item"><div class="ficha-label">' + (i.tipo==='ose'?'Nº da OSE':'Nº da OSP') + '</div><div class="ficha-val mono">' + i.os + '</div></div>' : '')
    + (i.tipo==='osp'&&i.dtInicioExec ? '<div class="ficha-item"><div class="ficha-label">Início Execução</div><div class="ficha-val">' + fdt(i.dtInicioExec) + '</div></div>' : '')
    + (i.tipo==='osp'&&i.diasPrazo    ? '<div class="ficha-item"><div class="ficha-label">Prazo</div><div class="ficha-val">' + i.diasPrazo + ' dias</div></div>' : '')
    + (i.tipo==='osp'&&i.dtFinalExec  ? '<div class="ficha-item"><div class="ficha-label">Data Final</div><div class="ficha-val">' + fdt(i.dtFinalExec) + '</div></div>' : '')
    + '</div></div>'

    /* KPIs */
    + '<div class="kpis">' + kpisHtml + '</div>'

    /* Barra de progresso */
    + '<div class="prog-wrap">'
    + '<div class="prog-header">'
    + '<span class="prog-title">' + (_osp ? 'Índice de Execução' : 'Índice de Conformidade') + '</span>'
    + '<span class="prog-pct" style="color:' + _pctCor + ';">' + _pct + '%</span>'
    + '</div>'
    + '<div class="prog-track"><div class="prog-fill" style="width:' + _pct + '%;background:linear-gradient(90deg,' + _pctG + ');"></div></div>'
    + '</div>'

    /* Painel OSE/OSP */
    + ospPanel

    /* Seções */
    + '<div class="sec-titulo">'
    + '<span class="sec-titulo-txt">📋 ' + (_osp ? 'Atividades por Sistema' : 'Checklist de Inspeção Técnica') + '</span>'
    + '<span class="sec-count">' + stats.total + ' itens · ' + Object.keys(sim).length + ' sistemas</span>'
    + '</div>'
    + '<div style="border:1px solid #dde3ec;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">'
    + secoes
    + '</div>'

    /* Materiais consolidados */
    + matsGerais

    /* Obs OSP */
    + (i.tipo === 'osp'
        ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 16px;margin-top:20px;">'
          + '<span style="font-size:11px;color:#92400e;font-weight:600;"><b>Observação:</b> Quantitativo e Qualitativo pode alterar conforme execução e verificação in-loco.</span></div>'
        : '')

    /* Assinaturas */
    + assHtml

    /* Rodapé */
    + '<div class="rodape-rit">'
    + 'Documento gerado eletronicamente pelo Sistema TJMG Fiscal · ' + geradoEm + '<br>'
    + 'Protocolo ' + numDoc + ' · Válido como registro técnico oficial de vistoria predial'
    + '</div>'

    + '</div>'  /* corpo */
    + '</div>'  /* page */
    + '<div id="foto-lb" onclick="fecharLB()"><img id="foto-lb-img" src=""><div id="foto-lb-cap"></div></div>'
    + '<scr' + 'ipt>'
    + 'function abrirLB(fig){'
    + 'var img=fig.querySelector("img");'
    + 'var cap=fig.querySelector("figcaption");'
    + 'document.getElementById("foto-lb-img").src=img.src;'
    + 'document.getElementById("foto-lb-cap").textContent=cap?cap.textContent:"";'
    + 'document.getElementById("foto-lb").classList.add("open");'
    + '}'
    + 'function fecharLB(){document.getElementById("foto-lb").classList.remove("open");}'
    + 'document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharLB();});'
    + 'function gerarPDF(btn){'
    + 'btn.disabled=true;btn.textContent="Gerando PDF...";'
    + 'var bar=document.querySelector(".btn-bar");'
    + 'if(bar)bar.style.display="none";'
    + 'var lb=document.getElementById("foto-lb");'
    + 'if(lb)lb.style.display="none";'
    + 'var el=document.querySelector(".page");'
    + 'var nomeArq=document.title.replace(/[^a-zA-Z0-9_\\-]/g,"_")+".pdf";'
    + 'html2pdf().set({'
    + 'margin:10,'
    + 'filename:nomeArq,'
    + 'image:{type:"jpeg",quality:0.97},'
    + 'html2canvas:{scale:2,useCORS:true,logging:false,'
    + 'windowWidth:730,scrollY:0,allowTaint:false},'
    + 'jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true}'
    + '}).from(el).save()'
    + '.then(function(){btn.disabled=false;btn.textContent="\uD83D\uDCC4 Exportar PDF A4";'
    + 'if(bar)bar.style.display="";})'
    + '.catch(function(){btn.disabled=false;btn.textContent="\uD83D\uDCC4 Exportar PDF A4";'
    + 'if(bar)bar.style.display="";});'
    + '}'
    + '<\/script>'
    + '</body></html>';

  return html;
}

/* ── Download do relatório principal ─────────────────────── */

function _doExportHTML(id) {
  var i = S.insp.find(function(x){ return x.id === id; }); if (!i) return;
  if (i.tipo === 'subestacao') { exportHTMLSub(id); return; }
  var html = _gerarHTMLStr(id); if (!html) return;
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  var nomeArq = 'TJMG_' + i.tipo.toUpperCase()
    + '_' + i.edif.replace(/[^a-zA-Z0-9]/g,'_')
    + (i.os ? '_' + i.os.replace(/[^a-zA-Z0-9]/g,'_') : '')
    + '_' + fdt(i.dtVistoria || i.data).replace(/\//g,'-') + '.html';
  a.download = nomeArq;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  Tt('\u2705 Relatório exportado com sucesso!');
}

/* ══════════════════════════════════════════════════════════
   SUBESTAÇÃO — identidade visual TJMG unificada
   ══════════════════════════════════════════════════════════ */

function exportHTMLSub(id) {
  var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) return;
  if (insp.sub) {
    Tt('Carregando fotos...');
    PhotoStore.loadSubAll(id, insp.sub).then(function(){ _doExportHTMLSub(id); }).catch(function(){ _doExportHTMLSub(id); });
    return;
  }
  _doExportHTMLSub(id);
}

function _gerarHTMLSubStr(id) {
  var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) return null;
  var sub  = insp.sub || {};
  var d    = insp.d   || {};

  var tipoSub = sub.tipo_sub       || d.tipo_sub       || 'AEREA';
  var tipoMan = sub.tipo_manutencao|| d.tipo_manutencao || 'ANUAL';
  var chk     = sub.chk || {};
  var COR_SUB = '#b45309';  /* âmbar — identidade de subestação */

  var secoes = SUB_SECOES.filter(function(s){
    if (s.sempre) return true;
    if (s.anual    && tipoMan !== 'ANUAL')     return false;
    if (s.abrigada && tipoSub !== 'ABRIGADA')  return false;
    return true;
  });

  var total = 0, marc = 0;
  secoes.forEach(function(s){ s.itens.forEach(function(it){ total++; if (chk[it.id] && chk[it.id].v) marc++; }); });
  var pct  = total ? Math.round(marc / total * 100) : 0;
  var pCor = pct >= 80 ? '#15803d' : pct >= 50 ? '#d97706' : '#b91c1c';
  var pG   = pct >= 80 ? '#15803d,#22c55e' : pct >= 50 ? '#b45309,#f59e0b' : '#b91c1c,#ef4444';

  var geradoEm   = new Date().toLocaleString('pt-BR', { dateStyle:'full', timeStyle:'short' });
  var numDoc     = insp.protocolo || gerarProtocolo(insp);
  var regLbl     = insp.reg && REG[insp.reg] ? 'Região ' + REG[insp.reg].l : '';
  var fiscalNome = insp.fiscal || (S.sessao && S.sessao.nome) || '—';
  var dt         = insp.data ? new Date(insp.data).toLocaleDateString('pt-BR') : fdt(Date.now());

  /* ── Helpers locais ── */
  function fImgs(fotos) {
    if (!fotos || !fotos.length) return '';
    return '<div class="foto-grid">'
      + fotos.map(function(f){
          return '<figure class="foto-item" onclick="abrirLB(this)">'
            + '<img src="' + f.b64 + '" alt="Foto" loading="lazy">'
            + '<figcaption>' + (f.leg || '') + '</figcaption></figure>';
        }).join('')
      + '</div>';
  }
  function mRow(l, v, lim, ok) {
    var bg = ok === false ? '#fff1f2' : ok === true ? '#f0fdf4' : '#fff';
    var fc = ok === false ? '#dc2626' : ok === true ? '#16a34a' : '#64748b';
    var st = ok === false ? 'FORA' : ok === true ? 'OK' : '—';
    return '<tr style="background:' + bg + ';">'
      + '<td class="med-lbl">' + l + '</td>'
      + '<td class="med-val"><b>' + v + '</b></td>'
      + '<td class="med-lim">' + lim + '</td>'
      + '<td class="med-st" style="color:' + fc + ';">' + st + '</td></tr>';
  }

  /* ── CSS ── */
  var css = [
    '*{box-sizing:border-box;margin:0;padding:0;}',
    'body{font-family:"Inter",system-ui,sans-serif;background:#f4f6f9;color:#1a2332;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',

    /* Botões */
    '.btn-bar{position:fixed;bottom:28px;right:28px;z-index:999;display:flex;flex-direction:column;gap:10px;align-items:flex-end;}',
    '.print-btn{background:' + COR_SUB + ';color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:"Inter",sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);white-space:nowrap;}',
    '.pdf-btn{background:#1a2332;color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:"Inter",sans-serif;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);white-space:nowrap;}',
    '.pdf-btn:disabled{opacity:.6;cursor:wait;}',

    /* Layout */
    '.page{width:730px;max-width:730px;margin:20px auto;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.12);word-break:break-word;}',
    '.topo{background:' + COR_SUB + ';overflow:hidden;}',
    '.topo-strip{height:5px;background:rgba(255,255,255,.25);}',
    '.topo-body{padding:14px 18px 12px;display:flex;align-items:center;gap:10px;}',
    '.topo-brasao{width:42px;height:42px;min-width:42px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}',
    '.topo-inst{flex:1;min-width:0;}',
    '.topo-estado{font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:2px;}',
    '.topo-nome{font-size:14px;font-weight:800;color:#fff;line-height:1.2;}',
    '.topo-sub{font-size:9px;color:rgba(255,255,255,.7);margin-top:2px;}',
    '.topo-doc{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:7px;padding:5px 8px;text-align:right;flex-shrink:0;max-width:200px;}',
    '.doc-label{font-size:8px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.6);}',
    '.doc-num{font-family:"JetBrains Mono",monospace;font-size:8px;font-weight:600;color:#fff;margin-top:2px;word-break:break-all;line-height:1.5;}',
    '.tipo-faixa{background:#1a2332;padding:7px 18px;display:flex;align-items:center;justify-content:space-between;gap:6px;}',
    '.tipo-badge{background:' + COR_SUB + ';color:#fff;border-radius:5px;padding:4px 10px;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap;}',
    '.tipo-data{font-size:9px;color:rgba(255,255,255,.5);font-family:"JetBrains Mono",monospace;}',
    '.corpo{padding:24px;}',

    /* Ficha técnica */
    '.ficha{border:1px solid #dde3ec;border-radius:10px;overflow:hidden;margin-bottom:24px;}',
    '.ficha-title{background:#f0f4f9;padding:10px 16px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;}',
    '.ficha-grid{display:grid;grid-template-columns:repeat(2,1fr);}',
    '.ficha-item{padding:12px 16px;border-right:1px solid #eef1f6;border-bottom:1px solid #eef1f6;}',
    '.ficha-item:nth-child(2n){border-right:none;}',
    '.ficha-label{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;}',
    '.ficha-val{font-size:13px;font-weight:600;color:#1a2332;}',
    '.ficha-val.mono{font-family:"JetBrains Mono",monospace;font-size:12px;color:' + COR_SUB + ';}',

    /* KPIs */
    '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}',
    '.kpi{border-radius:10px;padding:12px 14px;border:1px solid #dde3ec;}',
    '.kpi-num{font-size:26px;font-weight:800;line-height:1;margin-bottom:4px;}',
    '.kpi-lbl{font-size:10px;font-weight:600;letter-spacing:.5px;color:#64748b;}',
    '.kpi-total{background:#1a2332;border-color:#1a2332;}.kpi-total .kpi-num,.kpi-total .kpi-lbl{color:#fff;}',
    '.kpi-ok{background:#f0fdf4;border-color:#bbf7d0;}.kpi-ok .kpi-num{color:#16a34a;}',
    '.kpi-nc{background:#fff1f2;border-color:#fecdd3;}.kpi-nc .kpi-num{color:#dc2626;}',
    '.kpi-amb{background:#fff7ed;border-color:#fed7aa;}.kpi-amb .kpi-num{color:#ea580c;}',

    /* Barra progresso */
    '.prog-wrap{background:#f8fafc;border:1px solid #dde3ec;border-radius:10px;padding:16px 20px;margin-bottom:24px;}',
    '.prog-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}',
    '.prog-title{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;}',
    '.prog-pct{font-size:22px;font-weight:800;}',
    '.prog-track{height:8px;background:#e2e8f0;border-radius:20px;overflow:hidden;}',
    '.prog-fill{height:100%;border-radius:20px;}',

    /* Seções do checklist */
    '.sec-titulo{background:#1a2332;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:10px;margin-top:24px;border-radius:8px 8px 0 0;}',
    '.sec-titulo-txt{font-size:14px;font-weight:700;flex:1;}',
    '.sec-count{font-size:10px;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;}',
    '.sec-blk{margin-bottom:0;border:1px solid #dde3ec;border-top:none;}',
    '.sec-hdr{background:#f8fafc;padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;}',
    '.sec-id{background:' + COR_SUB + ';color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;flex-shrink:0;}',
    '.sec-nm{flex:1;font-weight:700;font-size:12px;}',
    '.sec-prog{font-size:11px;font-weight:700;}',
    '.chk-table{width:100%;border-collapse:collapse;}',
    '.chk-table thead tr{background:#fafafa;}',
    '.chk-th{padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:1px solid #e2e8f0;text-align:left;}',
    '.chk-row{border-bottom:1px solid #f1f5f9;vertical-align:top;}',
    '.chk-row:last-child{border-bottom:none;}',
    '.chk-cb{padding:8px 10px;text-align:center;font-size:16px;width:36px;}',
    '.chk-d{padding:8px 10px;font-size:12px;}',
    '.chk-obs{padding:8px 10px;font-size:11px;color:#64748b;width:200px;vertical-align:top;}',

    /* Fotos */
    '.foto-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:6px 0;}',
    '.foto-item{display:flex;flex-direction:column;border-radius:8px;overflow:hidden;border:1px solid #dde3ec;background:#f8fafc;cursor:zoom-in;}',
    '.foto-item img{width:100%;height:130px;object-fit:cover;display:block;}',
    '.foto-item figcaption{font-size:10px;color:#64748b;padding:4px 8px;text-align:center;}',

    /* Lightbox */
    '#foto-lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;}',
    '#foto-lb.open{display:flex;}',
    '#foto-lb img{max-width:94vw;max-height:90vh;border-radius:10px;}',
    '#foto-lb-cap{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;padding:7px 20px;border-radius:20px;font-size:13px;pointer-events:none;white-space:nowrap;}',

    /* Medições */
    '.med-wrap{margin-top:24px;}',
    '.med-titulo{background:#1e3a5f;color:#fff;padding:10px 16px;font-size:13px;font-weight:700;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:8px;}',
    '.med-sub{border:1px solid #dde3ec;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;margin-bottom:16px;}',
    '.med-equip-hdr{padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
    '.med-equip-badge{border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;color:#fff;}',
    '.med-table{width:100%;border-collapse:collapse;}',
    '.med-table thead tr{background:#fafafa;}',
    '.med-th{padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:1px solid #e2e8f0;text-align:left;}',
    '.med-lbl{padding:8px 10px;font-size:12px;}',
    '.med-val{padding:8px 10px;font-size:12px;font-family:"JetBrains Mono",monospace;font-weight:600;}',
    '.med-lim{padding:8px 10px;font-size:11px;color:#64748b;}',
    '.med-st{padding:8px 10px;font-size:11px;font-weight:700;text-align:center;}',

    /* NC / Ações */
    '.nc-wrap{margin-top:24px;display:flex;flex-direction:column;gap:12px;}',
    '.nc-blk{border-radius:10px;padding:14px 18px;border:1px solid #fde68a;background:#fffbeb;}',
    '.nc-blk.acoes{border-color:#bbf7d0;background:#f0fdf4;}',
    '.nc-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:8px;}',
    '.nc-blk.acoes .nc-lbl{color:#15803d;}',
    '.nc-txt{font-size:12px;line-height:1.7;color:#1a2332;}',

    /* Assinatura */
    '.ass-wrap{margin-top:40px;padding-top:24px;border-top:2px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:20px;}',
    '.ass-box{flex:1;min-width:200px;}',
    '.ass-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:16px;}',
    '.ass-linha{border-top:1px solid #94a3b8;margin:40px 0 10px;}',
    '.ass-nome{font-size:13px;font-weight:700;color:#1a2332;}',
    '.ass-cargo{font-size:11px;color:#64748b;margin-top:2px;}',
    '.ass-mat{font-family:"JetBrains Mono",monospace;font-size:10px;color:#94a3b8;margin-top:2px;}',

    /* Rodapé */
    '.rodape-rit{margin-top:32px;padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;line-height:1.7;}',

    /* Impressão */
    '@page{size:A4 portrait;margin:10mm;}',
    '@media print{',
    'html,body{height:auto!important;overflow:visible!important;background:#fff!important;margin:0!important;padding:0!important;}',
    '.btn-bar{display:none!important;}#foto-lb{display:none!important;}',
    '.page{width:100%!important;max-width:100%!important;box-shadow:none!important;margin:0!important;}',
    '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.ficha-item,.kpi,.ass-box,.prog-wrap,.sec-hdr{break-inside:avoid;}',
    '.foto-item{break-inside:avoid;}',
    '.chk-table,.med-table{break-inside:auto;}',
    '.chk-row{break-inside:auto;}',
    '.foto-grid{grid-template-columns:repeat(3,1fr)!important;}',
    '.foto-item img{height:90px!important;}',
    '.corpo{padding:14px!important;}',
    '}'
  ].join('');

  /* ── Blocos de checklist ── */
  var checkHtml = '';
  secoes.forEach(function(s){
    var sm = s.itens.filter(function(it){ return chk[it.id] && chk[it.id].v; }).length;
    var smCor = sm === s.itens.length ? '#16a34a' : sm === 0 ? '#dc2626' : '#d97706';
    checkHtml += '<div class="sec-blk">'
      + '<div class="sec-hdr">'
      + '<span class="sec-id">' + s.id + '</span>'
      + '<span class="sec-nm">' + s.n + '</span>'
      + '<span class="sec-prog" style="color:' + smCor + ';">' + sm + '/' + s.itens.length + '</span>'
      + '</div>'
      + '<table class="chk-table"><thead><tr>'
      + '<th class="chk-th" style="width:36px;text-align:center;">✓</th>'
      + '<th class="chk-th">Item</th>'
      + '<th class="chk-th" style="width:200px;">Obs / Fotos</th>'
      + '</tr></thead><tbody>';
    s.itens.forEach(function(it){
      var ck = chk[it.id] || { v:false, obs:'', fotos:[] };
      checkHtml += '<tr class="chk-row" style="background:' + (ck.v ? '#f8fff8' : '#fff') + ';">'
        + '<td class="chk-cb">' + (ck.v ? '✅' : '☐') + '</td>'
        + '<td class="chk-d">' + it.d + '</td>'
        + '<td class="chk-obs">' + (ck.obs || '')
        + (ck.fotos && ck.fotos.length ? fImgs(ck.fotos) : '')
        + '</td></tr>';
    });
    checkHtml += '</tbody></table></div>';
  });

  /* ── Medições elétricas (somente ABRIGADA) ── */
  var medHtml = '';
  if (tipoSub === 'ABRIGADA') {
    /* Transformadores */
    (sub.trafos || []).forEach(function(tr, idx){
      var at2 = _spf(tr.at), bt2 = _spf(tr.bt);
      var teo2 = at2 && bt2 ? at2 * 1000 / bt2 : 0;
      medHtml += '<div class="med-sub">'
        + '<div class="med-equip-hdr">'
        + '<span class="med-equip-badge" style="background:#b45309;">TR-' + (idx+1) + '</span>'
        + '<span style="font-weight:700;font-size:12px;">Transformador #' + (idx+1) + (tr.ref ? ' — Ref. ' + tr.ref : '') + '</span>'
        + '</div>'
        + '<table class="med-table"><thead><tr>'
        + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
        + '</tr></thead><tbody>';
      ['x1','x2','x3'].forEach(function(p, pi){
        var v = _spf(tr['ttr_' + p]);
        var ok = !v || !teo2 ? null : (Math.abs((v - teo2) / teo2) <= 0.005);
        medHtml += mRow('TTR X' + (pi+1) + '-T', (tr['ttr_' + p] || '—'), '±0,5% (a=' + teo2.toFixed(4) + ')', ok);
      });
      medHtml += mRow('Iso H1-T',  (tr.iso_h1t  || '—') + ' MΩ', '≥100 MΩ', tr.iso_h1t  ? _spf(tr.iso_h1t)  >= 100 : null);
      medHtml += mRow('Iso H2-T',  (tr.iso_h2t  || '—') + ' MΩ', '≥100 MΩ', tr.iso_h2t  ? _spf(tr.iso_h2t)  >= 100 : null);
      medHtml += mRow('Iso H3-T',  (tr.iso_h3t  || '—') + ' MΩ', '≥100 MΩ', tr.iso_h3t  ? _spf(tr.iso_h3t)  >= 100 : null);
      medHtml += mRow('Iso H1-X1', (tr.iso_h1x1 || '—') + ' MΩ', '≥10 MΩ',  tr.iso_h1x1 ? _spf(tr.iso_h1x1) >= 10  : null);
      medHtml += mRow('Iso H2-X2', (tr.iso_h2x2 || '—') + ' MΩ', '≥10 MΩ',  tr.iso_h2x2 ? _spf(tr.iso_h2x2) >= 10  : null);
      medHtml += mRow('Iso H3-X3', (tr.iso_h3x3 || '—') + ' MΩ', '≥10 MΩ',  tr.iso_h3x3 ? _spf(tr.iso_h3x3) >= 10  : null);
      var hh12 = _spf(tr.ohm_h1h2), hh13 = _spf(tr.ohm_h1h3), hh23 = _spf(tr.ohm_h2h3);
      var vp2  = hh12 && hh13 && hh23 && Math.min(hh12,hh13,hh23) > 0
        ? ((Math.max(hh12,hh13,hh23) / Math.min(hh12,hh13,hh23) - 1) * 100).toFixed(2) : null;
      medHtml += mRow('Variação ôhmica', vp2 !== null ? vp2 + '%' : '—', '≤3%', vp2 !== null ? parseFloat(vp2) <= 3 : null);
      medHtml += '</tbody></table>'
        + (tr.fotos_ttr && tr.fotos_ttr.length ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos TTR:</b>' + fImgs(tr.fotos_ttr) + '</div>' : '')
        + (tr.fotos_iso && tr.fotos_iso.length ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Isolação:</b>' + fImgs(tr.fotos_iso) + '</div>' : '')
        + (tr.fotos_ohm && tr.fotos_ohm.length ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Ôhmica:</b>' + fImgs(tr.fotos_ohm) + '</div>' : '')
        + '</div>';
    });

    /* Disjuntores */
    (sub.disjs || []).forEach(function(dj, idx){
      medHtml += '<div class="med-sub">'
        + '<div class="med-equip-hdr">'
        + '<span class="med-equip-badge" style="background:#1e3a5f;">DJ-' + (idx+1) + '</span>'
        + '<span style="font-weight:700;font-size:12px;">Disjuntor #' + (idx+1) + ' — ' + (dj.tipo || 'VACUO') + '</span>'
        + '</div>'
        + '<table class="med-table"><thead><tr>'
        + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
        + '</tr></thead><tbody>';
      ['r','s','t'].forEach(function(f){ var v = _spf(dj['ab_' + f]); medHtml += mRow('Iso Ab. ' + f.toUpperCase(), (dj['ab_'+f]||'—')+' MΩ','≥1000 MΩ', dj['ab_'+f] ? v >= 1000 : null); });
      ['r','s','t'].forEach(function(f){ var v = _spf(dj['fe_' + f]); medHtml += mRow('Iso Fe. ' + f.toUpperCase(), (dj['fe_'+f]||'—')+' MΩ','≥1000 MΩ', dj['fe_'+f] ? v >= 1000 : null); });
      [{f:'cr',l:'R1-R2'},{f:'cs',l:'S1-S2'},{f:'ct',l:'T1-T2'}].forEach(function(fd){
        var v = _spf(dj[fd.f]); medHtml += mRow('Cont. '+fd.l, (dj[fd.f]||'—')+' µΩ','≤300 µΩ', dj[fd.f] ? v <= 300 : null);
      });
      medHtml += '</tbody></table>'
        + (dj.fotos_iso && dj.fotos_iso.length ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Isolação:</b>' + fImgs(dj.fotos_iso) + '</div>' : '')
        + (dj.fotos_cr  && dj.fotos_cr.length  ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Contato:</b>'  + fImgs(dj.fotos_cr)  + '</div>' : '')
        + '</div>';
    });

    /* Chaves seccionadoras */
    (sub.secc || []).forEach(function(sc, idx){
      medHtml += '<div class="med-sub">'
        + '<div class="med-equip-hdr">'
        + '<span class="med-equip-badge" style="background:#1a4731;">CS-' + (idx+1) + '</span>'
        + '<span style="font-weight:700;font-size:12px;">Chave Seccionadora #' + (idx+1) + '</span>'
        + '</div>'
        + '<table class="med-table"><thead><tr>'
        + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
        + '</tr></thead><tbody>';
      ['r','s','t'].forEach(function(f){ var v = _spf(sc['ab_' + f]); medHtml += mRow('Iso Ab. '+f.toUpperCase(), (sc['ab_'+f]||'—')+' MΩ','≥1000 MΩ', sc['ab_'+f] ? v >= 1000 : null); });
      ['r','s','t'].forEach(function(f){ var v = _spf(sc['fe_' + f]); medHtml += mRow('Iso Fe. '+f.toUpperCase(), (sc['fe_'+f]||'—')+' MΩ','≥1000 MΩ', sc['fe_'+f] ? v >= 1000 : null); });
      [{f:'cr',l:'R1-R2'},{f:'cs',l:'S1-S2'},{f:'ct',l:'T1-T2'}].forEach(function(fd){
        var v = _spf(sc[fd.f]); medHtml += mRow('Cont. '+fd.l, (sc[fd.f]||'—')+' µΩ','≤500 µΩ', sc[fd.f] ? v <= 500 : null);
      });
      medHtml += '</tbody></table>'
        + (sc.fotos_iso && sc.fotos_iso.length ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Isolação:</b>' + fImgs(sc.fotos_iso) + '</div>' : '')
        + (sc.fotos_cr  && sc.fotos_cr.length  ? '<div style="padding:8px 10px;"><b style="font-size:10px;color:#64748b;">Fotos Contato:</b>'  + fImgs(sc.fotos_cr)  + '</div>' : '')
        + '</div>';
    });
  }

  /* ── Assinaturas ── */
  var assHtml = (function(){
    var _inspReg = insp.reg || (S.sessao && S.sessao.reg) || '';
    var _fiscais = US.filter(function(u){
      if (!u.ativo) return false;
      if (_inspReg && u.reg !== _inspReg) return false;
      var c = (u.cargo || '').toLowerCase();
      return c.indexOf('fiscal') >= 0 || c.indexOf('apoio') >= 0 || c.indexOf('engenheiro') >= 0;
    });
    if (!_fiscais.length) _fiscais = [{ nome: fiscalNome, cargo: 'Fiscal de Contrato', mat: S.sessao && S.sessao.mat || '' }];
    return '<div class="ass-wrap">'
      + _fiscais.map(function(u){
          return '<div class="ass-box">'
            + '<div class="ass-title">' + (u.cargo || 'Fiscal') + '</div>'
            + '<div class="ass-linha"></div>'
            + '<div class="ass-nome">' + u.nome + '</div>'
            + '<div class="ass-cargo">' + (u.cargo || 'Fiscal') + ' – TJMG / COMAP-GEMAP-DENGEP</div>'
            + (u.mat ? '<div class="ass-mat">Mat. ' + u.mat + '</div>' : '')
            + '</div>';
        }).join('')
      + '</div>';
  })();

  /* ── Montagem final ── */
  var html = '<!DOCTYPE html><html lang="pt-BR"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + numDoc + ' \u2013 Subestação \u2013 ' + (insp.edif || insp.com || '') + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">'
    + '<style>' + css + '</style>'
    + '</head><body>'
    + '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>'
    + '<div class="btn-bar">'
    + '<button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>'
    + '<button class="pdf-btn" id="btn-pdf" onclick="gerarPDF(this)">📄 Exportar PDF A4</button>'
    + '</div>'
    + '<div class="page">'

    /* Topo */
    + '<div class="topo">'
    + '<div class="topo-body">'
    + '<div class="topo-brasao">⚡</div>'
    + '<div class="topo-inst">'
    + '<div class="topo-estado">Estado de Minas Gerais</div>'
    + '<div class="topo-nome">Tribunal de Justiça do Estado de Minas Gerais</div>'
    + '<div class="topo-sub">COMAP-GEMAP-DENGEP · Manutenção de Subestação — Anexo B.1 TJMG' + (regLbl ? ' · ' + regLbl : '') + '</div>'
    + '</div>'
    + '<div class="topo-doc"><div class="doc-label">Protocolo</div><div class="doc-num">' + numDoc + '</div></div>'
    + '</div>'
    + '<div class="topo-strip"></div>'
    + '</div>'

    /* Faixa tipo */
    + '<div class="tipo-faixa">'
    + '<span class="tipo-badge">RITMP — COMPLEMENTAR — SUBESTAÇÃO</span>'
    + '<span class="tipo-data">' + geradoEm + '</span>'
    + '</div>'

    /* Corpo */
    + '<div class="corpo">'

    /* Ficha técnica */
    + '<div class="ficha"><div class="ficha-title">Identificação da Edificação</div>'
    + '<div class="ficha-grid">'
    + '<div class="ficha-item"><div class="ficha-label">Edificação</div><div class="ficha-val">' + (insp.edif || '—') + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Comarca</div><div class="ficha-val">' + (insp.com || '—') + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Data da Inspeção</div><div class="ficha-val">' + dt + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Fiscal Responsável</div><div class="ficha-val">' + fiscalNome + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Tipo de Subestação</div><div class="ficha-val mono">' + tipoSub + '</div></div>'
    + '<div class="ficha-item"><div class="ficha-label">Tipo de Manutenção</div><div class="ficha-val mono">' + tipoMan + '</div></div>'
    + (sub.responsavel ? '<div class="ficha-item"><div class="ficha-label">Resp. Técnico</div><div class="ficha-val">' + sub.responsavel + '</div></div>' : '')
    + '</div></div>'

    /* KPIs */
    + '<div class="kpis">'
    + '<div class="kpi kpi-total"><div class="kpi-num">' + total + '</div><div class="kpi-lbl">Total Itens</div></div>'
    + '<div class="kpi kpi-ok"><div class="kpi-num" style="color:#16a34a;">' + marc + '</div><div class="kpi-lbl">✅ Marcados</div></div>'
    + '<div class="kpi kpi-nc"><div class="kpi-num" style="color:#dc2626;">' + (total - marc) + '</div><div class="kpi-lbl">❌ Pendentes</div></div>'
    + '<div class="kpi kpi-amb"><div class="kpi-num" style="color:' + pCor + ';">' + pct + '%</div><div class="kpi-lbl">Conformidade</div></div>'
    + '</div>'

    /* Barra de progresso */
    + '<div class="prog-wrap">'
    + '<div class="prog-header">'
    + '<span class="prog-title">Índice de Conformidade do Checklist</span>'
    + '<span class="prog-pct" style="color:' + pCor + ';">' + pct + '%</span>'
    + '</div>'
    + '<div class="prog-track"><div class="prog-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + pG + ');"></div></div>'
    + '</div>'

    /* Obs gerais */
    + (sub.obs_geral
        ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:8px;">Observações Gerais</div>'
          + '<div style="font-size:12px;line-height:1.7;">' + sub.obs_geral + '</div>'
          + '</div>'
        : '')

    /* Checklist */
    + '<div class="sec-titulo">'
    + '<span class="sec-titulo-txt">📋 Checklist Inspeção — Anexo B.1 TJMG</span>'
    + '<span class="sec-count">' + total + ' itens · ' + secoes.length + ' seções</span>'
    + '</div>'
    + checkHtml

    /* Medições */
    + (tipoSub === 'ABRIGADA' && medHtml
        ? '<div class="med-wrap">'
          + '<div class="med-titulo">📊 Medições Elétricas</div>'
          + medHtml
          + '</div>'
        : '')

    /* Não conformidades */
    + ((sub.nc || sub.acoes)
        ? '<div class="nc-wrap">'
          + '<div class="nc-blk"><div class="nc-lbl">⚠️ Não Conformidades</div><div class="nc-txt">' + (sub.nc || 'Nenhuma registrada.') + '</div></div>'
          + '<div class="nc-blk acoes"><div class="nc-lbl">✅ Ações Corretivas</div><div class="nc-txt">' + (sub.acoes || 'Nenhuma registrada.') + '</div></div>'
          + '</div>'
        : '')

    /* Assinaturas */
    + assHtml

    /* Rodapé */
    + '<div class="rodape-rit">'
    + 'Documento gerado eletronicamente pelo Sistema TJMG Fiscal · ' + geradoEm + '<br>'
    + 'Protocolo ' + numDoc + ' · Prazo de entrega: 10 dias úteis após execução · TJMG / COMAP-GEMAP-DENGEP'
    + '</div>'
    + '</div>'  /* corpo */
    + '</div>'  /* page */

    + '<div id="foto-lb" onclick="fecharLB()"><img id="foto-lb-img" src=""><div id="foto-lb-cap"></div></div>'
    + '<scr' + 'ipt>'
    + 'function abrirLB(fig){var img=fig.querySelector("img");var cap=fig.querySelector("figcaption");'
    + 'document.getElementById("foto-lb-img").src=img.src;'
    + 'document.getElementById("foto-lb-cap").textContent=cap?cap.textContent:"";'
    + 'document.getElementById("foto-lb").classList.add("open");}'
    + 'function fecharLB(){document.getElementById("foto-lb").classList.remove("open");}'
    + 'document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharLB();});'
    + 'function gerarPDF(btn){'
    + 'btn.disabled=true;btn.textContent="Gerando PDF...";'
    + 'var bar=document.querySelector(".btn-bar");if(bar)bar.style.display="none";'
    + 'var lb=document.getElementById("foto-lb");if(lb)lb.style.display="none";'
    + 'var el=document.querySelector(".page");'
    + 'var nomeArq=document.title.replace(/[^a-zA-Z0-9_\\-]/g,"_")+".pdf";'
    + 'html2pdf().set({margin:10,filename:nomeArq,'
    + 'image:{type:"jpeg",quality:0.97},'
    + 'html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:730,scrollY:0,allowTaint:false},'
    + 'jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true}'
    + '}).from(el).save()'
    + '.then(function(){btn.disabled=false;btn.textContent="\uD83D\uDCC4 Exportar PDF A4";if(bar)bar.style.display="";})'
    + '.catch(function(){btn.disabled=false;btn.textContent="\uD83D\uDCC4 Exportar PDF A4";if(bar)bar.style.display="";});}'
    + '<\/script>'
    + '</body></html>';

  return html;
}

/* ── Download do relatório de subestação ──────────────────── */

function _doExportHTMLSub(id) {
  var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) return;
  var html = _gerarHTMLSubStr(id); if (!html) return;
  var tipoSub = (insp.sub || {}).tipo_sub || 'AEREA';
  var blob    = new Blob([html], { type: 'text/html;charset=utf-8' });
  var a       = document.createElement('a');
  a.href      = URL.createObjectURL(blob);
  var nomeArq = 'Sub_' + tipoSub
    + '_' + (insp.com  || '').replace(/[^a-zA-Z0-9]/g,'_')
    + '_' + fdt(insp.data || Date.now()).replace(/\//g,'-') + '.html';
  a.download = nomeArq;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  Tt('\u2705 HTML exportado com sucesso!');
}
