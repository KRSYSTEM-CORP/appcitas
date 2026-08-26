// Floating illustrative badge on login/signup — a lightweight CSS float (no
// JS animation library needed for one decorative element) advertising the
// 14-day free trial.
export function TrialBadge() {
  return (
    <div className="mx-auto w-fit rounded-full bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary),black_20%)] px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/30 trial-badge-float">
      <style>{`
        .trial-badge-float {
          animation: trial-badge-float 3s ease-in-out infinite;
        }
        @keyframes trial-badge-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .trial-badge-float { animation: none; }
        }
      `}</style>
      ✦ 14 días gratis para probar el sistema
    </div>
  );
}
