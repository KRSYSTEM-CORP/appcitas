"use client";

import { CheckIcon } from "lucide-react";

// Mirrors passwordField()'s rules in lib/validations.ts exactly — if one
// changes, update the other. Kept as separate small predicates (rather than
// reusing the schema's regexes directly) so this stays a plain, dependency-
// free client component.
const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (v) => v.length >= 8 },
  { label: "Una letra minúscula", test: (v) => /[a-z]/.test(v) },
  { label: "Una letra mayúscula", test: (v) => /[A-Z]/.test(v) },
  { label: "Un número", test: (v) => /[0-9]/.test(v) },
  { label: "Un símbolo especial (!@#%&*...)", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

// Live checklist shown under every "set a new password" field — each rule
// turns green the moment it's satisfied, instead of a single static hint
// the user has to re-read after a rejected submit.
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="flex flex-col gap-1 mt-1">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-muted-foreground"}`}
          >
            <span
              className={`flex items-center justify-center size-4 shrink-0 rounded-full ${
                met ? "bg-success text-success-foreground" : "bg-muted"
              }`}
            >
              {met && <CheckIcon className="size-3" />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
