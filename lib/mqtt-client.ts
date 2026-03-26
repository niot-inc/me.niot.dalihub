/**
 * MQTT Client for DALIHub Homey App
 *
 * Connects to Mosquitto MQTT broker running on the same Raspberry Pi as DALIHub server.
 * Subscribes to state change topics to receive real-time updates for gears, groups,
 * control devices, and lux sensors.
 *
 * Default configuration:
 * - Broker URL: mqtt://<server-ip>:1883
 * - Username: dalihub
 * - Password: dalihub
 * - Topic Prefix: dalihub
 *
 * Topic structure (published by DALIHub server):
 * - {prefix}/state/gear/{busId}/{address}                    -> gear level changes
 * - {prefix}/state/group/{busId}/{groupId}                   -> group level changes
 * - {prefix}/state/push-button/{busId}/{address}/{instance}  -> push button events (Part 301)
 * - {prefix}/state/occupancy/{busId}/{address}/{instance}    -> occupancy sensor events (Part 303)
 * - {prefix}/state/lux/{busId}/{address}/{instance}          -> lux sensor readings (polled)
 * - {prefix}/state/illuminance/{busId}/{address}/{instance}  -> illuminance events (Part 304)
 * - {prefix}/status                                           -> server online/offline
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { DaliEvent } from './dali-api';

export interface MqttConfig {
  brokerUrl: string;
  topicPrefix: string;
  username?: string;
  password?: string;
}

interface HomeyInterface {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
}

type EventHandler = (event: DaliEvent) => void;

export class DaliMqttClient {
  private client: MqttClient | null = null;
  private config: MqttConfig;
  private log: (...args: unknown[]) => void;
  private homey: HomeyInterface;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private isConnected: boolean = false;
  private statusHandler: ((online: boolean) => void) | null = null;

  constructor(config: MqttConfig, homey: HomeyInterface, logger: (...args: unknown[]) => void) {
    this.config = config;
    this.homey = homey;
    this.log = logger;
  }

  connect(): void {
    if (this.client) {
      this.log('MQTT client already exists');
      return;
    }

    this.shouldReconnect = true;

    const options: IClientOptions = {
      clientId: `dalihub-homey-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 0, // We handle reconnection manually
    };

    if (this.config.username) {
      options.username = this.config.username;
    }
    if (this.config.password) {
      options.password = this.config.password;
    }

    this.log('Connecting to MQTT broker:', this.config.brokerUrl);

    try {
      this.client = mqtt.connect(this.config.brokerUrl, options);

      this.client.on('connect', () => {
        this.log('MQTT connected');
        this.isConnected = true;
        this.subscribeToTopics();
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message.toString());
      });

      this.client.on('error', (error) => {
        this.log('MQTT error:', error);
      });

      this.client.on('close', () => {
        this.log('MQTT connection closed');
        this.isConnected = false;
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.client.on('offline', () => {
        this.log('MQTT client offline');
        this.isConnected = false;
      });
    } catch (error) {
      this.log('Failed to create MQTT client:', error);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private subscribeToTopics(): void {
    if (!this.client) return;

    const prefix = this.config.topicPrefix;
    const topics = [
      `${prefix}/state/gear/+/+`,              // gear.changed
      `${prefix}/state/group/+/+`,             // group.changed
      `${prefix}/state/push-button/+/+/+`,    // push-button.event
      `${prefix}/state/occupancy/+/+/+`,      // occupancy.event
      `${prefix}/state/lux/+/+/+`,            // control-device.lux
      `${prefix}/state/illuminance/+/+/+`,    // control-device.illuminance
      `${prefix}/status`,                      // online/offline
    ];

    topics.forEach((topic) => {
      this.client!.subscribe(topic, (err) => {
        if (err) {
          this.log(`Failed to subscribe to ${topic}:`, err);
        } else {
          this.log(`Subscribed to ${topic}`);
        }
      });
    });
  }

  private handleMessage(topic: string, message: string): void {
    const prefix = this.config.topicPrefix;

    // Handle status topic
    if (topic === `${prefix}/status`) {
      const online = message === 'online';
      this.log('Server status:', message);
      if (this.statusHandler) {
        this.statusHandler(online);
      }
      return;
    }

    // Parse state topics
    const gearMatch = topic.match(new RegExp(`^${prefix}/state/gear/(\\d+)/(\\d+)$`));
    if (gearMatch) {
      const busId = parseInt(gearMatch[1], 10);
      const address = parseInt(gearMatch[2], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'gear.changed',
          busId,
          address,
          level: data.level,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing gear message:', error);
      }
      return;
    }

    const groupMatch = topic.match(new RegExp(`^${prefix}/state/group/(\\d+)/(\\d+)$`));
    if (groupMatch) {
      const busId = parseInt(groupMatch[1], 10);
      const groupId = parseInt(groupMatch[2], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'group.changed',
          busId,
          groupId,
          level: data.level,
          memberCount: data.memberCount,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing group message:', error);
      }
      return;
    }

    const pushButtonMatch = topic.match(new RegExp(`^${prefix}/state/push-button/(\\d+)/(\\d+)/(\\d+)$`));
    if (pushButtonMatch) {
      const busId = parseInt(pushButtonMatch[1], 10);
      const address = parseInt(pushButtonMatch[2], 10);
      const instanceIndex = parseInt(pushButtonMatch[3], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'push-button.event',
          busId,
          address,
          instanceIndex,
          eventName: data.eventName,
          eventCode: data.eventCode,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing push-button message:', error);
      }
      return;
    }

    const occupancyMatch = topic.match(new RegExp(`^${prefix}/state/occupancy/(\\d+)/(\\d+)/(\\d+)$`));
    if (occupancyMatch) {
      const busId = parseInt(occupancyMatch[1], 10);
      const address = parseInt(occupancyMatch[2], 10);
      const instanceIndex = parseInt(occupancyMatch[3], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'occupancy.event',
          busId,
          address,
          instanceIndex,
          movement: data.movement,
          occupancy: data.occupancy,
          sensorType: data.sensorType,
          eventCode: data.eventCode,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing occupancy message:', error);
      }
      return;
    }

    const luxMatch = topic.match(new RegExp(`^${prefix}/state/lux/(\\d+)/(\\d+)/(\\d+)$`));
    if (luxMatch) {
      const busId = parseInt(luxMatch[1], 10);
      const address = parseInt(luxMatch[2], 10);
      const instanceIndex = parseInt(luxMatch[3], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'control-device.lux',
          busId,
          address,
          instanceIndex,
          luxValue: data.luxValue,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing lux message:', error);
      }
      return;
    }

    const illuminanceMatch = topic.match(new RegExp(`^${prefix}/state/illuminance/(\\d+)/(\\d+)/(\\d+)$`));
    if (illuminanceMatch) {
      const busId = parseInt(illuminanceMatch[1], 10);
      const address = parseInt(illuminanceMatch[2], 10);
      const instanceIndex = parseInt(illuminanceMatch[3], 10);
      try {
        const data = JSON.parse(message);
        const event: DaliEvent = {
          type: 'control-device.illuminance',
          busId,
          address,
          instanceIndex,
          illuminance: data.illuminance,
        };
        this.emitEvent(event);
      } catch (error) {
        this.log('Error parsing illuminance message:', error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.log('Scheduling MQTT reconnect in 5 seconds...');
    this.reconnectTimeout = this.homey.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.shouldReconnect) {
        this.log('Attempting MQTT reconnect...');
        this.client = null;
        this.connect();
      }
    }, 5000);
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
      this.log('MQTT disconnected');
    }
  }

  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  onStatus(handler: (online: boolean) => void): void {
    this.statusHandler = handler;
  }

  private emitEvent(event: DaliEvent): void {
    // Skip logging for sensor events to reduce noise
    if (event.type !== 'control-device.lux' && event.type !== 'control-device.illuminance' && event.type !== 'occupancy.event') {
      this.log('MQTT event received:', event.type, event);
    }

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.log('Error in event handler:', error);
        }
      });
    }

    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.log('Error in wildcard event handler:', error);
        }
      });
    }
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}
