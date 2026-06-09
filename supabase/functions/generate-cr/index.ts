import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const DEST_RULES: Record<string, string> = {
  "ANAH": "Argumentation ANAH : risque avéré, incompatibilité avec un maintien à domicile sécurisé, urgence de l'adaptation.",
  "MDPH": "Argumentation MDPH : limitation fonctionnelle permanente, impact sur l'autonomie, nécessité de compensation.",
  "Caisse de retraite": "Argumentation Caisse de retraite : prévention des chutes, préservation de l'autonomie.",
  "Mutuelle": "Argumentation Mutuelle : maintien à domicile, prévention, qualité de vie.",
  "Assurance dommages corporels": `Argumentation Assurance dommages corporels : lien de causalité entre les séquelles de l'événement et les besoins d'adaptation identifiés. Chaque limitation fonctionnelle observée est présentée comme une conséquence directe ou indirecte de l'événement. Les préconisations sont formulées comme des compensations nécessaires aux séquelles constatées. Ne pas qualifier l'imputabilité — ce jugement appartient au médecin expert ou à l'assureur ; l'ergo constate et argumente le lien fonctionnel, pas le lien juridique.
INTERDIT : ne jamais affirmer l'imputabilité à l'événement — utiliser uniquement des formulations du type "semble pouvoir être retenu au titre de l'événement" ou "apparaît en lien avec les séquelles constatées".`,
  "Protection juridique": `Argumentation Protection juridique : même logique que Assurance dommages corporels. Mettre en avant la traçabilité de l'évaluation, la neutralité professionnelle de l'ergo, et le caractère objectif des observations réalisées en situation réelle de vie.
INTERDIT : ne jamais affirmer l'imputabilité à l'événement — utiliser uniquement des formulations conditionnelles.`,
  "Employeur-Prévoyance": "Argumentation Employeur-Prévoyance : lien entre les limitations fonctionnelles et les répercussions sur la capacité de travail ou de reprise d'activité. Argumentation centrée sur la réduction des risques au domicile pendant l'arrêt, et le soutien au retour à l'autonomie.",
  "Retour hospitalisation": "Argumentation Retour hospitalisation : continuité de soins, sécurité du retour à domicile.",
  "Autre": "Argumentation générale : centrée sur la sécurité et la qualité de vie.",
};

function buildSystemPrompt(destination: string): string {
  const destRule = DEST_RULES[destination] || DEST_RULES["Autre"];
  const isAssurance = destination === "Assurance dommages corporels" || destination === "Protection juridique";

  let conclusionRule = `La conclusion établit que le maintien à domicile en sécurité est possible avec la mise en œuvre des adaptations préconisées. Ne jamais qualifier l'éligibilité au dispositif de financement, citer les critères du dispositif, ni mentionner la conformité de l'intervention.`;
  if (isAssurance) {
    conclusionRule += ` Pour cette destination, la conclusion peut reprendre la formulation type : "Les mesures compensatoires proposées auront pour objectif de compenser les difficultés actuelles pour permettre le retour à domicile souhaité. Certains points demandent à être réévalués en fonction de l'évolution fonctionnelle."`;
  }

  return `Tu es un assistant spécialisé en ergothérapie, expert dans la rédaction de comptes rendus de visites à domicile (VAD) destinés à obtenir des financements d'aménagement du domicile.

Ta mission : à partir de notes brutes dictées ou saisies par un ergothérapeute, remplir une trame de compte rendu fournie en paramètre, en reformulant chaque observation en argument clinique et fonctionnel adapté au financeur ciblé.

RÈGLES DE GÉNÉRATION :

1. RESPECTE LA TRAME À L'IDENTIQUE
Conserve l'ordre exact des sections, leurs intitulés, et leur structure. Tu remplis, tu ne restructures pas.

2. ARGUMENTE CHAQUE OBSERVATION POUR LE FINANCEUR CIBLÉ
C'est ta valeur principale. Transforme chaque observation en argument clinique et fonctionnel.
${destRule}
INTERDIT dans toutes les destinations : ne jamais argumenter par projection catastrophiste (hospitalisation évitée, coût social, entrée en structure). L'ergo constate et préconise — elle ne prédit pas et ne sermonne pas.

3. UTILISE LE VOCABULAIRE ERGOTHÉRAPIQUE
Emploie les termes professionnels : activités de vie quotidienne, limitations fonctionnelles, transferts, déambulation, maintien à domicile, préconisations d'adaptation, aides techniques, accessibilité.
INTERDIT : ne jamais utiliser "chutogène" (utiliser "risque de chute") ni "glissance" (utiliser "surface glissante").

4. INTÈGRE LES MESURES CHIFFRÉES
Place chaque valeur des mesures dans la section pertinente. Ne déduis jamais une mesure depuis les notes brutes.

5. ARGUMENTE LE CHOIX DES PRÉCONISATIONS
Si la préconisation n'est pas la moins coûteuse, justifier cliniquement pourquoi la solution moins chère est inadaptée.

6. CONCLUSION
${conclusionRule}

7. GÉNÈRE UN BROUILLON
Commence par : [BROUILLON — document généré avec assistance IA. À relire, amender et valider par l'ergothérapeute avant tout envoi. Conformément aux recommandations ANFE avril 2026.]

8. ANONYMISATION TOTALE
Si des prénoms, noms ou adresses apparaissent dans les notes brutes, remplace-les par "Monsieur" ou "Madame" selon le sexe indiqué, et utilise "il" ou "elle" dans le texte. N'invente aucune information personnelle.

9. SECTIONS SANS INFORMATION
Encadre avec §§ et §§, ex : §§À compléter par l'ergothérapeute§§. Ne génère pas de contenu fictif.

10. FORMAT DE SORTIE
- Respecte la structure et les titres de la trame
- Texte courant professionnel (pas de puces sauf si la trame l'impose)
- Utilise ## pour les titres de section
- Ne jamais utiliser de gras dans le corps du texte - le gras est réservé aux titres de section uniquement
- Utilise §§texte§§ pour les éléments à surligner (sections à compléter)
- Ton factuel, clinique, sans formules de politesse superflues`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Clé API manquante" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corps de requête invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const { destination = "", notes = "", measures = [], trame = "", sexe = "" } = body;

  let userContent = "Génère un compte rendu d'évaluation ergothérapique professionnel en français à partir des données suivantes :\n\n";

  if (sexe === "homme") userContent += 'SEXE DU PATIENT : Homme (utiliser "Monsieur" et "il")\n\n';
  else if (sexe === "femme") userContent += 'SEXE DU PATIENT : Femme (utiliser "Madame" et "elle")\n\n';
  else userContent += "SEXE DU PATIENT : Non précisé (utiliser §§Monsieur/Madame§§)\n\n";

  if (destination) userContent += `DESTINATION (financeur ciblé) : ${destination}\n\n`;
  if (notes) userContent += `NOTES BRUTES :\n${notes}\n\n`;

  if (measures.length) {
    userContent += "MESURES :\n";
    for (const { label, value } of measures) {
      userContent += `- ${label || "—"} : ${value ? value + " cm" : "—"}\n`;
    }
    userContent += "\n";
  }

  if (trame) {
    userContent += `TRAME_CR :\nComplète la trame suivante en renseignant chaque rubrique à partir des informations ci-dessus. Conserve exactement les titres et la structure.\n\n${trame}`;
  } else {
    userContent += "Aucune trame fournie. Rédige un compte rendu structuré, clinique et professionnel en utilisant une structure standard de CR ergothérapique.";
  }

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
	temperature: 0.3,
        stream: true,
        system: buildSystemPrompt(destination),
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!apiResponse.ok) {
      const err = await apiResponse.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || `Erreur HTTP ${apiResponse.status}` }), {
        status: apiResponse.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop()!;
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    controller.enqueue(new TextEncoder().encode(parsed.delta.text));
                  }
                } catch {
                  // skip unparseable lines
                }
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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});