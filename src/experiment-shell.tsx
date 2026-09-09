import { useEffect, useState, type ReactNode } from "react";
import { Button, Page, applyPalette, paletteById, type ResolvedTheme } from "@enduragent/ui";

export function ExperimentNavigation() {
  return (
    <nav aria-label="Experiments" className="flex flex-wrap gap-2 px-5 py-3">
      {[
        ["day-review", "Day review"],
        ["chat", "Chat"],
        ["training", "Training"],
        ["language", "Language"],
        ["plan-presentation", "Plan presentation"],
        ["plan-in-chat/", "Plan-in-Chat"],
      ].map(([path, label]) => (
        <Button
          key={path}
          variant="ghost"
          size="sm"
          onClick={() => location.assign(`/experiments/${path}`)}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}

export function ExperimentShell({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    applyPalette({
      root: document.documentElement,
      palette: paletteById("patrol"),
      appearance: theme,
    });
  }, [theme]);
  return (
    <main className="min-w-0 flex-1 bg-bg text-ink">
      <ExperimentNavigation />
      <div
        aria-label="Experiment controls"
        className="flex flex-wrap items-center gap-3 border-y border-line px-5 py-3"
      >
        <span className="text-xs text-ink-2">Experimental · Fictional data · Nothing is saved</span>
        <Button variant="ghost" size="sm" onClick={() => setRevision(revision + 1)}>
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "Dark" : "Light"}
        </Button>
      </div>
      <Page title={title}>
        <div key={revision} className="mx-auto grid w-full max-w-3xl gap-6">
          {children}
        </div>
      </Page>
    </main>
  );
}
