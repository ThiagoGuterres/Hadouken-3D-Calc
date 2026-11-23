(function () {
  'use strict';

  var STORE = 'hadouken3dcalc.v1';

  var FIELDS = ['pieceName','qtyPlate','timeH','timeM','waste','printerPreset','printerPrice','residualPct','lifeH','maintH',
    'watts','tarifa','prepMin','postMin','laborRate','packaging','extras','design','failPct','overheadPct','marginPct',
    'taxPct','mktPct','fixedFee'];

  var DEFAULTS = {
    pieceName:'', qtyPlate:1, timeH:2, timeM:30, waste:5, printerPreset:'a1', printerPrice:3500, residualPct:20, lifeH:5000,
    maintH:0.5, watts:120, tarifa:0.95, prepMin:10, postMin:10, laborRate:25, packaging:1.5, extras:0, design:0,
    failPct:8, overheadPct:5, marginPct:40, taxPct:0, mktPct:0, fixedFee:0
  };

  var PRINTERS = {
    a1:     { printerPrice:3500, watts:120, lifeH:5000, residualPct:20, maintH:0.5 },
    a1mini: { printerPrice:2300, watts:60,  lifeH:5000, residualPct:20, maintH:0.4 }
  };

  var MATERIALS = {
    PLA:  { price: 99,  spool: 1000 },
    PETG: { price: 110, spool: 1000 },
    ABS:  { price: 120, spool: 1000 },
    TPU:  { price: 160, spool: 1000 },
    Outro:{ price: 100, spool: 1000 }
  };

  var COLORS = ['#ff4d3d','#ff8a3d','#ffc23d','#35d07f','#3db8ff','#8a6bff','#d96bff'];

  var $ = function (id) { return document.getElementById(id); };
  var fils = [];
  var last = null;

  function num(id) {
    var v = parseFloat(String($(id).value).replace(',', '.'));
    return isFinite(v) && v >= 0 ? v : 0;
  }
  function toN(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : 0;
  }
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function money(v) { return brl.format(isFinite(v) ? v : 0); }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- filamentos ---------- */
  function newFil(type) {
    var m = MATERIALS[type || 'PLA'];
    return { type: type || 'PLA', name: '', price: m.price, spool: m.spool, used: 0 };
  }

  function renderFils() {
    var box = $('filaments');
    box.innerHTML = '';
    fils.forEach(function (f, i) {
      var row = document.createElement('div');
      row.className = 'fil';
      var opts = Object.keys(MATERIALS).map(function (k) {
        return '<option' + (k === f.type ? ' selected' : '') + '>' + k + '</option>';
      }).join('');
      row.innerHTML =
        '<label>Material<select data-i="' + i + '" data-k="type">' + opts + '</select></label>' +
        '<label>Cor / nome<input type="text" data-i="' + i + '" data-k="name" value="' + escapeAttr(f.name) + '" placeholder="Ex.: Preto"></label>' +
        '<label>Preço do carretel (R$)<input type="number" min="0" step="any" data-i="' + i + '" data-k="price" value="' + f.price + '"></label>' +
        '<label>Peso do carretel (g)<input type="number" min="1" step="any" data-i="' + i + '" data-k="spool" value="' + f.spool + '"></label>' +
        '<label>Gramas usadas<input type="number" min="0" step="any" data-i="' + i + '" data-k="used" value="' + f.used + '"></label>' +
        '<button class="rm" type="button" data-rm="' + i + '" title="Remover" aria-label="Remover filamento">×</button>';
      box.appendChild(row);
    });
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  $('filaments').addEventListener('input', onFilChange);
  $('filaments').addEventListener('change', onFilChange);
  function onFilChange(e) {
    var t = e.target;
    if (t.dataset.i === undefined) return;
    var f = fils[+t.dataset.i], k = t.dataset.k;
    if (!f) return;
    if (k === 'type') {
      if (e.type !== 'change') return;
      f.type = t.value;
      f.price = MATERIALS[f.type].price;
      f.spool = MATERIALS[f.type].spool;
      renderFils();
    } else if (k === 'name') {
      f.name = t.value;
    } else {
      f[k] = toN(t.value);
    }
    calc();
  }
  $('filaments').addEventListener('click', function (e) {
    var rm = e.target.closest('[data-rm]');
    if (!rm) return;
    if (fils.length <= 1) { toast('Mantenha pelo menos 1 filamento'); return; }
    fils.splice(+rm.dataset.rm, 1);
    renderFils();
    calc();
  });
  $('addFil').addEventListener('click', function () {
    fils.push(newFil('PLA'));
    renderFils();
    calc();
  });

  /* ---------- cálculo ---------- */
  function calc() {
    var qty = Math.max(1, Math.floor(num('qtyPlate')) || 1);
    var hours = num('timeH') + num('timeM') / 60;

    var filCost = 0, grams = 0;
    fils.forEach(function (f) {
      var spool = f.spool > 0 ? f.spool : 1000;
      filCost += (f.price / spool) * f.used;
      grams += f.used;
    });
    var wasteCost = filCost * (num('waste') / 100);
    var filTotal = filCost + wasteCost;

    var energy = (num('watts') / 1000) * hours * num('tarifa');

    var life = Math.max(1, num('lifeH'));
    var price = num('printerPrice');
    var deprH = (price - price * (Math.min(100, num('residualPct')) / 100)) / life;
    var machine = (deprH + num('maintH')) * hours;

    var repeat = filTotal + energy + machine;
    var f = Math.min(0.9, num('failPct') / 100);
    var failure = repeat * f / (1 - f);

    var labor = ((num('prepMin') + num('postMin')) / 60) * num('laborRate');
    var extras = num('packaging') + num('extras') + num('design');

    var subtotal = repeat + failure + labor + extras;
    var overhead = subtotal * (num('overheadPct') / 100);
    var cost = subtotal + overhead;

    var margin = num('marginPct') / 100, tax = num('taxPct') / 100, mkt = num('mktPct') / 100;
    var fixed = num('fixedFee');
    var divisor = 1 - margin - tax - mkt;
    var invalid = divisor <= 0.03;
    if (invalid) divisor = 0.03;

    var total = (cost + fixed) / divisor;
    var unit = total / qty;
    if ($('roundNice').checked) {
      var up = Math.ceil(unit + 0.0001);
      unit = up - 0.10;
      if (unit < total / qty) unit = up + 0.90;
      total = unit * qty;
    }
    var unitCost = cost / qty;
    var feesTax = total * (tax + mkt) + fixed;
    var profit = total - cost - feesTax;
    var breakEven = ((cost + fixed) / Math.max(0.03, 1 - tax - mkt)) / qty;

    var parts = [
      { label: 'Filamento', v: filCost },
      { label: 'Desperdício', v: wasteCost },
      { label: 'Energia', v: energy },
      { label: 'Máquina (desgaste)', v: machine },
      { label: 'Reserva de falhas', v: failure },
      { label: 'Mão de obra', v: labor },
      { label: 'Extras e design', v: extras },
      { label: 'Despesas gerais', v: overhead }
    ];

    last = { qty: qty, hours: hours, grams: grams, unit: unit, total: total, cost: cost, profit: profit, parts: parts,
      name: $('pieceName').value.trim() };

    $('outUnitPrice').textContent = money(unit);
    $('outPieceName').textContent = last.name ? last.name : '';
    $('outUnitCost').textContent = money(unitCost);
    $('outUnitProfit').textContent = money(profit / qty);
    $('outUnitMin').textContent = money(breakEven);
    $('outProfitHour').textContent = hours > 0 ? money(profit / hours) : '—';
    $('outTotalPrice').textContent = money(total);
    $('outQty').textContent = qty;

    var sum = parts.reduce(function (a, p) { return a + p.v; }, 0) || 1;
    $('stackBar').innerHTML = parts.map(function (p, i) {
      return '<span style="width:' + (p.v / sum * 100).toFixed(2) + '%;background:' + COLORS[i % COLORS.length] + '" title="' + p.label + '"></span>';
    }).join('');
    $('breakdown').innerHTML = parts.map(function (p, i) {
      return '<li><span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span><span>' + p.label +
        '</span><span class="pct">' + (p.v / sum * 100).toFixed(0) + '%</span><b>' + money(p.v) + '</b></li>';
    }).join('') +
      '<li><span class="dot" style="background:#555"></span><span>Impostos e taxas de venda</span><span class="pct"></span><b>' + money(feesTax) + '</b></li>';

    var w = [];
    if (invalid) w.push('Margem + imposto + taxa somam 97% ou mais: o preço ficou irreal. Reduza algum desses valores.');
    if (grams === 0) w.push('Informe as gramas usadas no fatiador para o custo do filamento entrar na conta.');
    if (hours === 0) w.push('Informe o tempo de impressão para calcular energia e desgaste da máquina.');
    $('warn').hidden = w.length === 0;
    $('warn').innerHTML = w.join('<br>');

    save();
  }

  /* ---------- salvar / carregar ---------- */
  function save() {
    try {
      var data = { v: {}, fils: fils, round: $('roundNice').checked };
      FIELDS.forEach(function (id) { data.v[id] = $(id).value; });
      localStorage.setItem(STORE, JSON.stringify(data));
    } catch (e) { /* navegador sem localStorage: segue sem salvar */ }
  }
  function load() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
    FIELDS.forEach(function (id) {
      $(id).value = data && data.v && data.v[id] !== undefined ? data.v[id] : DEFAULTS[id];
    });
    $('roundNice').checked = !!(data && data.round);
    fils = data && Array.isArray(data.fils) && data.fils.length ? data.fils : [Object.assign(newFil('PLA'), { used: 50 })];
  }
  function reset() {
    if (!confirm('Limpar todos os campos e voltar aos valores padrão?')) return;
    try { localStorage.removeItem(STORE); } catch (e) {}
    load();
    renderFils();
    calc();
    toast('Valores restaurados');
  }

  /* ---------- eventos ---------- */
  FIELDS.forEach(function (id) {
    $(id).addEventListener('input', calc);
  });
  $('roundNice').addEventListener('change', calc);
  $('btnReset').addEventListener('click', reset);

  $('printerPreset').addEventListener('change', function () {
    var p = PRINTERS[this.value];
    if (!p) return;
    Object.keys(p).forEach(function (k) { $(k).value = p[k]; });
    calc();
  });
  ['printerPrice', 'watts', 'lifeH', 'residualPct', 'maintH'].forEach(function (id) {
    $(id).addEventListener('input', function () { $('printerPreset').value = 'custom'; });
  });

  function quoteText() {
    if (!last) return '';
    var h = Math.floor(last.hours), m = Math.round((last.hours - h) * 60);
    var lines = [];
    lines.push('*Orçamento — Hadouken 3D*');
    if (last.name) lines.push('Peça: ' + last.name);
    lines.push('Quantidade: ' + last.qty);
    lines.push('Tempo de impressão (placa): ' + h + 'h' + (m ? String(m).padStart(2, '0') : ''));
    lines.push('Valor por peça: ' + money(last.unit));
    if (last.qty > 1) lines.push('Valor total: ' + money(last.total));
    return lines.join('\n');
  }
  $('btnCopy').addEventListener('click', function () {
    var t = quoteText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('Orçamento copiado!'); }, fallbackCopy.bind(null, t));
    } else fallbackCopy(t);
  });
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Orçamento copiado!'); } catch (e) { toast('Não foi possível copiar'); }
    document.body.removeChild(ta);
  }
  $('btnWhats').addEventListener('click', function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(quoteText()), '_blank', 'noopener');
  });

  load();
  renderFils();
  calc();
})();