import Homey from 'homey';
import { DaliGear, DaliState } from '../../lib/dali-api';

class DimmableLightDriver extends Homey.Driver {
  private levelChangedTrigger!: Homey.FlowCardTriggerDevice;
  private externalOnTrigger!: Homey.FlowCardTriggerDevice;
  private externalOffTrigger!: Homey.FlowCardTriggerDevice;

  async onInit() {
    this.log('DimmableLightDriver has been initialized');

    // Register trigger cards
    this.levelChangedTrigger = this.homey.flow.getDeviceTriggerCard('dimmable-light-level-changed');
    this.externalOnTrigger = this.homey.flow.getDeviceTriggerCard('dimmable-light-external-on');
    this.externalOffTrigger = this.homey.flow.getDeviceTriggerCard('dimmable-light-external-off');

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
        return args.device.setDaliLevel(args.level);
      });

    this.homey.flow.getActionCard('dimmable-light-set-level-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10) || 0;
        return args.device.setDaliLevel(args.level, fadeTime);
      });

    this.homey.flow.getActionCard('dimmable-light-set-dim')
      .registerRunListener(async (args) => {
        return args.device.setDim(args.brightness);
      });

    this.homey.flow.getActionCard('dimmable-light-set-dim-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10) || 0;
        return args.device.setDimWithFade(args.brightness, fadeTime);
      });

    // Register condition cards
    this.homey.flow.getConditionCard('dimmable-light-brightness-greater')
      .registerRunListener(async (args) => {
        const currentBrightness = (args.device.getCapabilityValue('dim') ?? 0) * 100;
        return currentBrightness > args.brightness;
      });

    this.homey.flow.getConditionCard('dimmable-light-brightness-less')
      .registerRunListener(async (args) => {
        const currentBrightness = (args.device.getCapabilityValue('dim') ?? 0) * 100;
        return currentBrightness < args.brightness;
      });

    this.homey.flow.getConditionCard('dimmable-light-level-greater')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level') ?? 0;
        return currentLevel > args.level;
      });

    this.homey.flow.getConditionCard('dimmable-light-level-less')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level') ?? 0;
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
        const dimmableGears = state.gears.filter((gear: DaliGear) =>
          gear.deviceTypes?.includes(6) && !gear.deviceTypes?.includes(8),
        );
        dimmableGears.forEach((gear: DaliGear) => {
          devices.push({
            name: gear.name,
            data: {
              id: `${gear.busId}-${gear.address}`,
              busId: gear.busId,
              address: gear.address,
            },
            store: {
              deviceTypes: gear.deviceTypes || [6],
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

  async triggerExternalOn(device: Homey.Device, tokens: { command: string }) {
    return this.externalOnTrigger.trigger(device, tokens);
  }

  async triggerExternalOff(device: Homey.Device, tokens: { command: string }) {
    return this.externalOffTrigger.trigger(device, tokens);
  }
}

module.exports = DimmableLightDriver;
