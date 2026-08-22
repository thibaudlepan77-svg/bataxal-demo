#!/usr/bin/env node
/**
 * carte-apercu.js — fabrique apercu.png (1200x630), la carte que WhatsApp, LinkedIn et
 * les moteurs affichent quand on colle l'adresse de la demonstration.
 *
 * Les quatre chiffres sont RECALCULES depuis data/boite-fictive.json, jamais ecrits a la
 * main : une carte qui annoncerait 3 urgents pendant que la demonstration en montre 4
 * serait un mensonge que personne ne verrait (lecon : aucun compteur ecrit a la main).
 *
 *   node carte-apercu.js            fabrique apercu.png
 *   node carte-apercu.js --verifier controle qu'il existe et qu'il est coherent
 */
const fs = require("fs");
const path = require("path");
const RACINE = __dirname;
const SORTIE = path.join(RACINE, "apercu.png");
const CHEMIN_PW = "C:/Users/alpha/Downloads/JAAYLEER/REVENTE-CRM/saas-crm/node_modules/playwright";

function chiffres() {
  const d = JSON.parse(fs.readFileSync(path.join(RACINE, "data", "boite-fictive.json"), "utf8"));
  /* Le champ vaut 1 a 4, PAS "P1" a "P4" : ecrit d'abord en "P1", ce filtre rendait 0
     partout et la verification disait quand meme OK. Un compte a zero n'est jamais un
     resultat valide ici, il est traite comme une PANNE (voir plus bas). */
  const par = (n) => d.emails.filter((e) => Number(e.importance) === n).length;
  const c = {
    urgents: par(1),
    importants: par(2),
    calmes: par(3) + par(4),
    total: d.emails.length
  };
  if (c.total === 0 || c.urgents + c.importants + c.calmes !== c.total) {
    console.error("ECHEC, les chiffres de la carte ne se recomposent pas depuis les donnees : " +
      JSON.stringify(c) + ". La carte annoncerait autre chose que la demonstration.");
    process.exit(1);
  }
  return c;
}

function gabarit(c) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#17171B;color:#F7F5F0;
       font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
       padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .haut{display:flex;align-items:center;gap:16px}
  .logo{width:64px;height:64px;border-radius:16px;background:#0E8B5A;color:#fff;
        font-size:38px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .marque{font-size:38px;font-weight:700;letter-spacing:-.5px}
  .marque span{color:#0E8B5A}
  h1{font-size:60px;line-height:1.08;font-weight:700;letter-spacing:-1.5px;max-width:1000px}
  h1 em{font-style:normal;color:#0E8B5A}
  .chiffres{display:flex;gap:20px}
  .c{flex:1;background:#212127;border-radius:18px;padding:22px 24px}
  .c .n{font-size:46px;font-weight:700;line-height:1}
  .c .l{font-size:17px;color:#ADAEB5;margin-top:8px;line-height:1.25}
  .c1 .n{color:#D6453A} .c2 .n{color:#DE8A1F} .c3 .n{color:#ADAEB5} .c4 .n{color:#F7F5F0}
  .bas{display:flex;justify-content:space-between;align-items:center;font-size:20px;color:#8A8B93}
  .bas b{color:#F7F5F0;font-weight:600}
  </style>
  <div class="haut"><div class="logo">B</div><div class="marque">Bataxa<span>l</span></div></div>
  <h1>Votre boite mail, <em>triee</em>.<br>Ce qui compte en premier, le reste plus tard.</h1>
  <div class="chiffres">
    <div class="c c1"><div class="n">${c.urgents}</div><div class="l">urgents, argent ou client en jeu</div></div>
    <div class="c c2"><div class="n">${c.importants}</div><div class="l">importants, une reponse est attendue</div></div>
    <div class="c c3"><div class="n">${c.calmes}</div><div class="l">ne demandent rien de vous</div></div>
    <div class="c c4"><div class="n">${c.total}</div><div class="l">emails recus depuis hier soir</div></div>
  </div>
  <div class="bas"><div>Demonstration <b>sans compte</b>, donnees fictives</div><div>Jaayleer, Dakar</div></div>
  </html>`;
}

async function main() {
  const c = chiffres();
  if (process.argv.includes("--verifier")) {
    if (!fs.existsSync(SORTIE)) { console.error("ECHEC, apercu.png n'existe pas. Lancer : node carte-apercu.js"); process.exit(1); }
    const o = fs.statSync(SORTIE).size;
    if (o < 5000) { console.error("ECHEC, apercu.png fait " + o + " octets, il est vide ou tronque."); process.exit(1); }
    if (c.urgents === 0 || c.importants === 0) {
      console.error("ECHEC, la carte annoncerait 0 urgent ou 0 important : le filtre lit le mauvais champ.");
      process.exit(1);
    }
    console.log("OK, apercu.png present (" + o + " octets), chiffres source " +
      c.urgents + "/" + c.importants + "/" + c.calmes + "/" + c.total + ".");
    return;
  }
  const { chromium } = require(CHEMIN_PW);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(gabarit(c), { waitUntil: "load" });
  await p.screenshot({ path: SORTIE });
  await b.close();
  console.log("apercu.png fabrique, " + fs.statSync(SORTIE).size + " octets.");
}
main();
