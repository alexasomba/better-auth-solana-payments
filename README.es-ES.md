[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Pagos con Solana para Better Auth

Integración de pagos únicos con Solana para [Better Auth](https://www.better-auth.com).


## Instalación

```bash
pnpm add better-auth better-auth-solana-payments solana-payments
```

Requiere Node.js 22.22.2 o superior y solana-payments 1.x.

En instalaciones existentes, es necesario añadir los campos de cumplimiento (*fulfillment fields*) antes de realizar la actualización. Para conocer los nombres predeterminados de las tablas y columnas en SQLite, consulta `migrations/0.2.0-sqlite.sql`; si utilizas esquemas personalizados, deberás generar la migración equivalente para Better Auth. Realiza una copia de seguridad de la base de datos, verifica el estado de cumplimiento de los registros de pago y, a continuación, procede con el despliegue.


## Configuración del servidor

Crea un cliente del SDK de Solana Payments en modo de solo lectura y registra el plugin de Better Auth.

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


## Configuración del cliente

```ts
import { createAuthClient } from "better-auth/client";
import { solanaPaymentsClient } from "better-auth-solana-payments/client";

export const authClient = createAuthClient({
  plugins: [solanaPaymentsClient()],
});
```


## Flujo de pago único

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

`payment.create` guarda una intención de pago pendiente y devuelve su referencia junto con la URL de Solana Pay.
Una vez que el cliente firma la transacción, llama a `payment.verify` utilizando dicha referencia. El servidor
emplea su cliente RPC configurado para verificar que la transferencia de tokens coincida antes de marcar el pago
como completado. `payment.get` permite consultar el estado actual sin realizar ninguna verificación.

Los importes deben indicarse como cadenas de texto decimales, expresadas en las unidades de visualización del token configurado (por ejemplo, `"2.5"` equivale
a 2.5 USDT, considerando un token USDT con seis decimales). No utilices números de JavaScript, ya que pueden perder
precisión al representar cantidades de tokens. Si la billetera ya ha devuelto una firma de transacción, envíela a través del campo opcional `signature` hacia `payment.verify`. El SDK evalúa dicho valor antes de analizar las transacciones recientes, al tiempo que verifica el *mint* (activo), el destinatario, el monto, el clúster y el nivel de confirmación configurados. El *plugin* hereda la configuración del programa de tokens definida en el cliente del SDK del servidor. Se admiten transferencias básicas de Token-2022; sin embargo, los *mints* que utilizan extensiones como *transfer-fee* (comisiones por transferencia) o *transfer-hook* (ganchos de transferencia) requieren una verificación específica para dichas extensiones y no se aceptan como transferencias ordinarias. Consulte la [guía de verificación de pagos](https://solana.com/docs/payments/accept-payments/verification-tools) y la [documentación sobre extensiones de tokens](https://solana.com/docs/tokens/extensions) de Solana al configurar un *mint*.

El navegador puede proporcionar el monto, metadatos opcionales, una referencia, la firma de la transacción (opcional) y el ID de la organización (opcional). El servidor controla la configuración del destinatario y del token, lo que impide que los clientes redirijan los fondos o elijan un *mint* distinto. La integración emplea un cliente RPC de solo lectura: no almacena claves privadas ni firma o envía transacciones en nombre del usuario.

Este paquete solo admite pagos únicos. No permite crear suscripciones recurrentes ni realizar cargos periódicos.


## Ejemplo con TanStack Start

El repositorio incluye un ejemplo funcional basado en TanStack Start, disponible en [`examples/tanstack`](./examples/tanstack). Este ejemplo demuestra la autenticación mediante correo electrónico y contraseña, la creación de solicitudes de Solana Pay desde el servidor, el proceso de pago a través de una billetera y la verificación en el servidor utilizando un RPC de *devnet*.

```bash
cd examples/tanstack
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to your devnet SPL token and recipient.
pnpm install
pnpm dev
```

El ejemplo utiliza un adaptador en memoria y está destinado exclusivamente al desarrollo local. No almacena claves privadas ni envía transacciones a la red. Consulte el archivo README correspondiente para obtener información sobre las pruebas RPC y las pruebas de funcionamiento (*smoke tests*) en la cadena (*on-chain*) (`pnpm test:devnet`), así como sobre el flujo completo de verificación de la billetera. Para la red de desarrollo (devnet), configura una emisión (mint) de tokens SPL específica para dicho entorno; el ajuste predefinido `SOLANA_USDT` corresponde a la emisión de USDT en la red principal (mainnet) y no debe utilizarse para pruebas en la red de desarrollo. En un entorno de producción, emplea un adaptador de Better Auth persistente, un identificador `BETTER_AUTH_SECRET` generado específicamente para este fin y un proveedor de RPC dedicado.


### Migración de cumplimiento (fulfillment) y reintentos

Genera y aplica la migración del esquema de Better Auth antes de realizar la actualización. Añade `fulfillmentStatus` (con valor predeterminado `pending`), así como los campos `fulfillmentToken` y `fulfillmentClaimedAt` —ambos configurados como anulables (nullable)—, a `solanaPayment`. Antes de comenzar a aceptar solicitudes, actualiza los registros existentes (backfill) marcando las filas ya pagadas en `completed`; de este modo, se evitará que los pagos históricos se procesen o cumplan de nuevo.

La liquidación del pago y su ejecución (cumplimiento) son procesos independientes: la verificación persiste (`paid`), tras lo cual se solicita un bloqueo (lease) en la base de datos antes de invocar `onPaymentComplete`. Si las devoluciones de llamada (callbacks) fallan, se devuelve un error y la ejecución queda pendiente; para recuperarse, es necesario reintentar la verificación, incluso después de un reinicio. Si un proceso de trabajo (worker) falla, su bloqueo en la base de datos vuelve a estar disponible tras cinco minutos. Las devoluciones de llamada deben ser idempotentes respecto a la referencia del pago, ya que un fallo tras un efecto secundario externo puede provocar un reintento. Las respuestas exponen `fulfillmentStatus`; solo se debe conceder acceso cuando el estado sea `completed`.


## Liquidación y casos límite operativos


### Profundidad de confirmación

El verificador del SDK requiere al menos `confirmed`, incluso si el cliente está configurado con
`processed`. Configure `commitment: "finalized"` cuando su aplicación requiera el estado de liquidación más sólido antes de proceder con la ejecución; en este caso, una transacción simplemente confirmada se considerará no aceptada.
Se trata de una política de commitment, no de un número configurable de confirmaciones. Si la ejecución falla, se rechaza, independientemente del nivel de commitment. Consulte las [definiciones de compromiso de Solana](https://solana.com/docs/rpc#configuring-state-commitment).

Muestre un estado de «espera de confirmación» y reintente la verificación en el servidor —aplicando un mecanismo de reintento con espera progresiva (backoff)— ante una transferencia no liquidada o un fallo en la llamada RPC (RPC failure). El valor `PAYMENT_MISMATCH`, por sí solo, no permite distinguir entre una transferencia no confirmada, una transferencia inexistente, un error en el token o la red, o un fallo del proveedor. Una notificación de éxito en una billetera (wallet) del navegador no constituye una prueba de liquidación. Conceda el acceso o beneficio únicamente cuando la respuesta incluya tanto `status === "paid"` como `fulfillmentStatus === "completed"`. Define el nivel de commitment antes de aceptar pagos y mantén la coherencia: una intención de pago ya liquidada reintenta la entrega del servicio sin volver a verificar la cadena; por lo tanto, cambiar el cliente a `finalized` no actualiza automáticamente los pagos confirmados previamente registrados.


### Verificación duplicada y devoluciones de llamada (callbacks)

Las llamadas de verificación repetidas desde el navegador comparten el pago almacenado. Un mecanismo de bloqueo condicional en la base de datos permite una única devolución de llamada (callback) activa para la entrega del servicio; una vez completada la entrega, no se vuelve a ejecutar la llamada. Si la devolución de llamada falla, el bloqueo se libera para permitir un reintento; si un proceso queda bloqueado debido a un fallo inesperado, el bloqueo puede recuperarse tras cinco minutos. Esto no garantiza que los efectos externos ocurran exactamente una vez: un fallo tras enviar un correo electrónico, conceder acceso o actualizar otro servicio puede producirse antes de que la finalización quede registrada de forma persistente.

Haz que `onPaymentComplete` sea idempotente utilizando la referencia de pago como una clave de negocio persistente. Emplea un registro único para la concesión/entrega del servicio y utiliza una transacción o un sistema de «bandeja de salida» (outbox) siempre que sea posible; emplea la misma referencia como clave de idempotencia para los servicios externos. Reintenta la verificación tras un fallo transitorio, incluso después de un reinicio del sistema. Es necesario implementar una migración para la entrega del servicio y un adaptador persistente; un adaptador que solo resida en memoria no puede coordinar procesos (workers) independientes.


### Reembolsos

Este plugin, de solo lectura, no dispone de un endpoint para reembolsos ni gestiona estados de pago como `refunded`. Un reembolso es una transferencia independiente autorizada en la cadena (on-chain), no una reversión de la transacción ya liquidada. Conserva el registro original del pago como prueba de la liquidación. El registro de reembolsos de tu aplicación debe incluir la referencia del pago, el importe aprobado, el token emitido, el clúster, el destino, la firma del reembolso y su estado de confirmación; asimismo, debe gestionar los reintentos de forma idempotente antes de realizar cualquier nuevo envío.

Verifica el destino del reembolso a través del flujo de revisión autenticado de tu aplicación; no confíes en una dirección proporcionada por el navegador ni infieras la identidad del pagador a partir de una cuenta de transacción arbitraria. Utiliza un servicio de firma independiente y controlado, o bien un proceso manual. Marca un reembolso como completado solo después de que se cumpla la política de confirmación establecida; a continuación, aplica la política de concesión de acceso de tu aplicación. El plugin no firma reembolsos ni revoca el acceso de forma automática.


### Token correcto, red incorrecta

Los símbolos de los tokens son meras etiquetas; El activo se identifica mediante su clúster y su dirección del mint. La verificación utiliza el endpoint RPC y el token configurados en el servidor, y no realiza búsquedas en otras redes.
Una transferencia realizada en otro clúster de Solana, o USDT enviado a través de otra cadena, no satisface esta intención. El preset de mainnet `SOLANA_USDT` no es un token de devnet. Consulta [clústeres de Solana](https://solana.com/docs/references/clusters).

Indica la red y el token (mint) requeridos antes de realizar el pago, verifica la red configurada en la billetera siempre que sea posible y mantén fija la configuración de RPC/clúster/token para las intenciones pendientes. Si el proceso de verificación no encuentra una transferencia coincidente, no concedas el acceso; la intención permanecerá en estado «pendiente» hasta su vencimiento. No cambies el verificador de producción a otra red, ni marques manualmente la intención como «pagada» para simular una coincidencia.

Recopila la firma de la transacción, la red utilizada, el token (mint) y el destinatario para gestionar el caso a través del soporte técnico, y verifica estos datos de forma independiente en dicha red. La ausencia de un resultado no constituye una prueba de que los fondos nunca se hayan enviado. Explica al usuario que la recuperación depende de que tenga control sobre la dirección de destino en la red utilizada; este plugin no puede realizar puentes (bridges), revertir operaciones ni recuperar dichos fondos. Si, tras una revisión, es posible realizar una recuperación o reembolso, gestiona el proceso por separado y solicita al cliente que cree una nueva intención en la red correcta. Nunca solicites la frase semilla (seed phrase) ni la clave privada de una billetera.
