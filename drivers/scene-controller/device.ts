import Homey from 'homey';
import { DaliApiClient } from '../../lib/dali-api';

class SceneControllerDevice extends Homey.Device {
  private busId!: number;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;

    this.log('SceneControllerDevice has been initialized:', this.getName(), `(Bus ${this.busId})`);
  }

  async recallScene(scene: number, targetType: 'address' | 'group' | 'broadcast', targetValue: number): Promise<void> {
    this.log(`Recalling scene ${scene} with targetType ${targetType}, targetValue ${targetValue}`);

    const app = this.homey.app as unknown as { getDaliClient: () => DaliApiClient | undefined };
    const client = app.getDaliClient();

    if (!client) {
      this.error('DALI client not initialized. Please configure server URL in app settings.');
      throw new Error('DALI Hub not connected');
    }

    await client.recallScene(this.busId, scene, targetType, targetValue);
  }

  async onDeleted() {
    this.log('SceneControllerDevice has been deleted');
  }
}

module.exports = SceneControllerDevice;
