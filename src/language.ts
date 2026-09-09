export const languageOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "de", label: "Deutsch" },
  { value: "nl", label: "Nederlands" },
  { value: "da", label: "Dansk" },
  { value: "sv", label: "Svenska" },
  { value: "nb", label: "Norsk bokmål" },
  { value: "fi", label: "Suomi" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pl", label: "Polski" },
  { value: "ko", label: "한국어" },
  { value: "ja", label: "日本語" },
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
] as const;

export type LanguageTag = (typeof languageOptions)[number]["value"];

export function resolveOsLanguage(languages: readonly string[]): LanguageTag {
  for (const language of languages) {
    let locale: Intl.Locale;
    try {
      locale = new Intl.Locale(language);
    } catch {
      continue;
    }
    if (locale.language === "pt") return locale.region === "BR" ? "pt-BR" : "pt-PT";
    if (locale.language === "zh") {
      if (locale.script === "Hant") return "zh-Hant";
      if (locale.script === "Hans") return "zh-Hans";
      return ["TW", "HK", "MO"].includes(locale.region ?? "") ? "zh-Hant" : "zh-Hans";
    }
    if (locale.language === "no") return "nb";
    const match = languageOptions.find((option) => option.value === locale.language);
    if (match) return match.value;
  }
  return "en";
}

export type Catalog = {
  readonly title: string;
  readonly continue: string;
  readonly setup: string;
  readonly chosenLanguage: string;
  readonly back: string;
  readonly preferences: string;
  readonly language: string;
  readonly automatic: string;
  readonly automaticDetail: string;
  readonly explicitDetail: string;
  readonly saving: string;
  readonly unavailable: string;
  readonly units: string;
  readonly unitsDetail: string;
  readonly metric: string;
  readonly imperial: string;
  readonly appearance: string;
  readonly appearanceDetail: string;
  readonly system: string;
  readonly light: string;
  readonly dark: string;
};

const catalogs: Record<"en" | "it" | "ja", Catalog> = {
  en: {
    title: "Choose your language",
    continue: "Continue",
    setup: "Setup",
    chosenLanguage: "Chosen language",
    back: "Back to language",
    preferences: "Preferences",
    language: "Language",
    automatic: "Automatic",
    automaticDetail:
      "Automatic follows your macOS language; the coach replies in the language you write in.",
    explicitDetail:
      "The app uses your selected language; the coach replies in the language you write in.",
    saving: "Saving language…",
    unavailable: "Language preference unavailable",
    units: "Units",
    unitsDetail:
      "Distance and body mass follow this setting. Cycling power-to-weight remains W/kg.",
    metric: "Metric",
    imperial: "Imperial",
    appearance: "Appearance",
    appearanceDetail: "System follows your macOS light and dark setting",
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  it: {
    title: "Scegli la tua lingua",
    continue: "Continua",
    setup: "Configurazione",
    chosenLanguage: "Lingua scelta",
    back: "Torna alla lingua",
    preferences: "Preferenze",
    language: "Lingua",
    automatic: "Automatica",
    automaticDetail:
      "Automatica segue la lingua di macOS; il coach risponde nella lingua in cui scrivi.",
    explicitDetail:
      "L'app usa la lingua selezionata; il coach risponde nella lingua in cui scrivi.",
    saving: "Salvataggio della lingua…",
    unavailable: "Preferenza della lingua non disponibile",
    units: "Unità",
    unitsDetail:
      "Distanza e peso corporeo seguono questa impostazione. Il rapporto potenza/peso nel ciclismo resta in W/kg.",
    metric: "Metriche",
    imperial: "Imperiali",
    appearance: "Aspetto",
    appearanceDetail: "Sistema segue l'impostazione chiara o scura di macOS",
    system: "Sistema",
    light: "Chiaro",
    dark: "Scuro",
  },
  ja: {
    title: "言語を選択",
    continue: "続ける",
    setup: "セットアップ",
    chosenLanguage: "選択した言語",
    back: "言語選択に戻る",
    preferences: "環境設定",
    language: "言語",
    automatic: "自動",
    automaticDetail: "「自動」はmacOSの言語に合わせ、コーチはあなたが書いた言語で返信します。",
    explicitDetail: "アプリは選択した言語で表示され、コーチはあなたが書いた言語で返信します。",
    saving: "言語を保存中…",
    unavailable: "言語設定を利用できません",
    units: "単位",
    unitsDetail:
      "距離と体重はこの設定に従います。サイクリングのパワーウェイトレシオはW/kgのままです。",
    metric: "メートル法",
    imperial: "ヤード・ポンド法",
    appearance: "外観",
    appearanceDetail: "「システム」はmacOSのライトとダークの設定に従います",
    system: "システム",
    light: "ライト",
    dark: "ダーク",
  },
};

export function catalogFor(tag: LanguageTag): {
  language: "en" | "it" | "ja";
  fallback: boolean;
  copy: Catalog;
} {
  const language = tag === "it" || tag === "ja" ? tag : "en";
  return { language, fallback: language !== tag, copy: catalogs[language] };
}

export type LanguageState = {
  readonly prototype: "first-launch" | "settings";
  readonly presentation: "radio" | "select";
  readonly osLanguage: LanguageTag;
  readonly launch: {
    readonly stage: "language" | "setup";
    readonly language: LanguageTag;
  };
  readonly preference: "automatic" | LanguageTag;
  readonly preferenceStatus: "ready" | "saving" | "unavailable";
  readonly units: "metric" | "imperial";
  readonly appearance: "system" | "light" | "dark";
};

export type LanguageAction =
  | { readonly type: "prototype"; readonly value: LanguageState["prototype"] }
  | { readonly type: "presentation"; readonly value: LanguageState["presentation"] }
  | { readonly type: "os-language"; readonly languages: readonly string[] }
  | { readonly type: "highlight"; readonly language: LanguageTag }
  | { readonly type: "continue" }
  | { readonly type: "back" }
  | { readonly type: "preference"; readonly value: LanguageState["preference"] }
  | {
      readonly type: "settings-scenario";
      readonly value: "automatic" | "explicit" | "saving" | "unavailable";
    }
  | { readonly type: "units"; readonly value: LanguageState["units"] }
  | { readonly type: "appearance"; readonly value: LanguageState["appearance"] };

export function initialLanguageState(languages: readonly string[]): LanguageState {
  const osLanguage = resolveOsLanguage(languages);
  return {
    prototype: "first-launch",
    presentation: "radio",
    osLanguage,
    launch: { stage: "language", language: osLanguage },
    preference: "automatic",
    preferenceStatus: "ready",
    units: "metric",
    appearance: "system",
  };
}

export function reduceLanguage(state: LanguageState, action: LanguageAction): LanguageState {
  switch (action.type) {
    case "prototype":
      return { ...state, prototype: action.value };
    case "presentation":
      return { ...state, presentation: action.value };
    case "os-language": {
      const osLanguage = resolveOsLanguage(action.languages);
      return { ...state, osLanguage, launch: { stage: "language", language: osLanguage } };
    }
    case "highlight":
      return state.launch.stage === "language"
        ? { ...state, launch: { stage: "language", language: action.language } }
        : state;
    case "continue":
      return state.launch.stage === "language"
        ? { ...state, launch: { ...state.launch, stage: "setup" } }
        : state;
    case "back":
      return state.launch.stage === "setup"
        ? { ...state, launch: { ...state.launch, stage: "language" } }
        : state;
    case "preference":
      return state.preferenceStatus === "ready" ? { ...state, preference: action.value } : state;
    case "settings-scenario":
      switch (action.value) {
        case "automatic":
          return { ...state, preference: "automatic", preferenceStatus: "ready" };
        case "explicit":
          return {
            ...state,
            preference: state.preference === "automatic" ? "it" : state.preference,
            preferenceStatus: "ready",
          };
        case "saving":
        case "unavailable":
          return { ...state, preferenceStatus: action.value };
      }
      break;
    case "units":
      return { ...state, units: action.value };
    case "appearance":
      return { ...state, appearance: action.value };
  }
}
