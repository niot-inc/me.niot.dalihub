import Homey from 'homey';
import { DaliGear, DaliState, DaliApiClient } from '../../lib/dali-api';

class DimmableLightDevice extends Homey.Device {
  private busId!: number;
  private address!: number;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;

    this.log('DimmableLightDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address})`);

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));

    await this.syncStateFromServer();
  }

  async syncStateFromServer() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    const state = app.getDaliState(this.busId);
    if (state) {
      const gear = state.gears.find((g: DaliGear) => g.address === this.address);
      if (gear) {
        const isOn = gear.level > 0;
        const dimValue = gear.level / 254;

        await this.setCapabilityValue('onoff', isOn).catch(this.error);
        await this.setCapabilityValue('dim', dimValue).catch(this.error);

        this.log('Synced state from server:', { isOn, level: gear.level, dimValue });
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

  async onCapabilityDim(value: number): Promise<void> {
    this.log('onCapabilityDim:', value);

    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    const level = Math.round(value * 254);

    await client.setLightLevel(this.busId, this.address, level);

    if (level > 0) {
      await this.setCapabilityValue('onoff', true).catch(this.error);
    } else {
      await this.setCapabilityValue('onoff', false).catch(this.error);
    }
  }

  async updateLevelFromEvent(level: number) {
    const isOn = level > 0;
    const dimValue = level / 254;

    await this.setCapabilityValue('onoff', isOn).catch(this.error);
    await this.setCapabilityValue('dim', dimValue).catch(this.error);

    this.log('Updated from event:', { isOn, level, dimValue });
  }

  async onDeleted() {
    this.log('DimmableLightDevice has been deleted');
  }
}

module.exports = DimmableLightDevice;
