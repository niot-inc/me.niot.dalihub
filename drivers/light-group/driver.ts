import Homey from 'homey';
import { DaliGroup, DaliState } from '../../lib/dali-api';

class LightGroupDriver extends Homey.Driver {
  async onInit() {
    this.log('LightGroupDriver has been initialized');
  }

  async onPairListDevices() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: any[] = [];

    for (let busId = 0; busId < 4; busId++) {
      const state = app.getDaliState(busId);
      if (state && state.groups) {
        state.groups.forEach((group: DaliGroup) => {
          devices.push({
            name: group.name,
            data: {
              id: `${group.busId}-group-${group.groupId}`,
              busId: group.busId,
              groupId: group.groupId,
            },
            store: {
              memberCount: group.memberCount,
            },
          });
        });
      }
    }

    this.log('Found light groups:', devices.length);
    return devices;
  }
}

module.exports = LightGroupDriver;
