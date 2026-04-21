import Homey from 'homey';

class OccupancySensorDevice extends Homey.Device {
  private busId!: number;
  private address!: number;
  private instanceIndex!: number;
  private occupancyStateChangedFlow!: Homey.FlowCardTriggerDevice;

  async onInit() {
    const data = this.getData();
    this.busId = data.busId;
    this.address = data.address;
    this.instanceIndex = data.instanceIndex;

    this.log('OccupancySensorDevice has been initialized:', this.getName(), `(Bus ${this.busId}, Address ${this.address}, Instance ${this.instanceIndex})`);

    // Add capabilities if they don't exist (for existing paired devices)
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff').catch(this.error);
      this.log('Added onoff capability');
    }
    if (!this.hasCapability('alarm_motion')) {
      await this.addCapability('alarm_motion').catch(this.error);
      this.log('Added alarm_motion capability');
    }
    if (!this.hasCapability('occupancy_state')) {
      await this.addCapability('occupancy_state').catch(this.error);
      this.log('Added occupancy_state capability');
    }

    // Default to enabled
    if (this.getCapabilityValue('onoff') === null) {
      await this.setCapabilityValue('onoff', true).catch(this.error);
    }

    this.registerCapabilityListener('onoff', async (value: boolean) => {
      this.log(`Sensor ${value ? 'enabled' : 'disabled'}`);
      if (!value) {
        // Reset to vacant when disabled to avoid stale "occupied" state
        await this.setCapabilityValue('alarm_motion', false).catch(this.error);
        await this.setCapabilityValue('occupancy_state', 'vacant').catch(this.error);
        this.log('State reset to vacant on disable');
      }
    });

    this.occupancyStateChangedFlow = this.homey.flow.getDeviceTriggerCard('occupancy-state-changed');
  }

  getOccupancyState(): string {
    return this.getCapabilityValue('occupancy_state') || 'vacant';
  }

  async handleOccupancyEvent(eventCode?: number) {
    if (eventCode === undefined) return;
    if (!this.occupancyStateChangedFlow) return;

    // IEC 62386-303 bitfield decoding
    // bit 0: movement (0=no movement, 1=movement)
    // bit 1-2: occupancy state (00=vacant, 01=occupied, 10=still vacant, 11=still occupied)
    // bit 3: sensor type (0=presence sensor, 1=movement sensor)
    const hasMovement = !!(eventCode & 0x01);
    const occupancyBits = (eventCode >> 1) & 0x03;
    const isMovementSensor = !!(eventCode & 0x08);

    const occupancyNames = ['vacant', 'occupied', 'still_vacant', 'still_occupied'] as const;
    const occupancy = occupancyNames[occupancyBits];
    const sensorType = isMovementSensor ? 'movement' : 'presence';

    this.log(`Occupancy event 0x${eventCode.toString(16)}: ${occupancy}, ${hasMovement ? 'movement' : 'no movement'}, ${sensorType} sensor`);

    // Skip everything when disabled
    const isEnabled = this.getCapabilityValue('onoff') !== false;
    if (!isEnabled) {
      this.log('Sensor disabled, ignoring event');
      return;
    }

    // Update capabilities
    await this.setCapabilityValue('alarm_motion', hasMovement).catch(this.error);
    await this.setCapabilityValue('occupancy_state', occupancy).catch(this.error);

    // Trigger flow with all decoded fields
    await this.occupancyStateChangedFlow.trigger(
      this,
      {
        occupancy,
        movement: hasMovement,
        sensor_type: sensorType,
      },
      {
        occupancy,
        movement: hasMovement,
        sensor_type: sensorType,
      },
    ).catch((err) => {
      this.error('Failed to trigger flow card:', err);
    });
  }

  async onDeleted() {
    this.log('OccupancySensorDevice has been deleted');
  }
}

module.exports = OccupancySensorDevice;
