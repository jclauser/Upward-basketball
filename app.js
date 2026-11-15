(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var form = document.getElementById('app');
  var sections = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var TOTAL = sections.length;
  var LABELS = ['About you', 'Background', 'Preferences', 'Availability', 'Faith & review'];
  var DAYS = ['Mon', 'Tue', 'Thu', 'Fri'];
  var TIMES = ['4:30', '5:30', '6:30', '7:30'];
  var MAX_CANT = 10;
  var current = 1;
  var startedAt = Date.now();
  var submitting = false;

  var $ = function (id) { return document.getElementById(id); };
  function h(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // ---------- setup ----------
  if (CFG.ORG_NAME) {
    $('orgName').textContent = CFG.ORG_NAME;
    document.title = 'Volunteer Application | ' + CFG.ORG_NAME;
  }
  if (!CFG.ENDPOINT_URL) $('testBanner').hidden = false;

  function buildStepper() {
    var ol = $('stepper');
    ol.textContent = '';
    LABELS.forEach(function (label, i) {
      var n = i + 1;
      var li = h('li', { 'class': (n <= current ? 'on ' : '') + (n === current ? 'cur' : '') }, [
        h('div', { 'class': 'bar' }),
        h('div', { 'class': 'lab', text: n + '. ' + label })
      ]);
      if (n === current) li.setAttribute('aria-current', 'step');
      ol.appendChild(li);
    });
  }

  function buildGrid() {
    var g = $('grid');
    g.appendChild(h('div'));
    DAYS.forEach(function (d) { g.appendChild(h('div', { 'class': 'hd', text: d })); });
    TIMES.forEach(function (t) {
      g.appendChild(h('div', { 'class': 'tm', text: t + ' pm' }));
      DAYS.forEach(function (d) {
        var value = d + ' ' + t + ' pm';
        var input = h('input', { type: 'checkbox', name: 'cant', value: value, 'aria-label': value + ', cannot practice' });
        g.appendChild(h('label', { 'class': 'cell' }, [
          input,
          h('span', { 'class': 'yes', 'aria-hidden': 'true', text: 'Open' }),
          h('span', { 'class': 'no', 'aria-hidden': 'true', text: 'Cannot' })
        ]));
      });
    });
  }

  var kidCount = 0;
  function addKid() {
    if (kidCount >= 3) return;
    kidCount += 1;
    var n = kidCount;
    var grade = h('select', { name: 'kidGrade', id: 'kg' + n });
    ['K', '1st', '2nd', '3rd', '4th', '5th', '6th'].forEach(function (g) { grade.appendChild(h('option', { text: g })); });
    var row = h('div', { 'class': 'kid' }, [
      h('div', { 'class': 'field' }, [h('label', { 'for': 'kn' + n, text: 'Child ' + n + ' name' }), h('input', { type: 'text', name: 'kidName', id: 'kn' + n })]),
      h('div', { 'class': 'field sm' }, [h('label', { 'for': 'kg' + n, text: 'Grade' }), grade]),
      h('label', { 'class': 'opt' }, [h('input', { type: 'checkbox', name: 'kidCoach' }), document.createTextNode('Wants me to coach')])
    ]);
    $('kids').appendChild(row);
    if (kidCount >= 3) $('addKid').hidden = true;
  }

  // ---------- data ----------
  function collect() {
    var fd = new FormData(form);
    var one = function (k) { return (fd.get(k) || '').toString().trim(); };
    var all = function (k) { return fd.getAll(k).map(String); };
    var roles = all('roles');
    var isRef = roles.indexOf('Referee') !== -1;
    var faith = one('faith');
    var kids = Array.prototype.slice.call(form.querySelectorAll('.kid')).map(function (r) {
      return {
        name: r.querySelector('[name=kidName]').value.trim(),
        grade: r.querySelector('[name=kidGrade]').value,
        wantsMeToCoach: r.querySelector('[name=kidCoach]').checked
      };
    }).filter(function (k) { return k.name; });
    return {
      roles: roles,
      firstName: one('firstName'), lastName: one('lastName'),
      email: one('email'), phone: one('phone'),
      address: one('address'), city: one('city'), zip: one('zip'),
      birthYear: one('birthYear'), sex: one('sex'),
      smsOptIn: one('smsOptIn') === 'Yes',
      knowledge: one('knowledge'), shirtSize: one('shirtSize'), shirtStyle: one('shirtStyle'),
      attendsChurch: one('attendsChurch'),
      churchName: one('attendsChurch') === 'Yes' ? one('churchName') : '',
      servedBefore: all('servedBefore'),
      children: kids,
      divisions: all('divisions'),
      divisionNoPreference: one('divNoPref') === 'Yes',
      refereeTime: isRef ? one('refTime') : '',
      refereeFullCourt: isRef ? one('fullCourt') : '',
      cannotPractice: all('cant'),
      wednesday430: one('wed'),
      noConflicts: one('noConflicts') === 'Yes',
      preferEarly: one('preferEarly') === 'Yes',
      preferFriday: one('preferFriday') === 'Yes',
      faithAnswer: faith,
      faithStatement: faith && faith !== 'No' ? one('faithStatement') : ''
    };
  }

  // ---------- validation ----------
  var thisYear = new Date().getFullYear();
  var req = function (v) { return !!v; };
  var RULES = {
    1: [
      ['roles', function (d) { return d.roles.length > 0; }, 'Choose Coach, Referee, or both.'],
      ['firstName', function (d) { return req(d.firstName); }, 'Enter your first name.'],
      ['lastName', function (d) { return req(d.lastName); }, 'Enter your last name.'],
      ['email', function (d) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email); }, 'Enter a valid email address.'],
      ['phone', function (d) { return d.phone.replace(/\D/g, '').length >= 10; }, 'Enter a 10-digit phone number.'],
      ['address', function (d) { return req(d.address); }, 'Enter your street address.'],
      ['city', function (d) { return req(d.city); }, 'Enter your city.'],
      ['zip', function (d) { return /^\d{5}(-\d{4})?$/.test(d.zip); }, 'Enter a 5-digit zip code.'],
      ['birthYear', function (d) { var y = +d.birthYear; return /^\d{4}$/.test(d.birthYear) && y >= 1920 && y <= thisYear - 14; }, 'Enter a 4-digit birth year.'],
      ['sex', function (d) { return req(d.sex); }, 'Choose one.']
    ],
    2: [
      ['knowledge', function (d) { return req(d.knowledge); }, 'Choose a level.'],
      ['shirtSize', function (d) { return req(d.shirtSize); }, 'Choose a size.'],
      ['shirtStyle', function (d) { return req(d.shirtStyle); }, 'Choose a style.'],
      ['attendsChurch', function (d) { return req(d.attendsChurch); }, 'Choose Yes or No.'],
      ['churchName', function (d) { return d.attendsChurch !== 'Yes' || req(d.churchName); }, 'Enter your church name.']
    ],
    3: [
      ['refTime', function (d) { return d.roles.indexOf('Referee') === -1 || req(d.refereeTime); }, 'Choose a time.'],
      ['fullCourt', function (d) { return d.roles.indexOf('Referee') === -1 || req(d.refereeFullCourt); }, 'Choose Yes or No.']
    ],
    4: [
      ['wed', function (d) { return req(d.wednesday430); }, 'Choose Yes or No.']
    ],
    5: [
      ['faith', function (d) { return req(d.faithAnswer); }, 'Choose one.'],
      ['faithStatement', function (d) { return d.faithAnswer === 'No' || !!d.faithStatement; }, 'Please share a few words.']
    ]
  };

  function clearErrors(section) {
    Array.prototype.forEach.call(section.querySelectorAll('.err'), function (e) { e.remove(); });
    Array.prototype.forEach.call(section.querySelectorAll('.invalid'), function (e) { e.classList.remove('invalid'); });
  }

  function validateStep(n) {
    var section = sections[n - 1];
    clearErrors(section);
    var d = collect();
    var firstBad = null;
    RULES[n].forEach(function (r) {
      var wrap = section.querySelector('[data-field="' + r[0] + '"]');
      if (!wrap || wrap.hidden) return;
      if (!r[1](d)) {
        wrap.classList.add('invalid');
        wrap.appendChild(h('p', { 'class': 'err', role: 'alert', text: r[2] }));
        if (!firstBad) firstBad = wrap;
      }
    });
    if (firstBad) {
      var focusable = firstBad.querySelector('input,select,textarea');
      if (focusable) focusable.focus();
      return false;
    }
    return true;
  }

  // ---------- conditional UI ----------
  function sync() {
    var d = collect();
    $('churchNameWrap').hidden = d.attendsChurch !== 'Yes';
    var isRef = d.roles.indexOf('Referee') !== -1;
    $('refSection').hidden = !isRef;
    $('refNote').hidden = isRef;
    $('faithWrap').hidden = d.faithAnswer === 'No';
    $('faithCount').textContent = $('faithStatement').value.length;
    var n = d.cannotPractice.length;
    var c = $('counter');
    c.textContent = n + ' of ' + MAX_CANT + ' marked';
    c.classList.toggle('full', n >= MAX_CANT);
    var boxes = form.querySelectorAll('input[name=cant]');
    Array.prototype.forEach.call(boxes, function (b) {
      b.disabled = d.noConflicts || (!b.checked && n >= MAX_CANT);
    });
  }

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'cant') {
      var n = form.querySelectorAll('input[name=cant]:checked').length;
      if (t.checked && n > MAX_CANT) { t.checked = false; $('capMsg').hidden = false; }
      else $('capMsg').hidden = true;
    }
    if (t.id === 'noConflicts' && t.checked) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name=cant]:checked'), function (b) { b.checked = false; });
      $('capMsg').hidden = true;
    }
    sync();
  });
  form.addEventListener('input', function (e) { if (e.target.id === 'faithStatement') sync(); });

  // ---------- review ----------
  function yn(b) { return b ? 'Yes' : 'No'; }
  function list(a) { return a.length ? a.join(', ') : 'None'; }
  function renderReview() {
    var d = collect();
    var box = $('review');
    box.textContent = '';
    var groups = [
      [1, 'About you', [
        ['Volunteering as', list(d.roles)], ['Name', d.firstName + ' ' + d.lastName], ['Email', d.email], ['Phone', d.phone],
        ['Address', d.address + ', ' + d.city + ' ' + d.zip], ['Birth year', d.birthYear], ['Sex', d.sex], ['Text updates', yn(d.smsOptIn)]]],
      [2, 'Background', [
        ['Basketball knowledge', d.knowledge], ['Shirt', d.shirtSize + ', ' + d.shirtStyle],
        ['Attends church', d.attendsChurch + (d.churchName ? ' (' + d.churchName + ')' : '')], ['Served before', list(d.servedBefore)],
        ['Children', d.children.length ? d.children.map(function (k) { return k.name + ' (' + k.grade + ')' + (k.wantsMeToCoach ? ', wants me to coach' : ''); }).join('; ') : 'None listed']]],
      [3, 'Preferences', [
        ['Divisions', d.divisionNoPreference ? 'No preference' : list(d.divisions)]
      ].concat(d.roles.indexOf('Referee') !== -1 ? [['Referee time', d.refereeTime], ['Full-court games', d.refereeFullCourt]] : [])],
      [4, 'Availability', [
        ['Cannot practice', d.noConflicts ? 'No conflicts' : list(d.cannotPractice)], ['Wednesday 4:30 pm', d.wednesday430],
        ['Prefers', [d.preferEarly ? 'early practices' : '', d.preferFriday ? 'Fridays' : ''].filter(Boolean).join(', ') || 'No preference']]]
    ];
    groups.forEach(function (g) {
      var dl = h('dl');
      g[2].forEach(function (row) { dl.appendChild(h('dt', { text: row[0] })); dl.appendChild(h('dd', { text: row[1] })); });
      var edit = h('button', { type: 'button', 'class': 'link', 'data-edit': String(g[0]), text: 'Edit' });
      box.appendChild(h('div', { 'class': 'review-group' }, [h('header', {}, [h('span', { text: g[1] }), edit]), dl]));
    });
  }
  $('review').addEventListener('click', function (e) {
    var n = e.target.getAttribute && e.target.getAttribute('data-edit');
    if (n) go(+n);
  });

  // ---------- navigation ----------
  function go(n) {
    current = n;
    sections.forEach(function (s, i) { s.hidden = (i + 1) !== n; });
    $('backBtn').hidden = n === 1;
    $('nextBtn').textContent = n === TOTAL ? 'Submit application' : 'Continue';
    $('submitError').hidden = true;
    buildStepper();
    if (n === TOTAL) renderReview();
    sync();
    var hd = sections[n - 1].querySelector('h2');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (hd) hd.focus({ preventScroll: true });
  }
  $('backBtn').addEventListener('click', function () { if (current > 1) go(current - 1); });
  $('addKid').addEventListener('click', addKid);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateStep(current)) return;
    if (current < TOTAL) { go(current + 1); return; }
    submit();
  });

  // ---------- submit ----------
  function showDone(opts) {
    form.hidden = true;
    $('stepper').hidden = true;
    $('done').hidden = false;
    $('doneTitle').textContent = 'Thank you, ' + opts.first + '!';
    $('doneMsg').textContent = opts.testMode
      ? 'Test mode: your answers were not sent anywhere. This is the data that would be saved:'
      : 'Your application was received. Reference number: ' + opts.id + '. We will be in touch by email.';
    if (opts.testMode) { $('payload').hidden = false; $('payload').textContent = JSON.stringify(opts.data, null, 2); }
    window.scrollTo({ top: 0 });
    $('doneTitle').focus();
  }

  function fail(msg) {
    var box = $('submitError');
    box.textContent = msg;
    box.hidden = false;
    submitting = false;
    $('nextBtn').disabled = false;
    $('nextBtn').textContent = 'Submit application';
  }

  function submit() {
    // re-check every step so nothing slips through
    for (var n = 1; n <= TOTAL; n++) {
      if (!validateStep(n)) { go(n); validateStep(n); return; }
    }
    var data = collect();
    data.website = form.elements.website.value;       // honeypot, must stay empty
    data.elapsedMs = Date.now() - startedAt;
    data.clientTime = new Date().toISOString();

    if (data.website) { showDone({ first: data.firstName, id: 'N/A' }); return; }  // bots get a fake success

    submitting = true;
    $('nextBtn').disabled = true;
    $('nextBtn').textContent = 'Submitting…';

    if (!CFG.ENDPOINT_URL) { submitting = false; showDone({ testMode: true, first: data.firstName, data: data }); return; }

    fetch(CFG.ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    }).then(function (res) { return res.json(); }).then(function (out) {
      if (out && out.ok) showDone({ first: data.firstName, id: out.id });
      else fail('We could not save your application: ' + ((out && out.error) || 'unknown error') + '. Please try again.');
    }).catch(function () {
      fail('We could not confirm that your application was saved. Please check your connection and try again. If you try twice, we will remove any duplicate.');
    });
  }

  $('againBtn').addEventListener('click', function () { window.location.reload(); });

  // ---------- go ----------
  buildGrid();
  addKid();
  go(1);
})();
