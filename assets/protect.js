/* ============================================================
   Защита прототипа от копирования (protect.js)
   Что делает:
   • запрещает выделение и копирование текста (Ctrl+C, контекстное меню);
   • запрещает перетаскивание изображений;
   • блокирует «горячие клавиши»: Ctrl/Cmd+U (код страницы),
     Ctrl/Cmd+S (сохранение), Ctrl/Cmd+P (печать), F12,
     Ctrl/Cmd+Shift+I/J/C — инструменты разработчика;
   • размывает и скрывает контент, когда окно теряет фокус
     (инструменты снимков экрана) и когда замечены открытые
     инструменты разработчика (по эвристике размеров окна);
   • кладёт водяной знак с ID сессии поверх всей страницы —
     любой снимок экрана получает пометку;
   • при печати выводит только короткое сообщение.
   Подключается после assets/app.js:
     <script src="assets/protect.js" defer></script>
   ============================================================ */
(function () {
  'use strict';

  /* --- ID сессии для водяного знака: один на вкладку --- */
  var sid = null;
  try {
    sid = sessionStorage.getItem('pt-sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 6).toUpperCase() +
            Math.random().toString(36).slice(2, 6).toUpperCase();
      sessionStorage.setItem('pt-sid', sid);
    }
  } catch (e) {
    sid = 'PROTECT';
  }

  /* --- Водяной знак: SVG-плитка, ставится фоном на прозрачный слой --- */
  function addWatermark() {
    var label = 'ПРОТОТИП \u00B7 ПОМЕЩЕНИЯ \u00B7 ' + sid;
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>" +
      "<g transform='rotate(-22 160 100)' fill='rgba(25,25,28,0.055)' font-family='Arial,sans-serif' font-size='13' font-weight='600'>" +
      "<text x='10' y='80'>" + label + "</text>" +
      "<text x='170' y='170'>" + label + "</text>" +
      "</g></svg>";
    var el = document.createElement('div');
    el.className = 'pt-wm';
    el.setAttribute('aria-hidden', 'true');
    el.style.backgroundImage = "url(\"data:image/svg+xml," + encodeURIComponent(svg) + "\")";
    (document.body || document.documentElement).appendChild(el);
  }

  /* --- Всплывающее уведомление --- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pt-toast';
      toastEl.setAttribute('role', 'status');
      (document.body || document.documentElement).appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1800);
  }

  /* --- «Пелена»: скрытие контента --- */
  var veil = null;
  function ensureVeil() {
    if (!veil) {
      veil = document.createElement('div');
      veil.className = 'pt-veil';
      veil.hidden = true;
      veil.textContent = 'Контент скрыт: копирование и снимки экрана отключены.';
      (document.body || document.documentElement).appendChild(veil);
    }
    return veil;
  }
  var veilTimer = null;
  function veilOn(temp) {
    var v = ensureVeil();
    v.hidden = false;
    clearTimeout(veilTimer);
    if (temp) {
      /* временная пелена — например, при потере фокуса на 3 секунды */
      veilTimer = setTimeout(function () { v.hidden = true; }, 3000);
    }
  }
  function veilOff() {
    if (veil) { veil.hidden = true; }
    clearTimeout(veilTimer);
  }

  /* --- Контекстное меню --- */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    toast('Контекстное меню отключено');
  });

  /* --- Выделение и копирование --- */
  function inField(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  document.addEventListener('selectstart', function (e) {
    if (inField(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener('copy', function (e) {
    if (inField(e.target)) return; /* в полях — свои данные */
    e.preventDefault();
    toast('Копирование текста отключено');
  });
  document.addEventListener('cut', function (e) {
    if (inField(e.target)) return;
    e.preventDefault();
    toast('Копирование текста отключено');
  });
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
  });

  /* --- Горячие клавиши --- */
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    if (!mod && k !== 'f12' && k !== 'printscreen') return;

    /* F12 — инструменты разработчика */
    if (k === 'f12') {
      e.preventDefault();
      veilOn(true);
      toast('Инструменты разработчика отключены');
      return;
    }
    if (!mod) return;

    /* Ctrl/Cmd+Shift+I, J, C — инструменты разработчика */
    if (e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) {
      e.preventDefault();
      veilOn(true);
      toast('Инструменты разработчика отключены');
      return;
    }
    /* Ctrl/Cmd+U — просмотр кода страницы */
    if (k === 'u') {
      e.preventDefault();
      toast('Просмотр кода отключён');
      return;
    }
    /* Ctrl/Cmd+S — сохранение страницы */
    if (k === 's') {
      e.preventDefault();
      toast('Сохранение страницы отключено');
      return;
    }
    /* Ctrl/Cmd+P — печать */
    if (k === 'p') {
      e.preventDefault();
      toast('Печать отключена');
      return;
    }
    /* Ctrl/Cmd+A — выделить всё */
    if (k === 'a' && !inField(e.target)) {
      e.preventDefault();
      toast('Выделение отключено');
      return;
    }
    /* Ctrl/Cmd+C — копирование (вне полей ввода) */
    if (k === 'c' && !inField(e.target)) {
      e.preventDefault();
      toast('Копирование текста отключено');
    }
  }, true);

  /* Печать через меню браузера */
  window.addEventListener('beforeprint', function () { veilOn(false); });
  window.addEventListener('afterprint', veilOff);

  /* --- Скрытие при потере фокуса (инструменты снимков экрана) --- */
  var hadFocus = true;
  window.addEventListener('blur', function () {
    hadFocus = false;
    veilOn(false); /* уберётся, когда окно снова в фокусе */
  });
  window.addEventListener('focus', function () {
    hadFocus = true;
    veilOff();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) veilOn(false);
    else if (hadFocus) veilOff();
  });

  /* --- Эвристика открытых инструментов разработчика ---
     DevTools обычно ужимает область страницы сбоку или снизу
     на заметную величину. Ложные срабатывания возможны при
     узких панелях браузера — тогда тоже скроем. */
  function devtoolsOpen() {
    var w = window.outerWidth - window.innerWidth;
    var h = window.outerHeight - window.innerHeight;
    return (w > 180 && window.innerWidth < window.outerWidth - 100) ||
           (h > 180 && window.innerHeight < window.outerHeight - 100);
  }
  setInterval(function () {
    if (devtoolsOpen()) veilOn(false);
    else if (hadFocus) veilOff();
  }, 1000);

  /* --- Старт --- */
  function init() {
    addWatermark();
    ensureVeil();
    document.addEventListener('keydown', function (e) {
      /* PrintScreen не отменяется браузером — хотя бы чистим буфер,
         насколько это возможно, и прячем контент немедленно */
      if (e.key === 'PrintScreen') {
        veilOn(false);
        var r = document.getSelection ? document.getSelection() : null;
        if (r && r.removeAllRanges) r.removeAllRanges();
        toast('Снимки экрана защищены водяным знаком');
        setTimeout(veilOff, 4000);
      }
    });
  }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
