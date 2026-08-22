#!/usr/bin/env node
"use strict";
/**
 * Harnais qui PILOTE l'interface de la demonstration dans jsdom, comme un prospect.
 * Il clique, il lit ce que la page affiche, et il verifie les CONSEQUENCES, pas
 * seulement l'affichage (lecons 16 et 22).
 *
 * Ce qu'il ne prouve pas, et il faut le dire : jsdom n'est pas un navigateur. Il ne
 * mesure ni hauteur rendue, ni contraste, ni debordement, et il implemente lui-meme
 * certaines regles (lecons 30 et 39). Toute assertion de VISIBILITE reelle est donc
 * hors de sa portee et reste a faire dans un vrai navigateur.
 *
 *   node verifier-dom.js            doit finir VERT
 *   node verifier-dom.js --rouge    mutations du code produit, chacune doit etre
 *                                   attrapee, plus un temoin inerte qui reste VERT
 */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RACINE = __dirname;
const CHEMIN_GABARIT = path.join(RACINE, "demo.gabarit.html");
const CHEMIN_DONNEES = path.join(RACINE, "data", "boite-fictive.json");

function assembler(gabarit, donnees) {
  return gabarit.replace("/*DONNEES*/", () => JSON.stringify(donnees));
}

function creerHarnais() {
  const echecs = [];
  let total = 0;
  const ok = (c, l) => { total++; if (!c) echecs.push(l); };
  const egal = (o, a, l) => {
    total++;
    if (o !== a) echecs.push(l + " (obtenu " + JSON.stringify(o) + ", attendu " + JSON.stringify(a) + ")");
  };
  return { ok, egal, echecs, compte: () => total };
}

function clic(noeud, fenetre) {
  noeud.dispatchEvent(new fenetre.Event("click", { bubbles: true }));
}

/* ------------------------------------------------------------------ */
function piloter(html, donnees) {
  const h = creerHarnais();
  const { ok, egal } = h;

  /* jsdom n'implemente pas scrollTo et le signale a chaque appel. Ce bruit n'est pas
     un defaut du produit, on le tait, mais on laisse passer les vraies erreurs. */
  const vc = new VirtualConsole();
  vc.on("jsdomError", (err) => {
    if (!/Not implemented/.test(String(err && err.message))) throw err;
  });
  const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc });
  const w = dom.window;
  const doc = w.document;
  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => Array.from(doc.querySelectorAll(s));

  const api = w.__bataxal;
  ok(!!api, "La demonstration doit exposer son etat pour etre verifiable");
  if (!api) return h;

  /* Verite de reference, recalculee ici depuis les donnees, jamais lue dans la page. */
  const emailsRef = donnees.emails;
  const total = emailsRef.length;
  const nbUrgents = emailsRef.filter((e) => e.importance === 1).length;
  const nbImportants = emailsRef.filter((e) => e.importance === 2).length;
  const nbCalmes = emailsRef.filter((e) => e.action === "RIEN").length;
  const nbATraiter = emailsRef.filter((e) => e.action !== "RIEN").length;

  /* --- 1. Etat de depart ---------------------------------------- */
  egal($("#vue-boite").hidden, false, "La boite doit etre la vue de depart");
  egal($("#vue-detail").hidden, true, "Le detail doit etre masque au demarrage");
  egal($$("#liste .ligne").length, total, "Toutes les lignes d'email doivent etre rendues");
  egal($("#bascule-avec").getAttribute("aria-pressed"), "true", "Le mode trie doit etre actif au demarrage");

  /* Les chiffres affiches doivent etre ceux des donnees, pas des nombres ecrits a la main. */
  const valeurs = $$("#chiffres .val").map((n) => Number(n.textContent));
  ok(valeurs.indexOf(nbUrgents) !== -1, "Le nombre d'urgents affiche doit valoir " + nbUrgents);
  ok(valeurs.indexOf(nbImportants) !== -1, "Le nombre d'importants affiche doit valoir " + nbImportants);
  ok(valeurs.indexOf(nbCalmes) !== -1, "Le nombre d'emails calmes affiche doit valoir " + nbCalmes);
  ok(valeurs.indexOf(total) !== -1, "Le total affiche doit valoir " + total);

  /* Chaque ligne triee porte un resume. On compte les OCCURRENCES, pas les distinctes. */
  const resumesNonVides = $$("#liste .ligne .resume").filter((n) => n.textContent.trim().length > 0);
  egal(resumesNonVides.length, total, "Chaque ligne doit afficher un resume non vide");
  const badgesTheme = $$("#liste .ligne .badge-theme").filter((n) => n.textContent.trim().length > 0);
  egal(badgesTheme.length, total, "Chaque ligne doit afficher sa categorie");

  /* Charte 2.4 : seuls Urgent et Important portent un badge d'importance dans les listes. */
  egal($$("#liste .ligne .badge-1").length, nbUrgents, "Un badge Urgent par email urgent");
  egal($$("#liste .ligne .badge-2").length, nbImportants, "Un badge Important par email important");
  egal($$("#liste .ligne .badge-3").length, 0, "Le niveau Normal ne porte pas de badge dans les listes");
  egal($$("#liste .ligne .badge-4").length, 0, "Le niveau Faible ne porte pas de badge dans les listes");
  ok(!/\bP[1-4]\b/.test(doc.body.textContent), "Aucun code interne P1 a P4 ne doit apparaitre a l'ecran");

  /* Bandeau prioritaires, au plus 3 cartes, uniquement des urgents et importants. */
  egal($("#prioritaires").hidden, false, "Le bandeau prioritaire doit etre visible au demarrage");
  const cartesPrio = $$("#grille-prio .carte-prio");
  ok(cartesPrio.length > 0 && cartesPrio.length <= 3, "Le bandeau prioritaire affiche 1 a 3 cartes");

  /* --- 2. Comparaison sans / avec ------------------------------- */
  clic($("#bascule-sans"), w);
  egal($("#bascule-sans").getAttribute("aria-pressed"), "true", "Le mode sans Bataxal doit etre atteint avant d'etre teste");
  egal($$("#liste .ligne").length, total, "Le mode sans Bataxal montre les memes emails");
  egal($$("#liste .ligne .resume").length, 0, "Sans Bataxal, aucun resume ne doit apparaitre");
  egal($$("#liste .ligne .badge").length, 0, "Sans Bataxal, aucun badge ne doit apparaitre");
  egal($("#onglets").hidden, true, "Sans Bataxal, les onglets de tri n'ont pas de sens");
  egal($("#prioritaires").hidden, true, "Sans Bataxal, il n'y a pas de bandeau prioritaire");

  clic($("#bascule-avec"), w);
  egal($("#bascule-avec").getAttribute("aria-pressed"), "true", "Le retour au mode trie doit etre atteint");
  egal($$("#liste .ligne .resume").length, total, "Le retour au mode trie doit rendre les resumes");

  /* --- 3. Onglets ----------------------------------------------- */
  const ongletUrgent = $$("#onglets .onglet").find((b) => b.textContent.indexOf("Urgent") === 0);
  ok(!!ongletUrgent, "Un onglet Urgent doit exister");
  egal(Number(ongletUrgent.querySelector(".pastille-cpt").textContent), nbUrgents,
    "Le compteur de l'onglet Urgent doit valoir " + nbUrgents);
  clic(ongletUrgent, w);
  /* La barre d'onglets est reconstruite a chaque rendu, le noeud clique est donc perime.
     On relit l'onglet dans le DOM courant, sinon on assert sur un fantome. */
  const ongletUrgentApres = $$("#onglets .onglet").find((b) => b.textContent.indexOf("Urgent") === 0);
  egal(ongletUrgentApres.getAttribute("aria-selected"), "true", "L'onglet Urgent doit etre selectionne avant d'etre teste");
  egal($$("#liste .ligne").length, nbUrgents, "L'onglet Urgent doit filtrer la liste");
  const sujetsUrgents = emailsRef.filter((e) => e.importance === 1).map((e) => e.sujet);
  $$("#liste .ligne .sujet").forEach((n) => {
    ok(sujetsUrgents.indexOf(n.textContent) !== -1, "Ligne etrangere dans l'onglet Urgent : " + n.textContent);
  });
  egal($("#prioritaires").hidden, true, "Le bandeau prioritaire ne s'affiche que sur l'onglet Tous");

  /* La somme des quatre niveaux doit valoir le total, sinon un email est invisible. */
  const cptNiveaux = ["Urgent", "Important", "Normal", "Faible"].map((lib) => {
    const b = $$("#onglets .onglet").find((x) => x.textContent.indexOf(lib) === 0);
    return b ? Number(b.querySelector(".pastille-cpt").textContent) : -1;
  });
  egal(cptNiveaux.reduce((a, b) => a + b, 0), total, "La somme des quatre niveaux doit valoir le total");

  const ongletTous = $$("#onglets .onglet").find((b) => b.textContent.indexOf("Tous") === 0);
  clic(ongletTous, w);
  egal($$("#liste .ligne").length, total, "Le retour a l'onglet Tous doit tout reafficher");

  /* --- 4. Ouvrir un email et repondre --------------------------- */
  const cible = emailsRef.find((e) => e.reponses && e.reponses.length === 3);
  const ligneCible = $$("#liste .ligne").find((n) => n.dataset.email === cible.id);
  ok(!!ligneCible, "La ligne de l'email cible doit exister dans la liste");
  clic(ligneCible, w);
  egal($("#vue-detail").hidden, false, "Le detail doit s'ouvrir avant toute assertion sur son contenu");
  egal($("#detail-sujet").textContent, cible.sujet, "Le detail doit afficher le sujet de l'email ouvert");
  egal($("#detail-resume").textContent, cible.resume, "Le detail doit afficher le resume de l'email ouvert");
  egal($$("#detail-reponses .reponse").length, 3, "Le produit promet trois reponses proposees");
  /* Ce que le prospect LIT doit differer d'une proposition a l'autre. Trois libelles de
     ton distincts au dessus de trois apercus identiques ne vendent rien : c'est le defaut
     qui a ete vu au navigateur, pas ici, et cette assertion est ce qui le rattrape. */
  const apercus = $$("#detail-reponses .reponse .apercu").map((n) => n.textContent.trim());
  egal(apercus.length, 3, "Chaque reponse proposee doit porter un apercu");
  egal(new Set(apercus).size, 3, "Les trois apercus affiches doivent etre differents");
  apercus.forEach((a, i) => {
    ok(!/^bonjour\b/i.test(a), "L'apercu " + (i + 1) + " ne doit pas etre la formule de politesse commune");
    ok(a.length >= 25, "L'apercu " + (i + 1) + " est trop court pour donner a choisir");
  });
  ok($("#detail-fiche").textContent.indexOf("Urgent") !== -1 || $("#detail-fiche").textContent.indexOf("Important") !== -1,
    "La fiche doit dire le niveau d'importance en toutes lettres");

  /* Envoyer sans texte doit REFUSER, et surtout ne rien changer.
     Un controle qui n'a pas eu lieu n'est pas un controle reussi (lecon 26). */
  egal($("#zone-texte").value, "", "La zone de reponse doit etre vide a l'ouverture");
  clic($("#btn-envoyer"), w);
  egal($("#confirmation").hidden, false, "Un envoi sans texte doit afficher un refus");
  ok(/avant d'envoyer/i.test($("#confirmation").textContent), "Le refus doit dire quoi faire");
  egal(api.emails.find((e) => e.id === cible.id).repondu, false,
    "Un envoi refuse ne doit PAS marquer l'email comme repondu");

  /* Choisir un ton remplit le texte a l'identique, sans reformulation cachee. */
  const premiere = $$("#detail-reponses .reponse")[0];
  clic(premiere, w);
  egal($("#zone-texte").value, cible.reponses[0].texte,
    "Le texte de la reponse choisie doit etre repris mot pour mot");
  egal($$("#detail-reponses .reponse")[0].getAttribute("aria-pressed"), "true",
    "La reponse choisie doit etre marquee comme telle");

  /* Envoyer pour de bon. On verifie la CONSEQUENCE, pas le message. */
  const aTraiterAvant = api.compter(api.aTraiter);
  clic($("#btn-envoyer"), w);
  egal(api.emails.find((e) => e.id === cible.id).repondu, true,
    "Apres envoi, l'email doit etre marque repondu dans l'etat, pas seulement a l'ecran");
  egal(api.compter(api.aTraiter), aTraiterAvant - 1,
    "Apres envoi, la file a traiter doit diminuer d'exactement un");
  egal($("#btn-envoyer").disabled, true, "On ne doit pas pouvoir envoyer deux fois la meme reponse");

  /* Assigner nomme une vraie personne de l'equipe. */
  clic($("#btn-assigner"), w);
  const noms = donnees.equipe.map((m) => m.nom);
  ok(noms.some((n) => $("#confirmation").textContent.indexOf(n) !== -1),
    "L'assignation doit nommer un membre reel de l'equipe");

  /* Retour a la boite : la ligne a change d'etat. */
  clic($("#retour-boite"), w);
  egal($("#vue-boite").hidden, false, "Le retour a la boite doit reafficher la boite");
  const ligneApres = $$("#liste .ligne").find((n) => n.dataset.email === cible.id);
  ok(!!ligneApres, "L'email repondu reste consultable dans la boite");
  ok(ligneApres.textContent.indexOf("Repondu") !== -1, "L'email repondu doit porter le badge Repondu");
  ok(ligneApres.textContent.indexOf("A repondre") === -1, "L'email repondu ne doit plus reclamer une reponse");
  const sujetsPrio = $$("#grille-prio .carte-prio .sujet-prio").map((n) => n.textContent);
  ok(sujetsPrio.indexOf(cible.sujet) === -1, "L'email repondu doit sortir du bandeau prioritaire");

  /* --- 5. Vider la file, l'ecran doit se calmer ------------------ */
  const restants = api.emails.filter((e) => api.aTraiter(e)).map((e) => e.id);
  restants.forEach((id) => {
    api.ouvrir(id);
    const boutons = $$("#detail-reponses .reponse");
    if (boutons.length > 0) { clic(boutons[0], w); } else { $("#zone-texte").value = "Traite."; }
    clic($("#btn-envoyer"), w);
  });
  egal(api.compter(api.aTraiter), 0, "Toute la file doit avoir ete traitee");
  api.allerA("boite");
  const ongletFile = $$("#onglets .onglet").find((b) => b.textContent.indexOf("A traiter") === 0);
  ok(!!ongletFile, "Un onglet A traiter doit exister");
  egal(Number(ongletFile.querySelector(".pastille-cpt").textContent), 0,
    "Le compteur A traiter doit tomber a zero");
  egal($("#prioritaires").hidden, true, "Le bandeau prioritaire doit disparaitre quand tout est traite");
  clic(ongletFile, w);
  const ongletFileApres = $$("#onglets .onglet").find((b) => b.textContent.indexOf("A traiter") === 0);
  egal(ongletFileApres.getAttribute("aria-selected"), "true", "L'onglet A traiter doit etre selectionne avant d'etre teste");
  egal($$("#liste .ligne").length, 0, "La file A traiter doit etre vide");
  egal($$("#liste .vide").length, 1, "Un etat vide doit s'afficher");
  ok(/matinee est faite/i.test($("#liste .vide").textContent),
    "L'etat vide de la file doit etre une recompense, pas un cul-de-sac");
  ok($("#liste .vide button") !== null, "L'etat vide doit proposer l'action suivante");

  /* --- 6. Briefing ---------------------------------------------- */
  api.allerA("briefing");
  egal($("#vue-briefing").hidden, false, "La vue briefing doit s'afficher avant d'etre lue");
  const briefing = $("#texte-briefing").textContent;
  egal(briefing.indexOf(String(total)) !== -1, true, "Le briefing doit citer le nombre d'emails recus");
  emailsRef.filter((e) => e.importance === 1).forEach((e) => {
    ok(briefing.indexOf(e.sujet) !== -1, "Le briefing doit citer l'urgent : " + e.sujet);
  });
  ok(briefing.indexOf("URGENT (" + nbUrgents + ")") !== -1, "Le briefing doit compter les urgents");
  ok(briefing.indexOf("IMPORTANT (" + nbImportants + ")") !== -1, "Le briefing doit compter les importants");
  ok(!/\bP[1-4]\b/.test(briefing), "Le briefing ne doit contenir aucun code interne");

  /* --- 7. Regles ------------------------------------------------ */
  api.allerA("regles");
  egal($("#vue-regles").hidden, false, "La vue regles doit s'afficher avant d'etre lue");
  egal($$("#liste-regles .regle").length, donnees.regles.length, "Toutes les regles doivent etre rendues");
  donnees.regles.forEach((r) => {
    ok($("#liste-regles").textContent.indexOf(r.nom) !== -1, "La regle doit etre nommee : " + r.nom);
  });

  /* --- 8. Chemin de retour, verifie NOMMEMENT (lecon 40) --------- */
  const retours = $$("a[id^='lien-retour']");
  ok(retours.length >= 2, "Au moins deux chemins de retour doivent exister (obtenu " + retours.length + ")");
  retours.forEach((a) => {
    ok(/^https?:/.test(a.getAttribute("href")), "Le chemin de retour " + a.id + " doit etre une vraie adresse");
    ok(a.textContent.trim().length >= 10, "Le chemin de retour " + a.id + " doit porter un libelle explicite");
    ok(/\bbtn\b|\bretour\b/.test(a.className), "Le chemin de retour " + a.id + " doit etre un bouton");
  });

  /* --- 9. Navigation mobile ------------------------------------- */
  egal($$("#mobile-nav button").length, 3, "La navigation mobile doit offrir les trois vues");
  egal($$("#menu-bureau button").length, 3, "Le menu de bureau doit offrir les trois vues");

  dom.window.close();
  return h;
}

/* ------------------------------------------------------------------ */
/* Mutations du CODE PRODUIT                                           */
/* ------------------------------------------------------------------ */
const MUTATIONS = [
  {
    nom: "Repondre n'affiche qu'un message, sans rien enregistrer (lecon 22)",
    muter: (g) => g.replace("    e.repondu = true;\n    rendre();", "    rendre();")
  },
  {
    nom: "Un envoi sans texte passe quand meme",
    muter: (g) => g.replace("if (texte.length === 0) {", "if (false) {")
  },
  {
    nom: "Le mode sans Bataxal affiche quand meme les resumes (la comparaison s'effondre)",
    muter: (g) => g.replace("      if (etat.trie) {\n        corps.appendChild(el(\"div\",\"resume\", e.resume));",
      "      if (true) {\n        corps.appendChild(el(\"div\",\"resume\", e.resume));")
  },
  {
    nom: "Le bandeau prioritaire ne disparait jamais",
    muter: (g) => g.replace("section.hidden = !etat.trie || etat.filtre !== \"tous\" || prio.length === 0;",
      "section.hidden = false;")
  },
  {
    nom: "Le bandeau prioritaire garde les emails deja traites",
    muter: (g) => g.replace("return (e.importance === 1 || e.importance === 2) && !e.repondu && aTraiter(e);",
      "return (e.importance === 1 || e.importance === 2);")
  },
  {
    nom: "Le badge Repondu n'est plus pose",
    muter: (g) => g.replace("if (e.repondu) { bs.appendChild(badge(\"badge-repondu\",\"Repondu\")); }\n        else if (aTraiter(e))",
      "if (false) { bs.appendChild(badge(\"badge-repondu\",\"Repondu\")); }\n        else if (aTraiter(e))")
  },
  {
    nom: "Les niveaux calmes se mettent a porter un badge (bruit visuel, charte 2.4)",
    muter: (g) => g.replace("if (IMPORTANCES[e.importance].badge) {", "if (true) {")
  },
  {
    nom: "Un onglet ne filtre plus rien",
    muter: (g) => g.replace("    return emails.filter(function(e){ return f.test(e); });",
      "    return emails.slice();")
  },
  {
    nom: "Le compteur d'un onglet est fige au lieu d'etre calcule",
    muter: (g) => g.replace("      var n = compter(f.test);", "      var n = 7;")
  },
  {
    nom: "Le nombre d'urgents affiche est ecrit a la main",
    muter: (g) => g.replace("{ val: compter(function(e){ return e.importance === 1; }), lib:\"urgents, argent ou client en jeu\", accent:true }",
      "{ val: 5, lib:\"urgents, argent ou client en jeu\", accent:true }")
  },
  {
    nom: "L'apercu retombe sur la premiere ligne, les trois choix deviennent identiques",
    muter: (g) => g.replace('b.appendChild(el("div","apercu", apercuReponse(r.texte)));',
      'b.appendChild(el("div","apercu", r.texte.split("\\n")[0]));')
  },
  {
    nom: "La reponse choisie est tronquee au lieu d'etre reprise mot pour mot",
    muter: (g) => g.replace("document.getElementById(\"zone-texte\").value = r.texte;",
      "document.getElementById(\"zone-texte\").value = r.texte.slice(0, 40);")
  },
  {
    nom: "L'assignation nomme n'importe qui",
    muter: (g) => g.replace("conf.textContent = \"Assigne a \" + qui.nom + \", \" + qui.role.toLowerCase()",
      "conf.textContent = \"Assigne a un collaborateur\" + (\"\")")
  },
  {
    nom: "Un code interne P1 ressort dans la fiche de detail",
    muter: (g) => g.replace("[\"Importance\", libelleImportance(e.importance)],",
      "[\"Importance\", \"P\" + e.importance],")
  },
  {
    nom: "Le briefing cesse de citer les urgents",
    muter: (g) => g.replace("    urgents.forEach(function(e){\n      lignes.push(\"- \" + e.de + \" : \" + e.sujet",
      "    [].forEach(function(e){\n      lignes.push(\"- \" + e.de + \" : \" + e.sujet")
  },
  {
    nom: "L'etat vide de la file redevient un cul-de-sac (lecon 20)",
    muter: (g) => g.replace("v.appendChild(el(\"h2\",null,\"Votre matinee est faite\"));",
      "v.appendChild(el(\"h2\",null,\"Rien ici\"));")
  },
  {
    nom: "TEMOIN INERTE, une variable interne est renommee",
    inerte: true,
    muter: (g) => g.replace(/function vider\(n\)\{ while \(n\.firstChild\) n\.removeChild\(n\.firstChild\); \}/,
      "function vider(noeud){ while (noeud.firstChild) noeud.removeChild(noeud.firstChild); }")
  }
];

/* ------------------------------------------------------------------ */
function main() {
  const gabarit = fs.readFileSync(CHEMIN_GABARIT, "utf8");
  const donnees = JSON.parse(fs.readFileSync(CHEMIN_DONNEES, "utf8"));
  const rouge = process.argv.indexOf("--rouge") !== -1;

  if (!rouge) {
    const h = piloter(assembler(gabarit, donnees), donnees);
    if (h.echecs.length > 0) {
      console.error("ECHEC, " + h.echecs.length + " assertion(s) rouge(s) sur " + h.compte() + " :");
      h.echecs.forEach((e) => console.error("  - " + e));
      process.exit(1);
    }
    console.log("VERT, " + h.compte() + " assertions passees en pilotant l'interface.");
    return;
  }

  console.log("Mode mutations du code produit, " + MUTATIONS.length + " mutations dont "
    + MUTATIONS.filter((m) => m.inerte).length + " temoin inerte.\n");
  let rates = 0;
  /* LECON 21, payee une TROISIEME fois dans cette maison, et cette fois elle rendait
     QUATRE mutations INERTES sans que personne ne le reprenne : le gabarit est stocke en
     CRLF, et tout motif de mutation ecrit avec un "\n" ne trouve alors rien. Les mutations
     d'une seule ligne marchaient, les multi-lignes etaient muettes, et le harnais annoncait
     donc quatre preuves qu'il n'avait jamais faites. On normalise le gabarit en LF AVANT
     d'appliquer les motifs, une bonne fois pour toute la classe de defaut, au lieu de
     reparer les motifs un par un en attendant le cinquieme. */
  const gabaritLF = gabarit.replace(/\r\n/g, "\n");
  MUTATIONS.forEach((m, i) => {
    const mute = m.muter(gabaritLF);
    if (mute === gabaritLF) {
      console.error("  [" + (i + 1) + "] MUTATION SANS EFFET, elle ne prouve rien : " + m.nom);
      rates++;
      return;
    }
    let h;
    try {
      h = piloter(assembler(mute, donnees), donnees);
    } catch (err) {
      /* Une mutation qui fait planter la page est attrapee, c'est un echec franc. */
      h = { echecs: ["exception : " + err.message], compte: () => 0 };
    }
    const attrapee = h.echecs.length > 0;
    if (m.inerte) {
      if (attrapee) {
        console.error("  [" + (i + 1) + "] TEMOIN ROUGE A TORT : " + m.nom + " (" + h.echecs[0] + ")");
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
