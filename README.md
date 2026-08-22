# BATAXAL, demonstration publique

**Adresse publique, unique et definitive : https://thibaudlepan77-svg.github.io/bataxal-demo/**

Un seul fichier, `index.html`. On l'ouvre, on voit le produit. Pas de compte, pas de
connexion a une boite mail, pas de reseau, pas de build a l'ouverture.

Ce depot ne sert QUE cette demonstration. La page de vente BATAXAL, quand elle
existera, aura sa propre adresse et ne viendra jamais se poser sur cette racine
(lecon 37 : deux artefacts qui se disputent une racine finissent par se servir l'un a
la place de l'autre, et les deux repondent 200, donc aucun test local ne le voit).
`verifier-publication.js` va chercher ce qui est REELLEMENT servi a cette adresse.

Ce depot est public parce que l'hebergement de la page l'exige. Les documents de
chantier (cadrage, revues) restent hors du depot : ils parlent de clients et de
strategie, ils n'ont rien a faire sur une page publique.

## A qui ca s'adresse

Un dirigeant de PME qui recoit entre vingt et cent emails par jour, en francais, et qui
perd sa matinee a chercher lesquels engagent de l'argent ou un client. Cette page lui
montre le resultat en une minute, sans rien installer et sans donner acces a sa boite.

## Ce que la demonstration montre

Une PME fictive de Dakar, Ndiaye & Fils, quincaillerie et materiaux, 24 emails recus
depuis la veille au soir.

1. **La comparaison.** Une bascule "Sans Bataxal" / "Avec Bataxal" sur les MEMES 24 emails.
   Sans, l'ordre d'arrivee et rien d'autre. Avec, importance, categorie, resume, etat.
   C'est l'argument, et il se voit en une seconde.
2. **Les quatre chiffres.** 3 urgents, 5 importants, 16 qui ne demandent rien, 24 recus.
   Tous calcules a l'execution depuis les donnees, jamais ecrits a la main.
3. **Le bandeau "A traiter en premier"**, jusqu'a trois cartes, avec l'action et l'echeance.
   Il disparait quand tout est traite, l'ecran se calme, c'est la recompense.
4. **Le detail d'un email** : resume, importance, categorie, action attendue, echeance, et
   trois reponses redigees de trois tons differents. On en choisit une, on garde la main
   sur le texte, on envoie, on transfere sur WhatsApp, ou on assigne a un collaborateur.
5. **Le briefing de 8 h**, tel qu'il arrive sur WhatsApp, genere depuis les memes donnees.
6. **Les regles de routage**, ecrites en francais, avec le nombre d'emails que chacune a
   traites sans deranger le patron.

## Honnetete

Le bandeau noir, present sur tous les ecrans, dit trois choses et elles sont vraies :
l'entreprise et les emails sont fictifs, aucune boite n'est connectee et aucun compte
n'est cree, **les analyses affichees ont ete produites a l'avance pour cette
demonstration**. Simuler un appel de modele en laissant croire qu'il a lieu serait une
preuve fabriquee. Ce qui est demontre ici, c'est le RESULTAT et l'interface reelle du
produit, pas le moteur en train de tourner. Le bouton WhatsApp le redit : rien n'est
envoye.

Aucune donnee reelle d'aucun client n'apparait. Le verificateur le controle explicitement,
et il ECHOUE si ce controle ne peut pas avoir lieu.

## Fabrication et preuve

```
npm install          # jsdom, uniquement pour le harnais
node construire.js   # assemble data/boite-fictive.json + demo.gabarit.html => index.html
npm test             # la sequence complete de preuve
```

`npm test` enchaine cinq etapes, toutes bloquantes :

| Etape | Ce qu'elle prouve | Etat au 2026-08-22 |
|---|---|---|
| `construire.js --verifier` | `index.html` est bien a jour avec sa source | OK |
| `carte-apercu.js --verifier` | la carte d'apercu du lien existe et est coherente | OK |
| `verifier.js` | coherence des donnees, regles produit, charte, honnetete | 894 controles verts |
| `verifier.js --rouge` | chaque controle PEUT virer au rouge | 17/17 mutations attrapees |
| `verifier-dom.js` | l'interface pilotee au clic fait ce qu'elle promet | 96 assertions vertes |
| `verifier-dom.js --rouge` | idem sur le code produit | 16/16 mutations attrapees |
| `verifier-publication.js` | l'adresse publiee sert bien CETTE demo, a jour | a lancer apres publication |
| `verifier-publication.js --rouge` | pointe sur un autre artefact, il doit rougir | 1 leurre |

Chaque mode `--rouge` embarque un **temoin inerte** : une modification qui ne change rien
d'observable, et qui doit rester VERTE. Sans lui, on ne distingue pas un harnais qui
discrimine d'un harnais qui rougit sur n'importe quoi.

### Ce que ces 990 controles NE prouvent PAS

jsdom n'est pas un navigateur. Il ne mesure ni hauteur rendue, ni contraste, ni
debordement, et il implemente parfois lui-meme la regle qu'on croit tester. **Toute
question de visibilite reelle reste hors de sa portee.** Elle se traite dans un vrai
navigateur, et les mesures de la derniere passe sont consignees dans
`REVUE-NAVIGATEUR.md`. Deux defauts reels de cette demonstration ont ete trouves la, et
nulle part ailleurs.

## Structure

```
data/boite-fictive.json   source unique des 24 emails, de l'equipe et des regles
demo.gabarit.html         interface, styles et logique
construire.js             assemble les deux en index.html (et verifie la synchronisation)
index.html                 LE livrable, autoportant, a ouvrir ou a publier tel quel
verifier.js               oracle donnees + source, avec mutations
verifier-dom.js           harnais qui pilote l'interface, avec mutations
apercu.png                la carte affichee quand le lien est colle sur WhatsApp
carte-apercu.js           la fabrique, chiffres recalcules depuis les memes donnees
```

## Ce qui reste a faire, par ordre de valeur

1. **La page de vente et le prix public.** Bloques, et par une seule question : les prix
   BATAXAL sont-ils HT ou TTC, et quel est le plancher d'entree de gamme. Le meme
   arbitrage manque desormais pour la cinquieme fois dans la maison.
2. **Un ecran "ce que cela donne chez vous"**, le parcours de mise en service en trois
   etapes, entre la demonstration et le premier rendez-vous.
3. **Ouvrir la demonstration sur un vrai telephone**, pas seulement dans un navigateur
   redimensionne a 390 px.
