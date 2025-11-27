import Homey from 'homey';

class OccupancySensorDevice extends Homey.Device {
  private busId!: number;
  private address!: number;
  private instanceIndex!: number;
  private occupancyStateChangedFlow!: Homey.FlowCardTriggerDevice;
  private occupancyState: 'vacant' | 'occupied_no_movement' | 'movement_detected' = 'vacant';

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;
    this.instanceIndex = data.instanceIndex;

    this.log('OccupancySensorDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address}, Instance ${this.instanceIndex})`);

    // Add alarm_motion capability if it doesn't exist (for existing paired devices)
    if (!this.hasCapability('alarm_motion')) {
      await this.addCapability('alarm_motion').catch(this.error);
      this.log('Added alarm_motion capability');
    }

    this.occupancyStateChangedFlow = this.homey.flow.getDeviceTriggerCard('occupancy-state-changed');
  }

  getOccupancyState(): 'vacant' | 'occupied_no_movement' | 'movement_detected' {
    return this.occupancyState;
  }

  async handleOccupancyEvent(eventCode?: number) {
    if (eventCode === undefined) return;

    this.log('Occupancy event:', eventCode);

    let newState: 'vacant' | 'occupied_no_movement' | 'movement_detected' | null = null;

    switch (eventCode) {
      case 8:
        newState = 'vacant';
        await this.setCapabilityValue('alarm_motion', false).catch(this.error);
        this.log('State changed to: Vacant');
        break;
      case 10:
        newState = 'occupied_no_movement';
        await this.setCapabilityValue('alarm_motion', false).catch(this.error);
        this.log('State changed to: Occupied (No movement)');
        break;
      case 11:
        newState = 'movement_detected';
        await this.setCapabilityValue('alarm_motion', true).catch(this.error);
        this.log('State changed to: Movement detected');
        break;
      default:
        this.log('Unknown event code:', eventCode);
        break;
    }

    if (newState) {
      this.occupancyState = newState;

      this.log('Triggering flow card with state:', newState);
      if (this.occupancyStateChangedFlow) {
        await this.occupancyStateChangedFlow.trigger(
          this,
          { state: newState },
          { state: newState },
        ).catch((err) => {
          this.error('Failed to trigger flow card:', err);
        });
      } else {
        this.error('Flow card not initialized yet');
      }
    }
  }

  async onDeleted() {
    this.log('OccupancySensorDevice has been deleted');
  }
}

module.exports = OccupancySensorDevice;
