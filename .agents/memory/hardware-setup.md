---
name: SkyGuard hardware setup
description: Which hardware is where in the SkyGuard deployment
---

All hardware is physically connected to the Raspberry Pi (admin@skyguard):
- HackRF One → runs skyguard-hackrf-bridge.service
- UB500 BLE USB dongle → hci1, runs droneID-scanner
- WiFi USB adapter → ambient WiFi scanning

The Raspberry Pi posts data to the Linux server API at http://192.168.100.224:3001.
The Linux server (192.168.100.224) runs nginx (port 8090) serving /var/www/skyguard/public/ and the API (port 3001).

**Why:** Confused this multiple times — user was very clear that admin@skyguard IS the Pi, not a separate server.

Build process: build on Replit (PORT=3000 BASE_PATH=/skyguard-os/ pnpm --filter @workspace/skyguard-os build), commit dist with git add -f, push, then on Pi: git pull && sudo cp -r artifacts/skyguard-os/dist/public/* /var/www/skyguard/public/
