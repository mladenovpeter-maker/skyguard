import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "bg";

const STORAGE_KEY = "skyguard-language";

const translations = {
  en: {
    "app.name": "SkyGuard OS",
    "nav.radar": "Radar",
    "nav.history": "History",
    "nav.settings": "Settings",
    "nav.admin": "Admin",
    "nav.logout": "Log out",
    "access.restricted": "Access restricted. Please sign in to continue.",
    "access.signIn": "Sign In",
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
    "settings.map.hint": "Click anywhere on the map, or drag the pin, to set the property location.",
    "settings.map.useCurrentLocation": "Use My Location",
    "settings.map.geoUnsupportedTitle": "Not Supported",
    "settings.map.geoUnsupportedDesc": "This device does not support geolocation.",
    "settings.map.geoErrorTitle": "Location Unavailable",
    "settings.map.geoErrorDesc": "Could not determine your current location. Please try clicking on the map instead.",
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

    "admin.title": "Device Administration",
    "admin.subtitle": "Register and manage field hardware devices and their API keys",
    "admin.addDevice": "Add Device",
    "admin.dialog.title": "Register New Device",
    "admin.dialog.description": "Give the device a name (e.g. its location). An API key will be generated for it.",
    "admin.dialog.create": "Generate Key",
    "admin.dialog.creating": "Generating...",
    "admin.device.name": "Device Name",
    "admin.device.namePlaceholder": "e.g. Roof Antenna",
    "admin.device.nameRequired": "Device name is required",
    "admin.table.device": "Device",
    "admin.table.status": "Status",
    "admin.table.lastSeen": "Last Seen",
    "admin.table.actions": "Actions",
    "admin.empty": "No devices registered yet",
    "admin.neverConnected": "Never connected",
    "admin.status.active": "Active",
    "admin.status.revoked": "Revoked",
    "admin.revokeDialog.title": "Revoke this device?",
    "admin.revokeDialog.description": "\"{name}\" will immediately lose access and can no longer submit detections. This cannot be undone.",
    "admin.revokeDialog.cancel": "Cancel",
    "admin.revokeDialog.confirm": "Revoke",
    "admin.keyDialog.title": "Device API Key",
    "admin.keyDialog.description": "Copy this key now and paste it into the device's bridge configuration. For security, it will not be shown again.",
    "admin.keyDialog.warning": "Store it somewhere safe — if lost, you'll need to revoke this device and create a new one.",
    "admin.keyDialog.done": "Done",
    "admin.toast.errorTitle": "Error",
    "admin.toast.createErrorDesc": "Failed to register device. Please try again.",
    "admin.toast.revokeErrorDesc": "Failed to revoke device. Please try again.",
    "admin.toast.revokedTitle": "Device revoked",
  },
  bg: {
    "app.name": "SkyGuard OS",
    "nav.radar": "Радар",
    "nav.history": "История",
    "nav.settings": "Настройки",
    "nav.admin": "Администрация",
    "nav.logout": "Изход",
    "access.restricted": "Достъпът е ограничен. Моля, влезте, за да продължите.",
    "access.signIn": "Вход",
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
    "settings.map.hint": "Кликнете върху картата или преместете пина, за да зададете местоположението на имота.",
    "settings.map.useCurrentLocation": "Моята локация",
    "settings.map.geoUnsupportedTitle": "Не се поддържа",
    "settings.map.geoUnsupportedDesc": "Това устройство не поддържа определяне на местоположение.",
    "settings.map.geoErrorTitle": "Локацията е недостъпна",
    "settings.map.geoErrorDesc": "Неуспешно определяне на текущото местоположение. Опитайте да кликнете върху картата.",
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

    "admin.title": "Управление на устройства",
    "admin.subtitle": "Регистрирайте и управлявайте устройствата и техните API ключове",
    "admin.addDevice": "Добави устройство",
    "admin.dialog.title": "Регистриране на ново устройство",
    "admin.dialog.description": "Задайте име на устройството (напр. неговото местоположение). Ще бъде генериран API ключ за него.",
    "admin.dialog.create": "Генерирай ключ",
    "admin.dialog.creating": "Генериране...",
    "admin.device.name": "Име на устройството",
    "admin.device.namePlaceholder": "напр. Антена на покрива",
    "admin.device.nameRequired": "Името на устройството е задължително",
    "admin.table.device": "Устройство",
    "admin.table.status": "Статус",
    "admin.table.lastSeen": "Последна връзка",
    "admin.table.actions": "Действия",
    "admin.empty": "Все още няма регистрирани устройства",
    "admin.neverConnected": "Никога не се е свързвало",
    "admin.status.active": "Активно",
    "admin.status.revoked": "Отменено",
    "admin.revokeDialog.title": "Да се отмени ли това устройство?",
    "admin.revokeDialog.description": "\"{name}\" незабавно ще загуби достъп и няма да може повече да изпраща засичания. Това действие е необратимо.",
    "admin.revokeDialog.cancel": "Отказ",
    "admin.revokeDialog.confirm": "Отмени",
    "admin.keyDialog.title": "API ключ на устройството",
    "admin.keyDialog.description": "Копирайте този ключ сега и го въведете в конфигурацията на моста на устройството. От съображения за сигурност няма да бъде показан отново.",
    "admin.keyDialog.warning": "Съхранявайте го на сигурно място — ако бъде изгубен, ще трябва да отмените това устройство и да създадете ново.",
    "admin.keyDialog.done": "Готово",
    "admin.toast.errorTitle": "Грешка",
    "admin.toast.createErrorDesc": "Неуспешно регистриране на устройството. Опитайте отново.",
    "admin.toast.revokeErrorDesc": "Неуспешно отменяне на устройството. Опитайте отново.",
    "admin.toast.revokedTitle": "Устройството е отменено",
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
