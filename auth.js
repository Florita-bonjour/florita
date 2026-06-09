// Auth check — redirige vers login.html si pas connecté
(async function() {
  const SUPABASE_URL = 'https://ipflegbroqefhbucbnrv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_iXkEAv5hsTgtaqSuza7maA_E17o44dl';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
  }
})();
