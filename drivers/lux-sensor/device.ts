import Homey from 'homey';
import { DaliControlDevice, DaliControlDeviceInstance, DaliState } from '../../lib/dali-api';

class LuxSensorDevice extends Homey.Device {
  private busId!: number;
  private address!: number;
  private instanceIndex!: number;
  private currentLux: number = 0;
  private currentIlluminance: number = 0;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;
    this.instanceIndex = data.instanceIndex;

    this.log('LuxSensorDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address}, Instance ${this.instanceIndex})`);

    // Add capabilities if they don't exist (for existing paired devices)
    if (!this.hasCapability('measure_luminance')) {
      await this.addCapability('measure_luminance').catch(this.error);
      this.log('Added measure_luminance capability');
    }
    if (!this.hasCapability('measure_illuminance')) {
      await this.addCapability('measure_illuminance').catch(this.error);
      this.log('Added measure_illuminance capability');
    }

    await this.syncStateFromServer();
  }

  getLuxValue(): number {
    return this.currentLux;
  }

  async syncStateFromServer() {
    const app = this.homey.app as unknown as { getDaliState: (busId: number) => DaliState | undefined };
    const state = app.getDaliState(this.busId);
    if (state) {
      const controlDevice = state.controlDevices.find((cd: DaliControlDevice) => cd.address === this.address);
      if (controlDevice) {
        const instance = controlDevice.instances.find((i: DaliControlDeviceInstance) => i.index === this.instanceIndex);
        if (instance) {
          if (instance.luxValue !== undefined) {
            this.currentLux = instance.luxValue;
            await this.setCapabilityValue('measure_luminance', instance.luxValue).catch(this.error);
          }
          if (instance.illuminance !== undefined) {
            this.currentIlluminance = instance.illuminance;
            await this.setCapabilityValue('measure_illuminance', instance.illuminance).catch(this.error);
          }
        }
      }
    }
  }

  async updateLuxValue(luxValue: number) {
    this.currentLux = luxValue;
    await this.setCapabilityValue('measure_luminance', luxValue).catch(this.error);
  }

  async updateIlluminance(illuminance: number) {
    this.currentIlluminance = illuminance;
    await this.setCapabilityValue('measure_illuminance', illuminance).catch(this.error);
  }

  getIlluminance(): number {
    return this.currentIlluminance;
  }

  async onDeleted() {
    this.log('LuxSensorDevice has been deleted');
  }
}

module.exports = LuxSensorDevice;
