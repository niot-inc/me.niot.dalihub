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

    this.homey.flow.getActionCard('scene-recall-address-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.scene, 'address', args.address, fadeTime);
      });

    this.homey.flow.getActionCard('scene-recall-group-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.scene, 'group', args.group, fadeTime);
      });

    this.homey.flow.getActionCard('scene-recall-broadcast-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.scene, 'broadcast', 0, fadeTime);
      });
  }

  async onPairListDevices() {
    // Create one scene controller per bus
    const devices = [];
    for (let busId = 0; busId < 4; busId++) {
      devices.push({
        name: `DALI 씬 컨트롤러 (버스 ${busId})`,
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
