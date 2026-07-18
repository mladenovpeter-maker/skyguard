---
name: SkyGuard Box — Hardware Design
description: Self-contained drone detection unit, всичко в една кутия. Одобрена архитектура от потребителя.
---

## Одобрена архитектура

Всичко в една IP67 кутия, захранена с PoE или DC 12V.

**Компоненти (Pro версия, ~$772 BOM):**
- Raspberry Pi 5 8GB — мозъкът, върти SkyGuard OS + API + DB + web
- HackRF One #1 — RF sweep 400–6000 MHz (hackrf_sweep)
- HackRF One #2 — DroneID декодиране на 868 MHz (gr-DroneID)
- nRF52840 USB dongle — BLE Remote ID
- Waveshare SIM7600 HAT — 4G LTE backup/основна връзка
- u-blox NEO-M8N — GPS
- NVMe SSD 512GB (Pi5 HAT) — RF dataset + logs (не SD карта!)
- Wideband omni антена 400–6000 MHz
- PoE HAT за Pi5
- IP67 ABS кутия 250×200×100mm

**Три SKU:**
- Starter: ~$420 BOM → $2,500 продажна
- Pro: ~$772 BOM → $5,500 продажна
- Enterprise: ~$900 BOM → $9,000 продажна

## Pi 5 може ли да върти всичко

Да. Pi 5 8GB (Cortex-A76 @ 2.4GHz) поема:
- SkyGuard OS (React static build — nginx, много лек)
- API сървър (Node.js/Express)
- PostgreSQL база данни
- hackrf_sweep bridge + WebSocket
- gr-DroneID (втори HackRF)
- DroneID BLE scanner
- Ambient WiFi scanner
- RF Fingerprinting inference (ONNX, бъдеще)

Текущият Linux сървър (192.168.100.224) прави по-малко от това. Pi 5 е по-мощен от типичен $20/мес VPS.

**Why:** NVMe SSD е критичен — SD картата умира при непрекъснат DB запис. С NVMe системата е production-ready.

## Дизайн на кутията — одобрена концепция

Flat panel като Dedrone RF-160 на снимката. **Алуминиевият гръб = антена.** Нищо не стърчи отвън.

Технически решения за вградена антена:
- **LPDA (Log-Periodic Dipole Array)** фрезована в алуминиевия гръб → покрива 400–6000 MHz в един panel
- Или: два patch антени (400–1000 MHz + 1–6 GHz) интегрирани в задната плоча
- SMA конекторите са вътре в кутията — навън само монтажна стойка/болт

Резултат: чист правоъгълен panel, монтира се на стена/стойка, изглежда като Dedrone но е наш.

## Следващи стъпки за хардуера
1. Поръчка на компонентите (списъкът е готов)
2. Consolidate Linux сървър → Pi 5 (всичко на едно място)
3. Тест в кутия преди IP67 заливане
4. RF Fingerprinting AI интеграция (dataset-ите на NVMe)
