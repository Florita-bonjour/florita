(function () {
  var LOGO_SVG =
    '<svg width="40" height="25" viewBox="0 0 48 30" aria-hidden="true">' +
    '<path d="M2,28 A22,22 0 0,1 46,28" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M7,28 A17,17 0 0,1 41,28" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M12,28 A12,12 0 0,1 36,28" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M17,28 A7,7 0 0,1 31,28" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M22,28 A2,2 0 0,1 26,28" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.5" stroke-linecap="round"/>' +
    '</svg>';

  var NAV = [
    {
      href: 'dashboard.html', label: 'Tableau de bord',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    },
    {
      href: 'formulaire.html', label: 'Nouveau CR',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    },
    {
      href: 'historique.html', label: 'Historique',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
    },
    {
      href: 'trames.html', label: 'Mes trames',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    },
    {
      href: 'profil.html', label: 'Profil',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    },
  ];

  // Resolve which nav item is active for the current page
  var page = location.pathname.split('/').pop() || 'dashboard.html';
  var activeHref = { 'index.html': 'formulaire.html', 'trames-edit.html': 'trames.html' }[page] || page;
  var isAide = page === 'aide.html';

  var navHTML = NAV.map(function (item) {
    var cls = item.href === activeHref ? ' class="active"' : '';
    return '<a href="' + item.href + '"' + cls + '>' + item.svg + '<span>' + item.label + '</span></a>';
  }).join('');

  var el = document.getElementById('sidebar');
  if (!el) return;

  el.innerHTML =
    '<a href="dashboard.html" class="sidebar-logo">' + LOGO_SVG +
      '<div class="name">florita<span>.</span></div>' +
    '</a>' +
    '<nav class="nav">' + navHTML + '</nav>' +
    '<div class="sidebar-bottom">' +
      '<div class="sidebar-sep"></div>' +
      '<a href="aide.html" class="sidebar-aide' + (isAide ? ' active' : '') + '">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<span>Aide</span>' +
      '</a>' +
      '<button class="logout-btn" id="logout">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span>Déconnexion</span>' +
      '</button>' +
    '</div>';

  document.getElementById('logout').addEventListener('click', function () {
    var sb = window.floritaSb;
    if (!sb && window.supabase) {
      sb = window.supabase.createClient(
        'https://ipflegbroqefhbucbnrv.supabase.co',
        'sb_publishable_iXkEAv5hsTgtaqSuza7maA_E17o44dl'
      );
    }
    if (sb) {
      sb.auth.signOut().then(function () { window.location.href = 'login.html'; });
    } else {
      window.location.href = 'login.html';
    }
  });
})();
