import Homey from 'homey';
import { DaliGear, DaliState } from '../../lib/dali-api';

// DT8 colourTypeFeatures bitmask
const COLOUR_TYPE_TC = 0x02;      // Bit 1: Tc (colour temperature)
const COLOUR_TYPE_PRIMARY_N = 0x04; // Bit 2: Primary N (RGB/RGBW)

class DT8LightDriver extends Homey.Driver {
  private levelChangedTrigger!: Homey.FlowCardTriggerDevice;

  async onInit() {
    this.log('DT8LightDriver has been initialized');

    // Register trigger cards
    this.levelChangedTrigger = this.homey.flow.getDeviceTriggerCard('dt8-light-level-changed');

    // Register action cards
    this.homey.flow.getActionCard('dt8-light-up')
      .registerRunListener(async (args) => {
        return args.device.increaseBrightness();
      });

    this.homey.flow.getActionCard('dt8-light-down')
      .registerRunListener(async (args) => {
        return args.device.decreaseBrightness();
      });

    this.homey.flow.getActionCard('dt8-light-set-level')
      .registerRunListener(async (args) => {
        return args.device.setDaliLevel(args.level);
      });

    this.homey.flow.getActionCard('dt8-light-set-level-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.setDaliLevel(args.level, fadeTime);
      });

    this.homey.flow.getActionCard('dt8-light-set-colour-temperature')
      .registerRunListener(async (args) => {
        return args.device.setColourTemperature(args.temperature);
      });

    // Register condition cards
    this.homey.flow.getConditionCard('dt8-light-brightness-greater')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness > args.brightness;
      });

    this.homey.flow.getConditionCard('dt8-light-brightness-less')
      .registerRunListener(async (args) => {
        const currentBrightness = args.device.getCapabilityValue('dim') * 100;
        return currentBrightness < args.brightness;
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
        // Filter gears that have DT8 (device type 8) in deviceTypes array
        const dt8Gears = state.gears.filter((gear: DaliGear) =>
          gear.deviceTypes?.includes(8),
        );

        dt8Gears.forEach((gear: DaliGear) => {
          // Determine capabilities based on colourTypeFeatures
          const capabilities = ['onoff', 'dim', 'dali_level'];
          const supportsTc = (gear.colourTypeFeatures ?? 0) & COLOUR_TYPE_TC;
          const supportsPrimaryN = (gear.colourTypeFeatures ?? 0) & COLOUR_TYPE_PRIMARY_N;

          if (supportsTc) {
            capabilities.push('light_temperature');
          }

          // For now, we only support Tc (colour temperature)
          // RGB/RGBW support can be added later with light_hue, light_saturation, light_mode

          devices.push({
            name: gear.name,
            data: {
              id: `${gear.busId}-${gear.address}`,
              busId: gear.busId,
              address: gear.address,
            },
            store: {
              deviceTypes: gear.deviceTypes || [8],
              colourTypeFeatures: gear.colourTypeFeatures || 0,
              supportsTc: !!supportsTc,
              supportsPrimaryN: !!supportsPrimaryN,
              tcWarmest: gear.tcWarmest,
              tcCoolest: gear.tcCoolest,
            },
            capabilities,
          });
        });
      }
    }

    this.log('Found DT8 colour lights:', devices.length);
    return devices;
  }

  async triggerLevelChanged(device: Homey.Device, tokens: { level: number }) {
    return this.levelChangedTrigger.trigger(device, tokens);
  }
}

module.exports = DT8LightDriver;
