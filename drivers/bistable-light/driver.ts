import Homey from 'homey';
import { DaliGear, DaliState } from '../../lib/dali-api';

class BistableLightDriver extends Homey.Driver {
  async onInit() {
    this.log('BistableLightDriver has been initialized');
  }

  async onPairListDevices() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: any[] = [];

    for (let busId = 0; busId < 4; busId++) {
      const state = app.getDaliState(busId);
      if (state) {
        const bistableGears = state.gears.filter((gear: DaliGear) => gear.deviceType === 7);
        bistableGears.forEach((gear: DaliGear) => {
          devices.push({
            name: gear.name,
            data: {
              id: `${gear.busId}-${gear.address}`,
              busId: gear.busId,
              address: gear.address,
            },
            store: {
              deviceType: gear.deviceType,
            },
          });
        });
      }
    }

    this.log('Found bistable lights:', devices.length);
    return devices;
  }
}

module.exports = BistableLightDriver;
