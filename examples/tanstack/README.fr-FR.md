[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Better Auth Solana Payments – Exemple de TanStack Start

Cet exemple suit la même structure TanStack Start que l'exemple d'intégration Paystack et
illustre le flux complet et unique du jeton SPL :

1. Créez un compte Better Auth et connectez-vous.
2. Créez une intention de paiement via `better-auth-solana-payments`.
3. Ouvrez l'URL Solana Pay générée par le serveur dans un portefeuille.
4. Vérifiez le transfert par rapport à devnet RPC et observez l'état `paid`.

L'exemple utilise l'adaptateur en mémoire de Better Auth pour plus de simplicité. Le redémarrage du serveur de développement s'efface
comptes et intentions de paiement ; utilisez un véritable adaptateur avant le déploiement. Le tableau de bord stocke uniquement les
références opaques qu'il a créées dans le navigateur et actualise chaque référence via le plugin
point de terminaison `payment.get` limité au propriétaire.


## Flux démontré

1. Créez un compte ou connectez-vous avec votre e-mail et votre mot de passe.
2. Saisissez le montant du jeton d'unité d'affichage et créez une intention de paiement.
3. Ouvrez l'URL Solana Pay générée par le serveur dans un portefeuille compatible.
4. Approuvez le transfert dans le portefeuille.
5. Vérifiez le paiement en chaîne via le serveur et inspectez le statut et l'historique du paiement.

L’interface utilisateur montre également les états d’intention de chargement, d’erreur, en attente, payé et expiré. Un portefeuille
la redirection n’est jamais considérée comme une preuve de paiement.


## Exécutez-le

```bash
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to a devnet SPL token and recipient.
pnpm install
pnpm dev
```

Ouvrez <http://localhost:3000>.

L'exemple ne stocke jamais les clés privées et ne signe ni ne soumet jamais de transaction. Le portefeuille fait
ça. Vous avez besoin d'un portefeuille Devnet financé avec le jeton SPL configuré. Le `SOLANA_USDT` par défaut
preset est un jeton du réseau principal, ne l'utilisez donc pas pour cet exemple devnet.


## Portée

`better-auth-solana-payments` prend en charge uniquement les paiements uniques. Cet exemple fait intentionnellement
ne pas ajouter d'abonnements, de catalogues de produits, de portails de facturation, de paiement par carte ou de portefeuille côté client
signature. Le destinataire configuré, le mint, les décimales du jeton, l'expiration et la vérification RPC restent
appartenant au serveur.


## Valider la configuration du devnet

Le script Smoke vérifie l'état du RPC et crée une demande de paiement sans signer ni soumettre de formulaire.
transaction :

```bash
pnpm test:devnet
```

Pour vérifier un transfert réel après avoir terminé le flux du navigateur, fournissez la référence de paiement et
signature de transaction du portefeuille :

```bash
SOLANA_SIGNATURE=... SOLANA_REFERENCE=... pnpm test:devnet
```

Le script utilise les même mint, destinataire, décimales et URL RPC que l'exemple d'application. Un succès
le flux du navigateur est le suivant : créer un compte, créer un paiement, ouvrir l'URL du portefeuille, approuver le transfert,
puis cliquez sur **Vérifier le paiement en chaîne**.

Pour la production, remplacez l'adaptateur mémoire par un adaptateur Better Auth persistant, définissez un
`BETTER_AUTH_SECRET` et utilisez un fournisseur RPC dédié. Ne mettez jamais de clés privées dans cet exemple ou
dans les variables d'environnement du serveur.
