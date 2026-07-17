# nRF52840 Dongle Setup — SkyGuard DroneID Scanner

## 1. Flash firmware (от твоя компютър, не от Pi)

### Изтегли nRF Connect for Desktop
https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-Desktop

### Изтегли Zephyr HCI USB firmware за nRF52840 Dongle
https://github.com/zephyrproject-rtos/zephyr/releases
→ търси `zephyr-sdk` или готов `hci_usb_nrf52840dongle.hex`

### Флашване
1. Натисни reset бутона на донгъла (малкия бутон встрани)
2. LED свети червено/белезникаво → bootloader mode
3. Отвори **Programmer** в nRF Connect for Desktop
4. Избери устройството → Add file → флашни `.hex` файла
5. Write → готово

### Алтернатива: nrfutil (command line)
```bash
pip3 install nrfutil
# донгъл в bootloader mode (reset бутон)
nrfutil dfu usb-serial -pkg hci_usb.zip -p /dev/ttyACM0
```

---

## 2. Включи в Pi-то

```bash
# Провери дали Pi-то го вижда
lsusb
# → трябва да видиш: Nordic Semiconductor ASA nRF52840 Dongle

# Провери HCI адаптери
hciconfig
# → hci0 = Pi built-in BT
# → hci1 = nRF52840 донгъл  ✓

# Активирай hci1
sudo hciconfig hci1 up
```

---

## 3. Инсталирай зависимостите на Pi-то

```bash
cd /home/pi/skyguard/hardware/droneID-scanner
pip3 install -r requirements.txt
```

---

## 4. Конфигурирай .env

```bash
cp .env.example .env
nano .env
# Попълни SKYGUARD_API_BASE и SKYGUARD_DEVICE_KEY
```

---

## 5. Тест

```bash
source .env && python3 scanner.py
# Ако няма дронове наоколо — тихо (нормално)
# Когато пуснеш симулатора → ще хване ако drone-ът праща BLE Remote ID
```

---

## 6. Systemd (always-on)

```bash
sudo cp skyguard-droneID-scanner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now skyguard-droneID-scanner
sudo journalctl -u skyguard-droneID-scanner -f
```

---

## Деактивирай ambient BLE scanner на Pi (вече не е нужен за BLE)

```bash
# Ambient scanner вече сканира само WiFi, не BLE
# Може да го рестартираш
sudo systemctl restart skyguard-ambient-scanner
```
