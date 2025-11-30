import Homey from 'homey';

class DaliControllerDriver extends Homey.Driver {
  async onInit() {
    this.log('DaliControllerDriver has been initialized');

    // Register scene recall action cards
    this.homey.flow.getActionCard('scene-recall-address')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.bus, args.scene, 'address', args.address);
      });

    this.homey.flow.getActionCard('scene-recall-group')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.bus, args.scene, 'group', args.group);
      });

    this.homey.flow.getActionCard('scene-recall-broadcast')
      .registerRunListener(async (args) => {
        return args.device.recallScene(args.bus, args.scene, 'broadcast', 0);
      });

    this.homey.flow.getActionCard('scene-recall-address-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.bus, args.scene, 'address', args.address, fadeTime);
      });

    this.homey.flow.getActionCard('scene-recall-group-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.bus, args.scene, 'group', args.group, fadeTime);
      });

    this.homey.flow.getActionCard('scene-recall-broadcast-with-fade')
      .registerRunListener(async (args) => {
        const fadeTime = parseInt(args.fadeTime, 10);
        return args.device.recallScene(args.bus, args.scene, 'broadcast', 0, fadeTime);
      });

    // Register max level action cards for groups
    this.homey.flow.getActionCard('group-set-max-level')
      .registerRunListener(async (args) => {
        return args.device.setGroupMaxLevel(args.bus, args.group, args.level);
      });

    this.homey.flow.getActionCard('group-set-max-level-percent')
      .registerRunListener(async (args) => {
        return args.device.setGroupMaxLevelPercent(args.bus, args.group, args.percent);
      });

    // Register max level action cards for lights
    this.homey.flow.getActionCard('light-set-max-level')
      .registerRunListener(async (args) => {
        return args.device.setLightMaxLevel(args.bus, args.address, args.level);
      });

    this.homey.flow.getActionCard('light-set-max-level-percent')
      .registerRunListener(async (args) => {
        return args.device.setLightMaxLevelPercent(args.bus, args.address, args.percent);
      });
  }

  async onPairListDevices() {
    // Create a single DALI controller device
    const devices = [{
      name: 'DALI 컨트롤러',
      data: {
        id: 'dali-controller',
      },
    }];

    this.log('Found DALI controller:', devices.length);
    return devices;
  }
}

module.exports = DaliControllerDriver;
