import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";
import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso de Cookies · KR Citas" };

export default function CookiesNoticePage() {
  return (
    <LegalDocument title="Aviso de Cookies" updatedAt={LEGAL_UPDATED_AT}>
      <LegalSection title="¿Qué son las cookies?">
        <p>
          Las cookies son pequeños archivos que un sitio web guarda en tu navegador para recordar
          información entre visitas.
        </p>
      </LegalSection>

      <LegalSection title="¿Qué cookies usamos?">
        <p>Usamos únicamente cookies estrictamente necesarias para que el sistema funcione:</p>
        <ul className="list-disc pl-5 text-muted-foreground flex flex-col gap-1">
          <li>Una cookie de sesión, que te mantiene con la sesión iniciada mientras usas la aplicación.</li>
          <li>
            Una cookie temporal de verificación, usada solo durante el proceso de inicio de sesión
            con Google, para prevenir accesos fraudulentos.
          </li>
        </ul>
        <p>
          No usamos cookies de publicidad, rastreo entre sitios ni de análisis de terceros (como
          Google Analytics), y no compartimos cookies con fines de marketing.
        </p>
      </LegalSection>

      <LegalSection title="¿Por qué no pedimos tu consentimiento para cookies de marketing?">
        <p>
          Porque no las usamos. Las únicas cookies presentes son estrictamente necesarias para
          iniciar sesión y mantener tu sesión activa — no requieren consentimiento previo bajo la
          mayoría de las normativas de privacidad, ya que sin ellas el sistema no podría funcionar.
        </p>
      </LegalSection>

      <LegalSection title="¿Cómo controlar las cookies?">
        <p>
          Puedes eliminar o bloquear las cookies desde la configuración de tu navegador en cualquier
          momento. Ten en cuenta que, si bloqueas la cookie de sesión, no podrás mantener la sesión
          iniciada en el sistema.
        </p>
      </LegalSection>

      <LegalSection title="Cambios a este aviso">
        <p>
          Si en el futuro incorporamos cookies adicionales (por ejemplo, de analítica), actualizaremos
          este aviso y, de ser necesario, solicitaremos tu consentimiento antes de activarlas.
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <p>
          Si tienes preguntas sobre este Aviso de Cookies, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
