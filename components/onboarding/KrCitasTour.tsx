"use client";

import { Rocket, CalendarDays, Users, Scissors, Settings2 } from "lucide-react";
import { ProductTour, type TourStep } from "@/components/onboarding/ProductTour";

const STEPS: TourStep[] = [
  {
    icon: <Rocket className="size-6" />,
    title: "¡Bienvenido a KR Citas!",
    description:
      "Te damos un recorrido rápido por las secciones principales, para que le saques provecho al sistema desde el primer día.",
  },
  {
    icon: <CalendarDays className="size-6" />,
    title: "Agenda",
    description:
      "Crea y gestiona las citas de tu negocio por día, semana o mes — y confirma o marca asistencia con un clic.",
  },
  {
    icon: <Users className="size-6" />,
    title: "Clientes y especialistas",
    description:
      "Lleva el historial de cada cliente y organiza qué servicios ofrece cada especialista de tu equipo.",
  },
  {
    icon: <Scissors className="size-6" />,
    title: "Servicios y paquetes",
    description:
      "Define los servicios que ofreces, sus precios y duración, o agrúpalos en paquetes con sesiones prepagadas.",
  },
  {
    icon: <Settings2 className="size-6" />,
    title: "Configuración",
    description:
      "Personaliza tu marca, horarios de atención y la página pública donde tus clientes reservan citas solos. Ya puedes empezar a agendar.",
  },
];

export function KrCitasTour({ hasSeenTour }: { hasSeenTour: boolean }) {
  if (hasSeenTour) return null;
  return <ProductTour steps={STEPS} />;
}
