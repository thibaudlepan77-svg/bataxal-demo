#!/usr/bin/env node
/**
 * verifier-publication.js
 *
 * Lecon 37 : deux artefacts qui se disputent une racine finissent par se servir l'un a
 * la place de l'autre, et AUCUN test local ne peut le voir parce que les deux adresses
 * repondent 200. Ce controle-ci va chercher ce que le PROSPECT recoit vraiment a
 * l'adresse publiee, et refuse tout ce qui n'est pas exactement cette demonstration.
 *
 *   node verifier-publication.js            controle l'adresse publiee
 *   node verifier-publication.js --rouge    prouve que le controle sait rougir
 *                                           (on le pointe vers un AUTRE artefact public
 *                                            de la maison, il doit echouer)
 */
const fs = require("fs");
const path = require("path");

const RACINE = __dirname;
/* Adresse unique et propre de cette demonstration. Ce depot ne sert QUE ce fichier. */
const ADRESSE = "https://thibaudlepan77-svg.github.io/bataxal-demo/";
/* Un autre artefact public de la maison, utilise UNIQUEMENT comme leurre en mode --rouge. */
const LEURRE = "https://thibaudlepan77-svg.github.io/recouvrement-daf/";

let passes = 0;
const echecs = [];
function ok(cond, message) {
  if (cond) { passes++; } else { echecs.push(message); }
}
function egal(obtenu, attendu, message) {
  ok(obtenu === attendu, message + " (attendu " + JSON.stringify(attendu) + ", obtenu " + JSON.stringify(obtenu) + ")");
}

async function main() {
  const rouge = process.argv.includes("--rouge");
  const cible = rouge ? LEURRE : ADRESSE;

  const local = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  const readme = fs.readFileSync(path.join(RACINE, "README.md"), "utf8");

  /* --- 1. Une seule adresse, ecrite au meme endroit partout ------- */
  if (!rouge) {
    ok(readme.indexOf(ADRESSE) !== -1,
      "Le README doit publier EXACTEMENT l'adresse controlee ici : " + ADRESSE);
    const autresPages = fs.readdirSync(RACINE).filter((f) => /\.html$/.test(f) && f !== "index.html" && f !== "demo.gabarit.html");
    egal(autresPages.length, 0,
      "Aucun autre fichier HTML ne doit vivre a la racine du depot publie (lecon 37) : " + autresPages.join(", "));
  }

  /* --- 2. Ce que le prospect recoit vraiment --------------------- */
  let reponse, servi;
  try {
    reponse = await fetch(cible, { redirect: "follow" });
    servi = await reponse.text();
  } catch (e) {
    echecs.push("L'adresse publiee ne repond pas : " + cible + " (" + e.message + ")");
    return conclure(rouge, cible);
  }
  egal(reponse.status, 200, "L'adresse publiee doit repondre 200 : " + cible);

  /* --- 3. C'est bien CETTE demonstration, pas une voisine --------- */
  const empreintes = [
    "Ndiaye & Fils",          // la PME fictive de cette demonstration
    "Bataxal",                // le produit
    "id=\"texte-bandeau\"",   // le bandeau d'honnetete
    "wa.me/221784266546"      // le chemin de retour vers la maison
  ];
  empreintes.forEach((e) => {
    ok(servi.indexOf(e) !== -1,
      "L'adresse publiee ne sert pas cette demonstration, empreinte absente : " + e);
  });

  /* --- 4. C'est bien la MEME version que celle qui a ete prouvee -- */
  const norm = (s) => s.replace(/\r\n/g, "\n");   // lecon 21 : normaliser avant de mesurer
  const octetsServis = Buffer.byteLength(norm(servi), "utf8");
  const octetsLocaux = Buffer.byteLength(norm(local), "utf8");
  ok(Math.abs(octetsServis - octetsLocaux) <= 64,
    "L'adresse publiee sert une AUTRE version que celle prouvee ici (servi " +
    octetsServis + " octets, local " + octetsLocaux + ")");

  /* --- 5. Les garde-fous d'honnetete tiennent EN LIGNE aussi ------ */
  ["221771234567", "client pilote", "en service chez"].forEach((interdit) => {
    ok(servi.toLowerCase().indexOf(interdit.toLowerCase()) === -1,
      "Ce qui est SERVI au prospect contient une chaine interdite : " + interdit);
  });
  ok(/deploye en production/i.test(servi),
    "Ce qui est SERVI au prospect doit porter l'affirmation verifiable de production");

  /* --- 6. La carte d'apercu du lien doit exister EN LIGNE --------- */
  /* Une balise og:image qui pointe sur un fichier absent est pire que pas de balise :
     l'agregateur affiche un cadre vide. C'est la premiere chose que voit le prospect
     quand le lien arrive sur son WhatsApp. */
  const image = (servi.match(/<meta property="og:image" content="([^"]*)"/) || [, ""])[1];
  ok(/^https:\/\//.test(image), "og:image servi doit etre une adresse absolue (obtenu " + image + ")");
  if (/^https:\/\//.test(image)) {
    try {
      const ri = await fetch(image);
      egal(ri.status, 200, "La carte d'apercu doit repondre 200 : " + image);
      const type = (ri.headers.get("content-type") || "");
      ok(/image\//.test(type), "La carte d'apercu doit etre servie comme une image (obtenu " + type + ")");
      const buf = Buffer.from(await ri.arrayBuffer());
      ok(buf.length > 5000, "La carte d'apercu servie est vide ou tronquee (" + buf.length + " octets)");
      ok(buf[0] === 0x89 && buf[1] === 0x50, "La carte d'apercu servie n'est pas un PNG");
    } catch (e) {
      echecs.push("La carte d'apercu ne repond pas : " + image + " (" + e.message + ")");
    }
  }

  conclure(rouge, cible);
}

function conclure(rouge, cible) {
  if (rouge) {
    if (echecs.length === 0) {
      console.error("ECHEC. Pointe vers un AUTRE artefact (" + cible + "), le controle est reste VERT.");
      console.error("Il ne discrimine donc rien, et il ne verrait pas deux artefacts se disputer une racine.");
      process.exit(1);
    }
    console.log("VERT, le controle rougit bien quand l'adresse sert autre chose (" +
      echecs.length + " echecs sur le leurre " + cible + ").");
    console.log("  premier echec : " + echecs[0]);
    return;
  }
  if (echecs.length > 0) {
    console.error("ECHEC, " + echecs.length + " controle(s) rouge(s) sur " + cible + " :");
    echecs.forEach((m) => console.error("  - " + m));
    process.exit(1);
  }
  console.log("VERT, " + passes + " controles passes sur l'adresse publiee " + cible);
}

main();
