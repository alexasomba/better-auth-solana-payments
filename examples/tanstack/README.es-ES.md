[English](README.md) · [Español](README.es-ES.md) · [Français](README.fr-FR.md)

# Pagos en Solana con Better Auth – Ejemplo con TanStack Start

Este ejemplo sigue la misma estructura de TanStack Start que el ejemplo de integración con Paystack y
muestra el flujo completo de una transacción única mediante tokens SPL:

1. Crea una cuenta en Better Auth e inicia sesión.
2. Crea una intención de pago a través de `better-auth-solana-payments`.
3. Abre en una billetera (wallet) la URL de Solana Pay generada por el servidor.
4. Verifica la transferencia mediante el RPC de _devnet_ y observa el estado en `paid`.

Para mayor simplicidad, este ejemplo utiliza el adaptador en memoria (_in-memory adapter_) de Better Auth. Al reiniciar el servidor de desarrollo, se eliminan las cuentas y las intenciones de pago; asegúrate de utilizar un adaptador persistente antes de realizar el despliegue. El panel de control solo almacena las referencias opacas creadas en el navegador y actualiza cada una de ellas a través del _endpoint_ `payment.get`, el cual está vinculado al propietario dentro del _plugin_.

## Flujo demostrado

1. Crea una cuenta o inicia sesión con tu correo electrónico y contraseña.
2. Introduce la cantidad de tokens (en unidades legibles) y crea una intención de pago.
3. Abre la URL de Solana Pay generada por el servidor en una billetera compatible.
4. Aprueba la transferencia desde la billetera.
5. Verifica el pago en la cadena de bloques (_on-chain_) a través del servidor y consulta el estado de pago y el historial.

La interfaz de usuario también muestra los distintos estados de una intención de pago: en carga, error, pendiente, pagado y caducado. La redirección desde la billetera nunca se considera como prueba de pago.

## Ejecución

```bash
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to a devnet SPL token and recipient.
pnpm install
pnpm dev
```

Abre <http://localhost:3000>.

Este ejemplo no almacena claves privadas, ni firma o envía transacciones; de eso se encarga la billetera. Necesitarás una billetera en _devnet_ que cuente con saldo del token SPL configurado. La configuración predeterminada `SOLANA_USDT` corresponde a un token de _mainnet_, por lo que no debe utilizarse en este ejemplo para _devnet_.

## Alcance

`better-auth-solana-payments` solo admite pagos únicos. Este ejemplo, de forma deliberada, no incluye suscripciones, catálogos de productos, portales de facturación, procesos de pago con tarjeta ni la firma de transacciones mediante billetera (wallet) en el lado del cliente. El destinatario configurado, el activo (mint), los decimales del token, la fecha de caducidad y la verificación mediante RPC permanecen bajo el control del servidor.

## Validación de la configuración en devnet

El script de prueba (smoke script) verifica el estado del RPC y genera una solicitud de pago sin llegar a firmar ni enviar ninguna transacción:

```bash
pnpm test:devnet
```

Para verificar una transferencia real tras completar el flujo en el navegador, proporcione la referencia del pago y la firma de la transacción realizada desde la billetera:

```bash
SOLANA_SIGNATURE=... SOLANA_REFERENCE=... pnpm test:devnet
```

El script utiliza el mismo activo (mint), destinatario, número de decimales y URL de RPC que la aplicación de ejemplo. Un flujo correcto en el navegador consiste en: crear una cuenta, generar un pago, abrir la URL de la billetera, aprobar la transferencia y, finalmente, hacer clic en **Verificar pago en la cadena (on-chain)**.

Para un entorno de producción, sustituya el adaptador en memoria por un adaptador persistente de Better Auth, configure un valor generado para `BETTER_AUTH_SECRET` y utilice un proveedor de RPC dedicado. Nunca incluya claves privadas en este ejemplo ni en las variables de entorno del servidor.
