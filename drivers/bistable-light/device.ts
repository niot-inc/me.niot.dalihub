import Homey from 'homey';
import { DaliGear, DaliState, DaliApiClient } from '../../lib/dali-api';

class BistableLightDevice extends Homey.Device {
  private busId!: number;
  private address!: number;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;

    this.log('BistableLightDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address})`);

    // Apply device class from settings
    const deviceClass = this.getSetting('device_class') || 'light';
    await this.setClass(deviceClass).catch(this.error);

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

    await this.syncStateFromServer();
  }

  async syncStateFromServer() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    const state = app.getDaliState(this.busId);
    if (state) {
      const gear = state.gears.find((g: DaliGear) => g.address === this.address);
      if (gear) {
        const isOn = gear.level > 0;
        await this.setCapabilityValue('onoff', isOn).catch(this.error);
        this.log('Synced state from server:', { isOn, level: gear.level });
      }
    }
  }

  async onCapabilityOnOff(value: boolean): Promise<void> {
    this.log('onCapabilityOnOff:', value);

    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    if (value) {
      await client.setLightOn(this.busId, this.address);
    } else {
      await client.setLightOff(this.busId, this.address);
    }
  }

  async updateLevelFromEvent(level: number) {
    const isOn = level > 0;
    await this.setCapabilityValue('onoff', isOn).catch(this.error);
    this.log('Updated from event:', { isOn, level });
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('Settings changed:', changedKeys);

    if (changedKeys.includes('device_class')) {
      const deviceClass = newSettings.device_class as string;
      this.log('Changing device class to:', deviceClass);
      await this.setClass(deviceClass);
    }
  }

  async onDeleted() {
    this.log('BistableLightDevice has been deleted');
  }
}

module.exports = BistableLightDevice;
