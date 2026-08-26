import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 px-6 py-6 text-center text-xs text-muted-foreground">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        <Link href="/privacidad" className="hover:underline">
          Política de Privacidad
        </Link>
        <span>·</span>
        <Link href="/terminos" className="hover:underline">
          Términos y Condiciones
        </Link>
        <span>·</span>
        <Link href="/cookies" className="hover:underline">
          Aviso de Cookies
        </Link>
      </div>
      <p>
        © 2026 KR SYSTEM. Todos los derechos reservados. Empresa de Sistemas Automatizados &quot;KR
        SYSTEM&quot; Teléfono: +1 (904) 579-6156.
      </p>
    </footer>
  );
}
