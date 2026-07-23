---
name: Pending tasks (user-requested, not started)
description: Tasks the user asked to save and execute later
---

## WiFi USB донгъл / HackRF revert

**Какво да се направи:**
1. `sudo systemctl disable --now skyguard-dji-wifi-scanner` на Pi
2. В `frequencies.json`: DJI 2.4G и 5.8G — баланс: -55 dBm (не -30, не -65)
3. За narrow-band (433/868/915): dynamic baseline остава. За 2.4/5.8 GHz: static_threshold_only: true
4. OcuSync детектора в bridge.py — остава (не пречи)

**Защо:** wlan1mon не хваща DJI Mini 2 (OcuSync 2.0 ≠ стандартен 802.11).
