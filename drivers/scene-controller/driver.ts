import Homey from 'homey';

class SceneControllerDriver extends Homey.Driver {
  async onInit() {
    this.log('SceneControllerDriver has been initialized');

    // Register action cards
    this.homey.flow.getActionCard('scene-recall-address')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.scene, 'address', args.address);
      });

    this.homey.flow.getActionCard('scene-recall-group')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.scene, 'group', args.group);
      });

    this.homey.flow.getActionCard('scene-recall-broadcast')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.scene, 'broadcast', 0);
      });
  }

  async onPairListDevices() {
    // Create one scene controller per bus
    const devices = [];
    for (let busId = 0; busId < 4; busId++) {
      devices.push({
        name: `DALI Scene Controller (Bus ${busId})`,
        data: {
          id: `scene-controller-bus-${busId}`,
          busId,
        },
      });
    }

    this.log('Found scene controllers:', devices.length);
    return devices;
  }
}

module.exports = SceneControllerDriver;
