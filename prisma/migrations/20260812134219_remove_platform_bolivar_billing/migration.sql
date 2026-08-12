-- La suscripción de la plataforma ahora se paga exclusivamente en USDT vía
-- Binance: se quita la tasa Bs/USD de PlatformSettings (nunca más se
-- recalcula) y Payment.exchangeRate pasa a nullable — los registros ya
-- existentes conservan su valor histórico, los nuevos no lo necesitan.
ALTER TABLE "PlatformSettings" DROP COLUMN "billingExchangeRate";
ALTER TABLE "Payment" ALTER COLUMN "exchangeRate" DROP NOT NULL;
