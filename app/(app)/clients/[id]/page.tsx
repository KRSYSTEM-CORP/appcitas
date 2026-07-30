import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientPackagesSection } from "@/components/clients/ClientPackagesSection";
import { getClient, updateClient } from "@/lib/actions/clients";
import { listPackagesByClient } from "@/lib/actions/packages";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, packages] = await Promise.all([getClient(id), listPackagesByClient(id)]);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Editar cliente</h1>
      </div>
      <ClientForm client={client} action={updateClient.bind(null, id)} />

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Paquetes de este cliente</h2>
        <ClientPackagesSection packages={packages} />
      </div>
    </div>
  );
}
