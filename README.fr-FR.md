[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Better Auth Solana Payments

Intégration de paiements Solana ponctuels pour [Better Auth](https://www.better-auth.com).

## Installation

```bash
pnpm add better-auth better-auth-solana-payments solana-payments
```

Nécessite Node.js 22.22.2 ou version ultérieure et solana-payments 1.x.

Les installations existantes doivent ajouter les champs de traitement avant la mise à niveau. Pour les noms de table et de colonne SQLite par défaut, voir `migrations/0.2.0-sqlite.sql` ; les schémas personnalisés doivent générer la migration Better Auth équivalente. Sauvegardez la base de données, vérifiez l’état d’exécution des lignes payantes, puis déployez.

## Configuration du serveur

Créez un client SDK Solana Payments en lecture seule et enregistrez le plugin Better Auth.

```ts
import { betterAuth } from "better-auth";
import { solanaPayments } from "better-auth-solana-payments";
import { SOLANA_USDT, createReadOnlySolanaPayments } from "solana-payments";

const client = createReadOnlySolanaPayments({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  token: SOLANA_USDT,
  commitment: "confirmed",
});

export const auth = betterAuth({
  plugins: [
    solanaPayments({
      client,
      recipient: process.env.SOLANA_RECIPIENT!,
    }),
  ],
});
```

## Configuration du client

```ts
import { createAuthClient } from "better-auth/client";
import { solanaPaymentsClient } from "better-auth-solana-payments/client";

export const authClient = createAuthClient({
  plugins: [solanaPaymentsClient()],
});
```

## Flux de paiement unique

```ts
const created = await authClient.payment.create({
  // A decimal string in the configured token's display units; never use a JavaScript number.
  amount: "2.5",
  metadata: { orderId: "order_123" },
});

if (created.data?.paymentUrl) {
  // Present this Solana Pay URL as a link or QR code for the signed-in customer.
  window.location.assign(created.data.paymentUrl);
}

const verified = await authClient.payment.verify({
  reference: created.data!.reference,
});

if (verified.data?.status === "paid" && verified.data.fulfillmentStatus === "completed") {
  // Grant the entitlement only after server-side verification and fulfillment complete.
}

const payment = await authClient.payment.get({
  reference: created.data!.reference,
});
```

`payment.create` conserve une intention de paiement en attente et renvoie sa référence et l'URL Solana Pay.
Une fois que le client a signé la transaction, appelez `payment.verify` avec cette référence. Le serveur
utilise son client RPC configuré pour vérifier le transfert de jeton correspondant avant de marquer le paiement
payé. `payment.get` lit l'état actuel sans tenter de vérification.

Les montants sont des chaînes décimales exprimées dans l’unité d’affichage du jeton configuré. Par exemple, `"2.5"` représente 2,5 USDT avec le jeton USDT par défaut, qui utilise six décimales. N’utilisez pas de nombres JavaScript : ils peuvent entraîner une perte de précision pour les montants de jetons.

Si le portefeuille a déjà renvoyé une signature de transaction, transmettez-la dans le champ facultatif `signature` de `payment.verify`. Le SDK vérifie d’abord cette transaction, puis analyse les transactions récentes si nécessaire. Dans les deux cas, il contrôle le mint configuré, le destinataire, le montant, le cluster et le niveau de commitment. Le plugin reprend le programme de jetons configuré dans le client SDK côté serveur. Les transferts Token-2022 de base sont pris en charge. Les mints comportant les extensions Transfer Fee ou Transfer Hook exigent une vérification tenant compte de ces extensions et ne sont pas acceptés comme transferts ordinaires. Consultez les [conseils de vérification des paiements de Solana](https://solana.com/docs/payments/accept-payments/verification-tools) et la [documentation sur les extensions de jetons](https://solana.com/docs/tokens/extensions) pour configurer un mint.

Le navigateur peut fournir le montant, des métadonnées facultatives, la référence, une signature de transaction facultative et un identifiant d’organisation facultatif. Le serveur contrôle le destinataire et la configuration du jeton ; le client ne peut donc ni rediriger les fonds ni choisir un autre mint. L’intégration utilise un client RPC en lecture seule : elle ne stocke aucune clé privée et ne signe ni n’envoie jamais de transaction pour le compte d’un client.

Ce package prend uniquement en charge les paiements ponctuels. Il ne crée pas d’abonnements et n’effectue pas de prélèvements récurrents.

## Exemple de démarrage de TanStack

Le dépôt contient un exemple TanStack Start exécutable dans [`examples/tanstack`](./examples/tanstack). Il présente l’authentification par e-mail et mot de passe, la création de demandes Solana Pay côté serveur, le paiement par portefeuille et la vérification côté serveur via le RPC de devnet.

```bash
cd examples/tanstack
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to your devnet SPL token and recipient.
pnpm install
pnpm dev
```

L’exemple utilise un adaptateur en mémoire et sert uniquement au développement local. Il ne stocke pas de clés privées et ne soumet pas de transactions. Consultez son README pour le test RPC reproductible sur la chaîne (`pnpm test:devnet`) et le parcours complet de vérification avec portefeuille.

Pour devnet, configurez le mint d’un jeton SPL de devnet. Le preset `SOLANA_USDT` intégré correspond au mint USDT de mainnet et ne doit pas être utilisé pour les tests sur devnet. En production, utilisez un adaptateur Better Auth persistant, un `BETTER_AUTH_SECRET` généré et un fournisseur RPC dédié.

### Migration et tentatives d'exécution

Générez et appliquez la migration du schéma Better Auth avant la mise à niveau. Ajoutez à `solanaPayment` les champs `fulfillmentStatus` (avec `pending` comme valeur par défaut), `fulfillmentToken` (nullable) et `fulfillmentClaimedAt` (nullable). Avant d’accepter de nouvelles demandes, renseignez `completed` pour les lignes déjà payées afin de ne pas exécuter une seconde fois les paiements historiques.

Le règlement du paiement et son exécution (fulfillment) sont deux étapes distinctes. La vérification enregistre le statut `paid`, puis réclame un bail en base de données avant d’appeler `onPaymentComplete`. Si le callback échoue, la requête renvoie une erreur et l’exécution reste en attente ; relancez la vérification pour réessayer, y compris après un redémarrage. Une réservation laissée par un processus interrompu peut être récupérée après cinq minutes. Rendez les callbacks idempotents à l’aide de la référence de paiement : un processus peut s’interrompre après un effet externe, avant que son achèvement soit enregistré. Les réponses exposent `fulfillmentStatus` ; n’accordez l’accès que lorsqu’il vaut `completed`.

## Cas limites de règlement et opérationnels

### Profondeur de confirmation

Le vérificateur du SDK exige au minimum le niveau `confirmed`, même si son client est configuré avec `processed`. Si votre application exige l’état de règlement le plus fort avant d’exécuter la commande, configurez `commitment: "finalized"` ; une transaction simplement confirmée ne sera alors pas acceptée. Il s’agit d’une politique de commitment, et non d’un nombre configurable de confirmations. Toute transaction dont l’exécution a échoué est rejetée, quel que soit le niveau de commitment. Consultez les [définitions des niveaux de commitment de Solana](https://solana.com/docs/rpc#configuring-state-commitment).

Affichez un état « en attente de confirmation » et relancez la vérification côté serveur avec un délai exponentiel plafonné pour un transfert non réglé ou une erreur RPC. À lui seul, `PAYMENT_MISMATCH` ne permet pas de distinguer un transfert non confirmé, un transfert absent, un jeton ou un réseau incorrect, ou une erreur du fournisseur. Une notification de réussite du portefeuille dans le navigateur ne prouve pas le règlement. Accordez un droit uniquement si la réponse contient à la fois `status === "paid"` et `fulfillmentStatus === "completed"`.

Choisissez le niveau de commitment avant d’accepter des paiements et conservez-le. Une intention déjà payée réessaie l’exécution sans revérifier la chaîne ; passer ensuite le client à `finalized` ne met donc pas automatiquement à niveau les paiements confirmés déjà enregistrés.

### Vérification et rappels en double

Les appels répétés de vérification depuis le navigateur utilisent le paiement déjà enregistré. Une mise à jour conditionnelle en base de données n’autorise qu’un seul callback d’exécution actif ; un callback terminé ne sera pas appelé à nouveau. En cas d’échec, la réservation est libérée pour permettre un nouvel essai. Une réservation laissée par un processus interrompu peut être récupérée après cinq minutes.

Cela ne garantit pas l’exécution exactement une fois des effets externes : un processus peut s’interrompre après l’envoi d’un e-mail, l’octroi d’un accès ou la mise à jour d’un autre service, mais avant l’enregistrement de la fin du traitement. Rendez `onPaymentComplete` idempotent en utilisant la référence de paiement comme clé métier durable. Dans la mesure du possible, utilisez un enregistrement unique de droit ou d’exécution et une transaction ou une outbox ; transmettez la même référence comme clé d’idempotence aux services externes. Après une erreur temporaire, relancez la vérification, y compris après un redémarrage. La migration d’exécution et un adaptateur persistant sont indispensables : un adaptateur en mémoire ne coordonne pas plusieurs processus.

### Remboursements

Ce plugin en lecture seule ne fournit aucun endpoint de remboursement et ne définit pas de statut de paiement `refunded`. Un remboursement est un nouveau transfert on-chain autorisé, et non l’annulation de la transaction réglée. Conservez l’enregistrement initial `paid` comme preuve du règlement. Le registre de remboursements de votre application doit consigner la référence du paiement, le montant autorisé, le mint du jeton, le cluster, la destination, la signature du remboursement et son niveau de confirmation. Réconciliez les tentatives de façon idempotente avant tout nouvel envoi.

Vérifiez la destination du remboursement dans le parcours authentifié de votre application. Ne faites pas confiance à une adresse fournie par le navigateur et ne déduisez pas l’identité du payeur à partir d’un compte de transaction arbitraire. Utilisez un service de signature contrôlé ou un processus manuel distinct. Ne marquez le remboursement comme terminé qu’après la confirmation selon la politique choisie, puis appliquez la politique d’autorisation de votre application. Le plugin ne signe pas les remboursements et ne révoque pas automatiquement l’accès.

### Bon jeton, mauvais réseau

Les symboles des jetons ne sont que des étiquettes : l’actif est identifié par son cluster et son adresse de mint. La vérification utilise le point de terminaison RPC et le jeton configurés sur le serveur ; elle ne recherche pas les transactions sur d’autres réseaux. Un transfert effectué sur un autre cluster Solana, ou de l’USDT envoyé par une autre chaîne, ne règle pas cette intention. Le preset mainnet `SOLANA_USDT` ne correspond pas à un jeton de devnet. Consultez les [clusters Solana](https://solana.com/docs/references/clusters).

Affichez le réseau et le jeton requis avant le paiement, vérifiez si possible le réseau choisi dans le portefeuille, et gardez la configuration RPC/cluster/mint fixe pour les intentions en attente. Si la vérification ne trouve aucun transfert correspondant, ne donnez pas accès : l’intention reste en attente jusqu’à son expiration. Ne basculez pas le vérificateur de production vers un autre réseau et ne marquez pas manuellement l’intention comme payée pour faire correspondre la transaction.

Pour traiter une demande d’assistance, recueillez la signature de la transaction, le réseau réellement utilisé, le mint et le destinataire, puis vérifiez ces éléments indépendamment sur ce réseau. L’absence de résultat ne prouve pas que les fonds n’ont jamais été envoyés. Expliquez que leur récupération dépend du contrôle de la destination sur le réseau utilisé : ce plugin ne peut ni transférer ces fonds entre réseaux, ni annuler le transfert, ni les récupérer. Si une récupération ou un remboursement approuvé est possible, traitez-le séparément et demandez au client de créer une nouvelle intention sur le réseau requis. Ne demandez jamais la phrase de récupération d’un portefeuille ni une clé privée.
