---
name: HackRF sweep architecture vs gr-DroneID
description: Открихме че bridge.py използва hackrf_sweep (енергиен детектор), не gr-DroneID (протоколен декодер). Frequency hopping е излишен. Второ HackRF има смисъл само за паралелен sweep + декодиране.
---

## Откритието

`hardware/hackrf-bridge/bridge.py` използва `hackrf_sweep` — мете 400–6000 MHz и засича RF **енергия** по честоти. НЕ използва gr-DroneID и НЕ декодира DroneID протокол.

**Следствия:**
- RF alerts = "има сигнал в тази честотна лента", не "засечен DroneID frame"
- Waterfall на Spectrum страницата е реален и покрива целия спектър
- Frequency hopping с едно HackRF е безсмислен — sweep-ът вече покрива всичко за ~1-2 сек
- Второ HackRF има смисъл само ако: едното мете (sweep) + другото декодира DroneID протокол (gr-DroneID) едновременно — те не могат да споделят един хардуер

**Why:**
HackRF е half-duplex, един процес в даден момент. hackrf_sweep и gr-DroneID не могат да вървят паралелно на едно устройство.

**How to apply:**
Ако потребителят пита за "засичане на DroneID" — уточни че сега засичаме RF енергия, не декодираме протокол. За истинско DroneID декодиране трябва второ HackRF + gr-DroneID.
