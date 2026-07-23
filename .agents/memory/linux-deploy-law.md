---
name: Linux server deploy law
description: After ANY skyguard-os code change, must build and reload nginx on Linux server (192.168.100.224). User-mandated law.
---

## Законът

След **всяка** промяна по `artifacts/skyguard-os` (или друга artifact, която се сервира от nginx на Linux сървъра), задължително изпълни deploy стъпката на `192.168.100.224 (user: tmm)`:

```bash
git pull origin main && BASE_PATH=/ pnpm --filter @workspace/skyguard-os run build && sudo nginx -s reload
```

## Why

nginx на Linux сървъра (`192.168.100.224:8090`) сервира от `/var/www/skyguard/public`, което е symlink към `/home/tmm/skyguard/artifacts/skyguard-os/dist/public`. Без нов build и nginx reload, продукционният сайт показва стари файлове.

## How to apply

- Преди да обявиш задача за завършена, инструктирай потребителя да изпълни горната команда на Linux сървъра.
- Ако промяната е само CSS/JS (никакви нови env vars), горната команда е достатъчна.
- `.env` файлът с `VITE_CLERK_PUBLISHABLE_KEY` вече е в git — ще се pull-ва автоматично.
