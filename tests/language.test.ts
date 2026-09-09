import { describe, expect, it } from "vitest";
import {
  catalogFor,
  initialLanguageState,
  languageOptions,
  reduceLanguage,
  resolveOsLanguage,
} from "../src/language";

describe("operating-system language", () => {
  it.each(languageOptions)("supports $value", ({ value }) => {
    expect(resolveOsLanguage([value])).toBe(value);
  });

  it.each([
    { input: "en-GB", expected: "en" },
    { input: "it-IT", expected: "it" },
    { input: "JA-jp", expected: "ja" },
    { input: "pt", expected: "pt-PT" },
    { input: "pt-AO", expected: "pt-PT" },
    { input: "pt-Latn-BR", expected: "pt-BR" },
    { input: "pt-Latn-PT", expected: "pt-PT" },
    { input: "zh", expected: "zh-Hans" },
    { input: "zh-CN", expected: "zh-Hans" },
    { input: "zh-SG", expected: "zh-Hans" },
    { input: "zh-TW", expected: "zh-Hant" },
    { input: "zh-HK", expected: "zh-Hant" },
    { input: "zh-MO", expected: "zh-Hant" },
    { input: "zh-Hant-CN", expected: "zh-Hant" },
    { input: "zh-Hans-TW", expected: "zh-Hans" },
    { input: "nb-NO", expected: "nb" },
    { input: "no-NO", expected: "nb" },
    { input: "de-DE-u-co-phonebk", expected: "de" },
  ])("resolves $input to $expected", ({ input, expected }) => {
    expect(resolveOsLanguage([input])).toBe(expected);
  });

  it("uses the first supported preference and skips malformed or unsupported tags", () => {
    expect(resolveOsLanguage(["not_a_locale", "", "ar-SA", "ja-JP", "it-IT"])).toBe("ja");
    expect(resolveOsLanguage(["es-MX", "en"])).toBe("es");
  });

  it("falls back to English when no language matches", () => {
    expect(resolveOsLanguage([])).toBe("en");
    expect(resolveOsLanguage(["ar", "ru", "invalid_locale"])).toBe("en");
  });
});

describe("fictional language flow", () => {
  it("starts with the OS language, radio presentation, and Automatic settings", () => {
    expect(initialLanguageState(["it-IT"])).toEqual({
      prototype: "first-launch",
      presentation: "radio",
      osLanguage: "it",
      launch: { stage: "language", language: "it" },
      preference: "automatic",
      preferenceStatus: "ready",
      units: "metric",
      appearance: "system",
    });
  });

  it("carries the highlighted language to Setup and preserves it when returning", () => {
    const highlighted = reduceLanguage(initialLanguageState(["en"]), {
      type: "highlight",
      language: "ja",
    });
    const setup = reduceLanguage(highlighted, { type: "continue" });
    expect(setup.launch).toEqual({ stage: "setup", language: "ja" });
    expect(reduceLanguage(setup, { type: "highlight", language: "it" })).toBe(setup);
    expect(reduceLanguage(setup, { type: "continue" })).toBe(setup);
    expect(reduceLanguage(setup, { type: "back" })).toEqual(highlighted);
    expect(reduceLanguage(highlighted, { type: "back" })).toBe(highlighted);
  });

  it("resets the launch selection from a new OS scenario without changing explicit settings", () => {
    const explicit = reduceLanguage(initialLanguageState(["en"]), {
      type: "preference",
      value: "it",
    });
    const setup = reduceLanguage(explicit, { type: "continue" });
    const changed = reduceLanguage(setup, { type: "os-language", languages: ["ja-JP"] });
    expect(changed.osLanguage).toBe("ja");
    expect(changed.launch).toEqual({ stage: "language", language: "ja" });
    expect(changed.preference).toBe("it");
    expect(reduceLanguage(changed, { type: "os-language", languages: ["ar"] }).osLanguage).toBe(
      "en",
    );
  });

  it.each(["saving", "unavailable"] as const)(
    "holds the existing preference while %s and enables changes when ready",
    (value) => {
      const explicit = reduceLanguage(initialLanguageState(["en"]), {
        type: "preference",
        value: "ja",
      });
      const blocked = reduceLanguage(explicit, { type: "settings-scenario", value });
      expect(blocked.preferenceStatus).toBe(value);
      expect(blocked.preference).toBe("ja");
      expect(reduceLanguage(blocked, { type: "preference", value: "it" })).toBe(blocked);
      const ready = reduceLanguage(blocked, { type: "settings-scenario", value: "explicit" });
      expect(ready.preference).toBe("ja");
      expect(reduceLanguage(ready, { type: "preference", value: "it" }).preference).toBe("it");
    },
  );

  it("provides repeatable Automatic and explicit scenarios", () => {
    const initial = initialLanguageState(["en"]);
    const explicit = reduceLanguage(initial, { type: "settings-scenario", value: "explicit" });
    expect(explicit.preference).toBe("it");
    expect(reduceLanguage(explicit, { type: "settings-scenario", value: "automatic" })).toEqual(
      initial,
    );
  });

  it("keeps prototype, presentation, units, and appearance independent of language choices", () => {
    const initial = initialLanguageState(["ja"]);
    const settings = reduceLanguage(initial, { type: "prototype", value: "settings" });
    const select = reduceLanguage(settings, { type: "presentation", value: "select" });
    const units = reduceLanguage(select, { type: "units", value: "imperial" });
    const appearance = reduceLanguage(units, { type: "appearance", value: "dark" });
    expect(appearance).toEqual({
      ...initial,
      prototype: "settings",
      presentation: "select",
      units: "imperial",
      appearance: "dark",
    });
    expect(initialLanguageState(["ja"])).toEqual(initial);
  });
});

describe("prototype catalogs", () => {
  it("renders the provided English, Italian, and Japanese catalogs without fallback", () => {
    expect(catalogFor("en").copy.title).toBe("Choose your language");
    expect(catalogFor("it").copy.title).toBe("Scegli la tua lingua");
    expect(catalogFor("ja").copy.title).toBe("言語を選択");
    for (const language of ["en", "it", "ja"] as const) {
      expect(catalogFor(language).fallback).toBe(false);
      expect(catalogFor(language).language).toBe(language);
    }
  });

  it("identifies English fallback for every remaining language", () => {
    for (const { value } of languageOptions) {
      if (value === "en" || value === "it" || value === "ja") continue;
      expect(catalogFor(value)).toEqual({
        language: "en",
        fallback: true,
        copy: catalogFor("en").copy,
      });
    }
  });
});
