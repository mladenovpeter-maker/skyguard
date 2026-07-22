# SkyGuard RF Fingerprinting

Автоматично разпознава дали RF сигнал е от дрон или от WiFi/намеса.
**Напълно автономен — без ръчна намеса.**

## Как работи

```
Публични dataset-и (DroneRF, UAVSig)
         │
         ▼
  process_datasets.py  →  features.npz
         │
         ▼
  train_from_datasets.py  →  rf_model.joblib
         │
    scp до Pi
         │
         ▼
  bridge.py  →  classify.py зарежда модела
         │
         ▼
  WiFi сигнал → ПОТИСНАТ
  Дрон сигнал → RF ALERT към API
```

## Стартиране (на Linux сървъра, веднъж)

```bash
cd ~/skyguard/hardware/rf-fingerprinting
chmod +x setup.sh
./setup.sh
```

Скриптът прави всичко автоматично:
1. Изтегля dataset-и от DroneRF (Zenodo) и UAVSig (GitHub)
2. Обработва ги в feature матрица
3. Тренира RandomForest + GradientBoosting, избира по-добрия
4. Копира модела на Pi-то: `/home/admin/skyguard/hardware/rf-fingerprinting/rf_model.joblib`
5. Рестартира `skyguard-hackrf-bridge` service

## При нов дрон на пазара

Ако се появи нов дрон модел, добави URL към `download_datasets.py` в `DATASETS` листа
и пусни `./setup.sh` отново. Моделът се преобучава автоматично.

## Features (9 броя)

| Feature | Описание |
|---|---|
| `peak_dbm` | Най-силен сигнал в лентата |
| `mean_dbm` | Средна мощност |
| `std_dbm` | Стандартно отклонение (спектрална форма) |
| `bw_norm` | Ширина при -3 dB (нормализирана) |
| `peak_norm` | Позиция на пика в лентата (0–1) |
| `above_mean` | Пик над средното ниво |
| `spec_kurt` | Куртозис — остра/плоска спектрална форма |
| `hour_sin/cos` | Час от деня (WiFi по-активен вечер) |
