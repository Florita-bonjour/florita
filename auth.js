(async function() {
  var SUPABASE_URL = 'https://ipflegbroqefhbucbnrv.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iXkEAv5hsTgtaqSuza7maA_E17o44dl';
  window.floritaSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var result = await window.floritaSb.auth.getSession();
  if (!result.data.session) {
    window.location.href = 'login.html';
  }
})();
