import { useReducer, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@enduragent/ui";
import { Check } from "lucide-react";
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
const segmentClass =
  "text-ink-2 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-elev-1";

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
  const radios = useRef(new Map<LanguageTag, HTMLButtonElement>());
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

  function moveRadio(index: number, key: string) {
    const target =
      key === "Home"
        ? 0
        : key === "End"
          ? languageOptions.length - 1
          : (index + (key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1) + languageOptions.length) %
            languageOptions.length;
    const option = languageOptions[target];
    if (!option) return;
    dispatch({ type: "highlight", language: option.value });
    radios.current.get(option.value)?.focus();
  }

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
              label="Selector presentation"
              value={state.presentation}
              options={[
                { value: "radio", label: "Radio list · 17 rows" },
                { value: "select", label: "Single Select" },
              ]}
              onChange={(value) => dispatch({ type: "presentation", value })}
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
          OS resolves to {state.osLanguage}. Fake catalogs: en, it, ja only. All other languages use
          English.
          {catalog.fallback
            ? ` English fallback active for ${selectedLanguage}.`
            : ` Showing ${catalog.language} catalog.`}
        </p>
      </section>
      {state.prototype === "first-launch" ? (
        <section
          aria-label="First launch prototype"
          lang={catalog.language}
          className="grid min-h-dvh min-w-0 place-items-center py-10"
        >
          <div className="setup-panel mx-auto w-full max-w-[680px]">
            <header className="mb-[22px] flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
              <h1
                ref={title}
                tabIndex={-1}
                className="text-2xl leading-8 font-semibold tracking-[-0.02em] outline-none"
              >
                {state.launch.stage === "language" ? copy.title : copy.setup}
              </h1>
            </header>
            <div className="rounded-xl border border-line bg-surface shadow-elev-1">
              {state.launch.stage === "setup" ? (
                <div className="flex flex-col items-start gap-4 p-4">
                  <p className="m-0 text-sm text-ink-2">
                    {copy.chosenLanguage}: <span>{state.launch.language}</span>
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      dispatch({ type: "back" });
                      requestAnimationFrame(() => title.current?.focus());
                    }}
                  >
                    {copy.back}
                  </Button>
                </div>
              ) : (
                <>
                  {state.presentation === "radio" ? (
                    <div role="radiogroup" aria-label={copy.language}>
                      {languageOptions.map((option, index) => (
                        <Button
                          key={option.value}
                          ref={(element) => {
                            if (element) radios.current.set(option.value, element);
                            else radios.current.delete(option.value);
                          }}
                          role="radio"
                          aria-checked={state.launch.language === option.value}
                          tabIndex={state.launch.language === option.value ? 0 : -1}
                          variant="ghost"
                          className="h-ctl w-full min-w-0 justify-between rounded-none px-4 first:rounded-t-xl"
                          onClick={() => dispatch({ type: "highlight", language: option.value })}
                          onKeyDown={(event) => {
                            if (
                              [
                                "ArrowDown",
                                "ArrowUp",
                                "ArrowLeft",
                                "ArrowRight",
                                "Home",
                                "End",
                              ].includes(event.key)
                            ) {
                              event.preventDefault();
                              moveRadio(index, event.key);
                            }
                          }}
                        >
                          <span lang={option.value} className="min-w-0 whitespace-normal text-left">
                            {option.label}
                          </span>
                          {state.launch.language === option.value ? (
                            <Check aria-hidden="true" className="size-4 shrink-0" />
                          ) : null}
                        </Button>
                      ))}
                    </div>
                  ) : (
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
                  )}
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
                </>
              )}
            </div>
          </div>
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
