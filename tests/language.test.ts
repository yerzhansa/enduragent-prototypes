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
  it("skips the language screen when the OS language is supported", () => {
    expect(initialLanguageState(["it-IT"])).toEqual({
      prototype: "first-launch",
      screen: "rule",
      osLanguage: "it",
      osSupported: true,
      launch: { stage: "setup", language: "it", skipped: true },
      preference: "automatic",
      preferenceStatus: "ready",
      units: "metric",
      appearance: "system",
    });
  });

  it("carries the highlighted language to Setup and preserves it when returning", () => {
    const highlighted = reduceLanguage(initialLanguageState(["ar"]), {
      type: "highlight",
      language: "ja",
    });
    const setup = reduceLanguage(highlighted, { type: "continue" });
    expect(setup.launch).toEqual({ stage: "setup", language: "ja", skipped: false });
    expect(reduceLanguage(setup, { type: "highlight", language: "it" })).toBe(setup);
    expect(reduceLanguage(setup, { type: "continue" })).toBe(setup);
  });

  it("resets the launch selection from a new OS scenario without changing explicit settings", () => {
    const explicit = reduceLanguage(initialLanguageState(["ar"]), {
      type: "preference",
      value: "it",
    });
    const setup = reduceLanguage(explicit, { type: "continue" });
    const changed = reduceLanguage(setup, { type: "os-language", languages: ["ja-JP"] });
    expect(changed.osLanguage).toBe("ja");
    expect(changed.launch).toEqual({ stage: "setup", language: "ja", skipped: true });
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

  it("shows the language screen with English preselected when the OS language is unsupported", () => {
    const unsupported = initialLanguageState(["uk", "ru"]);
    expect(unsupported.osSupported).toBe(false);
    expect(unsupported.launch).toEqual({ stage: "language", language: "en", skipped: false });
    const forced = reduceLanguage(initialLanguageState(["ja"]), {
      type: "screen",
      value: "always",
    });
    expect(forced.launch).toEqual({ stage: "language", language: "ja", skipped: false });
  });

  it("keeps prototype, units, and appearance independent of language choices", () => {
    const initial = initialLanguageState(["ja"]);
    const settings = reduceLanguage(initial, { type: "prototype", value: "settings" });
    const units = reduceLanguage(settings, { type: "units", value: "imperial" });
    const appearance = reduceLanguage(units, { type: "appearance", value: "dark" });
    expect(appearance).toEqual({
      ...initial,
      prototype: "settings",
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
