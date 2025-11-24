import Homey from 'homey';
import { DaliGear, DaliState } from '../../lib/dali-api';

class DimmableLightDriver extends Homey.Driver {
  async onInit() {
    this.log('DimmableLightDriver has been initialized');
  }

  async onPairListDevices() {
    const app = this.homey.app as unknown as {
      getDaliState: (busId: number) => DaliState | undefined;
      reloadState: () => Promise<void>;
    };

    // Reload state from server to get latest devices
    this.log('Reloading state from server...');
    await app.reloadState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: any[] = [];

    for (let busId = 0; busId < 4; busId++) {
      const state = app.getDaliState(busId);
      if (state) {
        const dimmableGears = state.gears.filter((gear: DaliGear) => gear.deviceType === 6);
        dimmableGears.forEach((gear: DaliGear) => {
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

    this.log('Found dimmable lights:', devices.length);
    return devices;
  }
}

module.exports = DimmableLightDriver;
