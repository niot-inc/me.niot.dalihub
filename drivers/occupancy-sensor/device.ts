import Homey from 'homey';

class OccupancySensorDevice extends Homey.Device {
  private busId!: number;
  private address!: number;
  private instanceIndex!: number;
  private occupancyStateChangedFlow!: Homey.FlowCardTriggerDevice;
  private occupancyState: string = 'vacant';

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

  getOccupancyState(): string {
    return this.occupancyState;
  }

  async handleOccupancyEvent(eventCode?: number) {
    if (eventCode === undefined) return;
    if (!this.occupancyStateChangedFlow) return;

    // IEC 62386-303 bitfield decoding
    const hasMovement = !!(eventCode & 0x01);
    const occupancyBits = (eventCode >> 1) & 0x03;
    const occupancyNames = ['vacant', 'occupied', 'still_vacant', 'still_occupied'];
    const occupancy = occupancyNames[occupancyBits];

    // Map to state string
    let newState: string;
    if (occupancy === 'vacant' || occupancy === 'still_vacant') {
      newState = occupancy;
    } else if (hasMovement) {
      newState = 'movement_detected';
    } else {
      newState = occupancy === 'still_occupied' ? 'still_occupied' : 'occupied_no_movement';
    }

    // alarm_motion: true when movement detected
    await this.setCapabilityValue('alarm_motion', hasMovement).catch(this.error);
    this.log(`Occupancy event ${eventCode}: ${occupancy}, ${hasMovement ? 'movement' : 'no movement'} → ${newState}`);

    this.occupancyState = newState;

    await this.occupancyStateChangedFlow.trigger(
      this,
      { state: newState },
      { state: newState },
    ).catch((err) => {
      this.error('Failed to trigger flow card:', err);
    });
  }

  async onDeleted() {
    this.log('OccupancySensorDevice has been deleted');
  }
}

module.exports = OccupancySensorDevice;
