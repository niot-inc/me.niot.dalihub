import Homey from 'homey';
import { DaliGroup, DaliState } from '../../lib/dali-api';

class LightGroupDriver extends Homey.Driver {
  private levelChangedTrigger!: Homey.FlowCardTriggerDevice;
  private externalOnTrigger!: Homey.FlowCardTriggerDevice;
  private externalOffTrigger!: Homey.FlowCardTriggerDevice;

  async onInit() {
    this.log('LightGroupDriver has been initialized');

    // Register trigger cards
    this.levelChangedTrigger = this.homey.flow.getDeviceTriggerCard('light-group-level-changed');
    this.externalOnTrigger = this.homey.flow.getDeviceTriggerCard('light-group-external-on');
    this.externalOffTrigger = this.homey.flow.getDeviceTriggerCard('light-group-external-off');

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
        const fadeTime = parseInt(args.fadeTime, 10) || 0;
        return args.device.setDaliLevel(args.level, fadeTime);
      });

    this.homey.flow.getActionCard('light-group-set-dim')
      .registerRunListener(async (args) => {
        return args.device.setDim(args.brightness);
      });

    this.homey.flow.getActionCard('light-group-set-dim-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10) || 0;
        return args.device.setDimWithFade(args.brightness, fadeTime);
      });

    // Register condition cards
    this.homey.flow.getConditionCard('light-group-brightness-greater')
      .registerRunListener(async (args) => {
        const currentBrightness = (args.device.getCapabilityValue('dim') ?? 0) * 100;
        return currentBrightness > args.brightness;
      });

    this.homey.flow.getConditionCard('light-group-brightness-less')
      .registerRunListener(async (args) => {
        const currentBrightness = (args.device.getCapabilityValue('dim') ?? 0) * 100;
        return currentBrightness < args.brightness;
      });

    this.homey.flow.getConditionCard('light-group-level-greater')
      .registerRunListener(async (args) => {
        const currentLevel = args.device.getCapabilityValue('dali_level') ?? 0;
        return currentLevel > args.level;
      });

    this.homey.flow.getConditionCard('light-group-level-less')
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

  async triggerExternalOn(device: Homey.Device, tokens: { command: string }) {
    return this.externalOnTrigger.trigger(device, tokens);
  }

  async triggerExternalOff(device: Homey.Device, tokens: { command: string }) {
    return this.externalOffTrigger.trigger(device, tokens);
  }
}

module.exports = LightGroupDriver;
