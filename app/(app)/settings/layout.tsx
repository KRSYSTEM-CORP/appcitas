import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Configuración del negocio</h1>
        <p className="text-sm text-muted-foreground mt-1">Marca, horario de atención y acceso de tu negocio.</p>
      </div>

      <SettingsTabs />

      {children}
    </div>
  );
}
