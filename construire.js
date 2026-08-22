#!/usr/bin/env node
"use strict";
/**
 * Fabrique index.html en injectant data/boite-fictive.json dans demo.gabarit.html.
 *
 * Pourquoi un assemblage plutot qu'un fichier ecrit a la main : la demonstration doit
 * rester UN SEUL fichier ouvrable hors ligne (un prospect a Dakar, sur telephone), donc
 * les donnees ne peuvent pas etre chargees en fetch depuis file://. Mais des donnees
 * recopiees a la main dans le HTML derivent en silence. L'assemblage garde une source
 * unique, et le verificateur controle que index.html est bien a jour (mode --verifier).
 */

const fs = require("fs");
const path = require("path");

const RACINE = __dirname;
const GABARIT = path.join(RACINE, "demo.gabarit.html");
const DONNEES = path.join(RACINE, "data", "boite-fictive.json");
const SORTIE = path.join(RACINE, "index.html");
const MARQUEUR = "/*DONNEES*/";

function assembler() {
  const gabarit = fs.readFileSync(GABARIT, "utf8");
  const brut = fs.readFileSync(DONNEES, "utf8");

  // Echec ferme : sans marqueur, on produirait une page sans donnees, silencieusement vide.
  if (gabarit.indexOf(MARQUEUR) === -1) {
    throw new Error("Marqueur " + MARQUEUR + " absent de demo.gabarit.html, assemblage impossible.");
  }
  const donnees = JSON.parse(brut); // valide le JSON, un JSON casse doit arreter la fabrication
  if (!Array.isArray(donnees.emails) || donnees.emails.length === 0) {
    throw new Error("data/boite-fictive.json ne contient aucun email.");
  }
  // Un "</script>" dans les donnees fermerait la balise et casserait la page.
  const compact = JSON.stringify(donnees);
  if (/<\/script/i.test(compact)) {
    throw new Error("Les donnees contiennent une balise de fermeture de script.");
  }
  // Remplacement par fonction : sinon les $ des donnees seraient interpretes par replace.
  return gabarit.replace(MARQUEUR, function () { return compact; });
}

function main() {
  const attendu = assembler();
  if (process.argv.indexOf("--verifier") !== -1) {
    const actuel = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, "utf8") : null;
    if (actuel === null) {
      console.error("ECHEC, index.html n'existe pas. Lancer : node construire.js");
      process.exit(1);
    }
    if (actuel.replace(/\r\n/g, "\n") !== attendu.replace(/\r\n/g, "\n")) {
      console.error("ECHEC, index.html n'est plus a jour avec le gabarit ou les donnees. Lancer : node construire.js");
      process.exit(1);
    }
    console.log("OK, index.html est a jour (" + Buffer.byteLength(attendu, "utf8") + " octets).");
    return;
  }
  fs.writeFileSync(SORTIE, attendu, "utf8");
  console.log("index.html fabrique, " + Buffer.byteLength(attendu, "utf8") + " octets.");
}

main();
