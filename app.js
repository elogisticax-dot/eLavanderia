/* Interface do controle de lavanderia. Regras em logica.js (window.Lav). */
(function () {
  'use strict';
  var L = window.Lav;

  // ---------------- estado ----------------
  var db = null, usr = null, meuId = null, podeEscrever = true, ehAdmin = false, semBanco = false;
  var cru = { cfg: null, visitas: [], ajustes: [], feriados: [] };
  var carregado = { cfg: false, visitas: false, ajustes: false, feriados: false };
  var confirmado = false, avisoRede = '', timerCarga = null;
  var E = L.estado(null, [], [], []);
  var nomes = {};
  var rota = 'inicio';
  var form = null, formNaTela = false, salvando = false, redesenhoPendente = false;
  var filtroHist = { mes: null, tipo: 'todos' };
  var rel = null;

  var app = document.getElementById('app');
  var camada = document.getElementById('camada');

  // ---------------- utilidades ----------------
  function hoje() { return L.iso(new Date()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var IC = {
    ok: '<path d="M20 6 9 17l-5-5"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    mais: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    seta: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    tela: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    caminhao: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.3A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  };
  function ico(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }
  function pill(n, icone, txt, titulo) { return '<span class="pill" data-n="' + n + '"' + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + (icone ? ico(icone) : '') + txt + '</span>'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dm(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  function dma(s) { return dm(s) + '/' + s.slice(0, 4); }
  function dsem(s) { return DIAS[L.diaSemana(s)]; }
  function dlongo(s) { return DIAS_LONGO[L.diaSemana(s)] + ', ' + dm(s); }
  function mesAno(s) { return MESES[+s.slice(5, 7) - 1] + ' de ' + s.slice(0, 4); }
  /** kg com 1 casa, sempre. */
  function fkg(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  /** valor para campo de texto: sem separador de milhar. */
  function kgCampo(n) { return n ? (Math.round(n * 100) / 100).toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 }) : ''; }
  function pct(n) { return String(n).replace('.', ','); }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function mopsTxt(br, vm) {
    var p = [];
    if (br) p.push(plural(br, 'branco', 'brancos'));
    if (vm) p.push(plural(vm, 'vermelho', 'vermelhos'));
    return p.join(', ');
  }
  function quandoRel(s) {
    var t = hoje();
    if (s === t) return 'hoje';
    if (s === L.somaDias(t, 1)) return 'amanhã';
    if (s === L.somaDias(t, -1)) return 'ontem';
    return dlongo(s);
  }
  function nome(id) { if (!id) return ''; if (id === meuId) return 'você'; return (nomes[id] && nomes[id].name) || 'alguém da equipe'; }
  function agoraISO() { return new Date().toISOString(); }
  function novoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function toast(txt, acao) {
    document.querySelectorAll('.toast').forEach(function (t) { t.remove(); });
    var el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status');
    var s = document.createElement('span'); s.textContent = txt; el.appendChild(s);
    if (acao) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = acao.rotulo;
      b.onclick = function () { el.remove(); acao.fn(); };
      el.appendChild(b);
    }
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, acao ? 8000 : 2600);
  }

  /** Diálogo próprio (confirm() é bloqueado). Resolve true/false. */
  function confirmar(titulo, texto, botao, perigo) {
    return new Promise(function (ok) {
      var antes = document.activeElement;
      camada.innerHTML = '<div class="veu"><div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-p">' +
        '<h2 id="dlg-t">' + esc(titulo) + '</h2><p id="dlg-p">' + esc(texto) + '</p>' +
        '<div class="botoes" style="justify-content:flex-end"><button class="btn" id="dlg-n">Cancelar</button>' +
        '<button class="btn pri' + (perigo ? ' perigo' : '') + '" id="dlg-s">' + esc(botao) + '</button></div></div></div>';
      var fim = function (v) { camada.innerHTML = ''; document.removeEventListener('keydown', tecla, true); if (antes && antes.focus) antes.focus({ preventScroll: true }); ok(v); };
      var tecla = function (e) {
        if (e.key === 'Escape') { e.preventDefault(); fim(false); }
        else if (e.key === 'Tab') { var n = document.getElementById('dlg-n'), s = document.getElementById('dlg-s'); if (document.activeElement === s && !e.shiftKey) { e.preventDefault(); n.focus(); } else if (document.activeElement === n && e.shiftKey) { e.preventDefault(); s.focus(); } }
      };
      document.addEventListener('keydown', tecla, true);
      document.getElementById('dlg-n').onclick = function () { fim(false); };
      document.getElementById('dlg-s').onclick = function () { fim(true); };
      camada.querySelector('.veu').onclick = function (e) { if (e.target === e.currentTarget) fim(false); };
      document.getElementById('dlg-s').focus();
    });
  }

  function erroEscrita(e) {
    var c = e && e.code;
    if (c === 'timeout') return 'O banco não confirmou a gravação. Seus dados continuam na tela: toque em salvar de novo.';
    if (c === 'invalid_argument') {
      if (usr) usr.can('data.write').then(function (ok) { if (ok === false) { podeEscrever = false; desenhar(); } });
      return 'O banco recusou a gravação. Se sua conta for só de leitura, peça ao responsável para liberar o registro.';
    }
    if (c === 'quota_exceeded') return 'O banco chegou ao limite de espaço. Nada foi salvo.';
    if (c === 'resource_exhausted') return 'Muitas gravações seguidas. Espere alguns segundos e tente de novo.';
    if (c === 'revoked') return 'O acesso a esta página foi encerrado. Recarregue a página.';
    return 'Não foi possível salvar agora. Confira a conexão e tente de novo.';
  }
  /** Gravação com 1 nova tentativa em falha temporária e prazo de 12 s. */
  function gravar(fn) {
    var tentativa = fn().catch(function (e) {
      if (e && e.code === 'unavailable') return new Promise(function (r) { setTimeout(r, 600 + Math.random() * 600); }).then(fn);
      throw e;
    });
    var prazo = new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'timeout' }); }, 12000); });
    return Promise.race([tentativa, prazo]);
  }

  // ---------------- banco ----------------
  function tudoCarregado() { return carregado.cfg && carregado.visitas && carregado.ajustes && carregado.feriados; }
  function marcarSinc(st) {
    var txt = st === 'ok' ? 'Conectado' : st === 'erro' ? 'Sem conexão' : 'Conectando…';
    var s = document.getElementById('sinc'); if (s) { s.dataset.st = st; s.title = txt; }
    var t = document.getElementById('sinc-txt'); if (t) t.textContent = txt;
  }
  function onErro(e) {
    clearTimeout(timerCarga);
    avisoRede = e && e.code === 'revoked' ? 'O acesso ao banco foi encerrado. Recarregue a página.' : 'Não foi possível ler o banco de dados (' + esc(e && e.code || 'erro') + ').';
    marcarSinc('erro'); desenhar();
  }
  function assinar() {
    timerCarga = setTimeout(function () {
      if (!confirmado) { avisoRede = 'O banco de dados ainda não respondeu. Os dados podem estar desatualizados; a página continua tentando.'; marcarSinc('erro'); desenhar(); }
    }, 10000);
    var ok = function (snap) {
      if (snap.metadata && !snap.metadata.fromCache && !confirmado) { confirmado = true; clearTimeout(timerCarga); avisoRede = ''; marcarSinc('ok'); }
    };
    var lista = function (q) { return q.docs.map(function (d) { return { id: d.id, data: d.data() }; }); };
    db.doc('config/geral').onSnapshot(function (s) { cru.cfg = s.exists ? s.data() : null; carregado.cfg = true; ok(s); atualizar(); }, onErro);
    db.collection('visitas').onSnapshot(function (q) { cru.visitas = lista(q); carregado.visitas = true; ok(q); atualizar(); }, onErro);
    db.collection('ajustes').onSnapshot(function (q) { cru.ajustes = lista(q); carregado.ajustes = true; ok(q); atualizar(); }, onErro);
    db.collection('feriados').onSnapshot(function (q) { cru.feriados = lista(q); carregado.feriados = true; ok(q); atualizar(); }, onErro);
  }
  function resolverNomes() {
    if (!usr) return;
    var ids = {};
    E.visitas.forEach(function (v) { if (v.por) ids[v.por] = 1; if (v.editPor) ids[v.editPor] = 1; });
    E.ajustes.forEach(function (a) { if (a.por) ids[a.por] = 1; });
    var falta = Object.keys(ids).filter(function (i) { return !nomes[i]; });
    if (!falta.length) return;
    usr.profiles(falta).then(function (ps) { Object.keys(ps).forEach(function (k) { nomes[k] = ps[k]; }); atualizarTela(); });
  }
  function digitando() {
    var a = document.activeElement;
    return a && app.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }
  /** Redesenha sem atropelar quem está digitando. */
  var ajSujo = false;
  function atualizarTela() {
    if (rota === 'registrar' && formNaTela) { atualizarLateral(); return; }
    if ((rota !== 'inicio' && digitando()) || (rota === 'ajustes' && ajSujo)) { redesenhoPendente = true; return; }
    desenhar(true);
  }
  function atualizar() {
    E = L.estado(cru.cfg, cru.visitas, cru.ajustes, cru.feriados);
    resolverNomes();
    atualizarTela();
  }
  app.addEventListener('focusout', function () {
    setTimeout(function () { if (redesenhoPendente && !digitando() && !(rota === 'ajustes' && ajSujo)) { redesenhoPendente = false; desenhar(true); } }, 0);
  });

  // ---------------- rotas ----------------
  var ROTAS = ['inicio', 'registrar', 'historico', 'relatorio', 'ajustes'];
  function lerRota() { var h = location.hash.replace('#', ''); return ROTAS.indexOf(h) >= 0 ? h : 'inicio'; }
  function ir(r) {
    formNaTela = false;
    if (lerRota() === r && location.hash) { rota = r; desenhar(); window.scrollTo(0, 0); }
    else location.hash = r;
  }
  window.addEventListener('hashchange', function () {
    rota = lerRota(); formNaTela = false; ajSujo = false;
    if (rota === 'registrar' && !form) form = novoForm(hoje(), false);
    desenhar(); window.scrollTo(0, 0);
  });
  function marcarAbas() {
    document.querySelectorAll('.aba').forEach(function (a) {
      if (a.dataset.r === rota) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.aba.primaria').forEach(function (p) { p.hidden = !podeEscrever; });
    var ac = document.querySelector('.abas-cel'); if (ac) ac.style.gridTemplateColumns = podeEscrever ? '' : 'repeat(4, 1fr)';
  }

  function desenhar(manterRolagem) {
    var y = window.scrollY;
    redesenhoPendente = false;
    marcarAbas();
    var topo = '';
    if (avisoRede) topo += '<div class="aviso" data-n="bad"><div class="txt"><strong>Sem conexão com o banco</strong><span>' + avisoRede + '</span></div></div>';
    if (semBanco) { app.innerHTML = topo; return; }
    if (!tudoCarregado()) { app.innerHTML = topo + '<p class="carregando">Carregando dados…</p>'; return; }
    if (!podeEscrever && rota !== 'relatorio') topo += '<div class="aviso"><div class="txt"><strong>Somente leitura</strong><span>Sua conta pode ver os dados, mas não registrar. Peça ao responsável para liberar o registro.</span></div></div>';
    if (rota === 'registrar') {
      if (!podeEscrever) { app.innerHTML = topo; formNaTela = false; return; }
      app.innerHTML = topo + telaRegistrar(); formNaTela = true; ligarForm(); return;
    }
    formNaTela = false;
    var html = rota === 'historico' ? telaHistorico() : rota === 'relatorio' ? telaRelatorio() : rota === 'ajustes' ? telaAjustes() : telaInicio();
    app.innerHTML = topo + html;
    if (rota === 'ajustes') ligarAjustes();
    if (rota === 'relatorio') ligarRelatorio();
    if (rota === 'historico') ligarHistorico();
    if (manterRolagem) window.scrollTo(0, y);
  }

  // ---------------- peças ----------------
  /** Etiquetas só para o que foge do normal. */
  function etiquetas(v, con, vg) {
    var t = [];
    if (v.falta) {
      t.push(v.motivo === 'feriado' ? pill('', 'cal', 'Feriado') : v.motivo === 'outro' ? pill('', 'info', 'Sem visita') : pill('bad', 'x', 'Faltou'));
      return t;
    }
    var tp = L.tipoVisita(E, v, vg);
    if (tp === 'urgencia') t.push(pill('warn', 'alerta', 'Urgência'));
    else if (tp === 'extra') t.push(pill('info', 'mais', 'Extra'));
    var p = con.porVisita[v.id];
    if (p && p.sobra) t.push(pill('roxo', 'seta', '+' + fkg(p.sobra) + ' kg', 'Voltou mais do que as coletas em aberto'));
    if (p && p.leva && p.leva.atrasada) t.push(pill('warn', 'relogio', 'Faltam ~' + fkg(p.leva.falta) + ' kg'));
    return t;
  }
  /** Cor do ponto de um registro na lista curta. */
  function tomVisita(v, con, vg) {
    if (v.falta) return v.motivo === 'lavanderia' ? 'bad' : '';
    var p = con.porVisita[v.id];
    if (p && (p.sobra || (p.leva && p.leva.atrasada))) return 'roxo';
    var tp = L.tipoVisita(E, v, vg);
    return tp === 'urgencia' ? 'warn' : tp === 'extra' ? 'info' : 'ok';
  }
  function linhaMov(rotulo, o, devolvido) {
    var kg = o.cam > 0 ? '<span class="kgv">' + fkg(o.cam) + '<small> kg</small></span>' : '<span class="kgv muted">—</span>';
    var p = [];
    if (devolvido && o.pecas) p.push(o.pecas + ' peças');
    var m = mopsTxt(o.br, o.vm); if (m) p.push('mops ' + m);
    return '<div><span class="l">' + rotulo + '</span>' + kg + '<span>' + (p.length ? p.join(' · ') : (o.cam > 0 ? '' : '<span class="muted">nada</span>')) + '</span></div>';
  }
  function itemVisita(v, con, vg, clicavel) {
    var corpo;
    if (v.falta) corpo = '<div class="mov"><div style="display:block">' + (v.motivo === 'feriado' ? 'Feriado, sem visita' : v.motivo === 'outro' ? 'Sem visita' : 'A lavanderia não veio') + '</div>' + (v.obs ? '<div class="obs">' + esc(v.obs) + '</div>' : '') + '</div>';
    else corpo = '<div class="mov">' + linhaMov('Levaram', v.levou, false) + linhaMov('Trouxeram', v.trouxe, true) + (v.obs ? '<div class="obs">' + esc(v.obs) + '</div>' : '') + '</div>';
    var tags = etiquetas(v, con, vg);
    return '<li class="item' + (clicavel ? ' clic' : '') + '"' + (clicavel ? ' data-editar="' + esc(v.id) + '" tabindex="0" role="button"' : '') + '>' +
      (clicavel ? '<span class="sr">Editar: </span>' : '') +
      '<div class="quando"><b>' + dsem(v.data) + '</b>' + dm(v.data) + '</div>' + corpo +
      '<div class="lado">' + tags.join('') + (v.por ? '<span class="quem">' + esc(nome(v.por)) + '</span>' : '') + '</div></li>';
  }
  function fichas(total, aqui, cls) {
    var n = Math.max(1, Math.min(total, 40)), s = '';
    for (var i = 0; i < n; i++) s += '<span class="ficha ' + cls + (i < aqui ? ' aqui' : '') + '"></span>';
    return '<div class="fichas" aria-hidden="true" style="--n:' + n + '">' + s + '</div>';
  }
  function grafico(sem) {
    var larg = app.clientWidth || 640;
    var W = Math.max(300, Math.min(1040, larg - 34)), H = 180, pl = 30, pr = 4, pt = 8, pb = 24;
    var max = 0; sem.forEach(function (s) { max = Math.max(max, s.levou, s.trouxe); });
    var passo = max <= 20 ? 5 : max <= 50 ? 10 : max <= 100 ? 25 : max <= 250 ? 50 : 100;
    var topo = Math.max(passo, Math.ceil(max / passo) * passo);
    var ih = H - pt - pb, iw = W - pl - pr, gw = iw / sem.length, bw = Math.min(16, gw * 0.28);
    var y = function (v) { return pt + ih - (v / topo) * ih; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Camisolas por semana, em kg: levado sujo e devolvido limpo">';
    for (var t = 0; t <= topo; t += passo) {
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="var(--line)" />';
      s += '<text x="' + (pl - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>';
    }
    sem.forEach(function (w, i) {
      var cx = pl + gw * i + gw / 2, ult = i === sem.length - 1;
      s += '<rect x="' + (cx - bw - 1) + '" y="' + y(w.levou) + '" width="' + bw + '" height="' + Math.max(0, y(0) - y(w.levou)) + '" rx="2" fill="none" stroke="var(--serie-a)" stroke-width="1.5"><title>Semana de ' + dm(w.ini) + ': ' + fkg(w.levou) + ' kg levados</title></rect>';
      s += '<rect x="' + (cx + 1) + '" y="' + y(w.trouxe) + '" width="' + bw + '" height="' + Math.max(0, y(0) - y(w.trouxe)) + '" rx="2" fill="var(--serie-b)"><title>Semana de ' + dm(w.ini) + ': ' + fkg(w.trouxe) + ' kg devolvidos</title></rect>';
      s += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle"' + (ult ? ' style="fill:var(--ink)"' : '') + '>' + dm(w.ini) + '</text>';
    });
    return s + '</svg>';
  }
  /** Pendência de camisolas: levas abertas há mais de 7 dias. */
  function pendencia(con) { return con.pendencia; }

  // ---------------- painel ----------------
  function aviso(n, icone, titulo, texto, acoes) {
    return '<div class="aviso" data-n="' + n + '"><div class="txt ic">' + ico(icone) + '<div><strong>' + titulo + '</strong><span>' + texto + '</span></div></div>' + (acoes ? '<div class="acoes">' + acoes + '</div>' : '') + '</div>';
  }
  function cartaoMops(rotulo, m, cls) {
    var n = Math.max(1, Math.min(m.total, 40)), s = '';
    for (var i = 0; i < n; i++) s += '<span class="seg' + (i < m.aqui ? ' ' + cls : '') + '"></span>';
    return '<div class="card c3"><div class="card-cab"><span class="rot">' + rotulo + '</span><span class="lat">' + m.total + ' no total</span></div>' +
      '<div class="linha-num"><span class="grande">' + m.aqui + '<small>aqui</small></span></div><span class="delta">' + Math.max(0, m.fora) + ' com a lavanderia</span>' +
      '<div class="empurra segs" style="--n:' + n + '" role="img" aria-label="' + m.aqui + ' aqui e ' + Math.max(0, m.fora) + ' na lavanderia">' + s + '</div>' +
      '<div class="seg-leg"><span><i class="seg ' + cls + '"></i>aqui</span><span><i class="seg"></i>na lavanderia</span></div></div>';
  }
  /** Mapa de calor da agenda: colunas = semanas, linhas = seg a sáb. */
  function mapaAgenda(t, semanas) {
    var c = E.cfg;
    if (c.inicio) semanas = Math.max(6, Math.min(semanas, L.diasEntre(L.inicioSemana(c.inicio), L.inicioSemana(t)) / 7 + 1));
    var ini0 = L.somaDias(L.inicioSemana(t), -7 * (semanas - 1));
    var porData = {}, max = 0;
    E.visitas.forEach(function (v) { (porData[v.data] = porData[v.data] || []).push(v); if (!v.falta) max = Math.max(max, v.levou.cam); });
    var h = '<div class="mapa" style="--cols:' + semanas + '">';
    for (var d = 1; d <= 6; d++) {
      var ehHoje = L.diaSemana(t) === d;
      h += '<span class="dia' + (ehHoje ? ' hoje' : '') + '">' + DIAS[d] + '</span>';
      for (var w = 0; w < semanas; w++) {
        var s = L.somaDias(ini0, 7 * w + d - 1), vs = porData[s] || [], cls = 'cel', tit = dlongo(s) + ': ';
        var real = vs.filter(function (v) { return !v.falta; }), falta = vs.filter(function (v) { return v.falta; })[0];
        var agenda = c.dias.indexOf(d) >= 0;
        if (s > t) { cls += agenda ? ' fora' : ' vazio'; tit += agenda ? 'visita prevista' : ''; }
        else if (c.inicio && s < c.inicio) { cls += ' vazio'; tit += 'antes do controle'; }
        else if (real.length) {
          var kg = real.reduce(function (x, v) { return x + v.levou.cam; }, 0);
          var nivel = max > 0 ? Math.min(4, Math.max(1, Math.ceil(kg / max * 4))) : 1;
          cls += ' n' + nivel; tit += plural(real.length, 'visita', 'visitas') + ', ' + fkg(kg) + ' kg levados';
        }
        else if (E.feriados[s] || (falta && falta.motivo === 'feriado')) { cls += agenda ? ' feriado' : ' vazio'; tit += 'feriado'; }
        else if (falta) { cls += falta.motivo === 'lavanderia' ? ' falta' : ' feriado'; tit += falta.motivo === 'lavanderia' ? 'a lavanderia não veio' : 'sem visita'; }
        else if (agenda && s < t) { cls += ' pend'; tit += 'sem registro'; }
        else if (agenda) { tit += 'hoje, aguardando'; }
        else { cls += ' fora'; tit += 'fora da agenda'; }
        if (s === t) cls += ' hoje';
        h += '<span class="' + cls + '" title="' + esc(tit) + '"></span>';
      }
    }
    h += '<span></span>';
    for (var x = 0; x < semanas; x++) h += '<span class="eixo">' + (x % 3 === 0 ? dm(L.somaDias(ini0, 7 * x)) : '') + '</span>';
    lastSemanas = semanas;
    return h + '</div>';
  }
  var lastSemanas = 12;
  var calMes = null, calVista = (function () { try { return localStorage.getItem('lav-cal') || 'mes'; } catch (e) { return 'mes'; } })();
  var MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  /** Calendário do mês: um bloco por dia, selo com o número de registros e a cor do que aconteceu. */
  function calendario(t, mes) {
    var c = E.cfg, ini = mes + '-01', fim = L.fimMes(ini);
    var porData = {};
    E.visitas.forEach(function (v) { if (v.data >= ini && v.data <= fim) (porData[v.data] = porData[v.data] || []).push(v); });
    var h = '<div class="cal-sem">' + ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="cal">';
    for (var i = 0; i < L.diaSemana(ini); i++) h += '<span class="dia-c fora-mes"></span>';
    for (var s2 = ini; s2 <= fim; s2 = L.somaDias(s2, 1)) {
      var vs = porData[s2] || [], real = vs.filter(function (v) { return !v.falta; }), falta = vs.filter(function (v) { return v.falta; })[0];
      var agenda = c.dias.indexOf(L.diaSemana(s2)) >= 0, antes = c.inicio && s2 < c.inicio, futuro = s2 > t;
      var st = '', selo = '', tit = cap(dlongo(s2));
      if (real.length) {
        var kg = real.reduce(function (x, v) { return x + v.levou.cam; }, 0), dv = real.reduce(function (x, v) { return x + v.trouxe.cam; }, 0);
        st = 'visita'; selo = '<b class="selo" data-n="info">' + real.length + '</b>';
        tit += ': ' + plural(real.length, 'visita', 'visitas') + ', levaram ' + fkg(kg) + ' kg e trouxeram ' + fkg(dv) + ' kg';
      } else if (E.feriados[s2] || (falta && falta.motivo === 'feriado')) { st = 'feriado'; selo = agenda ? '<b class="selo">' + ico('cal') + '</b>' : ''; tit += ': feriado' + (E.feriados[s2] ? ' (' + E.feriados[s2].nome + ')' : ''); }
      else if (falta) { st = falta.motivo === 'lavanderia' ? 'falta' : 'feriado'; selo = '<b class="selo" data-n="' + (falta.motivo === 'lavanderia' ? 'bad' : '') + '">' + ico('x') + '</b>'; tit += falta.motivo === 'lavanderia' ? ': a lavanderia não veio' : ': sem visita'; }
      else if (agenda && !antes && !futuro && s2 < t) { st = 'pend'; selo = '<b class="selo" data-n="warn">!</b>'; tit += ': dia de visita sem registro'; }
      else if (agenda && !antes) tit += s2 === t ? ': dia de visita, hoje' : ': visita prevista';
      var cls = 'dia-c' + (agenda ? ' agenda' : '') + (st ? ' ' + st : '') + (s2 === t ? ' hoje' : '') + (antes ? ' antes' : '');
      var acao = '';
      if (podeEscrever && !futuro && !antes) acao = real.length || falta ? ' data-editar="' + esc((real[0] || falta).id) + '"' : ' data-reg="' + s2 + '"';
      h += (acao ? '<button type="button" class="' + cls + '"' + acao + ' title="' + esc(tit) + '" aria-label="' + esc(tit) + '">' : '<span class="' + cls + '" title="' + esc(tit) + '">') +
        '<span class="num-d">' + s2.slice(8) + '</span>' + selo + (acao ? '</button>' : '</span>');
    }
    var resto = (7 - (L.diaSemana(ini) + +fim.slice(8)) % 7) % 7;
    for (var k = 0; k < resto; k++) h += '<span class="dia-c fora-mes"></span>';
    return h + '</div>';
  }
  function telaInicio() {
    var t = hoje(), c = E.cfg, m = L.mops(E, t);
    var out = '<div class="cab"><h1>Painel</h1><span class="data">' + cap(dlongo(t)) + '</span></div>';
    if (!c.inicio) {
      out += '<div class="aviso" data-n="info"><div class="txt ic">' + ico('info') + '<div><strong>Comece por aqui</strong><ol class="passos-ini muted"><li>Em Ajustes, defina a data de início e o que já está com a lavanderia hoje.</li><li>Registre a primeira visita quando a lavanderia passar.</li></ol></div></div>' +
        (ehAdmin ? '<div class="acoes"><a class="btn pri" href="#ajustes">Abrir ajustes</a></div>' : '') + '</div>';
      return out + '<div class="bento">' + cartaoMops('Mops brancos', m.br, 'b') + cartaoMops('Mops vermelhos', m.vm, 'v') + '</div>';
    }
    var con = L.conciliacao(E, t), vg = L.vagas(E);
    var ag = L.agenda(E, c.inicio, t, t);
    var pend = ag.filter(function (x) { return x.st === 'pendente'; });
    var hojeAg = ag.filter(function (x) { return x.st === 'hoje'; })[0];
    if (hojeAg && podeEscrever) out += aviso('info', 'caminhao', 'Hoje é dia de visita', 'Registre quando a lavanderia passar.', '<button class="btn pri" data-reg="' + t + '">Registrar visita</button><button class="btn" data-falta="' + t + '">Não vieram</button>');
    if (pend.length) out += aviso('warn', 'relogio', pend.length === 1 ? 'Um dia previsto sem registro' : pend.length + ' dias previstos sem registro',
      pend.slice(-6).map(function (x) { return dsem(x.data) + ' ' + dm(x.data); }).join(', ') + (pend.length > 6 ? ' e outros' : '') + '. Registre a visita ou marque que não vieram.',
      podeEscrever ? pend.slice(-3).reverse().map(function (x) { return '<button class="btn" data-reg="' + x.data + '">' + dsem(x.data) + ' ' + dm(x.data) + '</button>'; }).join('') : '');
    var pd = con.pendencia;
    if (pd) out += aviso('warn', 'alerta', 'Cerca de ' + fkg(pd.kg) + ' kg de camisolas não voltaram', (pd.atraso ? 'Há coleta aberta há mais de ' + L.ATRASO_DIAS + ' dias, desde ' + dlongo(pd.desde.data) + '.' : 'As últimas devoluções vieram abaixo do esperado.') + ' Confira com a lavanderia.');
    if (m.inconsistente) out += aviso('bad', 'alerta', 'A conta dos mops não fecha', 'Pelos registros, a lavanderia estaria com ' + m.br.fora + ' brancos e ' + m.vm.fora + ' vermelhos. Conte os mops que estão aqui.', podeEscrever ? '<a class="btn" href="#ajustes">Fazer contagem</a>' : '');

    var r = L.resumo(E, L.inicioMes(t), L.fimMes(t), t);
    var stV = r.pontualidade == null ? pill('', '', 'Sem dados') : r.faltaLav.length ? pill('bad', 'x', plural(r.faltaLav.length, 'falta', 'faltas')) : pill('ok', 'ok', 'Em dia');
    var b = '<div class="bento">';
    if (!calMes) calMes = t.slice(0, 7);
    var mesAtual = calMes === t.slice(0, 7), podeAvancar = calMes < t.slice(0, 7);
    var ICV = { mes: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M9 4v17M15 4v17"/>', semanas: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' };
    var vistaBtn = function (v, rotulo) { return '<button type="button" class="vista-b" data-vista="' + v + '" aria-pressed="' + (calVista === v) + '" aria-label="' + rotulo + '" title="' + rotulo + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICV[v] + '</svg></button>'; };
    b += '<div class="card c8 card-cal"><div class="cal-cab">' +
      (calVista === 'mes' ?
        '<div class="cal-titulo"><button type="button" class="cal-nav" data-cal="-1" aria-label="Mês anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
        '<h2><b>' + MES_CURTO[+calMes.slice(5) - 1] + '</b> ' + calMes.slice(0, 4) + '</h2>' +
        '<button type="button" class="cal-nav" data-cal="1" aria-label="Próximo mês"' + (podeAvancar ? '' : ' disabled') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>' +
        (mesAtual ? '' : '<button type="button" class="link" data-cal="0">Hoje</button>') + '</div>'
        : '<div class="cal-titulo"><h2><b>' + lastSemanas + '</b> semanas</h2></div>') +
      '<div class="vista" role="group" aria-label="Visualização">' + vistaBtn('mes', 'Mês') + vistaBtn('semanas', 'Últimas semanas') + '</div></div>';
    if (calVista === 'mes') {
      var rm = L.resumo(E, calMes + '-01', L.fimMes(calMes + '-01'), t);
      b += calendario(t, calMes) +
        '<div class="cal-rodape"><span class="delta">' + rm.feitas + ' de ' + rm.esperadas + ' visitas da agenda</span>' + (rm.faltaLav.length ? pill('bad', 'x', plural(rm.faltaLav.length, 'falta', 'faltas')) : rm.esperadas ? pill('ok', 'ok', 'Em dia') : '') + (rm.extras + rm.urgencias ? pill('info', 'mais', plural(rm.extras + rm.urgencias, 'extra', 'extras')) : '') + (rm.pendentes.length ? pill('warn', 'relogio', plural(rm.pendentes.length, 'sem registro', 'sem registro')) : '') + '</div>';
    } else {
      b += '<div class="linha-num"><span class="grande">' + r.feitas + '<small>de ' + r.esperadas + ' visitas no mês</small></span>' + stV + '</div>' +
        '<div class="empurra">' + mapaAgenda(t, 12) + '</div>' +
        '<div class="mapa-leg"><span><i class="cel n1"></i><i class="cel n2" style="margin-left:-3px"></i><i class="cel n4" style="margin-left:-3px"></i>visita (mais kg, mais forte)</span><span><i class="cel falta"></i>faltou</span><span><i class="cel pend"></i>sem registro</span><span><i class="cel feriado"></i>feriado</span></div>';
      b = b.replace('<b>' + lastSemanas + '</b> semanas', '<b>' + lastSemanas + '</b> semanas');
    }
    b += '</div>';
    b += '<div class="c4 pilha">' + cartaoMops('Mops brancos', m.br, 'b').replace('card c3', 'card') + cartaoMops('Mops vermelhos', m.vm, 'v').replace('card c3', 'card') + '</div>';

    var sem = L.semanas(E, t, 10), maxS = Math.max.apply(null, sem.map(function (w) { return w.trouxe; }).concat([1]));
    var antS = sem.length > 1 ? sem[sem.length - 2].trouxe : 0;
    b += '<div class="card c3"><div class="card-cab"><span class="rot">Camisolas a voltar</span></div>' +
      '<div class="linha-num"><span class="grande">' + fkg(con.aDevolver.med) + '<small>kg</small></span></div>' +
      '<span class="delta">' + (con.aDevolver.hi > 0 ? 'limpo, entre ' + fkg(con.aDevolver.lo) + ' e ' + fkg(con.aDevolver.hi) + ' kg' : 'nada em aberto') + '</span>' +
      '<div class="empurra colunas" role="img" aria-label="Devolvido por semana">' + sem.map(function (w, i) { return '<span class="col' + (i === sem.length - 1 ? ' atual' : '') + '" style="height:' + Math.max(4, Math.round(w.trouxe / maxS * 100)) + '%" title="Semana de ' + dm(w.ini) + ': ' + fkg(w.trouxe) + ' kg devolvidos"></span>'; }).join('') + '</div>' +
      '<span class="delta">devolvido por semana</span></div>';

    var ult = E.visitas.slice(-6).reverse(), maxL = Math.max.apply(null, ult.map(function (v) { return v.levou.cam; }).concat([1]));
    b += '<div class="card c5"><div class="card-cab"><span class="rot">Últimos registros</span><a class="link" href="#historico">Ver histórico</a></div>' +
      (ult.length ? '<ul class="lista">' + ult.map(function (v) {
        var tp = L.tipoVisita(E, v, vg);
        var txt = v.falta ? (v.motivo === 'feriado' ? 'feriado' : v.motivo === 'outro' ? 'sem visita' : 'faltou') : (tp === 'urgencia' ? 'urgência' : tp === 'extra' ? 'extra' : 'na agenda');
        return '<li class="linha-reg"' + (podeEscrever ? ' data-editar="' + esc(v.id) + '" tabindex="0" role="button"' : '') + '><span class="ponto" data-n="' + tomVisita(v, con, vg) + '"></span><span class="q">' + dsem(v.data) + ' ' + dm(v.data) + '</span><span class="t">' + txt + '</span>' +
          '<span class="barra"><i style="width:' + (v.falta ? 0 : Math.round(v.levou.cam / maxL * 100)) + '%"></i></span><span class="v">' + (v.falta ? '—' : fkg(v.trouxe.cam)) + '</span></li>';
      }).join('') + '</ul><span class="delta empurra">barra: kg levados · número: kg devolvidos</span>' : '<p class="vazio">Nenhuma visita registrada ainda.</p>') + '</div>';

    var sm = r.sujeiraMedia, smTom = sm == null ? '' : (sm > c.sujMax + 2 || sm < c.sujMin - 2) ? 'bad' : 'ok';
    b += '<div class="card c4"><div class="card-cab"><span class="rot">' + cap(MESES[+t.slice(5, 7) - 1]) + '</span><a class="link" href="#relatorio">Ver relatório</a></div>' +
      '<div class="linha-num"><span class="grande">' + fkg(r.tot.tCam) + '<small>kg devolvidos</small></span></div>' +
      (sm == null ? '<span class="delta">a comparação de peso aparece após 6 devoluções</span>' : '<div class="linha-num">' + pill(smTom, smTom === 'ok' ? 'ok' : 'alerta', pct(sm) + '% mais leve') + '<span class="delta">' + (smTom === 'ok' ? 'normal: ' : 'normal seria ') + c.sujMin + '–' + c.sujMax + '%</span></div>') +
      '<div class="kv empurra">' +
      '<div><span class="k">Levado sujo</span><span class="v">' + fkg(r.tot.lCam) + ' kg</span></div>' +
      '<div><span class="k">Peças devolvidas</span><span class="v">' + r.tot.tPecas + '</span></div>' +
      '<div><span class="k">Mops levados</span><span class="v">' + (mopsTxt(r.tot.lBr, r.tot.lVm) || 'nenhum') + '</span></div>' +
      '<div><span class="k">Faltas da lavanderia</span><span class="v">' + r.faltaLav.length + '</span></div>' +
      '</div></div>';
    return out + b + '</div>';
  }

  // ---------------- formulário ----------------
  function novoForm(data, falta) {
    return { id: null, novoId: novoId('v'), data: data || hoje(), falta: !!falta, motivo: 'lavanderia', urgencia: false,
      lcam: '', lbr: 0, lvm: 0, tcam: '', tpecas: '', tbr: 0, tvm: 0, obs: '', original: null };
  }
  function formDeVisita(v) {
    return { id: v.id, data: v.data, falta: v.falta, motivo: v.motivo || 'lavanderia', urgencia: v.urgencia,
      lcam: kgCampo(v.levou.cam), lbr: v.levou.br, lvm: v.levou.vm,
      tcam: kgCampo(v.trouxe.cam), tpecas: v.trouxe.pecas ? String(v.trouxe.pecas) : '', tbr: v.trouxe.br, tvm: v.trouxe.vm,
      obs: v.obs, original: v };
  }
  function formVazio(f) { return !f || (!f.id && !f.lcam && !f.tcam && !f.tpecas && !(f.lbr + f.lvm + f.tbr + f.tvm) && !f.obs); }
  function passo(id, rotulo, contexto, valor, tecla, off) {
    var d = off ? ' disabled' : '';
    return '<div class="campo"><label for="f-' + id + '">' + rotulo + '<span class="sr"> ' + contexto + '</span></label><div class="passo">' +
      '<button type="button" data-passo="' + id + '" data-d="-1" aria-label="Menos um, ' + rotulo + ' ' + contexto + '" tabindex="-1"' + d + '>−</button>' +
      '<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="' + (tecla || 'next') + '" id="f-' + id + '" value="' + valor + '"' + d + '>' +
      '<button type="button" data-passo="' + id + '" data-d="1" aria-label="Mais um, ' + rotulo + ' ' + contexto + '" tabindex="-1"' + d + '>+</button></div></div>';
  }
  function telaRegistrar() {
    if (!form) form = novoForm(hoje(), false);
    var f = form, t = hoje();
    var h = '<div class="cab"><h1>' + (f.id ? 'Editar visita' : 'Registrar visita') + '</h1></div>';
    h += '<form class="form com-salvar" id="form" novalidate autocomplete="off"><div class="campos">';
    h += '<div class="linha dois topo-form"><div class="campo"><label for="f-data">Data</label><input type="date" id="f-data" value="' + f.data + '" max="' + t + '"' + (E.cfg.inicio ? ' min="' + E.cfg.inicio + '"' : '') + ' required></div>' +
      '<div class="campo"><span class="lbl" id="lbl-veio">A lavanderia veio?</span><div class="alternar" role="group" aria-labelledby="lbl-veio"><button type="button" data-veio="1" aria-pressed="' + (!f.falta) + '">Veio</button><button type="button" data-veio="0" aria-pressed="' + f.falta + '">Não veio</button></div></div></div>';
    h += '<div id="f-dia" class="dica" style="margin-top:-8px"></div>';

    h += '<div id="bloco-veio" class="campos"' + (f.falta ? ' hidden' : '') + '>';
    h += '<fieldset class="grupo" style="margin:0"><div class="grupo-cab"><h2>Levaram</h2><span>sujo, pesado aqui</span></div><div class="linha">' +
      '<div class="campo largo"><label for="f-lcam">Camisolas<span class="sr"> levadas, em kg</span></label><div class="kg"><input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" id="f-lcam" placeholder="0,0" value="' + esc(f.lcam) + '"></div></div>' +
      passo('lbr', 'Mops brancos', 'levados', f.lbr) + passo('lvm', 'Mops vermelhos', 'levados', f.lvm) + '</div></fieldset>';
    h += '<fieldset class="grupo" style="margin:0"><div class="grupo-cab"><h2>Trouxeram</h2><span>limpo, contado e pesado pela lavanderia</span></div>' +
      '<div class="linha dois"><div class="campo"><label for="f-tcam">Camisolas<span class="sr"> devolvidas, em kg</span></label><div class="kg"><input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" id="f-tcam" placeholder="0,0" value="' + esc(f.tcam) + '"></div></div>' +
      '<div class="campo"><label for="f-tpecas">Peças<span class="sr"> devolvidas</span></label><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next" id="f-tpecas" placeholder="0" value="' + esc(f.tpecas) + '" style="font-size:17px"></div></div>' +
      '<div class="linha dois">' + passo('tbr', 'Mops brancos', 'devolvidos', f.tbr) + passo('tvm', 'Mops vermelhos', 'devolvidos', f.tvm, 'done') + '</div>' +
      '<div id="f-conf" class="conf"></div></fieldset>';
    h += '<label class="marcar"><input type="checkbox" id="f-urg"' + (f.urgencia ? ' checked' : '') + '><span>Visita de urgência <span class="muted">(pedida por alta demanda)</span></span></label>';
    h += '</div>';

    h += '<fieldset id="bloco-falta" class="grupo" style="margin:0"' + (f.falta ? '' : ' hidden') + '><h2>Por que não teve visita?</h2><div class="opcoes" role="radiogroup">' +
      [['lavanderia', 'A lavanderia não veio'], ['feriado', 'Feriado'], ['outro', 'Outro motivo (não é culpa da lavanderia)']].map(function (o) {
        return '<label class="opcao"><input type="radio" name="motivo" value="' + o[0] + '"' + (f.motivo === o[0] ? ' checked' : '') + '>' + o[1] + '</label>';
      }).join('') + '</div></fieldset>';

    h += '<div class="campo"><label for="f-obs">Observação <span class="muted" style="font-weight:400">(opcional)</span></label><textarea id="f-obs" maxlength="500">' + esc(f.obs) + '</textarea></div>';
    h += '</div>';

    h += '<aside class="lateral"><div class="painel resumo-form"><div class="painel-cab"><h2>Com a lavanderia</h2><span>antes → depois</span></div><div class="painel-corpo" id="f-lado"></div></div>' +
      '<p class="msg" id="f-msg" role="alert"></p>';
    if (f.id) {
      var o = f.original;
      h += '<button type="button" class="btn perigo" id="f-excluir" style="align-self:flex-start">Excluir este registro</button>' +
        '<p class="peq muted">Registrado' + (o.por ? ' por ' + esc(nome(o.por)) : '') + (o.em && L.dataLocal(o.em) ? ' em ' + dma(L.dataLocal(o.em)) : '') + (o.editPor ? '. Última alteração por ' + esc(nome(o.editPor)) + '.' : '.') + '</p>';
    }
    h += '<div class="salvar-fixo botoes"><button type="submit" class="btn pri grande" id="f-salvar">' + (f.id ? 'Salvar alterações' : 'Salvar visita') + '</button>' +
      (f.id ? '<button type="button" class="btn grande" id="f-cancelar">Cancelar</button>' : '') + '</div>';
    h += '</aside></form>';
    return h;
  }

  function g(id) { return document.getElementById('f-' + id); }
  /** Inteiro digitado: '' vira 0; qualquer coisa que não seja só dígitos vira NaN. */
  function inteiro(v) { var t = String(v == null ? '' : v).trim(); if (t === '') return 0; return /^\d+$/.test(t) ? parseInt(t, 10) : NaN; }
  function inteiroOu0(v) { var n = inteiro(v); return isFinite(n) ? n : 0; }
  function lerForm() {
    if (!form || !g('data')) return;
    form.data = g('data').value;
    form.lcam = g('lcam').value; form.tcam = g('tcam').value; form.tpecas = g('tpecas').value;
    ['lbr', 'lvm', 'tbr', 'tvm'].forEach(function (k) { form[k] = inteiro(g(k).value); });
    form.urgencia = g('urg').checked;
    var m = document.querySelector('input[name="motivo"]:checked'); form.motivo = m ? m.value : 'lavanderia';
    form.obs = g('obs').value;
  }
  function visitaDoForm() {
    var lc = L.lerNumero(form.lcam), tc = L.lerNumero(form.tcam), tp = L.lerNumero(form.tpecas);
    return L.visita(form.id || form.novoId, {
      data: form.data, status: form.falta ? 'falta' : 'realizada', motivo: form.motivo, urgencia: form.urgencia,
      levou: { cam: isFinite(lc) ? lc : 0, br: form.lbr || 0, vm: form.lvm || 0 },
      trouxe: { cam: isFinite(tc) ? tc : 0, pecas: isFinite(tp) ? tp : 0, br: form.tbr || 0, vm: form.tvm || 0 },
      em: form.original ? form.original.em : agoraISO()
    });
  }
  function comVisita(vs) { return { cfg: E.cfg, feriados: E.feriados, ajustes: E.ajustes, visitas: vs.slice().sort(L.ordem) }; }

  function atualizarLateral() {
    if (!formNaTela || !form || !g('data')) return;
    var d = form.data, dia = g('dia'), lado = g('lado'), conf = g('conf');
    if (!L.dataValida(d)) { dia.textContent = 'Escolha uma data.'; lado.innerHTML = ''; conf.innerHTML = ''; return; }
    var fer = E.feriados[d];
    var outras = E.visitas.filter(function (v) { return v.data === d && v.id !== form.id; });
    var txt = cap(DIAS_LONGO[L.diaSemana(d)]) + ': ';
    if (E.cfg.inicio && d < E.cfg.inicio) txt += 'antes do início do controle (' + dma(E.cfg.inicio) + ').';
    else if (fer) txt += 'feriado (' + fer.nome + ').';
    else if (L.ehPrevisto(E, d)) txt += 'dia da agenda.';
    else txt += 'fora da agenda.';
    dia.innerHTML = esc(txt) + (outras.length ? ' <strong style="color:var(--warn)">Já existe ' + (outras.length === 1 ? 'um registro' : outras.length + ' registros') + ' neste dia (' + esc(outras.map(function (o) { return o.falta ? 'falta' : 'visita de ' + nome(o.por); }).join(', ')) + ').</strong>' : '');

    var semEsta = comVisita(E.visitas.filter(function (v) { return v.id !== form.id; }));
    var vNova = visitaDoForm();
    var comNova = comVisita(semEsta.visitas.concat([vNova]));
    var ate = d > hoje() ? d : hoje();
    var antesM = L.mops(semEsta, ate), depoisM = L.mops(comNova, ate);
    var antesC = L.conciliacao(semEsta, ate), depoisC = L.conciliacao(comNova, ate);

    // o que esta devolução faz com as coletas em aberto
    var ch = '';
    if (!form.falta && vNova.trouxe.cam > 0) {
      var info = depoisC.porVisita[vNova.id];
      if (info) {
        info.abate.forEach(function (x) {
          var l = x.leva;
          var nomeL = l.inicial ? 'O que já estava com a lavanderia' : 'Coleta de ' + dsem(l.data) + ' ' + dm(l.data);
          ch += '<div><b>' + nomeL + '</b>: ' + fkg(l.sujo) + ' kg sujos, esperado ' + fkg(l.esperado.lo) + '–' + fkg(l.esperado.hi) + ' kg limpos. ' +
            (l.fechadaEm ? '<span class="tag" data-n="ok">Completa</span>' : '<span class="tag">Faltam ~' + fkg(l.falta) + ' kg</span>') + '</div>';
        });
        if (info.sobra) ch += '<div><span class="tag" data-n="warn">' + fkg(info.sobra) + ' kg a mais</span> <span class="muted">do que as coletas em aberto. Falta registrar alguma coleta?</span></div>';
      }
    }
    conf.innerHTML = ch;

    var avisos = [];
    if (!form.falta) {
      var foraB = Math.max(0, L.mops(semEsta, d).br.fora), foraV = Math.max(0, L.mops(semEsta, d).vm.fora);
      if (form.tbr > foraB) avisos.push('Trouxeram ' + form.tbr + ' brancos, mas pelos registros só ' + foraB + ' estavam com a lavanderia.');
      if (form.tvm > foraV) avisos.push('Trouxeram ' + form.tvm + ' vermelhos, mas pelos registros só ' + foraV + ' estavam com a lavanderia.');
    }
    lado.innerHTML = '<dl>' +
      '<dt>Mops brancos</dt><dd>' + antesM.br.fora + ' → <b>' + depoisM.br.fora + '</b></dd>' +
      '<dt>Mops vermelhos</dt><dd>' + antesM.vm.fora + ' → <b>' + depoisM.vm.fora + '</b></dd>' +
      '<dt>Camisolas (limpo)</dt><dd>' + fkg(antesC.aDevolver.med) + ' → <b>' + fkg(depoisC.aDevolver.med) + '</b> kg</dd>' +
      '</dl>' + (avisos.length ? '<p class="msg" data-n="warn" style="margin-top:12px">' + avisos.map(esc).join('<br>') + '</p>' : '');
  }

  function ligarForm() {
    var el = document.getElementById('form');
    el.addEventListener('input', function (e) {
      if (e.target.id === 'f-lcam' || e.target.id === 'f-tcam') e.target.removeAttribute('aria-invalid');
      lerForm(); atualizarLateral();
    });
    el.addEventListener('change', function (e) {
      var k = e.target.id && e.target.id.slice(2);
      if (['lbr', 'lvm', 'tbr', 'tvm', 'tpecas'].indexOf(k) >= 0) e.target.setAttribute('aria-invalid', String(!isFinite(inteiro(e.target.value))));
      lerForm(); atualizarLateral();
    });
    el.addEventListener('focusin', function (e) { if (e.target.closest('.passo') || e.target.id === 'f-tpecas') { try { e.target.select(); } catch (x) {} } });
    // Enter avança para o próximo campo em vez de salvar
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox' || e.target.type === 'radio') return;
      e.preventDefault();
      var cs = Array.prototype.filter.call(el.querySelectorAll('input[type="text"], textarea'), function (x) { return !x.closest('[hidden]'); });
      var i = cs.indexOf(e.target);
      var prox = cs[i + 1];
      if (prox && prox.id !== 'f-obs') prox.focus(); else { e.target.blur(); document.getElementById('f-salvar').focus({ preventScroll: true }); }
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.passo) {
        var inp = g(b.dataset.passo);
        inp.value = Math.max(0, inteiroOu0(inp.value) + (+b.dataset.d)); inp.removeAttribute('aria-invalid'); lerForm(); atualizarLateral();
      } else if (b.dataset.veio) {
        form.falta = b.dataset.veio === '0';
        el.querySelectorAll('[data-veio]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        document.getElementById('bloco-veio').hidden = form.falta;
        document.getElementById('bloco-falta').hidden = !form.falta;
        msgForm('');
        atualizarLateral();
      }
    });
    el.addEventListener('submit', function (e) { e.preventDefault(); salvarForm(); });
    var canc = g('cancelar'); if (canc) canc.onclick = function () { form = null; ir('historico'); };
    var exc = g('excluir'); if (exc) exc.onclick = excluirVisita;
    lerForm(); atualizarLateral();
    if (!form.id && !form.falta && !form.lcam) g('lcam').focus({ preventScroll: true });
  }
  function msgForm(txt, n) { var m = g('msg'); if (m) { m.textContent = txt; m.dataset.n = n || 'bad'; } }

  function salvarForm() {
    if (salvando || !db) return;
    lerForm();
    var t = hoje(), f = form;
    if (!L.dataValida(f.data)) return msgForm('Escolha uma data válida.');
    if (f.data > t) return msgForm('A data não pode ser no futuro.');
    if (E.cfg.inicio && f.data < E.cfg.inicio) return msgForm('Essa data é antes do início do controle (' + dma(E.cfg.inicio) + '). O que já estava com a lavanderia entra no saldo inicial, em Ajustes.');
    var corpo = { data: f.data, status: f.falta ? 'falta' : 'realizada', urgencia: false, motivo: '', obs: f.obs.trim().slice(0, 500),
      levou: { cam: 0, br: 0, vm: 0 }, trouxe: { cam: 0, pecas: 0, br: 0, vm: 0 } };
    var checar = [];
    if (f.falta) corpo.motivo = f.motivo;
    else {
      var lc = L.lerNumero(f.lcam), tc = L.lerNumero(f.tcam), tp = L.lerNumero(f.tpecas);
      if (!isFinite(lc) || lc < 0) { g('lcam').setAttribute('aria-invalid', 'true'); g('lcam').focus(); return msgForm('O peso levado não é um número. Use, por exemplo, 42,5.'); }
      if (!isFinite(tc) || tc < 0) { g('tcam').setAttribute('aria-invalid', 'true'); g('tcam').focus(); return msgForm('O peso devolvido não é um número. Use, por exemplo, 38,2.'); }
      if (!isFinite(tp) || tp < 0 || Math.round(tp) !== tp) { g('tpecas').focus(); return msgForm('Peças precisa ser um número inteiro, sem vírgula.'); }
      var ruim = ['lbr', 'lvm', 'tbr', 'tvm'].filter(function (k) { return !isFinite(f[k]); })[0];
      if (ruim) { g(ruim).setAttribute('aria-invalid', 'true'); g(ruim).focus(); return msgForm('Quantidade de mops precisa ser um número inteiro.'); }
      var mAntes = L.mops(comVisita(E.visitas.filter(function (v) { return v.id !== f.id; })), f.data);
      if (f.lbr > Math.max(0, mAntes.br.aqui) + f.tbr) checar.push('Levaram ' + f.lbr + ' mops brancos, mas pelos registros só havia ' + Math.max(0, mAntes.br.aqui) + ' aqui.');
      if (f.lvm > Math.max(0, mAntes.vm.aqui) + f.tvm) checar.push('Levaram ' + f.lvm + ' mops vermelhos, mas pelos registros só havia ' + Math.max(0, mAntes.vm.aqui) + ' aqui.');
      if (!lc && !tc && !tp && !f.lbr && !f.lvm && !f.tbr && !f.tvm) return msgForm('Preencha o que levaram ou o que trouxeram. Se não houve visita, marque "Não veio".');
      if (tp > 0 && !tc) { g('tcam').focus(); return msgForm('Informe também o peso das camisolas devolvidas.'); }
      [['levado', lc], ['devolvido', tc]].forEach(function (x) { if (x[1] > 200) checar.push('O peso ' + x[0] + ' é ' + fkg(x[1]) + ' kg, acima do comum.'); else if (x[1] > 0 && x[1] < 2) checar.push('O peso ' + x[0] + ' é ' + fkg(x[1]) + ' kg, abaixo do comum.'); });
      corpo.urgencia = f.urgencia;
      corpo.levou = { cam: L.r2(lc), br: f.lbr, vm: f.lvm };
      corpo.trouxe = { cam: L.r2(tc), pecas: tp, br: f.tbr, vm: f.tvm };
    }
    var mesmas = E.visitas.filter(function (v) { return v.data === f.data && v.id !== f.id; });
    var faltasDia = mesmas.filter(function (v) { return v.falta; }), visitasDia = mesmas.filter(function (v) { return !v.falta; });

    var contDia = !f.id && !f.falta ? E.ajustes.filter(function (a) { return a.motivo === 'contagem' && a.data === f.data; }).pop() : null;
    var antesDaContagem = false;
    var etapas = Promise.resolve(true);
    var pergunta = function (t1, t2, b) { etapas = etapas.then(function (ok) { return ok && confirmar(t1, t2, b); }); };
    if (checar.length) pergunta('Confira antes de salvar', checar.join(' ') + ' Está certo?', 'Está certo');
    if (!f.id && !f.falta && visitasDia.length) { var o = visitasDia[0]; pergunta('Já registraram este dia', cap(nome(o.por)) + ' já registrou uma visita em ' + dm(f.data) + ' (' + fkg(o.levou.cam) + ' kg levados, ' + fkg(o.trouxe.cam) + ' kg devolvidos). É outra visita no mesmo dia?', 'É outra visita'); }
    if (!f.id && f.falta && visitasDia.length) pergunta('Já há visita neste dia', 'Existe uma visita registrada em ' + dm(f.data) + '. Registrar a falta mesmo assim?', 'Registrar falta');
    if (!f.falta && faltasDia.length) pergunta('Este dia estava marcado como falta', 'Ao salvar a visita, a marcação de falta de ' + dm(f.data) + ' será apagada.', 'Salvar e apagar a falta');

    if (contDia && (f.lbr + f.lvm + f.tbr + f.tvm) > 0) etapas = etapas.then(function (ok) {
      if (!ok) return false;
      var hh = new Date(contDia.em); hh = isNaN(hh) ? '' : ' das ' + String(hh.getHours()).padStart(2, '0') + ':' + String(hh.getMinutes()).padStart(2, '0');
      return confirmar('Houve contagem de mops hoje', 'Esta visita aconteceu antes da contagem' + hh + '? Se sim, os mops dela já estão na contagem e não serão contados de novo.', 'Sim, foi antes').then(function (sim) { antesDaContagem = sim; return true; });
    });
    etapas.then(function (ok) {
      if (!ok) return;
      salvando = true;
      var btn = g('salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
      var id = f.id || f.novoId;
      var ref = db.collection('visitas').doc(id);
      var gravacao;
      if (f.id) {
        // edição: confere se ninguém mudou ou apagou antes, e preserva campos desconhecidos
        gravacao = Promise.race([ref.get(), new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'timeout' }); }, 12000); })]).then(function (s) {
          if (!s.exists) throw { code: 'sumiu' };
          var atual = s.data();
          if ((atual.editEm || '') !== (f.original.editEm || '')) throw { code: 'mudou' };
          var final = Object.assign({}, atual, corpo, { por: atual.por || null, em: atual.em || '', editPor: meuId, editEm: agoraISO() });
          return gravar(function () { return ref.set(final); });
        });
      } else {
        corpo.por = meuId; corpo.em = antesDaContagem ? new Date(new Date(contDia.em).getTime() - 1000).toISOString() : agoraISO();
        gravacao = gravar(function () { return ref.set(corpo); });
      }
      var copiasFaltas = faltasDia.map(function (x) { return { id: x.id, data: (cru.visitas.filter(function (c) { return c.id === x.id; })[0] || {}).data }; });
      gravacao.then(function () {
        if (!f.falta && faltasDia.length) faltasDia.forEach(function (x) { db.collection('visitas').doc(x.id).delete().catch(function () {}); });
        salvando = false; formNaTela = false;
        var editou = !!f.id;
        form = null;
        if (editou) { toast('Alterações salvas'); ir('historico'); }
        else {
          toast(corpo.status === 'falta' ? 'Falta registrada' : 'Visita registrada', { rotulo: 'Desfazer', fn: function () {
            gravar(function () { return db.collection('visitas').doc(id).delete(); })
              .then(function () { return Promise.all(copiasFaltas.filter(function (c) { return c.data; }).map(function (c) { return gravar(function () { return db.collection('visitas').doc(c.id).set(c.data); }); })); })
              .then(function () { toast('Registro desfeito'); }, function (e) { toast(erroEscrita(e)); });
          } });
          ir('inicio');
        }
      }).catch(function (e) {
        salvando = false; btn.disabled = false; btn.textContent = f.id ? 'Salvar alterações' : 'Salvar visita';
        if (e && e.code === 'sumiu') msgForm('Outra pessoa excluiu este registro. Nada foi salvo.');
        else if (e && e.code === 'mudou') msgForm('Outra pessoa alterou este registro enquanto você editava. Volte ao histórico e abra de novo.');
        else msgForm(erroEscrita(e));
      });
    });
  }
  function excluirVisita() {
    var f = form;
    confirmar('Excluir o registro de ' + dma(f.data) + '?', 'Os saldos e o relatório deixam de contar esta visita.', 'Excluir', true).then(function (ok) {
      if (!ok) return;
      var copia = Object.assign({}, cru.visitas.filter(function (x) { return x.id === f.id; })[0] || {}).data;
      gravar(function () { return db.collection('visitas').doc(f.id).delete(); }).then(function () {
        formNaTela = false; form = null;
        toast('Registro excluído', copia ? { rotulo: 'Desfazer', fn: function () { gravar(function () { return db.collection('visitas').doc(f.id).set(copia); }).then(function () { toast('Registro restaurado'); }, function (e) { toast(erroEscrita(e)); }); } } : null);
        ir('historico');
      }).catch(function (e) { msgForm(erroEscrita(e)); });
    });
  }

  // ---------------- histórico ----------------
  function telaHistorico() {
    var t = hoje();
    if (!filtroHist.mes) filtroHist.mes = t.slice(0, 7);
    var a = filtroHist.mes + '-01', b = L.fimMes(a), tp = filtroHist.tipo;
    var con = L.conciliacao(E, t), vg = L.vagas(E);
    var vs = E.visitas.filter(function (v) { return v.data >= a && v.data <= b; });
    if (tp === 'faltas') vs = vs.filter(function (v) { return v.falta; });
    else if (tp === 'extras') vs = vs.filter(function (v) { var x = L.tipoVisita(E, v, vg); return x === 'extra' || x === 'urgencia'; });
    else if (tp === 'conferir') vs = vs.filter(function (v) { var p = con.porVisita[v.id]; return p && (p.sobra || (p.leva && p.leva.atrasada)); });
    vs = vs.slice().reverse();
    var pend = E.cfg.inicio ? L.agenda(E, E.cfg.inicio > a ? E.cfg.inicio : a, b < t ? b : t, t).filter(function (x) { return x.st === 'pendente'; }) : [];
    var h = '<div class="cab"><h1>Histórico</h1></div>';
    h += '<div class="filtros"><div class="campo"><label for="h-mes">Mês</label><input type="month" id="h-mes" value="' + filtroHist.mes + '" max="' + t.slice(0, 7) + '"></div>' +
      '<div class="chips" role="group" aria-label="Filtrar">' + [['todos', 'Tudo'], ['faltas', 'Faltas'], ['extras', 'Fora da agenda'], ['conferir', 'Para conferir']].map(function (o) {
        return '<button class="chip" data-tipo="' + o[0] + '" aria-pressed="' + (tp === o[0]) + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    if (pend.length && tp === 'todos') h += '<div class="aviso" data-n="warn"><div class="txt"><strong>Dias da agenda sem registro</strong><span>' + pend.map(function (x) { return dsem(x.data) + ' ' + dm(x.data); }).join(', ') + '</span></div>' + (podeEscrever ? '<div class="acoes">' + pend.slice(-3).reverse().map(function (x) { return '<button class="btn" data-reg="' + x.data + '">' + dsem(x.data) + ' ' + dm(x.data) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    h += '<div class="painel">' + (vs.length ? '<ul class="lista">' + vs.map(function (v) { return itemVisita(v, con, vg, podeEscrever); }).join('') + '</ul>' : '<p class="vazio">Nenhum registro em ' + mesAno(a) + (tp !== 'todos' ? ' com esse filtro' : '') + '.</p>') + '</div>';
    if (podeEscrever && vs.length) h += '<p class="peq muted">Toque num registro para corrigir ou excluir.</p>';
    return h;
  }
  function ligarHistorico() {
    var m = document.getElementById('h-mes');
    m.onchange = function () { if (/^\d{4}-\d{2}$/.test(m.value)) { filtroHist.mes = m.value; m.blur(); desenhar(); } };
    document.querySelectorAll('[data-tipo]').forEach(function (b) { b.onclick = function () { filtroHist.tipo = b.dataset.tipo; desenhar(true); }; });
  }

  // ---------------- relatório ----------------
  function textoPeriodo(a, b) {
    var t = hoje();
    if (a === L.inicioMes(a) && (b === L.fimMes(a) || (b === t && b.slice(0, 7) === a.slice(0, 7)))) return mesAno(a) + (b === t && b !== L.fimMes(a) ? ' (até ' + dm(b) + ')' : '');
    return dma(a) + ' a ' + dma(b);
  }
  function montarRelatorio(a, b) {
    var t = hoje(), r = L.resumo(E, a, b, t), cfg = E.cfg, con = r.con;
    var hojeOuFim = r.ate === t ? 'Hoje' : 'No fim do período';
    // visitas
    var stV = r.pontualidade == null ? ['', 'Sem dados'] : r.pontualidade >= 0.9 ? ['ok', 'Em dia'] : r.pontualidade >= 0.7 ? ['warn', 'Algumas faltas'] : ['bad', 'Muitas faltas'];
    var tv = r.esperadas ? 'A lavanderia veio em ' + r.feitas + ' dos ' + r.esperadas + ' dias combinados' + (r.faltaLav.length ? ' e faltou em ' + plural(r.faltaLav.length, 'dia', 'dias') : '') + '.' : 'Não havia dias combinados no período.';
    if (r.extras + r.urgencias) tv += ' Veio também ' + plural(r.extras + r.urgencias, 'vez', 'vezes') + ' fora da agenda' + (r.urgencias ? ' (' + plural(r.urgencias, 'urgência', 'urgências') + ')' : '') + '.';
    if (r.feriados) tv += ' ' + plural(r.feriados, 'dia caiu', 'dias caíram') + ' em feriado.';
    if (r.outro.length) tv += ' Em ' + plural(r.outro.length, 'dia', 'dias') + ' não houve visita por outro motivo.';
    if (r.pendentes.length) tv += ' ' + plural(r.pendentes.length, 'dia ficou', 'dias ficaram') + ' sem registro da equipe.';
    // camisolas
    var pd = pendencia(con);
    var stC = null;
    var tc = r.realizadas ? 'Foram ' + fkg(r.tot.lCam) + ' kg de camisolas sujas e voltaram ' + fkg(r.tot.tCam) + ' kg limpas' + (r.tot.tPecas ? ' (' + r.tot.tPecas + ' peças)' : '') + '.' : 'Não houve movimento de camisolas.';
    var sujAlta = r.sujeiraMedia != null && r.sujeiraMedia > cfg.sujMax + 2, sujBaixa = r.sujeiraMedia != null && r.sujeiraMedia < cfg.sujMin - 2;
    if (r.sujeiraMedia != null) tc += ' A roupa limpa pesa menos porque a suja carrega sujeira e umidade, normalmente ' + cfg.sujMin + '% a ' + cfg.sujMax + '% do peso. No período, voltou ' + pct(r.sujeiraMedia) + '% mais leve' + (sujAlta ? ', acima do normal: pode estar faltando roupa.' : sujBaixa ? ', abaixo do normal: pode haver coleta sem registro.' : ', dentro do normal.');
    tc += ' ' + hojeOuFim + ' a lavanderia ainda tem cerca de ' + fkg(con.aDevolver.med) + ' kg para devolver' + (con.abertas.length && !pd ? ', da última coleta' : '') + '.';
    if (pd) tc += ' Atenção: cerca de ' + fkg(pd.kg) + ' kg deveriam ter voltado e ainda não voltaram.';
    stC = pd || r.sobras.length || sujAlta || sujBaixa ? ['warn', 'Conferir'] : ['ok', 'Normal'];
    if (r.sobras.length) tc += ' Em ' + plural(r.sobras.length, 'visita', 'visitas') + ' voltou mais do que tinha sido levado, o que indica coleta não registrada.';
    // mops
    var mm = r.mops;
    var stM = mm.inconsistente ? ['warn', 'Conferir'] : ['', 'Informativo'];
    var tm = hojeOuFim + ' a lavanderia está com ' + Math.max(0, mm.br.fora) + ' dos ' + mm.br.total + ' mops brancos e ' + Math.max(0, mm.vm.fora) + ' dos ' + mm.vm.total + ' vermelhos.' + (mm.inconsistente ? ' A conta não fecha: é preciso contar os mops que estão aqui.' : '');
    if (mm.contagem) tm += ' Última contagem: ' + dma(mm.contagem.data) + '.';
    var geral = stV[0] === 'bad' || stC[0] === 'warn' || stM[0] === 'warn' || stV[0] === 'warn' ? ['warn', 'Pede atenção'] : ['ok', 'Tudo normal'];
    return { r: r, linhas: [['Visitas', stV, tv], ['Camisolas', stC, tc], ['Mops', stM, tm]], geral: geral, titulo: textoPeriodo(a, b) };
  }
  var COR_ARQ = { ok: '#16703F', warn: '#8F5400', bad: '#B3261E', '': '#6B6A64' };
  function htmlRelatorio(R, arq) {
    var r = R.r, vg = L.vagas(E);
    var tag = function (st) { return '<span class="tag" data-n="' + st[0] + '"' + (arq ? ' style="color:' + COR_ARQ[st[0]] + '"' : '') + '>' + st[1] + '</span>'; };
    var h = '<div class="titulo"><div><p class="muted peq">eLavanderia · camisolas e mops</p><h1 style="font-size:22px">' + esc(cap(R.titulo)) + '</h1></div>' + tag(R.geral) + '</div>';
    h += '<table class="sema"><tbody>' + R.linhas.map(function (l) { return '<tr><th scope="row">' + l[0] + '</th><td>' + tag(l[1]) + '</td><td>' + esc(l[2]) + '</td></tr>'; }).join('') + '</tbody></table>';
    var sem = r.faltaLav.concat(r.outro).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    if (sem.length || r.pendentes.length) {
      h += '<div><h2 style="margin-bottom:6px">Dias sem visita</h2><ul style="margin:0;padding-left:18px">' +
        sem.map(function (x) { return '<li>' + cap(dlongo(x.data)) + ': ' + (x.st === 'outro' ? 'sem visita (outro motivo)' : 'a lavanderia não veio') + (x.v && x.v.obs ? ' — ' + esc(x.v.obs) : '') + '</li>'; }).join('') +
        r.pendentes.map(function (x) { return '<li>' + cap(dlongo(x.data)) + ': sem registro da equipe</li>'; }).join('') + '</ul></div>';
    }
    var vs = r.visitas;
    h += '<div><h2 style="margin-bottom:6px">Visitas</h2>' + (vs.length ? '<div class="tabela-wrap"><table class="visitas"><thead><tr><th>Data</th><th>Visita</th><th class="n">Camisolas levadas</th><th class="n">Camisolas devolvidas</th><th class="n">Peças</th><th>Mops levados</th><th>Mops devolvidos</th></tr></thead><tbody>' +
      vs.map(function (v) {
        var tp = { falta: v.motivo === 'feriado' ? 'Feriado' : v.motivo === 'outro' ? 'Sem visita' : 'Não veio', urgencia: 'Urgência', extra: 'Fora da agenda', prevista: 'Na agenda' }[L.tipoVisita(E, v, vg)];
        var dt = '<td class="dt">' + dsem(v.data) + ' ' + dm(v.data) + '</td><td class="tp">' + tp + '</td>';
        if (v.falta) return '<tr class="sem">' + dt + '<td class="n" data-l="Camisolas levadas">—</td><td class="n" data-l="Camisolas devolvidas">—</td><td class="n" data-l="Peças">—</td><td data-l="Mops levados">—</td><td data-l="Mops devolvidos">—</td></tr>';
        return '<tr>' + dt +
          '<td class="n" data-l="Camisolas levadas">' + (v.levou.cam ? fkg(v.levou.cam) + ' kg' : '—') + '</td><td class="n" data-l="Camisolas devolvidas">' + (v.trouxe.cam ? fkg(v.trouxe.cam) + ' kg' : '—') + '</td><td class="n" data-l="Peças">' + (v.trouxe.pecas || '—') + '</td>' +
          '<td data-l="Mops levados">' + (mopsTxt(v.levou.br, v.levou.vm) || '—') + '</td><td data-l="Mops devolvidos">' + (mopsTxt(v.trouxe.br, v.trouxe.vm) || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted">Nenhum registro no período.</p>') + '</div>';
    return h;
  }
  function telaRelatorio() {
    var t = hoje();
    if (!rel) rel = { a: L.inicioMes(t), b: t };
    var R = montarRelatorio(rel.a, rel.b);
    var mp = L.inicioMes(L.somaDias(L.inicioMes(t), -1));
    var h = '<div class="cab"><h1>Relatório</h1></div>';
    h += '<div class="filtros"><div class="chips" role="group" aria-label="Período">' +
      '<button class="chip" data-per="mes" aria-pressed="' + (rel.a === L.inicioMes(t) && rel.b === t) + '">Este mês</button>' +
      '<button class="chip" data-per="passado" aria-pressed="' + (rel.a === mp && rel.b === L.fimMes(mp)) + '">Mês passado</button>' +
      '<button class="chip" data-per="30" aria-pressed="' + (rel.a === L.somaDias(t, -29) && rel.b === t) + '">Últimos 30 dias</button></div>' +
      '<div class="campo"><label for="r-a">De</label><input type="date" id="r-a" value="' + rel.a + '" max="' + t + '"></div>' +
      '<div class="campo"><label for="r-b">Até</label><input type="date" id="r-b" value="' + rel.b + '"></div></div>';
    h += '<div class="botoes"><button class="btn pri" id="r-baixar">Baixar relatório</button><button class="btn" id="r-csv">Baixar planilha</button><button class="btn" id="r-copiar">Copiar resumo</button></div>';
    h += '<p class="msg" id="r-msg" role="status"></p>';
    h += '<article class="painel rel">' + htmlRelatorio(R, false) + '</article>';
    return h;
  }
  function arquivoRelatorio(R) {
    var css = 'body{font:14px/1.55 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1B1B19;max-width:860px;margin:32px auto;padding:0 20px;font-variant-numeric:tabular-nums}' +
      'h1,h2{margin:0;font-weight:600}h2{font-size:15px}p{margin:0}.muted{color:#6B6A64}.peq{font-size:12px}' +
      '.rel>div,.rel>table{margin-bottom:22px}.titulo{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:1px solid #1B1B19;padding-bottom:12px}' +
      '.tag{font-weight:600;white-space:nowrap}' +
      '.sema{width:100%;border-collapse:collapse;font-size:15px}.sema th{text-align:left;width:100px;padding:12px 12px 12px 0;vertical-align:top;border-bottom:1px solid #E6E4DE}.sema td{padding:12px 12px 12px 0;vertical-align:top;border-bottom:1px solid #E6E4DE}.sema td:nth-child(2){width:120px}.sema tr:last-child th,.sema tr:last-child td{border-bottom:0}' +
      '@media(max-width:600px){.sema,.sema tbody,.sema tr{display:block}.sema tr{display:grid;grid-template-columns:1fr auto;padding:12px 0;border-bottom:1px solid #E6E4DE}.sema th,.sema td{border:0!important;padding:0;width:auto!important}.sema td:last-child{grid-column:1/-1;margin-top:4px}}' +
      '.tabela-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}thead th{text-align:left;font-weight:600;color:#6B6A64;font-size:11px;border-bottom:1px solid #1B1B19;padding:6px 8px}' +
      'td{padding:6px 8px;border-bottom:1px solid #E6E4DE;vertical-align:top}.dt{white-space:nowrap}@media(max-width:600px){table.visitas thead{display:none}table.visitas,table.visitas tbody{display:block}table.visitas tr{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;padding:10px 0;border-bottom:1px solid #E6E4DE}table.visitas tr.sem td[data-l]{display:none}table.visitas td{border:0;padding:0;text-align:left!important;white-space:normal}table.visitas td.dt{font-weight:600}table.visitas td.tp{text-align:right!important;color:#6B6A64}table.visitas td[data-l]::before{content:attr(data-l);display:block;font-size:11px;color:#6B6A64}}.n{text-align:right;white-space:nowrap}ul{margin:0}.rodape{margin-top:28px;color:#77756D;font-size:11px}@media print{body{margin:0}}';
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>eLavanderia · Relatório · ' + esc(R.titulo) + '</title><style>' + css + '</style></head><body><div class="rel">' +
      htmlRelatorio(R, true) + '</div><p class="rodape">Gerado em ' + dma(hoje()) + '. Para salvar em PDF, abra no computador e use Imprimir (Ctrl+P) › Salvar como PDF.</p></body></html>';
  }
  function csvRelatorio(R) {
    var q = function (s) { s = String(s == null ? '' : s); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var n = function (x) { return x ? String(L.r2(x)).replace('.', ',') : '0'; };
    var vg = L.vagas(E), con = R.r.con;
    var linhas = [['Data', 'Dia', 'Visita', 'Motivo da falta', 'Camisolas levadas (kg)', 'Mops brancos levados', 'Mops vermelhos levados', 'Camisolas devolvidas (kg)', 'Peças devolvidas', 'Mops brancos devolvidos', 'Mops vermelhos devolvidos', 'Voltou a mais (kg)', 'Observação', 'Registrado por']];
    R.r.visitas.forEach(function (v) {
      var tp = { falta: 'Falta', urgencia: 'Urgência', extra: 'Fora da agenda', prevista: 'Na agenda' }[L.tipoVisita(E, v, vg)];
      var p = con.porVisita[v.id];
      linhas.push([dma(v.data), DIAS_LONGO[L.diaSemana(v.data)], tp, v.falta ? ({ lavanderia: 'Lavanderia não veio', feriado: 'Feriado', outro: 'Outro motivo' }[v.motivo]) : '',
        n(v.levou.cam), v.levou.br, v.levou.vm, n(v.trouxe.cam), v.trouxe.pecas, v.trouxe.br, v.trouxe.vm, p && p.sobra ? n(p.sobra) : '', v.obs, v.por ? nome(v.por) : '']);
    });
    return '﻿' + linhas.map(function (l) { return l.map(q).join(';'); }).join('\r\n');
  }
  function textoResumo(R) {
    return 'eLavanderia · ' + cap(R.titulo) + ' — ' + R.geral[1] + '\n\n' + R.linhas.map(function (l) { return l[0] + ' (' + l[1][1].toLowerCase() + '): ' + l[2]; }).join('\n\n');
  }
  function ligarRelatorio() {
    var t = hoje(), msg = document.getElementById('r-msg');
    document.querySelectorAll('[data-per]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.per === 'mes') rel = { a: L.inicioMes(t), b: t };
        else if (b.dataset.per === 'passado') { var a = L.inicioMes(L.somaDias(L.inicioMes(t), -1)); rel = { a: a, b: L.fimMes(a) }; }
        else rel = { a: L.somaDias(t, -29), b: t };
        desenhar(true);
      };
    });
    var ia = document.getElementById('r-a'), ib = document.getElementById('r-b');
    var mudar = function () {
      if (!L.dataValida(ia.value) || !L.dataValida(ib.value)) return;
      if (ia.value > ib.value) { msg.dataset.n = 'bad'; msg.textContent = 'A data inicial é depois da final.'; return; }
      rel = { a: ia.value, b: ib.value }; document.activeElement.blur(); desenhar(true);
    };
    ia.onchange = mudar; ib.onchange = mudar;
    var baixar = function (nomeArq, dados) {
      msg.textContent = '';
      var uso = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
      uso.then(function (d) {
        if (!d) { msg.dataset.n = 'bad'; msg.textContent = 'O download não está disponível aqui. Use "Copiar resumo".'; return; }
        return d.save({ filename: nomeArq, data: dados }).catch(function (e) {
          if (e && e.code === 'declined') return;
          msg.dataset.n = 'bad'; msg.textContent = 'Não foi possível baixar (' + (e && e.code || 'erro') + ').';
        });
      });
    };
    var sufixo = rel.a === L.inicioMes(rel.a) && rel.b.slice(0, 7) === rel.a.slice(0, 7) ? rel.a.slice(0, 7) : rel.a + '_a_' + rel.b;
    document.getElementById('r-baixar').onclick = function () { baixar('elavanderia-relatorio-' + sufixo + '.html', arquivoRelatorio(montarRelatorio(rel.a, rel.b))); };
    document.getElementById('r-csv').onclick = function () { baixar('elavanderia-' + sufixo + '.csv', csvRelatorio(montarRelatorio(rel.a, rel.b))); };
    document.getElementById('r-copiar').onclick = function () {
      var txt = textoResumo(montarRelatorio(rel.a, rel.b));
      var falhou = function () { msg.dataset.n = 'bad'; msg.textContent = 'Não foi possível copiar automaticamente.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Resumo copiado'); }, falhou); else falhou();
    };
  }

  // ---------------- ajustes ----------------
  var MOTIVO = { compra: 'Compra', descarte: 'Descarte', perda: 'Perda ou extravio', contagem: 'Contagem', outro: 'Ajuste' };
  function telaAjustes() {
    var t = hoje(), c = E.cfg, m = L.mops(E, t), ro = podeEscrever ? '' : ' disabled';
    var h = '<div class="cab"><h1>Ajustes</h1></div><div class="config-grid">';
    h += '<form class="painel" id="cont-form" novalidate><div class="painel-cab"><h2>Contagem de mops</h2>' + (m.contagem ? '<span>última: ' + dm(m.contagem.data) + '</span>' : '') + '</div><div class="painel-corpo campos" style="gap:14px">' +
      '<p class="peq muted">A lavanderia não informa quantos mops estão com ela. Conte os que estão aqui no hospital: a partir desta contagem, o sistema sabe quantos estão com a lavanderia.</p>' +
      '<div class="linha dois">' + passo('cbr', 'Brancos aqui', 'contados', m.inconsistente ? '' : Math.min(m.br.total, Math.max(0, m.br.aqui)), 'next', !podeEscrever) + passo('cvm', 'Vermelhos aqui', 'contados', m.inconsistente ? '' : Math.min(m.vm.total, Math.max(0, m.vm.aqui)), 'done', !podeEscrever) + '</div>' +
      '<p class="peq" id="cont-prev">' + (m.inconsistente ? 'A conta atual não fecha. Conte agora e preencha.' : 'Pelos registros há ' + m.br.aqui + ' brancos e ' + m.vm.aqui + ' vermelhos aqui.') + (podeEscrever && L.agenda(E, t, t, t).some(function (x) { return x.st === 'hoje'; }) ? ' Hoje é dia de visita: se a lavanderia já passou, registre a visita antes de contar.' : '') + '</p>' +
      '<button class="btn pri" type="submit"' + ro + '>Salvar contagem</button><p class="msg" id="cont-msg"></p></div></form>';
    h += '<form class="painel" id="aj-form" novalidate><div class="painel-cab"><h2>Compra, descarte ou perda</h2><span>total: ' + m.br.total + ' brancos, ' + m.vm.total + ' vermelhos</span></div><div class="painel-corpo campos" style="gap:14px">' +
      '<div class="linha dois"><div class="campo"><label for="aj-item">Mop</label><select id="aj-item"' + ro + '><option value="br">Branco</option><option value="vm">Vermelho</option></select></div>' +
      '<div class="campo"><label for="aj-mot">O que houve</label><select id="aj-mot"' + ro + '><option value="compra">Compra (entra)</option><option value="descarte">Descarte (sai)</option><option value="perda">Perda ou extravio (sai)</option></select></div></div>' +
      '<div class="linha dois">' + passo('ajq', 'Quantidade', '', 1, 'next', !podeEscrever) + '<div class="campo"><label for="aj-obs">Observação</label><input type="text" id="aj-obs" maxlength="200"' + ro + '></div></div>' +
      '<button class="btn pri" type="submit"' + ro + '>Registrar</button><p class="msg" id="aj-msg"></p></div></form>';
    h += '</div>';

    var ajs = E.ajustes.slice().reverse();
    h += '<section class="secao"><h2>Movimentos de mops</h2><div class="painel">' + (ajs.length ? '<div class="tabela-wrap"><table><thead><tr><th>Data</th><th>O que houve</th><th>Detalhe</th><th>Por</th><th></th></tr></thead><tbody>' +
      ajs.map(function (a) {
        var det = a.motivo === 'contagem' ? 'Contados aqui: ' + mopsTxt(a.aquiBr, a.aquiVm).replace(/^$/, 'nenhum') : (a.qtd > 0 ? '+' : '') + a.qtd + ' ' + (a.item === 'br' ? (Math.abs(a.qtd) === 1 ? 'branco' : 'brancos') : (Math.abs(a.qtd) === 1 ? 'vermelho' : 'vermelhos'));
        return '<tr><td style="white-space:nowrap">' + dma(a.data) + '</td><td>' + esc(MOTIVO[a.motivo]) + '</td><td>' + det + (a.obs ? ' <span class="muted">· ' + esc(a.obs) + '</span>' : '') + '</td><td class="muted">' + esc(nome(a.por)) + '</td><td style="text-align:right;white-space:nowrap">' + (podeEscrever ? '<button class="link perigo" data-del-aj="' + esc(a.id) + '">Excluir</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum movimento. Total base: ' + c.totalBr + ' brancos e ' + c.totalVm + ' vermelhos.</p>') + '</div></section>';

    h += '<section class="card"><div class="card-cab"><span class="rot">Aparência</span><span class="lat">vale só para este aparelho</span></div><div class="temas" role="group" aria-label="Tema">' +
      [['claro', 'Claro'], ['escuro', 'Escuro'], ['sistema', 'Sistema']].map(function (o) { return '<button type="button" class="tema" data-tema="' + o[0] + '" aria-pressed="' + (tema === o[0]) + '"><span class="mini ' + o[0] + '"><i style="width:40%"></i><i style="width:75%"></i><i style="width:60%"></i></span><span class="tema-nome">' + (tema === o[0] ? ico('ok') : '') + o[1] + '</span></button>'; }).join('') + '</div></section>';
    if (window.lavEquipe && ehAdmin) h += '<section class="card"><div class="card-cab"><span class="rot">Equipe</span><span class="lat">novos logins são criados no Supabase</span></div><div id="equipe-lista" class="equipe"><p class="muted peq">Carregando…</p></div><p class="msg" id="equipe-msg"></p></section>';
    var adm = ehAdmin, dis = adm ? '' : ' disabled';
    h += '<div class="config-grid">';
    h += '<form class="painel" id="cfg-form" novalidate><div class="painel-cab"><h2>Agenda e cálculo</h2><span>' + (adm ? '' : 'só o responsável altera') + '</span></div><div class="painel-corpo campos" style="gap:16px">' +
      '<div class="campo"><span class="lbl" id="lbl-dias">Dias de visita</span><div class="dias" role="group" aria-labelledby="lbl-dias">' + [1, 2, 3, 4, 5, 6].map(function (d) { return '<label><input type="checkbox" name="dia" value="' + d + '"' + (c.dias.indexOf(d) >= 0 ? ' checked' : '') + dis + '>' + DIAS[d] + '</label>'; }).join('') + '</div></div>' +
      '<div class="campo"><label for="cfg-ini">Início do controle</label><input type="date" id="cfg-ini" value="' + (c.inicio || t) + '" max="' + t + '"' + dis + '><span class="dica">Visitas e dias antes desta data não contam.</span></div>' +
      '<div class="campo"><span class="lbl">Já estava com a lavanderia no início</span><div class="linha">' +
      '<div class="campo"><label for="cfg-scam" class="peq muted" style="font-weight:400">Camisolas (kg sujos)</label><div class="kg"><input type="text" inputmode="decimal" id="cfg-scam" value="' + kgCampo(c.saldoIni.cam) + '" placeholder="0,0"' + dis + '></div></div>' +
      '<div class="campo"><label for="cfg-sbr" class="peq muted" style="font-weight:400">Mops brancos</label><input type="text" inputmode="numeric" id="cfg-sbr" value="' + c.saldoIni.br + '"' + dis + '></div>' +
      '<div class="campo"><label for="cfg-svm" class="peq muted" style="font-weight:400">Mops vermelhos</label><input type="text" inputmode="numeric" id="cfg-svm" value="' + c.saldoIni.vm + '"' + dis + '></div></div></div>' +
      '<div class="linha dois"><div class="campo"><label for="cfg-tbr">Total de mops brancos</label><input type="text" inputmode="numeric" id="cfg-tbr" value="' + c.totalBr + '"' + dis + '></div>' +
      '<div class="campo"><label for="cfg-tvm">Total de mops vermelhos</label><input type="text" inputmode="numeric" id="cfg-tvm" value="' + c.totalVm + '"' + dis + '></div></div>' +
      '<div class="linha dois"><div class="campo"><label for="cfg-smin">Sujeira mínima (%)</label><input type="text" inputmode="decimal" id="cfg-smin" value="' + pct(c.sujMin) + '"' + dis + '></div>' +
      '<div class="campo"><label for="cfg-smax">Sujeira máxima (%)</label><input type="text" inputmode="decimal" id="cfg-smax" value="' + pct(c.sujMax) + '"' + dis + '></div></div>' +
      '<p class="dica">Quanto do peso da camisola suja é sujeira e umidade. O padrão de 8% a 15% é a referência dos contratos de lavanderia hospitalar do Governo de SP; ajuste se o contrato de vocês usar outro valor.</p>' +
      (adm ? '<button class="btn pri" type="submit">Salvar configuração</button>' : '') + '<p class="msg" id="cfg-msg"></p></div></form>';

    var fers = Object.keys(E.feriados).sort().filter(function (d) { return d >= L.somaDias(t, -60); });
    h += '<div class="painel"><div class="painel-cab"><h2>Feriados</h2><span>sem visita esperada</span></div><div class="painel-corpo campos" style="gap:14px">' +
      (podeEscrever ? '<form id="fer-form" class="linha dois" novalidate style="align-items:end"><div class="campo"><label for="fer-d">Data</label><input type="date" id="fer-d"></div><div class="campo"><label for="fer-n">Nome</label><input type="text" id="fer-n" maxlength="60" placeholder="Aniversário da cidade"></div><button class="btn" type="submit" style="grid-column:1/-1">Adicionar feriado</button></form><p class="msg" id="fer-msg"></p>' : '') +
      (fers.length ? '<div class="tabela-wrap"><table><tbody>' + fers.map(function (d) {
        return '<tr><td style="white-space:nowrap">' + dsem(d) + ' ' + dma(d) + '</td><td>' + esc(E.feriados[d].nome) + '</td><td style="text-align:right">' + (podeEscrever ? '<button class="link perigo" data-del-fer="' + esc(E.feriados[d].id) + '">Excluir</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vazio">Nenhum feriado cadastrado.</p>') + '</div></div>';
    h += '</div>';
    return h;
  }

  function ligarEquipe() {
    var caixa = document.getElementById('equipe-lista'); if (!caixa || !window.lavEquipe) return;
    var msg = document.getElementById('equipe-msg');
    window.lavEquipe.listar().then(function (lst) {
      caixa.innerHTML = lst.map(function (p) {
        return '<div class="equipe-l" data-pid="' + esc(p.id) + '"><input type="text" value="' + esc(p.nome) + '" aria-label="Nome de ' + esc(p.email) + '" maxlength="60">' +
          '<span class="em">' + esc(p.email) + '</span><select aria-label="Papel de ' + esc(p.email) + '">' + [['admin', 'Responsável'], ['equipe', 'Registra'], ['leitor', 'Só vê']].map(function (o) { return '<option value="' + o[0] + '"' + (p.papel === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="btn">Salvar</button></div>';
      }).join('') || '<p class="muted peq">Ninguém ainda.</p>';
      caixa.querySelectorAll('.equipe-l').forEach(function (l) {
        l.querySelector('button').onclick = function () {
          var id = l.dataset.pid, nomeN = l.querySelector('input').value.trim(), papel = l.querySelector('select').value;
          if (id === meuId && papel !== 'admin') { msg.dataset.n = 'bad'; msg.textContent = 'Você não pode tirar o seu próprio acesso de responsável.'; return; }
          window.lavEquipe.salvar(id, { nome: nomeN, papel: papel }).then(function () { delete nomes[id]; ajSujo = false; toast('Equipe atualizada'); resolverNomes(); }, function (e) { msg.dataset.n = 'bad'; msg.textContent = erroEscrita(e); });
        };
      });
    }, function () { caixa.innerHTML = '<p class="msg" data-n="bad">Não foi possível carregar a equipe.</p>'; });
  }
  function ligarAjustes() {
    var t = hoje();
    ligarEquipe();
    app.querySelectorAll('[data-tema]').forEach(function (b) { b.onclick = function () { escolherTema(b.dataset.tema); }; });
    ['cont-form', 'aj-form', 'cfg-form', 'fer-form'].forEach(function (id) {
      var f = document.getElementById(id); if (!f) return;
      f.addEventListener('input', function () { ajSujo = true; });
      f.addEventListener('submit', function () { setTimeout(function () { ajSujo = false; if (redesenhoPendente && !digitando()) desenhar(true); }, 50); });
    });
    app.querySelectorAll('[data-passo]').forEach(function (b) {
      b.onclick = function () { var inp = g(b.dataset.passo); inp.value = Math.max(0, inteiroOu0(inp.value) + (+b.dataset.d)); inp.dispatchEvent(new Event('input', { bubbles: true })); };
    });
    app.querySelectorAll('.passo input').forEach(function (i) {
      i.addEventListener('focus', function () { try { i.select(); } catch (x) {} });
      i.addEventListener('change', function () { i.setAttribute('aria-invalid', String(!isFinite(inteiro(i.value)))); });
    });
    var m = L.mops(E, t);
    var cf = document.getElementById('cont-form');
    cf.addEventListener('input', function () {
      var br = inteiroOu0(g('cbr').value), vm = inteiroOu0(g('cvm').value), dB = br - m.br.aqui, dV = vm - m.vm.aqui;
      document.getElementById('cont-prev').textContent = (dB || dV) ?
        'Diferença dos registros: ' + (dB > 0 ? '+' : '') + dB + ' brancos e ' + (dV > 0 ? '+' : '') + dV + ' vermelhos. Ao salvar, a lavanderia passa a estar com ' + (m.br.total - br) + ' brancos e ' + (m.vm.total - vm) + ' vermelhos.' :
        'Bate com os registros. Salvar confirma a contagem de hoje.';
    });
    cf.onsubmit = function (e) {
      e.preventDefault(); if (!podeEscrever) return;
      var br = inteiro(g('cbr').value), vm = inteiro(g('cvm').value), msg = document.getElementById('cont-msg'); msg.dataset.n = 'bad';
      if (g('cbr').value.trim() === '' || g('cvm').value.trim() === '') { msg.textContent = 'Preencha quantos brancos e quantos vermelhos há aqui.'; return; }
      if (!isFinite(br) || !isFinite(vm)) { msg.textContent = 'Use só números inteiros.'; return; }
      if (br > m.br.total || vm > m.vm.total) { msg.textContent = 'Contou mais mops do que o total da empresa. Se houve compra, registre a compra antes.'; return; }
      gravar(function () { return db.collection('ajustes').doc(novoId('c')).set({ data: t, motivo: 'contagem', aquiBr: br, aquiVm: vm, obs: '', por: meuId, em: agoraISO() }); })
        .then(function () { document.activeElement && document.activeElement.blur(); toast('Contagem salva'); }).catch(function (e) { msg.textContent = erroEscrita(e); });
    };
    var af = document.getElementById('aj-form');
    af.onsubmit = function (e) {
      e.preventDefault(); if (!podeEscrever) return;
      var item = document.getElementById('aj-item').value, mot = document.getElementById('aj-mot').value, q = inteiro(g('ajq').value), msg = document.getElementById('aj-msg'); msg.dataset.n = 'bad';
      if (!(q > 0)) { msg.textContent = 'A quantidade precisa ser maior que zero.'; return; }
      gravar(function () { return db.collection('ajustes').doc(novoId('a')).set({ data: t, item: item, qtd: mot === 'compra' ? q : -q, motivo: mot, obs: document.getElementById('aj-obs').value.trim().slice(0, 200), por: meuId, em: agoraISO() }); })
        .then(function () { document.activeElement && document.activeElement.blur(); toast('Registrado'); }).catch(function (e) { msg.textContent = erroEscrita(e); });
    };
    app.querySelectorAll('[data-del-aj]').forEach(function (b) {
      b.onclick = function () {
        confirmar('Excluir este movimento?', 'As contas de mops voltam a ser feitas sem ele.', 'Excluir', true).then(function (ok) {
          if (ok) gravar(function () { return db.collection('ajustes').doc(b.dataset.delAj).delete(); }).then(function () { toast('Excluído'); }, function (e) { toast(erroEscrita(e)); });
        });
      };
    });
    var cfgF = document.getElementById('cfg-form');
    cfgF.onsubmit = function (e) {
      e.preventDefault(); if (!ehAdmin) return;
      var msg = document.getElementById('cfg-msg'); msg.dataset.n = 'bad';
      var val = function (id) { return document.getElementById(id).value; };
      var dias = Array.prototype.map.call(cfgF.querySelectorAll('input[name="dia"]:checked'), function (i) { return +i.value; }).sort();
      var ini = val('cfg-ini'), smin = L.lerNumero(val('cfg-smin')), smax = L.lerNumero(val('cfg-smax'));
      var tbr = L.lerNumero(val('cfg-tbr')), tvm = L.lerNumero(val('cfg-tvm')), scam = L.lerNumero(val('cfg-scam')), sbr = L.lerNumero(val('cfg-sbr')), svm = L.lerNumero(val('cfg-svm'));
      var inteiros = [tbr, tvm, sbr, svm].every(function (x) { return isFinite(x) && x >= 0 && Math.round(x) === x; });
      if (!dias.length) { msg.textContent = 'Marque pelo menos um dia de visita.'; return; }
      if (!L.dataValida(ini) || ini > t) { msg.textContent = 'A data de início precisa ser hoje ou antes.'; return; }
      if (!isFinite(smin) || !isFinite(smax) || smin < 0 || smax > 60 || smin > smax) { msg.textContent = 'A faixa de sujeira vai de 0% a 60%, com o mínimo menor que o máximo.'; return; }
      if (!inteiros) { msg.textContent = 'Totais e saldo de mops precisam ser números inteiros.'; return; }
      if (!isFinite(scam) || scam < 0) { msg.textContent = 'O peso inicial de camisolas não é um número.'; return; }
      if (sbr > tbr || svm > tvm) { msg.textContent = 'O saldo inicial de mops não pode passar do total.'; return; }
      var corpo = { dias: dias, inicio: ini, sujMin: smin, sujMax: smax, totalBr: tbr, totalVm: tvm, saldoIni: { cam: L.r2(scam), br: sbr, vm: svm }, editPor: meuId, editEm: agoraISO() };
      gravar(function () { return db.doc('config/geral').set(Object.assign({}, cru.cfg || {}, corpo)); }).then(function () { document.activeElement && document.activeElement.blur(); toast('Configuração salva'); }).catch(function (e) {
        msg.textContent = e && e.code === 'invalid_argument' ? 'Só o responsável pela página pode mudar a configuração.' : erroEscrita(e);
      });
    };
    var ff = document.getElementById('fer-form');
    if (ff) ff.onsubmit = function (e) {
      e.preventDefault();
      var d = document.getElementById('fer-d').value, n = document.getElementById('fer-n').value.trim(), msg = document.getElementById('fer-msg'); msg.dataset.n = 'bad';
      if (!L.dataValida(d)) { msg.textContent = 'Escolha a data do feriado.'; return; }
      gravar(function () { return db.collection('feriados').doc(d).set({ data: d, nome: (n || 'Feriado').slice(0, 60), por: meuId, em: agoraISO() }); })
        .then(function () { document.activeElement && document.activeElement.blur(); toast('Feriado adicionado'); }).catch(function (e) { msg.textContent = erroEscrita(e); });
    };
    app.querySelectorAll('[data-del-fer]').forEach(function (b) {
      b.onclick = function () {
        confirmar('Excluir este feriado?', 'O dia volta a contar como dia de visita.', 'Excluir', true).then(function (ok) {
          if (ok) gravar(function () { return db.collection('feriados').doc(b.dataset.delFer).delete(); }).then(function () { toast('Feriado excluído'); }, function (e) { toast(erroEscrita(e)); });
        });
      };
    });
  }

  // ---------------- ações globais ----------------
  app.addEventListener('click', function (e) {
    var cn = e.target.closest('[data-cal]'), vb = e.target.closest('[data-vista]');
    if (cn) { var dlt = +cn.dataset.cal, mt = hoje().slice(0, 7); if (!dlt) calMes = mt; else { var d0 = L.parse((calMes || mt) + '-01'); d0.setMonth(d0.getMonth() + dlt); calMes = L.iso(d0).slice(0, 7); if (calMes > mt) calMes = mt; } desenhar(true); return; }
    if (vb) { calVista = vb.dataset.vista; try { localStorage.setItem('lav-cal', calVista); } catch (x) {} desenhar(true); return; }
    var r = e.target.closest('[data-reg]'), f = e.target.closest('[data-falta]'), ed = e.target.closest('[data-editar]');
    if (r && podeEscrever) { form = novoForm(r.dataset.reg, false); ir('registrar'); }
    else if (f && podeEscrever) { form = novoForm(f.dataset.falta, true); ir('registrar'); }
    else if (ed && podeEscrever) {
      var v = E.visitas.filter(function (x) { return x.id === ed.dataset.editar; })[0];
      if (v) { form = formDeVisita(v); ir('registrar'); }
    }
  });
  app.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-editar]')) { e.preventDefault(); e.target.click(); }
  });
  // A aba Registrar mantém o rascunho; só recomeça se o formulário estava vazio ou era uma edição.
  document.querySelectorAll('[data-r="registrar"]').forEach(function (el) {
    el.addEventListener('click', function () { if (rota !== 'registrar' && (formVazio(form) || (form && form.id))) form = novoForm(hoje(), false); });
  });

  // ---------------- tema e menu ----------------
  var guardado = function (k, padrao) { try { return localStorage.getItem(k) || padrao; } catch (e) { return padrao; } };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var tema = guardado('lav-tema', 'sistema');
  var NOME_TEMA = { claro: 'Tema claro', escuro: 'Tema escuro', sistema: 'Tema do sistema' };
  function aplicarTema() {
    var plat = document.documentElement.getAttribute('data-theme');
    var escuroSis = plat === 'dark' || (plat !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.modo = tema === 'escuro' || (tema === 'sistema' && escuroSis) ? 'escuro' : 'claro';
    var icone = ico(tema === 'claro' ? 'sol' : tema === 'escuro' ? 'lua' : 'tela');
    ['tema-ic', 'tema-ic2'].forEach(function (id) { var el = document.getElementById(id); if (el) el.innerHTML = icone; });
    var tt = document.getElementById('tema-txt'); if (tt) tt.textContent = NOME_TEMA[tema];
    var b2 = document.getElementById('tema-btn2'); if (b2) b2.setAttribute('aria-label', NOME_TEMA[tema] + '. Trocar tema');
  }
  function escolherTema(t) { tema = t; guardar('lav-tema', t); aplicarTema(); if (rota === 'ajustes') desenhar(true); }
  var ciclo = { claro: 'escuro', escuro: 'sistema', sistema: 'claro' };
  ['tema-btn', 'tema-btn2'].forEach(function (id) { var b = document.getElementById(id); if (b) b.onclick = function () { escolherTema(ciclo[tema]); }; });
  if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', aplicarTema); }
  new MutationObserver(aplicarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  aplicarTema();
  var bSair = document.getElementById('sair');
  if (bSair) { if (window.lavEquipe) bSair.onclick = function () { window.lavEquipe.sair(); }; else bSair.hidden = true; }
  var casca = document.getElementById('casca'), rec = document.getElementById('recolher');
  function menu(recolhido) { casca.classList.toggle('recolhido', recolhido); rec.setAttribute('aria-expanded', String(!recolhido)); rec.setAttribute('aria-label', recolhido ? 'Abrir menu' : 'Recolher menu'); guardar('lav-menu', recolhido ? '1' : '0'); }
  menu(guardado('lav-menu', '0') === '1');
  rec.onclick = function () { menu(!casca.classList.contains('recolhido')); };
  window.addEventListener('beforeunload', function (e) { if (rota === 'registrar' && !formVazio(form) && !salvando) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------- início ----------------
  rota = lerRota();
  if (rota === 'registrar') form = novoForm(hoje(), false);
  marcarAbas();
  var usar = function (n) { return window.claude && typeof window.claude.use === 'function' ? window.claude.use(n) : Promise.resolve(null); };
  usar('db').then(function (d) {
    db = d;
    if (!db) { semBanco = true; avisoRede = 'Não foi possível conectar ao banco de dados. Confira a internet e recarregue a página.'; marcarSinc('erro'); desenhar(); return; }
    return usar('user').then(function (u) {
      usr = u;
      if (!u) return;
      return Promise.all([u.id(), u.canEdit(), u.can('data.write')]).then(function (x) { meuId = x[0]; ehAdmin = !!x[1]; if (x[2] === false) podeEscrever = false; });
    }).then(function () { assinar(); desenhar(); });
  }).catch(function () { semBanco = true; avisoRede = 'Não foi possível conectar ao banco de dados.'; marcarSinc('erro'); desenhar(); });
  desenhar();
})();
