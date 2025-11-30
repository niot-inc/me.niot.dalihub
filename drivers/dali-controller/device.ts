import Homey from 'homey';
import { DaliApiClient } from '../../lib/dali-api';

class DaliControllerDevice extends Homey.Device {
  async onInit() {
    this.log('DaliControllerDevice has been initialized:', this.getName());
  }

  private getDaliClient(): DaliApiClient {
    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    return client;
  }

  async recallScene(busId: number, scene: number, targetType: 'address' | 'group' | 'broadcast', targetValue: number, fadeTime?: number): Promise<void> {
    this.log(`Recalling scene ${scene} on bus ${busId} with targetType ${targetType}, targetValue ${targetValue}${fadeTime !== undefined ? `, fadeTime ${fadeTime}` : ''}`);
    const client = this.getDaliClient();
    await client.recallScene(busId, scene, targetType, targetValue, fadeTime);
  }

  async setGroupMaxLevel(busId: number, groupId: number, level: number): Promise<void> {
    this.log(`Setting max level for group ${groupId} on bus ${busId} to ${level}`);
    const client = this.getDaliClient();
    await client.setGroupMaxLevel(busId, groupId, level);
  }

  async setGroupMaxLevelPercent(busId: number, groupId: number, percent: number): Promise<void> {
    this.log(`Setting max level for group ${groupId} on bus ${busId} to ${percent}%`);
    const client = this.getDaliClient();
    await client.setGroupMaxLevelPercent(busId, groupId, percent);
  }

  async setLightMaxLevel(busId: number, address: number, level: number): Promise<void> {
    this.log(`Setting max level for light ${address} on bus ${busId} to ${level}`);
    const client = this.getDaliClient();
    await client.setLightMaxLevel(busId, address, level);
  }

  async setLightMaxLevelPercent(busId: number, address: number, percent: number): Promise<void> {
    this.log(`Setting max level for light ${address} on bus ${busId} to ${percent}%`);
    const client = this.getDaliClient();
    await client.setLightMaxLevelPercent(busId, address, percent);
  }

  async onDeleted() {
    this.log('DaliControllerDevice has been deleted');
  }
}

module.exports = DaliControllerDevice;
