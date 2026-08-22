"use strict";
/**
 * Vocabulaire d'accents, partage par les deux oracles.
 *
 * Ce produit vend la comprehension du francais professionnel. Une page ecrite sans
 * accents detruit l'argument avant la premiere fonction, et aucun controle de
 * coherence ne peut le voir : ils cherchent des idees, pas des graphies.
 *
 * Le vocabulaire est ecrit en francais CORRECT. Le radical a chercher en est DERIVE,
 * jamais ecrit a la main : il court du debut du mot jusqu'apres le dernier caractere
 * accente, avec un minimum de cinq lettres. Ecrire les radicaux a la main est
 * exactement ce qui a failli rendre ce controle inerte : "publicit" est un prefixe de
 * "publicite" ET de "publicité", il aurait donc mordu sur les deux, donc sur rien.
 * `radicaux()` s'auto-teste : tout radical qui se retrouve dans la graphie correcte
 * est signale au lieu d'etre utilise (lecon 39, casser la sonde avant de la croire).
 *
 * Trois mots ont ete RETIRES et ne doivent pas y revenir :
 *   "premiere" — le masculin "premier" est correct sans accent, et la page en porte un ;
 *   "donnees"  — le verbe "donne" est correct, "Voir ce que cela donne" est dans la page ;
 *   "Senegal"  — la signature fictive "SENEGINDIA BTP" est un nom propre ;
 *   "complete" — le masculin "complet" est correct, "le devis complet" est dans les donnees.
 * Chacun donnait un faux rouge, et un faux rouge finit toujours par etre desactive
 * (lecon 28).
 */

const VOCABULAIRE = [
  "résumé", "répondre", "répondu", "réponse", "catégorie", "échéance", "événement",
  "démonstration", "déployé", "pièce", "délai", "matériaux", "dépôt",
  "prélèvement", "règlement", "référence", "réception", "matinée", "journée",
  "vérifier", "sécuriser", "téléchargement", "publicité", "problème", "créer",
  "aperçu", "honnêteté", "négocier", "déranger", "concernée", "numéro", "français",
  "espérer", "activité", "comptabilité", "priorité", "équipe",
  "échelonner", "école", "désolé", "détail", "différencier", "disponibilité",
  "expéditeur", "expérience", "immédiatement", "mérite", "moitié", "obligé",
  "préparation", "présent", "procéder", "réactivité", "récapitulatif", "régler",
  "réhabilitation", "rénovation", "rentrée", "réseau", "résidence", "spontanée",
  "systématiquement", "visibilité", "électricité", "établissement", "évacuation",
  "éviter", "plutôt", "quantité", "énergie", "région",
  "façon", "triée", "triés", "règle", "boîte", "août", "reçu",
];

/**
 * Trop courts pour etre cherches comme radicaux : ils exigent des bornes non-lettres,
 * ecrites a la main car \b est ASCII en JS et couperait sur une lettre accentuee
 * (lecon 15).
 */
const MOTS_COURTS = ["ete", "deja", "tres", "apres", "meme", "cout", "arret", "hotel",
  "prete", "metre", "etant"];

const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** [{ mot, radical }] pour chaque entree du vocabulaire. */
function radicaux() {
  return VOCABULAIRE.map((mot) => {
    const bas = mot.toLowerCase();
    const nu = sansAccent(bas);
    let dernier = -1;
    for (let i = 0; i < bas.length; i++) if (bas[i] !== nu[i]) dernier = i;
    /* Au moins cinq lettres : un radical de deux lettres ("re" pour "regler") mordrait
       sur la moitie de la page. L'accent reste dans la tranche, donc la discrimination
       est preservee, ce que l'auto-test verifie mot par mot. */
    return { mot: bas, radical: nu.slice(0, Math.min(nu.length, Math.max(dernier + 1, 5))) };
  });
}

/** Motif borne pour un mot court, sans \b (ASCII) qui couperait sur une lettre accentuee. */
function motifCourt(mot) {
  return new RegExp("(^|[^a-z\\u00e0-\\u00ff])" + mot + "([^a-z\\u00e0-\\u00ff]|$)", "i");
}

module.exports = { VOCABULAIRE, MOTS_COURTS, sansAccent, radicaux, motifCourt };
