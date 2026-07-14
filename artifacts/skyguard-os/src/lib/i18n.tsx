import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "bg";

const STORAGE_KEY = "skyguard-language";

const translations = {
  en: {
    "app.name": "SkyGuard OS",
    "nav.radar": "Radar",
    "nav.history": "History",
    "nav.settings": "Settings",
    "badge.online": "System Online",
    "badge.offline": "Hardware Offline",
    "badge.det": "DET",

    "home.initializing": "Initializing Radar Systems...",
    "home.configMissingTitle": "System Configuration Missing",
    "home.configMissingDesc":
      "Please navigate to Settings to configure the home property coordinates and geofence radius before initiating tracking.",
    "home.breach": "Proximity Breach Detected",

    "telemetry.activeTargets": "Active Targets",
    "telemetry.noTargets": "No targets detected",
    "telemetry.unknownTarget": "Unknown Target",
    "telemetry.distance": "Distance",
    "telemetry.altSpd": "ALT / SPD",
    "telemetry.signal": "Signal",
    "telemetry.pilotLoc": "Pilot Est. Loc",
    "telemetry.lastSeen": "Last seen {time}",

    "settings.title": "System Configuration",
    "settings.subtitle": "Configure property coordinates and perimeter defense radius",
    "settings.section.propertyDetails": "Property Details",
    "settings.field.designation": "Designation",
    "settings.field.designationPlaceholder": "e.g. ALPHA BASE",
    "settings.field.designationDesc": "Internal reference name for this installation.",
    "settings.field.designationRequired": "Property name is required",
    "settings.section.positioning": "Global Positioning",
    "settings.field.latitude": "Latitude",
    "settings.field.longitude": "Longitude",
    "settings.section.perimeter": "Perimeter Defense",
    "settings.field.radius": "Alarm Radius (Meters)",
    "settings.field.radiusDesc": "Proximity threshold for triggering audible and visual alarms.",
    "settings.field.radiusMin": "Radius must be at least 1 meter",
    "settings.button.commit": "Commit Changes",
    "settings.button.committing": "Committing...",
    "settings.toast.savedTitle": "Configuration Saved",
    "settings.toast.savedDesc": "Property and geofence settings updated successfully.",
    "settings.toast.errorTitle": "Error",
    "settings.toast.errorDesc": "Failed to save configuration. Please try again.",

    "history.title": "Detection Log",
    "history.subtitle": "Historical record of identified incursions and flight sessions",
    "history.table.targetId": "Target ID / Details",
    "history.table.firstDetected": "First Detected",
    "history.table.duration": "Duration",
    "history.table.minRange": "Min Range",
    "history.table.peakActivity": "Peak Activity",
    "history.empty": "No historical data available",
    "history.unknownModel": "Unknown",
    "history.minutes": "min",
    "history.points": "points",
    "history.alt": "ALT",
    "history.spd": "SPD",
  },
  bg: {
    "app.name": "SkyGuard OS",
    "nav.radar": "Радар",
    "nav.history": "История",
    "nav.settings": "Настройки",
    "badge.online": "Системата е онлайн",
    "badge.offline": "Хардуерът е офлайн",
    "badge.det": "ДЕТ",

    "home.initializing": "Инициализиране на радарната система...",
    "home.configMissingTitle": "Липсва системна конфигурация",
    "home.configMissingDesc":
      "Моля, отидете в Настройки, за да зададете координатите на имота и радиуса на защитната зона, преди да стартирате наблюдението.",
    "home.breach": "Засечено нарушение на периметъра",

    "telemetry.activeTargets": "Активни цели",
    "telemetry.noTargets": "Няма засечени цели",
    "telemetry.unknownTarget": "Неизвестна цел",
    "telemetry.distance": "Разстояние",
    "telemetry.altSpd": "ВИС. / СКОР.",
    "telemetry.signal": "Сигнал",
    "telemetry.pilotLoc": "Прибл. позиция на пилота",
    "telemetry.lastSeen": "Последно засечен {time}",

    "settings.title": "Системна конфигурация",
    "settings.subtitle": "Настройте координатите на имота и радиуса на защитната зона",
    "settings.section.propertyDetails": "Данни за имота",
    "settings.field.designation": "Наименование",
    "settings.field.designationPlaceholder": "напр. БАЗА АЛФА",
    "settings.field.designationDesc": "Вътрешно име за тази инсталация.",
    "settings.field.designationRequired": "Името на имота е задължително",
    "settings.section.positioning": "Позициониране",
    "settings.field.latitude": "Ширина (Latitude)",
    "settings.field.longitude": "Дължина (Longitude)",
    "settings.section.perimeter": "Защитен периметър",
    "settings.field.radius": "Радиус на алармата (метри)",
    "settings.field.radiusDesc": "Праг на близост за задействане на звуковата и визуалната аларма.",
    "settings.field.radiusMin": "Радиусът трябва да е поне 1 метър",
    "settings.button.commit": "Запази промените",
    "settings.button.committing": "Запазване...",
    "settings.toast.savedTitle": "Конфигурацията е запазена",
    "settings.toast.savedDesc": "Настройките за имота и защитната зона бяха успешно обновени.",
    "settings.toast.errorTitle": "Грешка",
    "settings.toast.errorDesc": "Неуспешно запазване на конфигурацията. Опитайте отново.",

    "history.title": "Дневник на засичанията",
    "history.subtitle": "Хронологичен запис на засечени навлизания и полети",
    "history.table.targetId": "Идентификатор / Данни",
    "history.table.firstDetected": "Първо засичане",
    "history.table.duration": "Продължителност",
    "history.table.minRange": "Мин. разстояние",
    "history.table.peakActivity": "Пикова активност",
    "history.empty": "Няма налични исторически данни",
    "history.unknownModel": "Неизвестен",
    "history.minutes": "мин",
    "history.points": "точки",
    "history.alt": "ВИС",
    "history.spd": "СКОР",
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "bg" || stored === "en" ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: Language) => setLanguageState(next);
    const toggleLanguage = () => setLanguageState((prev) => (prev === "en" ? "bg" : "en"));
    const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = translations[language][key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [varKey, varValue] of Object.entries(vars)) {
          text = text.replace(`{${varKey}}`, String(varValue));
        }
      }
      return text;
    };
    return { language, setLanguage, toggleLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
