---
name: Linux server git sync quirk
description: git pull on Linux server often misses Replit edits; apply fixes via sed directly on server
---

## Правило

Когато правиш edit на файл в Replit и после правиш git pull на Linux сървъра (tmm@192.168.100.224), файлът може да не се обнови — особено ако е бил в commit преди текущия HEAD на сървъра.

**Симптом:** grep на сървъра показва стария код; build-натият JS има стария hash.

**Fix:** Прилагай промяната директно на сървъра с `sed -i`, после rebuild.

```bash
sed -i 's|СТАР_КОД|НОВ_КОД|' ~/skyguard/path/to/file.tsx
cd ~/skyguard && pnpm --filter @workspace/skyguard-os run build && sudo nginx -s reload
```

**Why:** Сървърът понякога е ahead/behind с commits по различен начин от Replit. dist/ файловете са в git и причиняват конфликти при pull.

**Дългосрочно решение:** Добави `artifacts/*/dist/` в `.gitignore` на сървъра.

## wss:// pattern за HTTPS

Всички WebSocket URL-и трябва да използват:
```js
`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/path`
```
НЕ хардкоднато `ws://` — блокира се от браузъра на HTTPS сайтове.
