---
name: HackRF WebSocket proxy via nginx
description: How the HackRF bridge WebSocket is exposed to the browser — nginx proxy, not direct Pi connection.
---

## Rule
Browser connects to `ws://192.168.100.224:8090/hackrf-ws` (nginx on Linux server), NOT directly to `ws://192.168.100.252:8765` (Pi). Pi static IP is 192.168.100.252.

**Why:** Browser on Mac LAN could not connect directly to Pi port 8765 (blocked/filtered on the home network). Proxying through nginx on the Linux server (which CAN reach the Pi) solves this.

## nginx location block (in /etc/nginx/sites-enabled/skyguard)
```nginx
location /hackrf-ws {
    proxy_pass http://192.168.100.252:8765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

## Frontend WS_URL (spectrum.tsx)
```ts
const WS_URL = (import.meta.env.VITE_HACKRF_WS_URL as string) ||
  `ws://${window.location.host}/hackrf-ws`;
```

**How to apply:** Any time the HackRF bridge WebSocket needs to be accessed from the browser, use the nginx proxy path, not a direct Pi IP.
