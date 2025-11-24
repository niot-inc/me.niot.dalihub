import Homey from 'homey';
import {
  DaliGroup, DaliState, DaliApiClient, arcToPercent,
} from '../../lib/dali-api';

class LightGroupDevice extends Homey.Device {
  private busId!: number;
  private groupId!: number;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.groupId = data.groupId;

    this.log('LightGroupDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Group ${this.groupId})`);

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));

    await this.syncStateFromServer();
  }

  async syncStateFromServer() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    const state = app.getDaliState(this.busId);
    if (state) {
      const group = state.groups.find((g: DaliGroup) => g.groupId === this.groupId);
      if (group) {
        const isOn = group.level > 0;
        const percent = arcToPercent(group.level);
        const dimValue = percent / 100;

        await this.setCapabilityValue('onoff', isOn).catch(this.error);
        await this.setCapabilityValue('dim', dimValue).catch(this.error);

        this.log('Synced state from server:', {
          isOn, level: group.level, percent, dimValue,
        });
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
      await client.setGroupOn(this.busId, this.groupId);
      // Update dim to 100% when turning on
      await this.setCapabilityValue('dim', 1.0).catch(this.error);
    } else {
      await client.setGroupOff(this.busId, this.groupId);
      // Update dim to 0% when turning off
      await this.setCapabilityValue('dim', 0).catch(this.error);
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

    const percent = Math.round(value * 100);

    await client.setGroupPercent(this.busId, this.groupId, percent);

    if (percent > 0) {
      await this.setCapabilityValue('onoff', true).catch(this.error);
    } else {
      await this.setCapabilityValue('onoff', false).catch(this.error);
    }
  }

  async updateLevelFromEvent(level: number) {
    const isOn = level > 0;
    const percent = arcToPercent(level);
    const dimValue = percent / 100;

    await this.setCapabilityValue('onoff', isOn).catch(this.error);
    await this.setCapabilityValue('dim', dimValue).catch(this.error);

    this.log('Updated from event:', {
      isOn, level, percent, dimValue,
    });
  }

  async increaseBrightness(): Promise<void> {
    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    await client.setGroupUp(this.busId, this.groupId);
  }

  async decreaseBrightness(): Promise<void> {
    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    await client.setGroupDown(this.busId, this.groupId);
  }

  async onDeleted() {
    this.log('LightGroupDevice has been deleted');
  }
}

module.exports = LightGroupDevice;
