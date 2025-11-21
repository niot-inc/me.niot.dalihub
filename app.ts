'use strict';

import Homey from 'homey';
import { DaliApiClient, DaliState, DaliEvent } from './lib/dali-api';

interface DaliDevice extends Homey.Device {
  getData(): { busId: number; address?: number; groupId?: number; instanceIndex?: number };
  updateLevelFromEvent(level: number): Promise<void>;
  handleOccupancyEvent?(eventCode: number): Promise<void>;
  handleButtonEvent?(eventCode: number): Promise<void>;
  updateLuxValue?(luxValue: number): Promise<void>;
}

class DaliHubApp extends Homey.App {
  private daliClient!: DaliApiClient;
  private daliState: Map<number, DaliState> = new Map();
  private readonly BUS_IDS = [0, 1, 2, 3];

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('DALIHub app has been initialized');

    // Listen for settings changes
    this.homey.settings.on('set', (key: string) => {
      this.onSettingsChanged(key).catch((error: Error) => {
        this.error('Error handling settings change:', error);
      });
    });

    // Get server URL from settings
    const serverUrl = this.homey.settings.get('server_url');

    if (serverUrl) {
      this.log(`Connecting to DALI Hub at ${serverUrl}`);
      await this.initializeConnection(serverUrl);
    } else {
      this.log('No server URL configured. Please configure the app in settings.');
    }
  }

  async onUninit() {
    this.log('DALIHub app is shutting down');
    if (this.daliClient) {
      this.daliClient.disconnectFromEventStream();
    }
  }

  async onSettingsChanged(key: string) {
    this.log(`Settings have been changed: ${key}`);

    // Only reconnect if server_url changed
    if (key === 'server_url') {
      const serverUrl = this.homey.settings.get('server_url');

      if (serverUrl) {
        this.log(`Reconnecting to new server: ${serverUrl}`);

        // Disconnect existing connection
        if (this.daliClient) {
          this.daliClient.disconnectFromEventStream();
        }

        // Clear existing state
        this.daliState.clear();

        // Initialize new connection
        await this.initializeConnection(serverUrl);
      } else {
        this.log('Server URL removed, disconnecting...');
        if (this.daliClient) {
          this.daliClient.disconnectFromEventStream();
        }
      }
    }
  }

  private async initializeConnection(serverUrl: string): Promise<void> {
    try {
      this.daliClient = new DaliApiClient(serverUrl, this.homey, this.log.bind(this));

      await this.loadInitialState();

      this.setupEventHandlers();

      this.daliClient.connectToEventStream();
    } catch (error) {
      this.error('Failed to initialize connection:', error);
    }
  }

  private async loadInitialState(): Promise<void> {
    this.log('Loading initial state for all buses...');

    for (const busId of this.BUS_IDS) {
      try {
        const state = await this.daliClient.getState(busId);
        this.daliState.set(busId, state);
        this.log(`Bus ${busId} state loaded: ${state.gears.length} gears, ${state.groups.length} groups, ${state.controlDevices.length} control devices`);
      } catch (error) {
        this.error(`Failed to load state for bus ${busId}:`, error);
      }
    }
  }

  private setupEventHandlers(): void {
    this.daliClient.on('gear.changed', (event) => {
      this.handleGearChanged(event);
    });

    this.daliClient.on('group.changed', (event) => {
      this.handleGroupChanged(event);
    });

    this.daliClient.on('control-device.changed', (event) => {
      this.handleControlDeviceChanged(event);
    });

    this.daliClient.on('control-device.lux', (event) => {
      this.handleControlDeviceLux(event);
    });
  }

  private handleGearChanged(event: DaliEvent): void {
    if (event.address === undefined || event.level === undefined) return;

    const { level } = event;
    const { address } = event;

    const state = this.daliState.get(event.busId);
    if (state) {
      const gear = state.gears.find((g) => g.address === address);
      if (gear) {
        gear.level = level;
        gear.lastUpdated = new Date().toISOString();
      }
    }

    const drivers = this.homey.drivers.getDrivers();
    ['dimmable-light', 'bistable-light'].forEach((driverName) => {
      const driver = drivers[driverName];
      if (driver) {
        const devices = driver.getDevices() as DaliDevice[];
        devices.forEach((device) => {
          const deviceData = device.getData();
          if (deviceData.busId === event.busId && deviceData.address === address) {
            device.updateLevelFromEvent(level).catch((err: Error) => {
              this.error('Failed to update device level:', err);
            });
          }
        });
      }
    });
  }

  private handleGroupChanged(event: DaliEvent): void {
    if (event.groupId === undefined || event.level === undefined) return;

    const { level } = event;
    const { groupId } = event;

    const state = this.daliState.get(event.busId);
    if (state) {
      const group = state.groups.find((g) => g.groupId === groupId);
      if (group) {
        group.level = level;
      }
    }

    const driver = this.homey.drivers.getDriver('light-group');
    if (driver) {
      const devices = driver.getDevices() as DaliDevice[];
      devices.forEach((device) => {
        const deviceData = device.getData();
        if (deviceData.busId === event.busId && deviceData.groupId === groupId) {
          device.updateLevelFromEvent(level).catch((err: Error) => {
            this.error('Failed to update group level:', err);
          });
        }
      });
    }
  }

  private handleControlDeviceChanged(event: DaliEvent): void {
    this.log('Control device changed event:', JSON.stringify(event));

    if (event.address === undefined || event.instanceIndex === undefined || event.eventCode === undefined) {
      this.log('Event missing required fields - address:', event.address, 'instanceIndex:', event.instanceIndex, 'eventCode:', event.eventCode);
      return;
    }

    const { address } = event;
    const { instanceIndex } = event;
    const { eventCode } = event;

    const state = this.daliState.get(event.busId);
    if (state) {
      const controlDevice = state.controlDevices.find((cd) => cd.address === address);
      if (controlDevice) {
        const instance = controlDevice.instances.find((i) => i.index === instanceIndex);
        if (instance && instance.type === 3) {
          const drivers = this.homey.drivers.getDrivers();
          const driver = drivers['occupancy-sensor'];
          if (driver) {
            const devices = driver.getDevices() as DaliDevice[];
            devices.forEach((device) => {
              const deviceData = device.getData();
              if (deviceData.busId === event.busId
                  && deviceData.address === address
                  && deviceData.instanceIndex === instanceIndex) {
                device.handleOccupancyEvent?.(eventCode).catch((err: Error) => {
                  this.error('Failed to handle occupancy event:', err);
                });
              }
            });
          }
        } else if (instance && instance.type === 1) {
          this.log('Button instance found - type:', instance.type, 'name:', instance.name);
          const drivers = this.homey.drivers.getDrivers();
          const driver = drivers['push-button'];
          if (driver) {
            const devices = driver.getDevices() as DaliDevice[];
            this.log('Found', devices.length, 'push-button devices');
            devices.forEach((device) => {
              const deviceData = device.getData();
              this.log('Checking device:', deviceData.busId, deviceData.address, deviceData.instanceIndex, 'vs event:', event.busId, address, instanceIndex);
              if (deviceData.busId === event.busId
                  && deviceData.address === address
                  && deviceData.instanceIndex === instanceIndex) {
                this.log('Matched! Calling handleButtonEvent with eventCode:', eventCode);
                device.handleButtonEvent?.(eventCode).catch((err: Error) => {
                  this.error('Failed to handle button event:', err);
                });
              }
            });
          } else {
            this.log('push-button driver not found!');
          }
        }
      }
    }
  }

  private handleControlDeviceLux(event: DaliEvent): void {
    if (event.address === undefined || event.instanceIndex === undefined || event.luxValue === undefined) return;

    const { address } = event;
    const { instanceIndex } = event;
    const { luxValue } = event;

    const state = this.daliState.get(event.busId);
    if (state) {
      const controlDevice = state.controlDevices.find((cd) => cd.address === address);
      if (controlDevice) {
        const instance = controlDevice.instances.find((i) => i.index === instanceIndex);
        if (instance) {
          instance.luxValue = luxValue;
          instance.luxUpdated = new Date().toISOString();
        }
      }
    }

    const driver = this.homey.drivers.getDriver('lux-sensor');
    if (driver) {
      const devices = driver.getDevices() as DaliDevice[];
      devices.forEach((device) => {
        const deviceData = device.getData();
        if (deviceData.busId === event.busId
            && deviceData.address === address
            && deviceData.instanceIndex === instanceIndex) {
          device.updateLuxValue?.(luxValue).catch((err: Error) => {
            this.error('Failed to update lux value:', err);
          });
        }
      });
    }
  }

  getDaliClient(): DaliApiClient | undefined {
    return this.daliClient;
  }

  getDaliState(busId: number): DaliState | undefined {
    return this.daliState.get(busId);
  }
}

module.exports = DaliHubApp;
