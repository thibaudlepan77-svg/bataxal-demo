#!/usr/bin/env node
"use strict";
/**
 * Oracle sur les DONNEES et la SOURCE de la demonstration Bataxal.
 *
 * Ce que ce fichier prouve, et ce qu'il ne prouve pas.
 *   - Il prouve la coherence interne des donnees et le respect des regles produit
 *     ecrites (charte graphique, vocabulaire d'importance, ton redactionnel).
 *   - Il NE prouve RIEN de ce que voit un humain a l'ecran : la visibilite reelle,
 *     la hauteur rendue, le contraste. Cela reste du ressort du navigateur, et
 *     verifier-dom.js n'y suffit pas non plus (lecons 29, 30, 39).
 *
 * Deux modes :
 *   node verifier.js            controle la version reelle, doit finir VERT
 *   node verifier.js --rouge    applique une a une des mutations qui simulent un
 *                               vrai defaut, et exige que chacune soit ATTRAPEE,
 *                               plus un temoin inerte qui doit rester VERT (sans
 *                               lui, on ne distingue pas un harnais discriminant
 *                               d'un harnais qui rougit sur n'importe quoi).
 */

const fs = require("fs");
const path = require("path");

const RACINE = __dirname;
const CHEMIN_DONNEES = path.join(RACINE, "data", "boite-fictive.json");
const CHEMIN_GABARIT = path.join(RACINE, "demo.gabarit.html");
const CHEMIN_DEMO = path.join(RACINE, "index.html");

const IMPORTANCES = { 1: "Urgent", 2: "Important", 3: "Normal", 4: "Faible" };
const ACTIONS = ["REPONDRE", "PAYER", "RAPPELER", "RIEN"];

/* Meme regle que l'interface : l'apercu montre la premiere phrase qui porte le ton,
   pas la formule de politesse commune aux trois propositions. */
function premierePhraseUtile(texte) {
  const lignes = texte.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  for (const l of lignes) {
    if (!/^(bonjour|bonsoir|madame|monsieur|cher|chere)\b/i.test(l)) return l;
  }
  return lignes[0] || "";
}

/* ------------------------------------------------------------------ */
/* Petit harnais                                                       */
/* ------------------------------------------------------------------ */
function creerHarnais() {
  const echecs = [];
  let total = 0;
  function ok(condition, libelle) {
    total++;
    if (!condition) echecs.push(libelle);
  }
  function egal(obtenu, attendu, libelle) {
    total++;
    if (obtenu !== attendu) {
      echecs.push(libelle + " (obtenu " + JSON.stringify(obtenu) + ", attendu " + JSON.stringify(attendu) + ")");
    }
  }
  return { ok, egal, echecs, compte: () => total };
}

/* ------------------------------------------------------------------ */
/* Les controles, tous appliques a un couple (donnees, source)         */
/* ------------------------------------------------------------------ */
function controler(donnees, gabarit, demo) {
  const h = creerHarnais();
  const { ok, egal } = h;
  const emails = donnees.emails;

  /* --- 1. Integrite des donnees --------------------------------- */
  ok(emails.length >= 20, "La boite doit contenir au moins 20 emails pour etre credible");
  const ids = emails.map((e) => e.id);
  egal(new Set(ids).size, ids.length, "Les identifiants d'email doivent etre uniques");

  emails.forEach((e) => {
    ok(IMPORTANCES[e.importance] !== undefined, "Importance hors bornes 1 a 4 sur " + e.id);
    ok(ACTIONS.indexOf(e.action) !== -1, "Action inconnue sur " + e.id);
    ok(typeof e.resume === "string" && e.resume.trim().length >= 30,
      "Resume absent ou trop court sur " + e.id);
    ok(typeof e.corps === "string" && e.corps.trim().length > 0, "Corps vide sur " + e.id);
    ok(typeof e.categorie === "string" && e.categorie.trim().length > 0, "Categorie vide sur " + e.id);
    ok(/^\d{2}:\d{2}$/.test(e.heure), "Heure mal formee sur " + e.id);
    ok(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.adresse), "Adresse mal formee sur " + e.id);
    ok(Number.isInteger(e.piecesJointes) && e.piecesJointes >= 0, "Pieces jointes invalides sur " + e.id);
  });

  /* Un resume qui promet deux phrases doit en faire deux. Une promesse produit
     non tenue dans la demonstration se paierait au premier rendez-vous. */
  emails.forEach((e) => {
    const phrases = e.resume.split(/[.!?]\s+|[.!?]$/).filter((p) => p.trim().length > 0);
    ok(phrases.length >= 1 && phrases.length <= 3,
      "Le resume de " + e.id + " doit tenir en 1 a 3 phrases (obtenu " + phrases.length + ")");
    ok(e.resume.length <= 320, "Resume trop long sur " + e.id + " (" + e.resume.length + " caracteres)");
  });

  /* --- 2. Le tri doit etre DISCRIMINANT ------------------------- */
  const parNiveau = {};
  [1, 2, 3, 4].forEach((n) => { parNiveau[n] = emails.filter((e) => e.importance === n).length; });
  [1, 2, 3, 4].forEach((n) => {
    ok(parNiveau[n] > 0, "Le niveau " + IMPORTANCES[n] + " doit contenir au moins un email, sinon le tri ne demontre rien");
  });
  /* L'argument de vente est qu'il y a PEU d'urgents. Une boite ou tout est urgent
     ne demontre pas le produit, elle demontre le contraire. */
  ok(parNiveau[1] <= Math.floor(emails.length * 0.25),
    "Trop d'emails urgents (" + parNiveau[1] + " sur " + emails.length + "), la demonstration perd son argument");
  const calmes = emails.filter((e) => e.action === "RIEN").length;
  ok(calmes >= Math.ceil(emails.length * 0.4),
    "Pas assez d'emails qui ne demandent rien (" + calmes + "), le gain de temps n'est pas visible");

  /* Coherence importance / action : ce qui est urgent ou important exige une action,
     ce qui est calme n'en exige aucune. Sans cela le tri est decoratif. */
  emails.forEach((e) => {
    if (e.importance <= 2) ok(e.action !== "RIEN", e.id + " est " + IMPORTANCES[e.importance] + " mais n'attend aucune action");
    if (e.importance >= 3) ok(e.action === "RIEN", e.id + " est " + IMPORTANCES[e.importance] + " mais exige une action");
  });

  /* Les urgents doivent porter une echeance, c'est ce qui fait leur urgence. */
  emails.filter((e) => e.importance === 1).forEach((e) => {
    ok(typeof e.deadline === "string" && e.deadline.trim().length > 0,
      e.id + " est Urgent mais sans echeance, l'urgence n'est alors justifiee par rien");
  });

  /* --- 3. Reponses proposees ------------------------------------ */
  const avecReponses = emails.filter((e) => Array.isArray(e.reponses) && e.reponses.length > 0);
  ok(avecReponses.length >= 3, "Au moins 3 emails doivent porter des reponses proposees");
  avecReponses.forEach((e) => {
    egal(e.reponses.length, 3, "Le produit promet 3 reponses, " + e.id + " n'en a pas 3");
    ok(e.action === "REPONDRE", e.id + " propose des reponses alors que l'action attendue n'est pas Repondre");
    const tons = e.reponses.map((r) => r.ton);
    egal(new Set(tons).size, 3, "Les 3 tons proposes sur " + e.id + " doivent etre distincts");
    /* Des libelles distincts ne suffisent pas : ce qui est LU a l'ecran est la premiere
       phrase utile de chaque reponse. Si les trois se ressemblent, le prospect voit trois
       fois la meme chose et le differenciateur vendu disparait (defaut constate au
       navigateur, ou les trois apercus affichaient la meme formule de politesse). */
    const utiles = e.reponses.map((r) => premierePhraseUtile(r.texte));
    egal(new Set(utiles).size, 3, "Les 3 apercus lisibles de " + e.id + " doivent differer");
    utiles.forEach((u, i) => {
      ok(!/^(bonjour|bonsoir|madame|monsieur|cher)\b/i.test(u),
        "L'apercu " + (i + 1) + " de " + e.id + " ne doit pas etre une formule de politesse");
      ok(u.length >= 25, "L'apercu " + (i + 1) + " de " + e.id + " est trop court pour distinguer le ton");
    });
    e.reponses.forEach((r, i) => {
      ok(r.texte.trim().length >= 120, "Reponse " + (i + 1) + " de " + e.id + " trop courte pour etre envoyable");
      ok(/Moussa Ndiaye\s*$/.test(r.texte.trim()), "Reponse " + (i + 1) + " de " + e.id + " non signee");
      ok(/^Bonjour/.test(r.texte.trim()), "Reponse " + (i + 1) + " de " + e.id + " sans formule d'ouverture");
    });
  });

  /* --- 4. Regles de routage ------------------------------------- */
  ok(donnees.regles.length >= 3, "Au moins 3 regles de routage pour montrer le no-code");
  donnees.regles.forEach((r) => {
    ok(r.touches.length > 0, "La regle \"" + r.nom + "\" ne touche aucun email, elle ne demontre rien");
    r.touches.forEach((id) => {
      ok(ids.indexOf(id) !== -1, "La regle \"" + r.nom + "\" cite un email inexistant : " + id);
    });
    const nomsEquipe = donnees.equipe.map((m) => m.nom);
    ok(nomsEquipe.some((n) => r.alors.indexOf(n) !== -1),
      "La regle \"" + r.nom + "\" n'assigne a personne de l'equipe");
  });

  /* --- 5. Vocabulaire produit, charte section 2.4 ---------------- */
  /* Aucun code interne P1 a P4 ne doit sortir dans un texte vu par l'utilisateur.
     On cherche le radical sans frontiere de mot (lecon 15), sur tout ce qui s'affiche. */
  const textesVisibles = [];
  emails.forEach((e) => {
    textesVisibles.push(e.sujet, e.resume, e.corps, e.de, e.categorie);
    (e.reponses || []).forEach((r) => textesVisibles.push(r.ton, r.texte));
  });
  donnees.regles.forEach((r) => textesVisibles.push(r.nom, r.si, r.alors));
  const gabaritTexte = gabarit
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ");
  textesVisibles.push(gabaritTexte);

  textesVisibles.forEach((t, i) => {
    ok(!/\bP[1-4]\b/.test(t), "Code interne P1 a P4 visible dans un texte (index " + i + ")");
  });
  /* Emoji et tiret cadratin sont interdits par la charte (sections 8 et 9). */
  textesVisibles.forEach((t, i) => {
    ok(!/[—]/.test(t), "Tiret cadratin interdit dans un texte (index " + i + ")");
    ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), "Emoji interdit dans l'interface (index " + i + ")");
  });

  /* --- 6. Honnetete de la demonstration -------------------------- */
  /* Le bandeau doit dire trois choses : c'est fictif, aucune boite n'est connectee,
     les analyses sont pre-etablies. Omettre la troisieme serait laisser croire qu'un
     modele tourne ici, donc fabriquer une preuve. */
  const bandeau = (gabarit.match(/id="texte-bandeau">([^<]*)</) || [, ""])[1];
  ok(/fictif/i.test(bandeau), "Le bandeau doit dire que les donnees sont fictives");
  ok(/aucun compte|aucune connexion/i.test(bandeau), "Le bandeau doit dire qu'aucune boite n'est connectee");
  ok(/a l'avance|pre-?etabli|produites a l'avance/i.test(bandeau),
    "Le bandeau doit dire que les analyses ont ete produites a l'avance");
  /* Le bouton WhatsApp de la demonstration doit dire qu'il n'envoie rien. */
  ok(/rien n'est envoye/i.test(gabarit),
    "L'action WhatsApp doit annoncer qu'elle n'envoie rien dans la demonstration");

  /* Une affirmation VRAIE aujourd'hui et INVERIFIABLE demain est un mensonge a retardement :
     aucun test ne bouge le jour ou elle cesse d'etre vraie. La demonstration affirmait
     une phrase dont la verite depend d'un fait exterieur que personne ne peut mesurer
     depuis cette machine. On interdit nommement les formulations qui dependent d'un
     fait exterieur non mesurable, et on exige a la place la seule qui se verifie d'un
     coup de HTTP (verifier-publication.js controle que la production repond). */
  const CLAIMS_PERISSABLES = [
    "client pilote", "clients pilotes", "en service chez", "utilise par \d+ entreprise",
    "nos clients", "deja \d+ PME"
  ];
  CLAIMS_PERISSABLES.forEach((motif) => {
    ok(!new RegExp(motif, "i").test(demo),
      "Affirmation perissable et invisible aux tests dans la demonstration : " + motif);
  });
  ok(/deploye en production/i.test(demo),
    "Le pied doit porter l'affirmation verifiable : le produit reel est deploye en production");

  /* --- 7. Chemin de retour, lecons 20 et 40 ---------------------- */
  /* Une demonstration sans sortie perd 100 pour cent des prospects convaincus.
     Le chemin de retour se verifie NOMMEMENT, pas par un balayage general. */
  const liens = [...gabarit.matchAll(/<a\b[^>]*id="(lien-retour[^"]*)"[^>]*href="([^"]+)"[^>]*class?="?([^">]*)"?/g)];
  const hrefs = [...gabarit.matchAll(/id="(lien-retour[^"]*)"[^>]*href="([^"]+)"/g)]
    .concat([...gabarit.matchAll(/href="([^"]+)"[^>]*id="(lien-retour[^"]*)"/g)].map((m) => [m[0], m[2], m[1]]));
  ok(hrefs.length >= 2, "Il faut au moins deux chemins de retour dans la demonstration (obtenu " + hrefs.length + ")");
  hrefs.forEach((m) => {
    const href = m[2];
    ok(/^https?:\/\/|^mailto:/.test(href), "Le chemin de retour " + m[1] + " doit etre une vraie adresse");
    ok(!/^#/.test(href) && href.trim().length > 1, "Le chemin de retour " + m[1] + " est vide");
    ok(/wa\.me|whatsapp|mailto/i.test(href), "Le chemin de retour " + m[1] + " doit ouvrir un canal de contact reel");
  });
  /* Un numero de contact FACTICE est pire qu'un lien mort : il a l'air de marcher et
     envoie chaque prospect convaincu chez un inconnu. Defaut reellement commis sur ce
     fichier, attrape en revue. On interdit les formes de gabarit, et on exige le numero
     reellement utilise par les autres artefacts publics de la maison. */
  const NUMERO_MAISON = "221784266546";
  const FACTICES = ["221771234567", "221770000000", "0000000000", "1234567890", "XXXXXXXXX"];
  FACTICES.forEach((faux) => {
    ok(demo.indexOf(faux) === -1, "Numero de contact factice dans la demonstration : " + faux);
  });
  const numeros = [...demo.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]);
  ok(numeros.length >= 2, "Chaque chemin de retour WhatsApp doit porter un numero");
  numeros.forEach((n) => {
    egal(n, NUMERO_MAISON, "Un chemin de retour pointe vers un numero qui n'est pas celui de la maison");
  });

  /* Chaque chemin de retour doit etre un bouton, pas un lien noye dans une phrase
     (la mutation qui le remet en ligne exploiterait sinon l'exemption, lecon 40). */
  hrefs.forEach((m) => {
    const balise = (gabarit.match(new RegExp('<a[^>]*id="' + m[1] + '"[^>]*>')) || [""])[0];
    ok(/class="[^"]*\bbtn\b/.test(balise) || /class="[^"]*\bretour\b/.test(balise),
      "Le chemin de retour " + m[1] + " doit porter une classe de bouton, pas etre un lien inline");
  });

  /* --- 7 bis. Carte d'apercu du lien partage --------------------- */
  /* Ce lien se colle d'abord dans WhatsApp. Sans carte d'apercu il arrive en URL nue,
     ce qui ressemble a du spam, et le prospect ne clique pas : la meilleure demonstration
     du monde ne sert a rien si le lien n'est jamais ouvert. Les adresses des balises
     doivent etre ABSOLUES (une adresse relative dans une balise og ne resout chez aucun
     agregateur) et pointer sur l'adresse publiee, pas sur une autre. */
  const ADRESSE_PUBLIEE = "https://thibaudlepan77-svg.github.io/bataxal-demo/";
  const balise = (prop) => {
    const m = gabarit.match(new RegExp('<meta[^>]*(?:property|name)="' + prop + '"[^>]*content="([^"]*)"'));
    return m ? m[1] : null;
  };
  ["og:type", "og:url", "og:title", "og:description", "og:image",
   "twitter:card", "twitter:image"].forEach((prop) => {
    const v = balise(prop);
    ok(v !== null && v.trim().length > 0, "Balise de partage absente ou vide : " + prop);
  });
  egal(balise("og:url"), ADRESSE_PUBLIEE, "og:url doit pointer sur l'adresse publiee");
  egal(balise("og:image"), ADRESSE_PUBLIEE + "apercu.png", "og:image doit etre une adresse ABSOLUE sur l'adresse publiee");
  egal(balise("twitter:image"), ADRESSE_PUBLIEE + "apercu.png", "twitter:image doit etre une adresse ABSOLUE");
  ok(fs.existsSync(path.join(RACINE, "apercu.png")),
    "apercu.png doit exister, sinon la carte d'apercu affiche un trou (node carte-apercu.js)");
  /* Le titre partage doit dire ce que le produit fait, pas seulement son nom. */
  ok((balise("og:title") || "").length >= 25, "og:title est trop court pour vendre quoi que ce soit");
  ok(/demonstration|sans compte|fictives/i.test(balise("og:description") || ""),
    "og:description doit annoncer que c'est une demonstration, l'honnetete vaut aussi dans l'apercu");

  /* --- 8. Charte graphique, jetons obligatoires ------------------ */
  const jetons = ["--green-deep:#0E8B5A", "--bg-cream:#F7F5F0", "--bg-dark:#17171B",
    "--p1:#D6453A", "--p2:#DE8A1F", "--p3:#6E6F78", "--p4:#ADAEB5", "--whatsapp-green:#25D366"];
  jetons.forEach((j) => ok(gabarit.indexOf(j) !== -1, "Jeton de charte absent : " + j));
  /* Lecon 30 : un hidden pose par le code ne cache rien si une classe declare un display. */
  ok(/\[hidden\]\{display:none !important\}/.test(gabarit.replace(/\s+/g, "")) ||
     /\[hidden\]\{display:none!important\}/.test(gabarit.replace(/\s+/g, "")),
    "La regle [hidden]{display:none !important} doit exister, sinon un ecran masque reste visible");
  /* Cibles tactiles : tout bouton declare doit atteindre 40px de haut. */
  const minHeights = [...gabarit.matchAll(/\.btn\{[^}]*min-height:(\d+)px/g)].map((m) => Number(m[1]));
  ok(minHeights.length > 0 && minHeights.every((v) => v >= 40),
    "Les boutons doivent faire au moins 40px de haut (charte section 7)");
  /* prefers-reduced-motion doit neutraliser les animations. */
  ok(/prefers-reduced-motion/.test(gabarit), "La regle prefers-reduced-motion est obligatoire");

  /* --- 9. Aucune donnee reelle du pilote ne doit fuiter ---------- */
  /* La liste des identifiants a ne jamais laisser fuiter vit dans data/interdits.local.json,
     qui n'est PAS suivi par git. Raison : ce depot est PUBLIC pour que la demonstration soit
     hebergee gratuitement, donc ecrire ici le compte du client pilote et le nom de la base
     reviendrait a publier exactement ce que ce controle empeche. Fichier absent = ECHEC,
     jamais un controle silencieusement saute (lecon 26). */
  const CHEMIN_INTERDITS = path.join(RACINE, "data", "interdits.local.json");
  if (!fs.existsSync(CHEMIN_INTERDITS)) {
    console.error("ECHEC, data/interdits.local.json est absent : le controle de non-fuite des");
    console.error("identifiants du client pilote NE PEUT PAS avoir lieu. Il ne passe pas pour autant.");
    process.exit(1);
  }
  const interdits = JSON.parse(fs.readFileSync(CHEMIN_INTERDITS, "utf8")).interdits;
  ok(Array.isArray(interdits) && interdits.length >= 3,
    "data/interdits.local.json doit lister au moins trois identifiants a surveiller");
  interdits.forEach((mot) => {
    ok(demo.toLowerCase().indexOf(mot.toLowerCase()) === -1,
      "La demonstration ne doit contenir aucune trace du pilote reel : " + mot);
  });
  /* Aucun secret, aucune cle. */
  ok(!/sk_live|sk_test|AIza[0-9A-Za-z_-]{10}|xox[baprs]-/.test(demo),
    "Aucune cle ni secret ne doit apparaitre dans la demonstration");

  /* --- 10. La demo assemblee contient bien les donnees ----------- */
  ok(demo.indexOf("/*DONNEES*/") === -1, "Le marqueur de donnees n'a pas ete remplace dans index.html");
  emails.forEach((e) => {
    ok(demo.indexOf(e.sujet) !== -1, "Le sujet de " + e.id + " est absent de index.html");
  });
  ok(demo.indexOf("fetch(") === -1 && demo.indexOf("XMLHttpRequest") === -1,
    "La demonstration doit fonctionner hors ligne, aucun appel reseau");

  return h;
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */
/* Chaque mutation ecrit le defaut TEL QU'IL S'ECRIRAIT VRAIMENT (lecon 33),
   et doit changer quelque chose d'observable, sans quoi elle est inerte. */
const MUTATIONS = [
  {
    nom: "Un resume est vide (l'IA n'a rien produit et personne ne le voit)",
    muter: (d) => { d.emails[0].resume = ""; }
  },
  {
    nom: "Un email Urgent perd son echeance",
    muter: (d) => { d.emails[0].deadline = null; }
  },
  {
    nom: "Un email Faible reclame une action (le tri devient incoherent)",
    muter: (d) => { const e = d.emails.find((x) => x.importance === 4); e.action = "REPONDRE"; }
  },
  {
    nom: "Tout devient urgent (la demonstration perd son argument)",
    muter: (d) => { d.emails.forEach((e) => { e.importance = 1; e.action = "REPONDRE"; e.deadline = "Aujourd'hui"; }); }
  },
  {
    nom: "Le produit ne propose plus que 2 reponses au lieu de 3",
    muter: (d) => { d.emails.find((e) => e.reponses.length === 3).reponses.pop(); }
  },
  {
    nom: "Deux reponses proposees deviennent identiques a l'ecran",
    muter: (d) => {
      const e = d.emails.find((x) => x.reponses.length === 3);
      const lignes = e.reponses[0].texte.split("\n");
      const lignes2 = e.reponses[1].texte.split("\n");
      lignes2[2] = lignes[2];
      e.reponses[1].texte = lignes2.join("\n");
    }
  },
  {
    nom: "Une reponse proposee n'est plus signee",
    muter: (d) => {
      const e = d.emails.find((x) => x.reponses.length > 0);
      e.reponses[0].texte = e.reponses[0].texte.replace(/Moussa Ndiaye\s*$/, "");
    }
  },
  {
    nom: "Une regle de routage cite un email qui n'existe pas",
    muter: (d) => { d.regles[0].touches.push("e99"); }
  },
  {
    nom: "Une regle n'assigne plus a personne de l'equipe",
    muter: (d) => { d.regles[0].alors = "Archiver le message"; }
  },
  {
    nom: "Un code interne P1 ressort dans un texte visible",
    muter: (d) => { d.emails[0].resume = "Classe P1 par le moteur. " + d.emails[0].resume; }
  },
  {
    nom: "Un emoji entre dans l'interface produit",
    muter: (d) => { d.emails[0].sujet = d.emails[0].sujet + " \u{1F525}"; }
  },
  {
    nom: "Le bandeau cesse de dire que les analyses sont pre-etablies",
    muterSource: (g) => g.replace(
      "Les analyses affichees ont ete produites a l'avance pour cette demonstration.", "")
  },
  {
    nom: "og:image redevient une adresse relative (aucun agregateur ne la resout)",
    muterSource: (g) => g.replace(
      'content="https://thibaudlepan77-svg.github.io/bataxal-demo/apercu.png"', 'content="apercu.png"')
  },
  {
    nom: "og:url pointe vers un AUTRE artefact de la maison",
    muterSource: (g) => g.replace(
      '<meta property="og:url" content="https://thibaudlepan77-svg.github.io/bataxal-demo/">',
      '<meta property="og:url" content="https://thibaudlepan77-svg.github.io/recouvrement-daf/">')
  },
  {
    nom: "La carte d'apercu cesse de dire que la demonstration est fictive",
    muterSource: (g) => g.replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      '$1Triez vos emails automatiquement.$2')
  },
  {
    nom: "Une affirmation perissable revient dans le pied (client pilote)",
    muterSource: (g) => g.replace(
      "Le produit reel est deploye en production.",
      "Version reelle en service chez un client pilote.")
  },
  {
    nom: "Le pied perd son affirmation verifiable",
    muterSource: (g) => g.replace("Le produit reel est deploye en production.", "")
  },
  {
    nom: "Un numero de contact de gabarit repart en production",
    muterSource: (g) => g.replace(/wa\.me\/221784266546/, "wa.me/221771234567")
  },
  {
    nom: "Le chemin de retour devient un ancre morte",
    muterSource: (g) => g.replace(/id="lien-retour" href="[^"]+"/, 'id="lien-retour" href="#"')
  },
  {
    nom: "La regle [hidden] disparait, un ecran masque redevient visible",
    muterSource: (g) => g.replace("[hidden]{display:none !important}", "")
  },
  {
    nom: "Les boutons descendent sous la cible tactile de 40px",
    muterSource: (g) => g.replace(".btn{border:0; border-radius:999px; padding:10px 20px; font-size:13.5px; font-weight:600;\n  min-height:40px;", ".btn{border:0; border-radius:999px; padding:10px 20px; font-size:13.5px; font-weight:600;\n  min-height:28px;")
  },
  {
    nom: "Le vert de marque derive vers une autre teinte",
    muterSource: (g) => g.replace("--green-deep:#0E8B5A", "--green-deep:#12A96C")
  },
  {
    nom: "TEMOIN INERTE, un commentaire est ajoute dans la feuille de style",
    inerte: true,
    muterSource: (g) => g.replace("/* --------------------------- rendu ---------------------------", "/* commentaire sans effet\n  /* --------------------------- rendu ---------------------------")
  }
];

/* ------------------------------------------------------------------ */
function chargerTout() {
  return {
    donnees: JSON.parse(fs.readFileSync(CHEMIN_DONNEES, "utf8")),
    gabarit: fs.readFileSync(CHEMIN_GABARIT, "utf8"),
    demo: fs.readFileSync(CHEMIN_DEMO, "utf8")
  };
}

function main() {
  const rouge = process.argv.indexOf("--rouge") !== -1;
  const base = chargerTout();

  if (!rouge) {
    const h = controler(base.donnees, base.gabarit, base.demo);
    if (h.echecs.length > 0) {
      console.error("ECHEC, " + h.echecs.length + " controle(s) rouge(s) sur " + h.compte() + " :");
      h.echecs.forEach((e) => console.error("  - " + e));
      process.exit(1);
    }
    console.log("VERT, " + h.compte() + " controles passes sur les donnees et la source.");
    return;
  }

  console.log("Mode mutations, " + MUTATIONS.length + " mutations dont "
    + MUTATIONS.filter((m) => m.inerte).length + " temoin inerte.\n");
  let rates = 0;
  MUTATIONS.forEach((m, i) => {
    const donnees = JSON.parse(JSON.stringify(base.donnees));
    let gabarit = base.gabarit;
    if (m.muter) m.muter(donnees);
    if (m.muterSource) gabarit = m.muterSource(gabarit);

    /* Une mutation qui ne change rien est INERTE et ne prouve rien (lecons 21 et 33).
       Seul le temoin a le droit de l'etre, et il doit rester vert. */
    const aChange = (m.muterSource ? gabarit !== base.gabarit : true)
      && (m.muter ? JSON.stringify(donnees) !== JSON.stringify(base.donnees) : true);
    if (!aChange) {
      console.error("  [" + (i + 1) + "] MUTATION SANS EFFET : " + m.nom);
      rates++;
      return;
    }
    /* La demo est reassemblee comme en production, sinon on testerait autre chose. */
    const demo = gabarit.replace("/*DONNEES*/", () => JSON.stringify(donnees));
    const h = controler(donnees, gabarit, demo);
    const attrapee = h.echecs.length > 0;

    if (m.inerte) {
      if (attrapee) {
        console.error("  [" + (i + 1) + "] TEMOIN ROUGE A TORT : " + m.nom
          + " (" + h.echecs[0] + ") le harnais rougit sur n'importe quoi");
        rates++;
      } else {
        console.log("  [" + (i + 1) + "] temoin inerte reste VERT, le harnais est discriminant");
      }
      return;
    }
    if (attrapee) {
      console.log("  [" + (i + 1) + "] ROUGE comme attendu : " + m.nom);
    } else {
      console.error("  [" + (i + 1) + "] SURVIT, trou de couverture : " + m.nom);
      rates++;
    }
  });

  const utiles = MUTATIONS.filter((m) => !m.inerte).length;
  if (rates > 0) {
    console.error("\nECHEC, " + rates + " mutation(s) mal traitee(s) sur " + MUTATIONS.length + ".");
    process.exit(1);
  }
  console.log("\nVERT, " + utiles + "/" + utiles + " mutations attrapees et temoin inerte reste vert.");
}

main();
