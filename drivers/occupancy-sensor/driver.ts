import Homey from 'homey';
import { DaliControlDevice, DaliControlDeviceInstance, DaliState } from '../../lib/dali-api';

class OccupancySensorDriver extends Homey.Driver {
  async onInit() {
    this.log('OccupancySensorDriver has been initialized');

    // Register unified condition card
    this.homey.flow.getConditionCard('occupancy-state-is')
      .registerRunListener(async (args) => {
        const currentState = args.device.getOccupancyState();
        return currentState === args.state;
      });
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
      if (state && state.controlDevices) {
        state.controlDevices.forEach((controlDevice: DaliControlDevice) => {
          controlDevice.instances.forEach((instance: DaliControlDeviceInstance) => {
            if (instance.type === 3) {
              devices.push({
                name: instance.name,
                data: {
                  id: `${controlDevice.busId}-${controlDevice.address}-${instance.index}`,
                  busId: controlDevice.busId,
                  address: controlDevice.address,
                  instanceIndex: instance.index,
                },
                store: {
                  type: instance.type,
                },
              });
            }
          });
        });
      }
    }

    this.log('Found occupancy sensors:', devices.length);
    return devices;
  }
}

module.exports = OccupancySensorDriver;
