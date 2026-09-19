# Bot WhatsApp — King Food chez Hassan, Aigle

Prototype fonctionnel d’un bot semi-automatique pour le **079 717 18 60**.

## Ce qui fonctionne

- Choix à emporter ou livraison.
- Catalogue des six fiches fournies avec prix et suppléments.
- Dernières corrections du Tasty Crousty.
- Livraison offerte à Aigle/Yvorne dès 22 CHF.
- Zone 2 dès 35 CHF avec 5 CHF de frais.
- Panier, calcul du total, commune, adresse, prénom et heure.
- La commande n’est jamais confirmée automatiquement.
- Écran iPhone `/` avec alarme, délai, Accepter et Refuser.
- Webhook officiel WhatsApp Cloud API et mode de simulation.

## Démarrage local

```bash
npm install
cp .env.example .env
npm start
```

Ouvrir `http://localhost:3000` sur le navigateur. Pour simuler un message :

```bash
curl -X POST http://localhost:3000/api/demo -H 'Content-Type: application/json' -d '{"from":"41790000000","text":"bonjour"}'
```

## Connexion au numéro réel

Créer/configurer le compte WhatsApp Business Platform dans Meta, puis renseigner `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `VERIFY_TOKEN` et l’URL publique du webhook. Vérifier au préalable que la méthode d’intégration choisie permet de conserver l’usage souhaité de l’application WhatsApp Business sur l’iPhone.

## À confirmer avant mise en production

- Ce qui est inclus avec le Grec maison à 18.90 CHF (photo montrant frites et canette).
- Boissons disponibles.
- Horaires de prise de commandes/livraison.
- Limite exacte de viandes du Tacos XL et KING Tacos.
- Les produits indisponibles doivent pouvoir être désactivés.

## Sécurité/production

Le prototype conserve les commandes en mémoire. Avant usage réel, ajouter une base de données, authentifier l’écran de validation, vérifier la signature Meta du webhook, journaliser les erreurs et déployer en HTTPS.
