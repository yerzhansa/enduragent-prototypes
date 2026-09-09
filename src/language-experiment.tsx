import { useReducer, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@enduragent/ui";
import {
  catalogFor,
  initialLanguageState,
  languageOptions,
  reduceLanguage,
  type LanguageTag,
} from "./language";

const headingClass =
  "mx-1 mt-[26px] mb-2 text-[11px] font-normal tracking-[0.07em] text-ink-3 uppercase first:mt-0";
const rowClass = "flex items-center gap-4 border-b border-line px-4 py-[13px]";
const controlClass =
  "h-ctl w-full min-w-0 max-w-[260px] shrink-0 rounded-ctl border border-input bg-background px-ctl-px text-sm text-foreground shadow-elev-1 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-64";
const setupCardClass =
  "rounded-xl border border-line bg-surface shadow-elev-1 [&>*+*]:border-t [&>*+*]:border-line [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl";
const segmentClass =
  "text-ink-2 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-elev-1";

function SetupRow({
  title,
  subtitle,
  disc = true,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly disc?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-[11px] px-[15px] py-3">
      {disc ? (
        <span className="size-[18px] shrink-0 rounded-full border border-dashed border-line-2" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="mt-px text-xs text-ink-2">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

function ScenarioControl<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly onChange: (value: Value) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs text-ink-2">
      {label}
      <Select<Value>
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger aria-label={label} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SettingsRow({
  title,
  detail,
  children,
}: {
  readonly title: string;
  readonly detail: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={rowClass}>
      <div className="flex min-w-0 flex-1 flex-col items-stretch">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-px text-[12.5px] text-ink-2" role="status">
          {detail}
        </div>
      </div>
      {children}
    </div>
  );
}

function Segments<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly onChange: (value: Value) => void;
}) {
  return (
    <div
      className="flex shrink-0 rounded-ctl border border-line bg-sunk p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          className={segmentClass}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function LanguageExperiment() {
  const [state, dispatch] = useReducer(reduceLanguage, navigator.languages, initialLanguageState);
  const [osScenario, setOsScenario] = useState("browser");
  const title = useRef<HTMLHeadingElement>(null);
  const selectedLanguage =
    state.prototype === "first-launch"
      ? state.launch.language
      : state.preference === "automatic"
        ? state.osLanguage
        : state.preference;
  const catalog = catalogFor(selectedLanguage);
  const copy = catalog.copy;
  const settingsScenario =
    state.preferenceStatus === "ready"
      ? state.preference === "automatic"
        ? "automatic"
        : "explicit"
      : state.preferenceStatus;
  const preferenceOptions = [{ value: "automatic", label: copy.automatic }, ...languageOptions];

  return (
    <>
      <section aria-label="Language scenario controls" className="grid min-w-0 gap-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <ScenarioControl
            label="Prototype"
            value={state.prototype}
            options={[
              { value: "first-launch", label: "First launch" },
              { value: "settings", label: "Settings language row" },
            ]}
            onChange={(value) => dispatch({ type: "prototype", value })}
          />
          <ScenarioControl
            label="OS language"
            value={osScenario}
            options={[
              { value: "browser", label: "Browser languages" },
              { value: "en", label: "English · en" },
              { value: "it", label: "Italiano · it" },
              { value: "ja", label: "日本語 · ja" },
              { value: "unsupported", label: "Unsupported · falls back to English" },
            ]}
            onChange={(value) => {
              setOsScenario(value);
              dispatch({
                type: "os-language",
                languages:
                  value === "browser"
                    ? navigator.languages
                    : [value === "unsupported" ? "uk" : value],
              });
            }}
          />
          {state.prototype === "first-launch" ? (
            <ScenarioControl
              label="Language screen"
              value={state.screen}
              options={[
                { value: "rule", label: "Product rule · skip when the OS language is supported" },
                { value: "always", label: "Always show · review strings" },
              ]}
              onChange={(value) => dispatch({ type: "screen", value })}
            />
          ) : (
            <ScenarioControl
              label="Settings state"
              value={settingsScenario}
              options={[
                { value: "automatic", label: "Automatic" },
                { value: "explicit", label: "Explicit language" },
                { value: "saving", label: "Saving" },
                { value: "unavailable", label: "Unavailable" },
              ]}
              onChange={(value) => dispatch({ type: "settings-scenario", value })}
            />
          )}
        </div>
        <p className="m-0 text-xs text-ink-2" role="status">
          OS resolves to {state.osLanguage}
          {state.osSupported
            ? " (supported, screen skipped by rule)"
            : " (unsupported, screen shown)"}
          . Fake catalogs: en, it, ja only. All other languages use English.
          {catalog.fallback
            ? ` English fallback active for ${selectedLanguage}.`
            : ` Showing ${catalog.language} catalog.`}
        </p>
      </section>
      {state.prototype === "first-launch" ? (
        <section
          aria-label="First launch prototype"
          lang={catalog.language}
          className="relative h-[720px] min-w-0 overflow-hidden"
        >
          {state.launch.stage === "setup" ? (
            <div className="setup-panel mx-auto w-full max-w-[680px] py-10">
              <header className="mb-[22px] flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
                <h1
                  ref={title}
                  tabIndex={-1}
                  className="text-2xl leading-8 font-semibold tracking-[-0.02em] outline-none"
                >
                  {copy.setupHeading}
                </h1>
                <span className="inline-flex h-ctl-sm flex-none items-center gap-2 rounded-full border border-line-2 bg-surface px-row text-xs text-ink-2">
                  <span
                    className="size-2 rounded-full bg-line-2 ring-4 ring-line-2/20"
                    aria-hidden="true"
                  />
                  {copy.setupStatus}
                </span>
              </header>
              <div className={setupCardClass}>
                <SetupRow title={copy.aiTitle} subtitle={copy.aiSubtitle}>
                  <Button variant="outline" size="sm">
                    {copy.setUp}
                  </Button>
                </SetupRow>
                <SetupRow title="Intervals.icu" subtitle={copy.intervalsSubtitle}>
                  <Button variant="outline" size="sm">
                    {copy.connect}
                  </Button>
                </SetupRow>
                <SetupRow title="Telegram" subtitle={copy.telegramSubtitle}>
                  <Button variant="outline" size="sm">
                    {copy.setUp}
                  </Button>
                </SetupRow>
                <SetupRow title={copy.injuryTitle} subtitle={copy.injurySubtitle} disc={false}>
                  <Select<"none"> items={[{ value: "none", label: copy.injuryNone }]} value="none">
                    <SelectTrigger aria-label={copy.injuryTitle} className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{copy.injuryNone}</SelectItem>
                    </SelectContent>
                  </Select>
                </SetupRow>
              </div>
              <footer className="mt-[18px] flex flex-wrap items-center gap-3">
                <Button size="lg" disabled>
                  {copy.startCoaching}
                </Button>
                <span className="ml-auto text-xs text-ink-2">{copy.footerNote}</span>
              </footer>
            </div>
          ) : (
            <div className="setup-panel absolute top-1/2 left-1/2 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2">
              <header className="mb-[22px] flex justify-center">
                <h1
                  ref={title}
                  tabIndex={-1}
                  className="text-center text-2xl leading-8 font-semibold tracking-[-0.02em] outline-none"
                >
                  {copy.title}
                </h1>
              </header>
              <div className={setupCardClass}>
                <div className="p-4">
                  <Select<LanguageTag>
                    items={languageOptions}
                    value={state.launch.language}
                    onValueChange={(language) => {
                      if (language !== null) dispatch({ type: "highlight", language });
                    }}
                  >
                    <SelectTrigger aria-label={copy.language} className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} lang={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end border-t border-line p-4">
                  <Button
                    onClick={() => {
                      dispatch({ type: "continue" });
                      requestAnimationFrame(() => title.current?.focus());
                    }}
                  >
                    {copy.continue}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <div
          lang={catalog.language}
          className="min-w-0 max-sm:[&>section>div]:flex-col max-sm:[&>section>div]:items-stretch"
        >
          <h2 className={headingClass}>{copy.preferences}</h2>
          <section
            aria-label={copy.preferences}
            className="rounded-card border border-line bg-surface shadow-elev-1 [&>*:last-child]:border-b-0"
          >
            <SettingsRow
              title={copy.language}
              detail={
                state.preferenceStatus === "saving"
                  ? copy.saving
                  : state.preferenceStatus === "unavailable"
                    ? copy.unavailable
                    : state.preference === "automatic"
                      ? copy.automaticDetail
                      : copy.explicitDetail
              }
            >
              <Select<"automatic" | LanguageTag>
                items={preferenceOptions}
                value={state.preference}
                disabled={state.preferenceStatus !== "ready"}
                onValueChange={(value) => {
                  if (value !== null) dispatch({ type: "preference", value });
                }}
              >
                <SelectTrigger className={controlClass} aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="automatic">{copy.automatic}</SelectItem>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} lang={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
            <SettingsRow title={copy.units} detail={copy.unitsDetail}>
              <Segments
                label={copy.units}
                value={state.units}
                options={[
                  { value: "metric", label: copy.metric },
                  { value: "imperial", label: copy.imperial },
                ]}
                onChange={(value) => dispatch({ type: "units", value })}
              />
            </SettingsRow>
            <SettingsRow title={copy.appearance} detail={copy.appearanceDetail}>
              <Segments
                label={copy.appearance}
                value={state.appearance}
                options={[
                  { value: "system", label: copy.system },
                  { value: "light", label: copy.light },
                  { value: "dark", label: copy.dark },
                ]}
                onChange={(value) => dispatch({ type: "appearance", value })}
              />
            </SettingsRow>
          </section>
        </div>
      )}
    </>
  );
}
