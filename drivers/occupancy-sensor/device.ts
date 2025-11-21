import Homey from 'homey';

class OccupancySensorDevice extends Homey.Device {
  private busId!: number;
  private address!: number;
  private instanceIndex!: number;
  private movementDetectedFlow!: Homey.FlowCardTriggerDevice;
  private occupiedNoMovementFlow!: Homey.FlowCardTriggerDevice;
  private vacantFlow!: Homey.FlowCardTriggerDevice;
  private occupancyState: 'vacant' | 'occupied_no_movement' | 'movement_detected' = 'vacant';

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;
    this.instanceIndex = data.instanceIndex;

    this.log('OccupancySensorDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address}, Instance ${this.instanceIndex})`);

    this.movementDetectedFlow = this.homey.flow.getDeviceTriggerCard('occupancy-movement-detected');
    this.occupiedNoMovementFlow = this.homey.flow.getDeviceTriggerCard('occupancy-occupied-no-movement');
    this.vacantFlow = this.homey.flow.getDeviceTriggerCard('occupancy-vacant');
  }

  getOccupancyState(): 'vacant' | 'occupied_no_movement' | 'movement_detected' {
    return this.occupancyState;
  }

  async handleOccupancyEvent(eventCode?: number) {
    if (eventCode === undefined) return;

    this.log('Occupancy event:', eventCode);

    switch (eventCode) {
      case 8:
        this.occupancyState = 'vacant';
        this.log('Vacant');
        await this.vacantFlow.trigger(this, {}, {}).catch(this.error);
        break;
      case 10:
        this.occupancyState = 'occupied_no_movement';
        this.log('Occupied (No movement)');
        await this.occupiedNoMovementFlow.trigger(this, {}, {}).catch(this.error);
        break;
      case 11:
        this.occupancyState = 'movement_detected';
        this.log('Occupied (Movement)');
        await this.movementDetectedFlow.trigger(this, {}, {}).catch(this.error);
        break;
      default:
        this.log('Unknown event code:', eventCode);
        return;
    }
  }

  async onDeleted() {
    this.log('OccupancySensorDevice has been deleted');
  }
}

module.exports = OccupancySensorDevice;
