exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Clé API manquante côté serveur' }) };
  }
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête invalide' }) };
  }
  const { destination = '', notes = '', measures = [], trame = '', sexe = '' } = body;
  let userContent = 'Génère un compte rendu d\'évaluation ergothérapique professionnel en français à partir des données suivantes :\n\n';
  if (sexe === 'homme') userContent += 'ANONYMISATION : Remplacer tout nom ou prénom du patient par "Monsieur". Utiliser "il" dans le texte. Ne jamais écrire le nom du patient.\n\n';
  else if (sexe === 'femme') userContent += 'ANONYMISATION : Remplacer tout nom ou prénom du patient par "Madame". Utiliser "elle" dans le texte. Ne jamais écrire le nom du patient.\n\n';
  else userContent += 'ANONYMISATION : Remplacer tout nom ou prénom du patient par §§Monsieur/Madame§§. Ne jamais écrire le nom du patient.\n\n';
  if (destination) userContent += `Destination / objectif : ${destination}\n\n`;
  if (notes)       userContent += `Observations cliniques :\n${notes}\n\n`;
  if (measures.length) {
    userContent += 'Mesures relevées :\n';
    measures.forEach(({ label, value }) => {
      userContent += `- ${label || '—'} : ${value ? value + ' cm' : '—'}\n`;
    });
    userContent += '\n';
  }
  if (trame) {
    userContent += `\nComplète la trame suivante en renseignant chaque rubrique à partir des informations ci-dessus. Conserve exactement les titres et la structure. Si une information manque, écris À compléter par l'ergothérapeute.\n\nTRAME :\n${trame}`;
  } else {
    userContent += 'Rédige un compte rendu structuré, clinique et professionnel. Utilise uniquement du texte courant (pas de markdown, pas de listes à puces). Chaque paragraphe thématique doit être séparé par une ligne vide. Ne génère pas de titre général ni d\'en-tête.';
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: 'Tu es un assistant spécialisé en ergothérapie. Tu remplis une trame de compte rendu à partir des notes brutes. RÈGLES : 1) Tu n\'inventes rien qui ne soit pas dans les notes. 2) Si une information manque pour une section, encadre le contenu avec §§ et §§, ex : §§À compléter par l\'ergothérapeute§§. 3) Reformule en langage professionnel sans ajouter de contenu. 4) Termes interdits : chutogène (utiliser : risque de chute) ; glissance (utiliser : risque de chute ou surface glissante). 5) Commence par BROUILLON. 6) ANONYMISATION OBLIGATOIRE : ne jamais écrire le nom ni le prénom du patient dans le compte rendu. Utiliser Monsieur ou Madame selon le sexe indiqué, et les pronoms il ou elle.',
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.error?.message || `Erreur HTTP ${response.status}` }),
      };
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};