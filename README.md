# DALIHub for Homey

[![Homey App Validation](https://github.com/niot-inc/me.niot.dalihub/actions/workflows/homey-app-validate.yml/badge.svg)](https://github.com/niot-inc/me.niot.dalihub/actions/workflows/homey-app-validate.yml)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/wokim)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?style=flat-square&logo=paypal)](https://paypal.me/wonshikkim)

Bring professional DALI lighting control to your smart home!

DALIHub connects your DALI lighting system to Homey, giving you full control over your commercial-grade lighting through an intuitive smart home interface.

## Features

### Device Support

- **DT6 & DT7 DALI Lights** - Full dimming control with precise DALI level (0-254) support
- **DT8 Color Lights** - Coming soon!
- **Occupancy Sensors** - Tested with Lunatone DALI-2 CS sensors
- **Lux Sensors** - Tested with Lunatone DALI-2 CS sensors
- **Push Buttons** - Tested with Lunatone DALI-2 MC devices
- **Light Groups** - Organize and control multiple lights as zones

### Advanced Control
- **DALI Level Control** - Direct arc power control (0-254) for sub-1% dimming precision
- **Scene Controller** - Recall DALI scenes by address, group, or broadcast
- **Real-time Updates** - Instant status synchronization via Server-Sent Events

### Flow Cards
- **When (Triggers)** - DALI level changed events
- **And (Conditions)** - DALI level comparisons
- **Then (Actions)** - Set DALI level, recall scenes, brightness control

## Requirements

This app requires:
1. **DALIHub Software** - Server software for DALI communication
2. **ATX LED DALI HAT** - Raspberry Pi DALI interface hardware
   - Purchase: [ATX LED DALI HAT](https://atx-led.com/products/atx-led%C2%AE-raspberry-pi-to-dali-co-processor?_pos=1&_sid=85d971d63&_ss=r&variant=50911029461276)

## License

Copyright © 2024 nIoT Inc.

---

Made with ❤️ for the Homey community
