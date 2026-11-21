/* Прототип: поведение страниц. В WordPress то же самое делают
   блок «Вкладки», блок «Подробности», модальное окно темы и плагины фильтров и подтверждения номера. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var AUTH = 'pm-auth', ADS = 'pm-ads';
  function authed() { return store.get(AUTH) === '1'; }
  function logout() { store.del(AUTH); location.reload(); }

  /* --- вкладки --- */
  function initTabs(root) {
    var tabs = $$('[role=tab]', root);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function act(i, focus) {
      tabs.forEach(function (t, j) {
        t.setAttribute('aria-selected', String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        if (panels[j]) panels[j].hidden = j !== i;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { act(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); act((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); act((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    var h = location.hash.slice(1);
    var idx = -1;
    tabs.forEach(function (t, i) { if (t.dataset.hash === h) idx = i; });
    act(idx > -1 ? idx : 0);
  }
  $$('[data-tabs]').forEach(initTabs);

  /* --- «Ещё параметры» --- */
  $$('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = document.getElementById(b.getAttribute('aria-controls'));
      var open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      if (t) t.hidden = !open;
    });
  });

  /* --- окна: «Что вы хотите сделать?», «Что вы ищете?», «Что вы сдаёте?», жалоба --- */
  var lastFocus = null;
  function openDlg(d) {
    if (!d) return;
    if (!lastFocus) lastFocus = document.activeElement;
    d.hidden = false;
    document.body.classList.add('no-scroll');
    var c = $('.modal__close', d); if (c) c.focus();
  }
  function closeDlg(d, keepFocus) {
    if (!d || d.hidden) return;
    d.hidden = true;
    if (d.id === 'choose') store.set('pm-choose', String(Date.now()));
    var anyOpen = $$('.modal').some(function (m) { return !m.hidden; });
    if (!anyOpen) {
      document.body.classList.remove('no-scroll');
      if (!keepFocus && lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    }
  }
  $$('.modal').forEach(function (d) {
    d.addEventListener('mousedown', function (e) { if (e.target === d) closeDlg(d); });
    $$('[data-close]', d).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); closeDlg(d); });
    });
  });
  $$('[data-open]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var parent = b.closest('.modal');
      if (parent) closeDlg(parent, true);
      openDlg(document.getElementById(b.dataset.open));
    });
  });
  document.addEventListener('keydown', function (e) {
    var d = $$('.modal').filter(function (m) { return !m.hidden; })[0];
    if (!d) return;
    if (e.key === 'Escape') { closeDlg(d); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href],button:not([disabled]),select,textarea,input', d);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  /* Окно на главной показываем один раз, через несколько секунд. Чтобы отключить автопоказ, уберите этот блок. */
  var choose = $('#choose');
  if (choose && !store.get('pm-choose')) {
    setTimeout(function () { if (!$$('.modal').some(function (m) { return !m.hidden; })) openDlg(choose); }, 9000);
  }

  /* --- cookie: тонкая полоса внизу, запоминаем выбор --- */
  var ck = $('.cookie');
  if (ck) {
    if (!store.get('pm-cookie')) { ck.hidden = false; document.body.classList.add('has-cookie'); }
    $$('[data-cookie]', ck).forEach(function (b) {
      b.addEventListener('click', function () {
        store.set('pm-cookie', b.dataset.cookie);
        ck.hidden = true; document.body.classList.remove('has-cookie');
      });
    });
  }

  /* --- каталог: фильтры, сортировка, «Показать ещё» --- */
  var KEYS = {
    'высота': /высота\s*(\d+(?:[.,]\d+)?)/,
    'пол': /пол\s*(\d+(?:[.,]\d+)?)/,
    'мощность': /мощность\s*(\d+(?:[.,]\d+)?)/
  };
  function num(v) {
    var n = parseFloat(String(v || '').replace(/[\s ]/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function countWord(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'предложение';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'предложения';
    return 'предложений';
  }

  $$('[data-catalog]').forEach(function (cat) {
    var form = $('[data-filter-form]', cat);
    var list = $('[data-cards]', cat);
    var cards = $$('.card', list);
    var counter = $('[data-count]', cat);
    var empty = $('[data-empty]', cat);
    var moreBtn = $('[data-more-btn]', cat);
    var sortSel = $('[data-sort]', cat);
    var moreOpen = false;

    function read() {
      var f = {};
      if (!form) return f;
      var g = function (n) { var e = form.elements[n]; return e ? e.value : ''; };
      f.city = g('city'); f.who = g('who');
      f.amin = num(g('area-min')); f.amax = num(g('area-max'));
      f.pmin = num(g('price-min')); f.pmax = num(g('price-max'));
      f.extra = [];
      $$('[data-f]', form).forEach(function (el) {
        var kind = el.dataset.f;
        if (kind === 'min') { var v = num(el.value); if (v !== null) f.extra.push({ k: 'min', key: el.dataset.key, v: v }); }
        else if (kind === 'kw') {
          if (el.type === 'checkbox') { if (el.checked) f.extra.push({ k: 'kw', v: el.dataset.kw }); }
          else if (el.value) f.extra.push({ k: 'kw', v: el.value });
        } else if (kind === 'tag') { if (el.value) f.extra.push({ k: 'tag', v: el.value }); }
      });
      return f;
    }
    function active(f) {
      return !!(f.city || f.who || f.amin !== null || f.amax !== null || f.pmin !== null || f.pmax !== null || (f.extra && f.extra.length));
    }
    function match(c, f) {
      var d = c.dataset, area = +d.area, price = +d.price, feat = d.feat || '';
      if (f.city && d.city !== f.city) return false;
      if (f.who && d.who !== f.who) return false;
      if (f.amin !== null && area < f.amin) return false;
      if (f.amax !== null && area > f.amax) return false;
      if (f.pmin !== null && price < f.pmin) return false;
      if (f.pmax !== null && price > f.pmax) return false;
      for (var i = 0; i < (f.extra || []).length; i++) {
        var x = f.extra[i];
        if (x.k === 'tag' && d.tag !== x.v) return false;
        if (x.k === 'kw' && !new RegExp(x.v, 'i').test(feat)) return false;
        if (x.k === 'min') {
          var re = KEYS[x.key], m = re && re.exec(feat);
          if (!m || parseFloat(m[1].replace(',', '.')) < x.v) return false;
        }
      }
      return true;
    }
    function apply() {
      var f = read(), filtering = active(f), n = 0, hasMore = false;
      cards.forEach(function (c) {
        var ok = match(c, f);
        var isMore = c.dataset.more === '1';
        if (isMore && ok && !moreOpen && !filtering) hasMore = true;
        var vis = ok && (!isMore || moreOpen || filtering);
        c.hidden = !vis;
        if (vis) n++;
      });
      if (counter) counter.textContent = 'Найдено ' + n + ' ' + countWord(n);
      if (empty) empty.hidden = n !== 0;
      if (moreBtn) moreBtn.parentNode.hidden = !hasMore;
    }
    function sort() {
      var v = sortSel ? sortSel.value : 'new';
      var arr = cards.slice().sort(function (a, b) {
        if (v === 'asc') return a.dataset.price - b.dataset.price;
        if (v === 'desc') return b.dataset.price - a.dataset.price;
        return a.dataset.idx - b.dataset.idx;
      });
      arr.forEach(function (c) { list.appendChild(c); });
    }

    if (form) {
      form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
      form.addEventListener('reset', function () { setTimeout(apply, 0); });
      $$('select,input[type=checkbox]', form).forEach(function (el) { el.addEventListener('change', apply); });
    }
    if (sortSel) sortSel.addEventListener('change', function () { sort(); apply(); });
    if (moreBtn) moreBtn.addEventListener('click', function () { moreOpen = true; apply(); });
    var rs = $('[data-reset]', cat);
    if (rs) rs.addEventListener('click', function () { if (form) form.reset(); apply(); });
    apply();
  });

  /* --- простые формы-макеты: показываем ответ вместо отправки --- */
  $$('form[data-demo]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('[data-demo-done]', f); if (m) m.hidden = false;
    });
  });

  /* --- объявление: галерея, телефон --- */
  $$('[data-gal-thumb]').forEach(function (b) {
    b.addEventListener('click', function () {
      var main = $('[data-gal-main]');
      if (main) { main.src = b.dataset.src; main.alt = b.dataset.alt || ''; }
      $$('[data-gal-thumb]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    });
  });
  var pb = $('[data-phone-btn]');
  if (pb) {
    pb.addEventListener('click', function () {
      var msg = $('[data-phone-msg]');
      if (authed()) {
        var a = document.createElement('a');
        a.className = pb.className; a.href = 'tel:+79001234567'; a.textContent = '+7 (900) 123-45-67';
        pb.parentNode.replaceChild(a, pb);
        if (msg) { msg.hidden = false; msg.className = 'msg msg--ok'; msg.textContent = 'Телефон из макета. Скажите, что нашли объявление на сайте.'; }
      } else if (msg) { msg.hidden = false; }
    });
  }

  /* --- страницы «Сдать»: отправка объявления и предложения арендаторам --- */
  function toAuth() {
    var t = document.querySelector('[role=tab][data-hash="vhod"]'); if (t) t.click();
    var a = document.getElementById('vhod'); if (a) a.scrollIntoView({ block: 'start' });
  }
  var nf = $('#newad-form');
  if (nf) {
    nf.addEventListener('submit', function (e) {
      e.preventDefault();
      var need = $('[data-need-auth]', nf), done = $('[data-newad-done]', nf);
      if (!authed()) { need.hidden = false; done.hidden = true; return; }
      need.hidden = true;
      var ads = []; try { ads = JSON.parse(store.get(ADS) || '[]'); } catch (x) { ads = []; }
      var area = nf.elements.area.value.trim(), city = nf.elements.city.value.trim(), price = nf.elements.price.value.trim();
      ads.unshift({ title: nf.dataset.name + (area ? ', ' + area + ' м²' : ''), city: city || 'Город не указан', price: price, img: nf.dataset.img });
      store.set(ADS, JSON.stringify(ads.slice(0, 10)));
      done.hidden = false;
      nf.reset();
      done.scrollIntoView({ block: 'center' });
    });
  }
  $$('[data-offer]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!authed()) { toAuth(); return; }
      var msg = $('[data-offer-msg]', b.closest('.req')); if (msg) msg.hidden = false;
      b.hidden = true;
    });
  });
  var files = $('[data-files]');
  if (files) files.addEventListener('change', function () {
    var t = $('[data-files-text]');
    if (t) t.textContent = files.files.length ? 'Выбрано файлов: ' + files.files.length : 'Перетащите фото или выберите файлы';
  });

  /* --- кабинет --- */
  var gate = $('[data-gate]');
  if (gate && !authed()) gate.hidden = false;
  var mine = $('#mine-list');
  if (mine) {
    var ads = []; try { ads = JSON.parse(store.get(ADS) || '[]'); } catch (x) { ads = []; }
    ads.slice().reverse().forEach(function (ad) {
      var li = document.createElement('li');
      li.innerHTML = '<img src="assets/img/' + ad.img + '.jpg" alt="" width="112" height="84">' +
        '<div><span class="status status--wait">На проверке</span><h3></h3><p></p><p>Мы проверяем объявление. Статус изменится, когда проверка закончится.</p></div>' +
        '<div class="mine__act"></div>';
      $('h3', li).textContent = ad.title;
      $('p', li).textContent = ad.city + (ad.price ? '. ' + ad.price + ' ₽ в месяц' : '');
      mine.insertBefore(li, mine.firstChild);
    });
  }
  $$('[data-unpublish]').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('li'), st = $('[data-status]', li);
      var off = b.dataset.unpublish !== 'off';
      b.dataset.unpublish = off ? 'off' : '';
      b.textContent = off ? 'Опубликовать снова' : 'Снять с публикации';
      if (st) { st.textContent = off ? 'Снято с публикации' : 'Опубликовано'; st.className = 'status ' + (off ? 'status--off' : 'status--ok'); }
    });
  });
  var delOpen = $('[data-delete-open]');
  if (delOpen) {
    delOpen.addEventListener('click', function () { $('#delete-box').hidden = false; });
    $('[data-delete-no]').addEventListener('click', function () { $('#delete-box').hidden = true; });
    $('[data-delete-yes]').addEventListener('click', function () { $('#delete-box').hidden = true; $('#delete-done').hidden = false; });
  }
  $$('[data-logout]').forEach(function (b) { b.addEventListener('click', logout); });

  /* --- вход и регистрация: номер, код из звонка, готово --- */
  $$('[data-flow]').forEach(function (pane) {
    var form1 = $('.js-phone-form', pane), form2 = $('.js-code-form', pane), done = $('.js-done', pane);
    var phone = $('.js-phone', pane), consent = $('.js-consent', pane), go = $('.js-go', pane);
    var inputs = $$('.code input', pane), codeBox = $('.code', pane), err = $('.js-err', pane);
    var resend = $('.js-resend', pane), bars = $$('.stepper__bars i', pane), stepTxt = $('.js-step-txt', pane);
    var timerId = null;

    function showDone() {
      form1.hidden = true; form2.hidden = true; done.hidden = false;
      if (bars[1]) bars[1].classList.add('on');
      if (stepTxt) stepTxt.textContent = 'Номер подтверждён';
    }
    $('.js-logout', pane).addEventListener('click', logout);
    if (authed()) { showDone(); return; }

    function valid() {
      var d = phone.value.replace(/\D/g, '');
      go.disabled = !(d.length === 11 && (!consent || consent.checked));
    }
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '');
      if (d.charAt(0) === '7' || d.charAt(0) === '8') d = d.slice(1);
      d = d.slice(0, 10);
      var s = '+7';
      if (d.length) s += ' (' + d.slice(0, 3);
      if (d.length >= 3) s += ') ' + d.slice(3, 6);
      if (d.length >= 6) s += '-' + d.slice(6, 8);
      if (d.length >= 8) s += '-' + d.slice(8, 10);
      phone.value = s;
      valid();
    });
    if (consent) consent.addEventListener('change', valid);

    function startTimer() {
      var left = 45;
      resend.disabled = true;
      resend.textContent = 'Позвонить ещё раз через ' + left + ' с';
      clearInterval(timerId);
      timerId = setInterval(function () {
        left--;
        if (left <= 0) { clearInterval(timerId); resend.disabled = false; resend.textContent = 'Позвонить ещё раз'; }
        else resend.textContent = 'Позвонить ещё раз через ' + left + ' с';
      }, 1000);
    }
    resend.addEventListener('click', function () { startTimer(); inputs.forEach(function (i) { i.value = ''; }); inputs[0].focus(); });

    form1.addEventListener('submit', function (e) {
      e.preventDefault();
      if (go.disabled) return;
      form1.hidden = true; form2.hidden = false;
      if (bars[1]) bars[1].classList.add('on');
      if (stepTxt) stepTxt.textContent = 'Шаг 2 из 2: код из звонка';
      $('.js-show', pane).textContent = phone.value;
      inputs.forEach(function (i) { i.value = ''; });
      codeBox.classList.remove('is-bad'); err.hidden = true;
      inputs[0].focus();
      startTimer();
    });

    function check() {
      var code = inputs.map(function (i) { return i.value; }).join('');
      if (code.length < 4) return;
      /* Прототип: код 0000 показывает ошибку, любой другой подходит. */
      if (code === '0000') { codeBox.classList.add('is-bad'); err.hidden = false; return; }
      clearInterval(timerId);
      store.set(AUTH, '1');
      showDone();
    }
    inputs.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
        codeBox.classList.remove('is-bad'); err.hidden = true;
        if (inp.value && inputs[i + 1]) inputs[i + 1].focus();
        check();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
      });
      inp.addEventListener('paste', function (e) {
        var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 4);
        if (!t) return;
        e.preventDefault();
        t.split('').forEach(function (ch, k) { if (inputs[k]) inputs[k].value = ch; });
        check();
      });
    });
    $('.js-change', pane).addEventListener('click', function () {
      clearInterval(timerId);
      form2.hidden = true; form1.hidden = false;
      if (bars[1]) bars[1].classList.remove('on');
      if (stepTxt) stepTxt.textContent = 'Шаг 1 из 2: номер телефона';
      phone.focus();
    });
  });
})();
