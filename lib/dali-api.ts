import http from 'http';

interface HomeyInterface {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
}

export interface DaliGear {
  busId: number;
  address: number;
  level: number;
  lastUpdated: string;
  deviceType: 6 | 7;
  name: string;
}

export interface DaliGroup {
  busId: number;
  groupId: number;
  level: number;
  lastSetLevel: number | null;
  memberCount: number;
  name: string;
  members: Array<{
    address: number;
    level: number;
  }>;
}

export interface DaliControlDeviceInstance {
  index: number;
  type: 1 | 3 | 4;
  name: string;
  luxValue?: number;
  luxUpdated?: string;
}

export interface DaliControlDevice {
  busId: number;
  address: number;
  instances: DaliControlDeviceInstance[];
}

export interface DaliState {
  gears: DaliGear[];
  groups: DaliGroup[];
  controlDevices: DaliControlDevice[];
}

export interface DaliEvent {
  type: 'gear.changed' | 'group.changed' | 'control-device.changed' | 'control-device.lux';
  busId: number;
  address?: number;
  groupId?: number;
  level?: number;
  instanceIndex?: number;
  eventCode?: number;
  luxValue?: number;
  memberCount?: number;
  lastEvent?: {
    instanceIndex: number;
    eventCode: number;
    timestamp: string;
  };
}

export class DaliApiClient {
  private baseUrl: string;
  private log: (...args: unknown[]) => void;
  private homey: HomeyInterface;
  private sseRequest: http.ClientRequest | null = null;
  private eventHandlers: Map<string, Set<(event: DaliEvent) => void>> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;

  constructor(host: string, homey: HomeyInterface, logger: (...args: unknown[]) => void) {
    // If host doesn't include port, add default port 3000
    const hostWithPort = host.includes(':') ? host : `${host}:3000`;
    this.baseUrl = `http://${hostWithPort}`;
    this.homey = homey;
    this.log = logger;
  }

  async getState(bus: number): Promise<DaliState> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/state?bus=${bus}`;
      this.log('Fetching state:', url);

      http.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const state = JSON.parse(data);
            resolve(state);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  async setLightLevel(busId: number, address: number, level: number): Promise<void> {
    this.log(`🔆 Set Light Level - Bus ${busId}, Address ${address}, Level ${level}`);
    return this.makePostRequest(`/dali/lights/${address}/level`, {
      bus: busId,
      level,
    });
  }

  async setLightOn(busId: number, address: number): Promise<void> {
    this.log(`💡 Set Light ON - Bus ${busId}, Address ${address}`);
    return this.makePostRequest(`/dali/lights/${address}/on`, {
      bus: busId,
    });
  }

  async setLightOff(busId: number, address: number): Promise<void> {
    this.log(`🔌 Set Light OFF - Bus ${busId}, Address ${address}`);
    return this.makePostRequest(`/dali/lights/${address}/off`, {
      bus: busId,
    });
  }

  async setLightUp(busId: number, address: number): Promise<void> {
    this.log(`⬆️ Set Light UP - Bus ${busId}, Address ${address}`);
    return this.makePostRequest(`/dali/lights/${address}/up`, {
      bus: busId,
    });
  }

  async setLightDown(busId: number, address: number): Promise<void> {
    this.log(`⬇️ Set Light DOWN - Bus ${busId}, Address ${address}`);
    return this.makePostRequest(`/dali/lights/${address}/down`, {
      bus: busId,
    });
  }

  async setGroupLevel(busId: number, groupId: number, level: number): Promise<void> {
    this.log(`🔆 Set Group Level - Bus ${busId}, Group ${groupId}, Level ${level}`);
    return this.makePostRequest(`/dali/groups/${groupId}/level`, {
      bus: busId,
      level,
    });
  }

  async setGroupOn(busId: number, groupId: number): Promise<void> {
    this.log(`💡 Set Group ON - Bus ${busId}, Group ${groupId}`);
    return this.makePostRequest(`/dali/groups/${groupId}/on`, {
      bus: busId,
    });
  }

  async setGroupOff(busId: number, groupId: number): Promise<void> {
    this.log(`🔌 Set Group OFF - Bus ${busId}, Group ${groupId}`);
    return this.makePostRequest(`/dali/groups/${groupId}/off`, {
      bus: busId,
    });
  }

  async setGroupUp(busId: number, groupId: number): Promise<void> {
    this.log(`⬆️ Set Group UP - Bus ${busId}, Group ${groupId}`);
    return this.makePostRequest(`/dali/groups/${groupId}/up`, {
      bus: busId,
    });
  }

  async setGroupDown(busId: number, groupId: number): Promise<void> {
    this.log(`⬇️ Set Group DOWN - Bus ${busId}, Group ${groupId}`);
    return this.makePostRequest(`/dali/groups/${groupId}/down`, {
      bus: busId,
    });
  }

  private makePostRequest(path: string, body: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const postData = JSON.stringify(body);

      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      // this.log(`POST ${this.baseUrl}${options.path} body:`, body);

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  connectToEventStream(): void {
    if (this.sseRequest) {
      this.log('SSE already connected');
      return;
    }

    // Enable reconnection for this connection
    this.shouldReconnect = true;

    const url = new URL('/events/state', this.baseUrl);
    this.log('Connecting to SSE:', url.href);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    };

    this.sseRequest = http.request(options, (res) => {
      this.log('SSE connected with status:', res.statusCode);

      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const event = JSON.parse(data) as DaliEvent;
              this.emitEvent(event);
            } catch (error) {
              this.log('Error parsing SSE event:', error);
            }
          }
        }
      });

      res.on('end', () => {
        this.log('SSE connection ended');
        this.sseRequest = null;
        if (this.shouldReconnect) {
          this.reconnectTimeout = this.homey.setTimeout(() => this.reconnect(), 5000);
        }
      });

      res.on('error', (error) => {
        this.log('SSE response error:', error);
        this.sseRequest = null;
        if (this.shouldReconnect) {
          this.reconnectTimeout = this.homey.setTimeout(() => this.reconnect(), 5000);
        }
      });
    });

    this.sseRequest.on('error', (error) => {
      this.log('SSE request error:', error);
      this.sseRequest = null;
      if (this.shouldReconnect) {
        this.reconnectTimeout = this.homey.setTimeout(() => this.reconnect(), 5000);
      }
    });

    this.sseRequest.end();
  }

  private reconnect(): void {
    this.log('Reconnecting to SSE...');
    this.connectToEventStream();
  }

  disconnectFromEventStream(): void {
    // Prevent any reconnection attempts
    this.shouldReconnect = false;

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Destroy the SSE connection
    if (this.sseRequest) {
      this.sseRequest.destroy();
      this.sseRequest = null;
      this.log('SSE disconnected');
    }
  }

  on(eventType: string, handler: (event: DaliEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: (event: DaliEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emitEvent(event: DaliEvent): void {
    // Skip logging for sensor events to reduce noise (only show light-related events)
    if (event.type !== 'control-device.lux' && event.type !== 'control-device.changed') {
      this.log('SSE event received:', event.type, event);
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
}
