import Homey from 'homey';
import http from 'http';

const SPARKY_API_PATH = '/api/v1/data';
const MIN_FIRMWARE = 95;

interface SparkyApiData {
  unique_id?: string;
  total_power_import_kwh?: number;
  [key: string]: unknown;
}

class SparkyDriver extends Homey.Driver {

  async onInit() {
    // this.log('Sparky driver has been initialized');
  }

  /**
   * Return list of discovered Sparkys (fw >= 95) for pairing.
   */
  async onPairListDevices() {
    const strategy = this.getDiscoveryStrategy();
    const results = strategy.getDiscoveryResults();
    const devices: Array<{ name: string; data: { id: string }; store: { ipAddress: string } }> = [];

    for (const discoveryResult of Object.values(results)) {
      const txt = (discoveryResult as any).txt || {};
      const fw = parseInt(txt.fw ?? '', 10);
      if (isNaN(fw) || fw < MIN_FIRMWARE) {
        continue;
      }
      const address = (discoveryResult as any).address;
      const name = (discoveryResult as any).name || (discoveryResult as any).host || `Sparky-${txt.sn || discoveryResult.id}`;
      devices.push({
        name,
        data: { id: discoveryResult.id },
        store: { ipAddress: address },
      });
    }

    return devices;
  }

  async onPair(session: any) {
    session.setHandler('get_discovered', async () => {
      return this.onPairListDevices();
    });
    session.setHandler('ip_entered', async (data: any) => {
      if (data && data.ip_address) {
        const valid = await this.validateSparkyApi(data.ip_address, 80);
        await session.emit('ip_entered', valid ? 'Success' : 'Failed');
        return valid ? 'Success' : 'Failed';
      }
      return 'Failed';
    });
  }

  /**
   * Validate that the given host serves the Sparky API (GET /api/v1/data returns 200 and valid JSON).
   */
  async validateSparkyApi(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const path = SPARKY_API_PATH;
      const req = http.get(
        { host, port, path, timeout: 5000 },
        (res) => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(body) as SparkyApiData;
              resolve(
                typeof json.unique_id === 'string' ||
                typeof json.total_power_import_kwh === 'number'
              );
            } catch {
              resolve(false);
            }
          });
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}

module.exports = SparkyDriver;
