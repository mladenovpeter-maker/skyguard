# SkyGuard RF Fingerprinting

Тренировъчен pipeline за разграничаване на дронове от WiFi и фонов шум,
базиран на реални HackRF sweep captures.

## Как работи

```
DroneRF.zip (IEEE DataPort)
    │
    ▼
extract_dronerf.py     → datasets/*.csv  +  *.label
    │
    ▼
process_datasets.py    → datasets/features.npz
    │
    ▼
train_from_datasets.py → rf_model.joblib
    │
    ▼
scp → Pi:rf_model.joblib
    │
    ▼
bridge.py (зарежда модела → класифицира sweep-ове в реално време)
```

## Стъпки

### 1. Вземи DroneRF dataset (еднократно)

1. Регистрирай се безплатно на https://ieee-dataport.org/open-access/dronerf
2. Изтегли пълния DroneRF zip (~2 GB)
3. Качи го на Linux сървъра:
   ```bash
   scp DroneRF.zip tmm@192.168.100.224:~/skyguard/hardware/rf-fingerprinting/
   ```

### 2. Пусни pipeline-а

```bash
ssh tmm@192.168.100.224
cd ~/skyguard/hardware/rf-fingerprinting
chmod +x setup.sh
./setup.sh
```

Очаквано време: ~5–10 мин (извличане + тренировка).

### 3. Провери

```bash
ls -lh rf_model.joblib          # трябва да съществува, ~1–5 MB
ssh admin@192.168.100.252 "sudo systemctl status skyguard-hackrf-bridge"
```

## Файлова структура

| Файл | Роля |
|------|------|
| `extract_dronerf.py` | Извлича zip, поставя `.label` sidecars |
| `process_datasets.py` | CSV → feature матрица (features.npz) |
| `train_from_datasets.py` | RandomForest / GradientBoosting, избира по-добрия |
| `classify.py` | Runtime класификация (ползва се от bridge.py) |
| `setup.sh` | Master скрипт (стъпки 1–5) |
| `datasets/` | Извлечени CSV-та + features.npz (gitignore-нати) |
| `rf_model.joblib` | Готов модел (деплойва се на Pi) |

## Features (9 на sweep window)

| Feature | Описание |
|---------|----------|
| `peak_dbm` | Най-силният bin в dBm |
| `mean_dbm` | Средна мощност |
| `std_dbm` | Спектрална плоскост |
| `bandwidth_3db` | Ширина при -3 dB (нормализирана) |
| `peak_norm_hz` | Позиция на пика в обхвата (0–1) |
| `above_mean_db` | Пик над средната (spike индикатор) |
| `spectral_kurtosis` | Форма на разпределението |
| `hour_sin` / `hour_cos` | Час на деня (runtime → не е 0) |

## DroneRF dataset

**Хартия:** Al-Sa'd et al., "DroneRF dataset: A dataset of drones for RF-based detection, classification and identification", Data in Brief, 2019.

**Лиценз:** CC BY 4.0

**Дронове:** DJI Phantom 4, Parrot Bebop 2, AR.Drone 2.0

**Честота:** 2.4 GHz WiFi band (2400–2500 MHz)

**Формат:** hackrf_sweep CSV — `date, time, hz_low, hz_high, bin_width, n_samples, dBm...`
