import Homey from 'homey';
import { DaliGear, DaliState } from '../../lib/dali-api';

class DimmableLightDriver extends Homey.Driver {
  private levelChangedTrigger!: Homey.FlowCardTriggerDevice;

  async onInit() {
    this.log('DimmableLightDriver has been initialized');

    // Register trigger cards
    this.levelChangedTrigger = this.homey.flow.getDeviceTriggerCard('dimmable-light-level-changed');

    // Register action cards
    this.homey.flow.getActionCard('dimmable-light-up')
      .registerRunListener(async (args) => {
        return args.device.increaseBrightness();
      });

    this.homey.flow.getActionCard('dimmable-light-down')
      .registerRunListener(async (args) => {
        return args.device.decreaseBrightness();
      });

    this.homey.flow.getActionCard('dimmable-light-set-level')
      .registerRunListener(async (args) => {
        return args.device.setCapabilityValue('dali_level', args.level);
      });

    // Register condition cards
    this.homey.flow.getConditionCard('dimmable-light-brightness-greater')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness > args.brightness;
      });

    this.homey.flow.getConditionCard('dimmable-light-brightness-less')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness < args.brightness;
      });

    this.homey.flow.getConditionCard('dimmable-light-level-greater')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level');
        return currentLevel > args.level;
      });

    this.homey.flow.getConditionCard('dimmable-light-level-less')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level');
        return currentLevel < args.level;
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

  async triggerLevelChanged(device: Homey.Device, tokens: { level: number }) {
    return this.levelChangedTrigger.trigger(device, tokens);
  }
}

module.exports = DimmableLightDriver;
