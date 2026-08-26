import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from "@/lib/legal";

export const metadata: Metadata = { title: "Términos y Condiciones · KR Citas" };

export default function TermsPage() {
  return (
    <LegalDocument title="Términos y Condiciones" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="1. Aceptación de los términos">
        <p>
          Al crear una cuenta o usar KR POS, KR Citas o cualquier otro sistema de KR SYSTEM, aceptas
          estos Términos y Condiciones. Si no estás de acuerdo, no debes usar el servicio.
        </p>
      </LegalSection>

      <LegalSection title="2. Descripción del servicio">
        <p>
          KR SYSTEM ofrece sistemas de gestión para negocios bajo un modelo de suscripción,
          incluyendo (según el producto) punto de venta, inventario, facturación, presupuestos,
          compras, finanzas, agenda de citas, gestión de clientes y atención por WhatsApp. Podemos
          agregar, modificar o retirar funciones del servicio en cualquier momento, procurando
          notificarlo con antelación razonable cuando el cambio sea significativo.
        </p>
      </LegalSection>

      <LegalSection title="3. Tu cuenta">
        <p>
          Eres responsable de la veracidad de los datos que registras, de mantener la
          confidencialidad de tus credenciales de acceso y de toda actividad que ocurra bajo tu
          cuenta, incluida la de los especialistas/empleados a quienes les des acceso. Debes
          notificarnos de inmediato si sospechas un uso no autorizado de tu cuenta.
        </p>
      </LegalSection>

      <LegalSection title="4. Suscripción y pagos">
        <p>
          El uso del servicio requiere el pago de una tarifa periódica. El pago se coordina de forma
          manual (por ejemplo, transferencia o Binance) y se confirma reportándolo dentro del sistema
          y por WhatsApp; la activación o reactivación de tu cuenta queda sujeta a la verificación de
          ese pago por nuestro equipo. Si tu cuenta queda en mora, podemos suspender el acceso al
          servicio hasta regularizar el pago. Los precios pueden ajustarse; te avisaremos con
          anticipación razonable antes de que un cambio de precio te afecte.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso aceptable">
        <p>
          No puedes usar el servicio para actividades ilegales, para vulnerar la seguridad del
          sistema, para revender o sublicenciar el acceso sin nuestra autorización expresa, ni de
          forma que perjudique a otros usuarios o a la operación del servicio. Nos reservamos el
          derecho de suspender cuentas que incumplan esta sección.
        </p>
      </LegalSection>

      <LegalSection title="6. Tus datos">
        <p>
          Los datos que registras en el sistema (tus clientes, citas, especialistas, servicios,
          etc.) te pertenecen a ti o a tu negocio. Nos concedes una licencia limitada para
          almacenarlos y procesarlos únicamente con el fin de prestarte el servicio, conforme a
          nuestra Política de Privacidad.
        </p>
      </LegalSection>

      <LegalSection title="7. Propiedad intelectual">
        <p>
          El software, el diseño, las marcas y el contenido de KR POS, KR Citas y KR ChatBot son
          propiedad de KR SYSTEM. Estos Términos no te otorgan ningún derecho sobre ellos más allá
          del uso del servicio mientras tu suscripción esté vigente.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidad del servicio">
        <p>
          Procuramos que el servicio esté disponible de forma continua, pero no garantizamos que
          esté libre de interrupciones, errores o mantenimientos programados. No somos responsables
          por fallas de terceros fuera de nuestro control (por ejemplo, proveedores de internet,
          bancos o pasarelas de pago).
        </p>
      </LegalSection>

      <LegalSection title="9. Limitación de responsabilidad">
        <p>
          En la medida permitida por la ley aplicable, KR SYSTEM no será responsable por daños
          indirectos, pérdida de ganancias o de datos derivados del uso o la imposibilidad de uso del
          servicio, ni por decisiones de negocio que tomes con base en la información que el sistema
          te muestra. Nuestra responsabilidad total frente a ti, en cualquier caso, se limita al
          monto que hayas pagado por el servicio en los tres meses previos al hecho que la origine.
        </p>
      </LegalSection>

      <LegalSection title="10. Terminación">
        <p>
          Puedes cancelar tu suscripción en cualquier momento. Podemos suspender o cancelar tu cuenta
          si incumples estos Términos, si tu cuenta queda en mora de forma prolongada, o si
          detectamos un uso indebido del servicio. Al terminar la relación, podrás solicitar una
          exportación de tus datos dentro de un plazo razonable antes de que sean eliminados.
        </p>
      </LegalSection>

      <LegalSection title="11. Modificaciones a estos Términos">
        <p>
          Podemos actualizar estos Términos ocasionalmente. Te notificaremos los cambios importantes
          dentro del sistema o por correo; el uso continuado del servicio después de un cambio
          implica tu aceptación de los nuevos Términos.
        </p>
      </LegalSection>

      <LegalSection title="12. Ley aplicable y disputas">
        <p>
          Estos Términos se rigen por las leyes aplicables según la relación entre las partes. Ante
          cualquier desacuerdo, ambas partes procurarán resolverlo primero de forma directa y de
          buena fe antes de acudir a cualquier otra vía.
        </p>
      </LegalSection>

      <LegalSection title="13. Contacto">
        <p>
          Si tienes preguntas sobre estos Términos y Condiciones, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          o por WhatsApp al +1 (904) 579-6156.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
