import Homey from 'homey';
import { DaliControlDevice, DaliControlDeviceInstance, DaliState } from '../../lib/dali-api';

class OccupancySensorDriver extends Homey.Driver {
  async onInit() {
    this.log('OccupancySensorDriver has been initialized');

    // Register condition cards
    this.homey.flow.getConditionCard('occupancy-is-movement-detected')
      .registerRunListener(async (args) => {
        const state = args.device.getOccupancyState();
        return state === 'movement_detected';
      });

    this.homey.flow.getConditionCard('occupancy-is-occupied-no-movement')
      .registerRunListener(async (args) => {
        const state = args.device.getOccupancyState();
        return state === 'occupied_no_movement';
      });

    this.homey.flow.getConditionCard('occupancy-is-vacant')
      .registerRunListener(async (args) => {
        const state = args.device.getOccupancyState();
        return state === 'vacant';
      });
  }

  async onPairListDevices() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
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
