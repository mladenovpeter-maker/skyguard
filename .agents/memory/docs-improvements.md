---
name: DronExit documentation improvements
description: Pending text/presentation improvements for landing page, README, and technical docs — approved by user for later implementation.
---

# DronExit — Документационни подобрения (за по-късно)

## 1. Landing страница — заглавие
- Сменя с конкретен сегмент: "Passive RF & Remote ID detection for critical infrastructure perimeters"
- Една линия, без думите "система" или "платформа"

## 2. Технически термини — замени
| Сега | По-точно |
|---|---|
| "засича дрони" | "detects UAS presence via RF signature" |
| "RF спектър мониторинг" | "passive wideband RF monitoring (400 MHz – 6 GHz)" |
| "BLE декодер" | "ASTM F3411-22a Remote ID decoder" |
| "ML модел" | "on-device RF classifier (scikit-learn)" |
| "Wi-Fi разузнаване" | "802.11 passive monitoring (monitor mode, no injection)" |
| "алерт" | "detection event" |

## 3. README — структура
```
README.md
├── What it does (2 изречения)
├── Detection capabilities (таблица)
├── Hardware requirements
├── Quick start (5 стъпки, copy-paste)
├── Architecture diagram
├── Configuration reference (всички ENV vars)
├── Known limitations
└── License
```

## 4. "Честен преглед" → Detection Matrix
Замени с таблица в стил:
```
┌────────────────────┬──────────┬──────────────────────────────┐
│ Target             │ Method   │ Output                       │
├────────────────────┼──────────┼──────────────────────────────┤
│ DJI Mini 3 Pro     │ BLE RID  │ GPS, serial, pilot position  │
│ DJI OcuSync 2.4G  │ RF       │ Presence, signal strength    │
│ FPV (ELRS 868MHz) │ RF       │ Presence                     │
│ DJI Mini 2        │ RF only  │ Presence (no RID)            │
│ Custom / silent   │ —        │ Not detected                 │
└────────────────────┴──────────┴──────────────────────────────┘
```

## 5. Feature cards — добави технически детайл
Под всяко feature: конкретна бележка (напр. "scikit-learn classifier, ~60% fewer false positives")

## 6. Version banner
`v1.0.0-beta · Tested on Raspberry Pi 4 · Requires HackRF One`

**Why:** User confirmed architecture and hardware are 9.5/10 — documentation is the main gap (7/10). These changes make the project look like a mature open-source/commercial product without touching code.
