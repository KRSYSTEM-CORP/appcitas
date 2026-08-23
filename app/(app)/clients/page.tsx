import Link from "next/link";
import { ClientForm } from "@/components/clients/ClientForm";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import { createClient, listClients } from "@/lib/actions/clients";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="flex flex-col gap-8 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          También puedes registrar clientes nuevos directamente al agendar una cita.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Nuevo cliente</h2>
        <ClientForm action={createClient} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {clients.length} cliente{clients.length === 1 ? "" : "s"}
        </h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aún no tienes clientes registrados.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Teléfono</th>
                  <th className="px-4 py-2 font-medium">Correo</th>
                  <th className="px-4 py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{c.phone}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end items-start gap-3">
                        <Link
                          href={`/clients/${c.id}`}
                          className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
                        >
                          Editar
                        </Link>
                        <DeleteClientButton clientId={c.id} clientName={`${c.firstName} ${c.lastName}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
