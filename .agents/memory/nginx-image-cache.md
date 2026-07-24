---
name: nginx image cache busting
description: nginx кешира статичните файлове по URL — замяна на файл със същото име НЕ се вижда на live сайта
---

**Rule:** Когато сменяш изображение на live сайта (nginx), ако запазиш същото файлово ime, nginx сервира стария cached файл на всички потребители — дори след `git pull + build + nginx -s reload`.

**Why:** nginx (и браузърите) кешират по URL path. `dronexit_hero.png` → същия URL → стар кеш.

**How to apply:** Всеки път когато се сменя публичен asset (`.png`, `.jpg`, etc.) с ново съдържание:
1. Дай му ново ime (напр. `dronexit_hero_v2.png`, `dronexit_hero_v3.png`)
2. Обнови референцията в кода
3. Commit + push + deploy

Никога не разчитай на браузъра на потребителя или nginx да "усети" промяната по съдържание при еднакво файлово ime.
