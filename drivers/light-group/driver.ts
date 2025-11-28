import Homey from 'homey';
import { DaliGroup, DaliState } from '../../lib/dali-api';

class LightGroupDriver extends Homey.Driver {
  private levelChangedTrigger!: Homey.FlowCardTriggerDevice;

  async onInit() {
    this.log('LightGroupDriver has been initialized');

    // Register trigger cards
    this.levelChangedTrigger = this.homey.flow.getDeviceTriggerCard('light-group-level-changed');

    // Register action cards
    this.homey.flow.getActionCard('light-group-up')
      .registerRunListener(async (args) => {
        return args.device.increaseBrightness();
      });

    this.homey.flow.getActionCard('light-group-down')
      .registerRunListener(async (args) => {
        return args.device.decreaseBrightness();
      });

    this.homey.flow.getActionCard('light-group-set-level')
      .registerRunListener(async (args) => {
        return args.device.setDaliLevel(args.level);
      });

    this.homey.flow.getActionCard('light-group-set-level-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.setDaliLevel(args.level, fadeTime);
      });

    this.homey.flow.getActionCard('light-group-set-dim-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.setDimWithFade(args.brightness, fadeTime);
      });

    // Register condition cards
    this.homey.flow.getConditionCard('light-group-brightness-greater')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness > args.brightness;
      });

    this.homey.flow.getConditionCard('light-group-brightness-less')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness < args.brightness;
      });

    this.homey.flow.getConditionCard('light-group-level-greater')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level');
        return currentLevel > args.level;
      });

    this.homey.flow.getConditionCard('light-group-level-less')
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

  async triggerLevelChanged(device: Homey.Device, tokens: { level: number }) {
    return this.levelChangedTrigger.trigger(device, tokens);
  }
}

module.exports = LightGroupDriver;
