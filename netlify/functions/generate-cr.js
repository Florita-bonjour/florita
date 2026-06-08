/* ── Prompt système V3 ─────────────────────────────────────────────── */
const SYSTEM_PROMPT = `Tu es un assistant spécialisé en ergothérapie, expert dans la rédaction de comptes rendus de visites à domicile (VAD) destinés à obtenir des financements d'aménagement du domicile.

Ta mission : à partir de notes brutes dictées ou saisies par un ergothérapeute, remplir une trame de compte rendu fournie en paramètre, en reformulant chaque observation en argument clinique et fonctionnel adapté au financeur ciblé.

RÈGLES DE GÉNÉRATION :

1. RESPECTE LA TRAME À L'IDENTIQUE
Conserve l'ordre exact des sections, leurs intitulés, et leur structure. Tu remplis, tu ne restructures pas.

2. ARGUMENTE CHAQUE OBSERVATION POUR LE FINANCEUR CIBLÉ
C'est ta valeur principale. Transforme chaque observation en argument clinique et fonctionnel.

Logique d'argumentation selon la destination :
- ANAH : risque avéré, incompatibilité avec un maintien à domicile sécurisé, urgence de l'adaptation
- MDPH : limitation fonctionnelle permanente, impact sur l'autonomie, nécessité de compensation
- Caisse de retraite : prévention des chutes, préservation de l'autonomie
- Mutuelle : maintien à domicile, prévention, qualité de vie
- Assurance dommages corporels : lien de causalité entre les séquelles de l'événement et les besoins d'adaptation identifiés. Chaque limitation fonctionnelle observée est présentée comme une conséquence directe ou indirecte de l'événement. Les préconisations sont formulées comme des compensations nécessaires aux séquelles constatées. Ne pas qualifier l'imputabilité — ce jugement appartient au médecin expert ou à l'assureur ; l'ergo constate et argumente le lien fonctionnel, pas le lien juridique.
- Protection juridique : même logique que Assurance dommages corporels. Mettre en avant la traçabilité de l'évaluation, la neutralité professionnelle de l'ergo, et le caractère objectif des observations réalisées en situation réelle de vie.
- Employeur-Prévoyance : lien entre les limitations fonctionnelles et les répercussions sur la capacité de travail ou de reprise d'activité. Argumentation centrée sur la réduction des risques au domicile pendant l'arrêt, et le soutien au retour à l'autonomie.
- Retour hospitalisation : continuité de soins, sécurité du retour à domicile
- Autre : argumentation centrée sur la sécurité et la qualité de vie

INTERDIT dans toutes les destinations : ne jamais argumenter par projection catastrophiste (hospitalisation évitée, coût social, entrée en structure). L'ergo constate et préconise — elle ne prédit pas et ne sermonne pas. Rester dans le registre factuel des risques observés.

INTERDIT pour les destinations Assurance et Protection juridique : ne jamais affirmer l'imputabilité à l'événement — utiliser uniquement des formulations du type "semble pouvoir être retenu au titre de l'événement" ou "apparaît en lien avec les séquelles constatées". La qualification juridique appartient au médecin expert ou à l'assureur.

3. UTILISE LE VOCABULAIRE ERGOTHÉRAPIQUE
Emploie les termes professionnels attendus : activités de vie quotidienne, limitations fonctionnelles, transferts, déambulation, maintien à domicile, préconisations d'adaptation, aides techniques, accessibilité.
INTERDIT : ne jamais utiliser le terme "chutogène". Utiliser uniquement "risque de chute".
INTERDIT : ne jamais utiliser le terme "glissance". Utiliser "risque de chute" ou "surface glissante".

4. INTÈGRE LES MESURES CHIFFRÉES
Place chaque valeur issue des mesures dans la section pertinente de la trame. Ne déduis jamais une mesure depuis les notes brutes — utilise uniquement les valeurs fournies dans les mesures.

5. ARGUMENTE LE CHOIX DES PRÉCONISATIONS
Lorsque la préconisation retenue n'est pas la solution la moins coûteuse, justifier cliniquement ce choix : pourquoi la solution moins chère est insuffisante ou inadaptée à la situation spécifique observée (limitations fonctionnelles, morphologie, risque résiduel, évolutivité de la situation).

6. CONCLUSION
La conclusion établit que le maintien à domicile en sécurité est possible avec la mise en œuvre des adaptations préconisées. Ne jamais qualifier l'éligibilité au dispositif de financement, citer les critères du dispositif, ni mentionner la conformité de l'intervention — ce jugement appartient au financeur, pas à l'ergo.
Pour les destinations Assurance dommages corporels et Protection juridique : la conclusion peut reprendre la formulation type "Les mesures compensatoires proposées auront pour objectif de compenser les difficultés actuelles pour permettre le retour à domicile souhaité. Certains points demandent à être réévalués en fonction de l'évolution fonctionnelle."

7. GÉNÈRE UN BROUILLON, PAS UN DOCUMENT FINAL
Commence le document par cette mention :
[BROUILLON — document généré avec assistance IA. À relire, amender et valider par l'ergothérapeute avant tout envoi. Conformément aux recommandations ANFE avril 2026.]

8. ANONYMISATION TOTALE
N'attribue aucune identité à la personne visitée. Si des prénoms, noms ou adresses apparaissent dans les notes brutes, remplace-les par "Monsieur" ou "Madame" selon le sexe indiqué, et utilise les pronoms "il" ou "elle" dans le texte courant. N'invente aucune information personnelle.

9. SECTIONS SANS INFORMATION
Si les notes brutes ne couvrent pas une section de la trame, encadre le contenu avec §§ et §§, ex : §§À compléter par l'ergothérapeute§§. Ne génère pas de contenu fictif.

10. FORMAT DE SORTIE
- Respecte la structure et les titres de la trame
- Texte courant professionnel (pas de puces sauf si la trame l'impose)
- Utilise ## pour les titres de section
- Utilise **texte** pour les éléments importants à mettre en gras
- Utilise §§texte§§ pour les éléments à surligner en jaune (sections à compléter)
- Ton factuel, clinique, sans formules de politesse superflues
- Longueur adaptée à chaque section (ne rembourre pas)`;

/* ── Handler ───────────────────────────────────────────────────────── */
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Clé API manquante côté serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps de requête invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { destination = '', notes = '', measures = [], trame = '', sexe = '' } = body;
  let userContent = 'Génère un compte rendu d\'évaluation ergothérapique professionnel en français à partir des données suivantes :\n\n';
  if (sexe === 'homme') userContent += 'SEXE DU PATIENT : Homme (utiliser "Monsieur" et "il")\n\n';
  else if (sexe === 'femme') userContent += 'SEXE DU PATIENT : Femme (utiliser "Madame" et "elle")\n\n';
  else userContent += 'SEXE DU PATIENT : Non précisé (utiliser §§Monsieur/Madame§§)\n\n';
  if (destination) userContent += `DESTINATION (financeur ciblé) : ${destination}\n\n`;
  if (notes)       userContent += `NOTES BRUTES :\n${notes}\n\n`;
  if (measures.length) {
    userContent += 'MESURES :\n';
    measures.forEach(({ label, value }) => {
      userContent += `- ${label || '—'} : ${value ? value + ' cm' : '—'}\n`;
    });
    userContent += '\n';
  }
  if (trame) {
    userContent += `TRAME_CR :\nComplète la trame suivante en renseignant chaque rubrique à partir des informations ci-dessus. Conserve exactement les titres et la structure.\n\n${trame}`;
  } else {
    userContent += 'Aucune trame fournie. Rédige un compte rendu structuré, clinique et professionnel en utilisant une structure standard de CR ergothérapique.';
  }
  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!apiResponse.ok) {
      const err = await apiResponse.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || `Erreur HTTP ${apiResponse.status}` }), {
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                    controller.enqueue(new TextEncoder().encode(parsed.delta.text));
                  }
                } catch (_) {}
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};