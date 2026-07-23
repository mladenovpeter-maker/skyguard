---
name: RF Drone Datasets — TODO list
description: Статус на dataset-ите за RF fingerprinting. Моделът е натрениран на Jul 22.
---

# RF Drone Datasets — СТАТУС

## ✅ rf_model.joblib — ГОТОВ
- Натрениран: Jul 22 17:29 на Linux сървъра (192.168.100.224)
- Път: ~/skyguard/hardware/rf-fingerprinting/rf_model.joblib (446KB)
- datasets/ папката е изтрита след тренировката (пестене на място)
- Следваща стъпка: scp към Pi + интеграция в bridge.py

## Dataset статус

### ✅ DroneRF — Mendeley / IEEE DataPort
- Изтеглен ръчно от потребителя, прехвърлен на Linux сървъра
- Обработен с process_datasets.py → features.npz
- Натрениран с train_from_datasets.py → rf_model.joblib
- datasets/ изтрита след тренировката

### ✅ VTI_DroneSET_FFT — Mendeley Data
- Изтеглен (~4GB), после ИЗТРИТ — не е бил полезен

### ⏳ RF UAV — Zenodo (2023)
- URL: https://zenodo.org/records/10223214
- Съдържание: DJI M100, USRP X310, I/Q семпли
- Статус: не е теглен

### ⏳ Drone RF Dataset — KU Leuven (2024)
- URL: https://rdr.kuleuven.be/dataset.xhtml?persistentId=doi%3A10.48804%2FHZRVNZ
- Статус: не е теглен

### ⏳ Drone Remote Controller RF Signal — IEEE DataPort (Open Access)
- URL: https://ieee-dataport.org/open-access/drone-remote-controller-rf-signal-dataset
- IEEE DataPort акаунт вече е направен
- Статус: не е теглен

## Бележки
- CardRF (IEEE DataPort) е Standard tier — платен, пропускаме
- Dataset-ите се пазят на Linux сървъра (192.168.100.224, user: tmm), не на Pi
- Моделът се деплойва на Pi: scp rf_model.joblib admin@192.168.100.252:~/skyguard/hardware/rf-fingerprinting/
