import Link from "next/link";

// Shared layout for the three public legal pages (Privacidad/Términos/
// Cookies) — plain, readable typography rather than the app's usual
// card-based UI, since these are read top-to-bottom, not scanned/operated.
export function LegalDocument({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 py-12">
      <div>
        <Link href="/login" className="text-sm text-primary hover:underline">
          ← Volver
        </Link>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última actualización: {updatedAt}</p>
      </div>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:text-center [&_p]:text-muted-foreground [&_p]:text-justify [&_li]:text-justify">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
