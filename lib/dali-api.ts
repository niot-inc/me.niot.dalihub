import http from 'http';

interface HomeyInterface {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
}

// DALI Arc Power <-> Percent 변환
// DALI 표준 로그 커브 기반

const DALI_MAX_ARC = 254;

/**
 * DALI Arc 값을 퍼센트로 변환
 * @param arc - DALI arc 값 (1-254, 0은 OFF)
 * @returns 밝기 퍼센트 (0.1 ~ 100)
 */
export function arcToPercent(arc: number): number {
  if (arc <= 0) return 0;
  if (arc > DALI_MAX_ARC) arc = DALI_MAX_ARC;

  // DALI 표준 공식: percent = 10^((arc - 254) * 3 / 253)
  const percent = 10 ** (((arc - 254) * 3) / 253) * 100;
  return Math.round(percent * 100) / 100; // 소수점 2자리
}

/**
 * 퍼센트를 DALI Arc 값으로 변환
 * @param percent - 밝기 퍼센트 (0-100)
 * @returns DALI arc 값 (0-254)
 */
export function percentToArc(percent: number): number {
  if (percent <= 0) return 0;
  if (percent > 100) percent = 100;

  // 역공식: arc = 253/3 * log10(percent/100) + 254
  const arc = (253 / 3) * Math.log10(percent / 100) + 254;
  return Math.round(arc);
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

  async setLightPercent(busId: number, address: number, percent: number, fadeTime?: number): Promise<void> {
    this.log(`🔆 Set Light Percent - Bus ${busId}, Address ${address}, Percent ${percent}%${fadeTime !== undefined ? `, Fade Time ${fadeTime}` : ''}`);
    const body: Record<string, unknown> = {
      bus: busId,
      percent,
    };
    if (fadeTime !== undefined) {
      body.fadeTime = fadeTime;
    }
    return this.makePostRequest(`/dali/lights/${address}/percent`, body);
  }

  async setLightLevel(busId: number, address: number, level: number, fadeTime?: number): Promise<void> {
    this.log(`🔆 Set Light Level - Bus ${busId}, Address ${address}, Level ${level}${fadeTime !== undefined ? `, Fade Time ${fadeTime}` : ''}`);
    const body: Record<string, unknown> = {
      bus: busId,
      level,
    };
    if (fadeTime !== undefined) {
      body.fadeTime = fadeTime;
    }
    return this.makePostRequest(`/dali/lights/${address}/level`, body);
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

  async setGroupPercent(busId: number, groupId: number, percent: number, fadeTime?: number): Promise<void> {
    this.log(`🔆 Set Group Percent - Bus ${busId}, Group ${groupId}, Percent ${percent}%${fadeTime !== undefined ? `, Fade Time ${fadeTime}` : ''}`);
    const body: Record<string, unknown> = {
      bus: busId,
      percent,
    };
    if (fadeTime !== undefined) {
      body.fadeTime = fadeTime;
    }
    return this.makePostRequest(`/dali/groups/${groupId}/percent`, body);
  }

  async setGroupLevel(busId: number, groupId: number, level: number, fadeTime?: number): Promise<void> {
    this.log(`🔆 Set Group Level - Bus ${busId}, Group ${groupId}, Level ${level}${fadeTime !== undefined ? `, Fade Time ${fadeTime}` : ''}`);
    const body: Record<string, unknown> = {
      bus: busId,
      level,
    };
    if (fadeTime !== undefined) {
      body.fadeTime = fadeTime;
    }
    return this.makePostRequest(`/dali/groups/${groupId}/level`, body);
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

  async recallScene(
    busId: number,
    scene: number,
    targetType: 'address' | 'group' | 'broadcast',
    targetValue: number,
    fadeTime?: number,
  ): Promise<void> {
    this.log(`🎬 Recall Scene ${scene} - Bus ${busId}, Type ${targetType}, Value ${targetValue}${fadeTime !== undefined ? `, Fade Time ${fadeTime}` : ''}`);
    const body: Record<string, unknown> = { bus: busId };

    if (targetType === 'address') {
      body.targetType = 'address';
      body.targetValue = targetValue;
    } else if (targetType === 'group') {
      body.targetType = 'group';
      body.targetValue = targetValue;
    } else {
      body.targetType = 'broadcast';
    }

    if (fadeTime !== undefined) {
      body.fadeTime = fadeTime;
    }

    return this.makePostRequest(`/dali/scenes/${scene}/recall`, body);
  }

  async setGroupMaxLevel(busId: number, groupId: number, level: number): Promise<void> {
    this.log(`🔆 Set Group Max Level - Bus ${busId}, Group ${groupId}, Max Level ${level}`);
    return this.makePostRequest(`/dali/groups/${groupId}/set-max-level`, {
      bus: busId,
      level,
    });
  }

  async setGroupMaxLevelPercent(busId: number, groupId: number, percent: number): Promise<void> {
    this.log(`🔆 Set Group Max Level Percent - Bus ${busId}, Group ${groupId}, Max Percent ${percent}%`);
    return this.makePostRequest(`/dali/groups/${groupId}/set-max-level-percent`, {
      bus: busId,
      percent,
    });
  }

  async setLightMaxLevel(busId: number, address: number, level: number): Promise<void> {
    this.log(`🔆 Set Light Max Level - Bus ${busId}, Address ${address}, Max Level ${level}`);
    return this.makePostRequest(`/dali/lights/${address}/set-max-level`, {
      bus: busId,
      level,
    });
  }

  async setLightMaxLevelPercent(busId: number, address: number, percent: number): Promise<void> {
    this.log(`🔆 Set Light Max Level Percent - Bus ${busId}, Address ${address}, Max Percent ${percent}%`);
    return this.makePostRequest(`/dali/lights/${address}/set-max-level-percent`, {
      bus: busId,
      percent,
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

      this.log(`POST ${this.baseUrl}${options.path} body:`, body);

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
