import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { CONTACT_EMAIL, LEGAL_UPDATED_AT, WHATSAPP_PHONE } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de Privacidad · KR Citas" };

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Política de Privacidad" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="1. Quiénes somos">
        <p>
          KR SYSTEM (&quot;nosotros&quot;, &quot;la empresa&quot;) es la empresa desarrolladora de KR
          POS, KR Citas y KR ChatBot, un conjunto de sistemas de gestión para negocios: punto de
          venta, inventario y facturación; agenda de citas y clientes; y atención por WhatsApp. Esta
          Política de Privacidad explica qué información recopilamos, cómo la usamos y qué derechos
          tienes sobre ella.
        </p>
      </LegalSection>

      <LegalSection title="2. Qué información recopilamos">
        <p>Recopilamos dos tipos de información:</p>
        <p>
          <strong className="text-foreground">Datos de tu cuenta:</strong> nombre, correo
          electrónico, teléfono, contraseña (almacenada cifrada, nunca en texto plano) y los datos
          de tu negocio (nombre comercial, dirección, logo) que tú mismo ingresas al configurar tu
          cuenta.
        </p>
        <p>
          <strong className="text-foreground">Datos que tú registras al usar el sistema:</strong>{" "}
          información de tus propios clientes, especialistas, servicios, citas y demás datos
          operativos de tu negocio. Estos datos son tuyos — nosotros solo los alojamos y procesamos
          para que el sistema funcione; tú sigues siendo responsable de cómo los obtuviste y de
          cumplir con las obligaciones que tengas frente a esas personas.
        </p>
        <p>
          No recopilamos datos de pago con fines de procesamiento de tarjetas: los pagos de la
          suscripción de KR SYSTEM se coordinan manualmente y se confirman por WhatsApp; no
          almacenamos números de tarjeta ni datos bancarios completos.
        </p>
      </LegalSection>

      <LegalSection title="3. Para qué usamos tu información">
        <p>Usamos la información recopilada para:</p>
        <ul className="list-disc pl-5 text-muted-foreground flex flex-col gap-1">
          <li>Prestar el servicio (crear tu cuenta, mostrar tus datos, gestionar tu agenda y reportes).</li>
          <li>Gestionar el cobro de tu suscripción y comunicarte su estado.</li>
          <li>Brindarte soporte cuando lo solicitas.</li>
          <li>Detectar fallas, prevenir abusos y mejorar el sistema.</li>
          <li>
            Enviarte comunicaciones operativas (recuperación de contraseña, avisos de facturación) y,
            si lo autorizas, novedades del producto.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Con quién compartimos información">
        <p>
          No vendemos ni alquilamos tu información a terceros con fines publicitarios. Compartimos
          datos únicamente con proveedores que nos ayudan a operar el servicio, bajo sus propias
          obligaciones de confidencialidad:
        </p>
        <ul className="list-disc pl-5 text-muted-foreground flex flex-col gap-1">
          <li>Proveedores de hosting y base de datos, para alojar la aplicación y tu información.</li>
          <li>Un proveedor de correo transaccional, para enviar notificaciones del sistema (por ejemplo, recuperación de contraseña).</li>
          <li>Google, únicamente si tú eliges iniciar sesión con tu cuenta de Google.</li>
        </ul>
        <p>
          También podemos divulgar información si la ley nos lo exige o para proteger nuestros
          derechos, los tuyos o los de terceros.
        </p>
      </LegalSection>

      <LegalSection title="5. Dónde se almacena tu información">
        <p>
          Usamos infraestructura en la nube que puede alojar tu información en servidores ubicados
          fuera de tu país. Aplicamos las mismas medidas de seguridad sin importar dónde se procesen
          los datos.
        </p>
      </LegalSection>

      <LegalSection title="6. Seguridad">
        <p>
          Aplicamos medidas técnicas razonables para proteger tu información: conexiones cifradas,
          contraseñas almacenadas con hash (nunca en texto plano) y control de acceso según el rol de
          cada usuario dentro de tu negocio. Ningún sistema es 100% infalible; si detectamos un
          incidente que afecte tu información, te lo notificaremos.
        </p>
      </LegalSection>

      <LegalSection title="7. Cuánto tiempo conservamos tu información">
        <p>
          Conservamos tu información mientras tu cuenta esté activa. Si cancelas el servicio,
          podemos conservar cierta información por un período adicional razonable para cumplir
          obligaciones legales, fiscales o para resolver disputas, y luego la eliminamos o
          anonimizamos.
        </p>
      </LegalSection>

      <LegalSection title="8. Tus derechos">
        <p>
          Puedes solicitarnos en cualquier momento: acceder a tu información, corregirla, exportarla
          o eliminarla (sujeto a las obligaciones legales que debamos cumplir primero). Para ejercer
          estos derechos, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          o por WhatsApp al +1 (904) 579-6156.
        </p>
      </LegalSection>

      <LegalSection title="9. Menores de edad">
        <p>
          Nuestros sistemas están dirigidos a negocios y no están diseñados para ser usados por
          menores de edad. No recopilamos intencionalmente información de menores.
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios a esta política">
        <p>
          Podemos actualizar esta Política de Privacidad ocasionalmente. Si hacemos cambios
          importantes, te lo notificaremos dentro del sistema o por correo. La fecha de
          &quot;Última actualización&quot; al inicio de este documento indica la versión vigente.
        </p>
      </LegalSection>

      <LegalSection title="11. Contacto">
        <p>
          Si tienes preguntas sobre esta Política de Privacidad, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          o por WhatsApp al{" "}
          <a
            href={`https://wa.me/${WHATSAPP_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            +1 (904) 579-6156
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
