// eslint-disable-next-line strict
import Homey from 'homey';
import http from 'http';

const SPARKY_API_PATH = '/api/v1/data';
const POLL_INTERVAL_MS = 1000;

interface SparkyApiData {
  active_power_w?: number | null;
  total_power_import_kwh?: number | null;
  total_power_import_t1_kwh?: number | null;
  total_power_import_t2_kwh?: number | null;
  total_power_export_kwh?: number | null;
  total_power_export_t1_kwh?: number | null;
  total_power_export_t2_kwh?: number | null;
  active_voltage_l1_v?: number | null;
  active_voltage_l2_v?: number | null;
  active_voltage_l3_v?: number | null;
  active_current_l1_a?: number | null;
  active_current_l2_a?: number | null;
  active_current_l3_a?: number | null;
  total_gas_m3?: number | null;
  [key: string]: unknown;
}

class SparkyDevice extends Homey.Device {

  ipAddress?: string;
  readonly apiPort = 80; // Sparky REST API is always on port 80 (mDNS may advertise 3602 for P1 stream)
  pollingInterval?: NodeJS.Timeout;
  errorCount: number = 0;
  readonly maxErrorsBeforeUnavailable = 3;

  getApiUrl(): string {
    return `http://${this.ipAddress}:${this.apiPort}${SPARKY_API_PATH}`;
  }

  async onInit() {
    this.ipAddress = this.getStoreValue('ipAddress') as string;
    this.log('Sparky API:', this.getApiUrl());

    if (!this.ipAddress) {
      this.error('IP address not found in store!');
      return;
    }

    if (!this.hasCapability('meter_power.imported')) { await this.addCapability('meter_power.imported'); }
    if (!this.hasCapability('meter_power.exported')) { await this.addCapability('meter_power.exported'); }
    if (!this.hasCapability('meter_power.consumedPeak')) { await this.addCapability('meter_power.consumedPeak'); }
    if (!this.hasCapability('meter_power.consumedOffPeak')) { await this.addCapability('meter_power.consumedOffPeak'); }
    if (!this.hasCapability('meter_power.producedPeak')) { await this.addCapability('meter_power.producedPeak'); }
    if (!this.hasCapability('meter_power.producedOffPeak')) { await this.addCapability('meter_power.producedOffPeak'); }
    if (!this.hasCapability('meter_power.produced')) { await this.addCapability('meter_power.produced'); }
    if (!this.hasCapability('meter_power.consumed')) { await this.addCapability('meter_power.consumed'); }

    this.registerCapabilityListener('measure_power', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('meter_power', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_current.L1', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_current.L2', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_current.L3', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_voltage.L1', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_voltage.L2', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('measure_voltage.L3', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('meter_power.imported', this.onCapabilityReadOnly.bind(this));
    this.registerCapabilityListener('meter_power.exported', this.onCapabilityReadOnly.bind(this));

    this.startPolling();
  }

  async onCapabilityReadOnly() {
    // Read-only sensor; no action.
  }

  startPolling() {
    this.stopPolling();
    this.pollingInterval = this.homey.setInterval(() => {
      this.fetchApiData().catch((err) => this.error('Poll error:', err));
    }, POLL_INTERVAL_MS);
    // First fetch immediately
    this.fetchApiData().catch((err) => this.error('Initial fetch error:', err));
  }

  stopPolling() {
    if (this.pollingInterval) {
      this.homey.clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  async fetchApiData(): Promise<void> {
    if (!this.ipAddress) return;

    return new Promise((resolve) => {
      const req = http.get(
        {
          host: this.ipAddress,
          port: this.apiPort,
          path: SPARKY_API_PATH,
          timeout: 10000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            this.handlePollError();
            resolve();
            return;
          }
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              const data = JSON.parse(body) as SparkyApiData;
              this.processApiData(data);
              this.errorCount = 0;
              this.setAvailable().catch(this.error);
            } catch (e) {
              this.handlePollError();
            }
            resolve();
          });
        }
      );
      req.on('error', () => {
        this.handlePollError();
        resolve();
      });
      req.on('timeout', () => {
        req.destroy();
        this.handlePollError();
        resolve();
      });
    });
  }

  handlePollError() {
    this.errorCount += 1;
    if (this.errorCount >= this.maxErrorsBeforeUnavailable) {
      this.setUnavailable(this.homey.__('errors.api_unavailable')).catch(this.error);
    }
  }

  processApiData(data: SparkyApiData) {
    try {
      const importKwh = data.total_power_import_kwh ?? 0;
      const importT1 = data.total_power_import_t1_kwh ?? 0;
      const importT2 = data.total_power_import_t2_kwh ?? 0;
      const exportKwh = data.total_power_export_kwh ?? 0;
      const exportT1 = data.total_power_export_t1_kwh ?? 0;
      const exportT2 = data.total_power_export_t2_kwh ?? 0;

      const meterPower = importKwh - exportKwh;
      const powerW = data.active_power_w ?? 0;

      const gas = data.total_gas_m3 ?? 0;

      const v1 = data.active_voltage_l1_v ?? 0;
      const v2 = data.active_voltage_l2_v ?? 0;
      const v3 = data.active_voltage_l3_v ?? 0;

      const c1 = data.active_current_l1_a ?? 0;
      const c2 = data.active_current_l2_a ?? 0;
      const c3 = data.active_current_l3_a ?? 0;

      this.setCapabilityValue('meter_power', meterPower).catch(this.error);
      this.setCapabilityValue('measure_power', powerW).catch(this.error);
      this.setCapabilityValue('meter_gas', gas).catch(this.error);

      this.setCapabilityValue('measure_voltage.L1', v1).catch(this.error);
      this.setCapabilityValue('measure_voltage.L2', v2).catch(this.error);
      this.setCapabilityValue('measure_voltage.L3', v3).catch(this.error);
      this.setCapabilityValue('measure_current.L1', c1).catch(this.error);
      this.setCapabilityValue('measure_current.L2', c2).catch(this.error);
      this.setCapabilityValue('measure_current.L3', c3).catch(this.error);

      this.setCapabilityValue('meter_power.consumedPeak', importT1).catch(this.error);
      this.setCapabilityValue('meter_power.consumedOffPeak', importT2).catch(this.error);
      this.setCapabilityValue('meter_power.producedPeak', exportT1).catch(this.error);
      this.setCapabilityValue('meter_power.producedOffPeak', exportT2).catch(this.error);
      this.setCapabilityValue('meter_power.consumed', importKwh).catch(this.error);
      this.setCapabilityValue('meter_power.produced', exportKwh).catch(this.error);
      this.setCapabilityValue('meter_power.imported', importKwh).catch(this.error);
      this.setCapabilityValue('meter_power.exported', exportKwh).catch(this.error);
    } catch (error) {
      this.error('Error processing API data:', error);
    }
  }

  // --- Discovery (for devices added via mDNS) ---

  onDiscoveryResult(discoveryResult: Homey.DiscoveryResult): boolean {
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult: Homey.DiscoveryResult) {
    const dr = discoveryResult as any;
    this.ipAddress = dr.address;
    this.setStoreValue('ipAddress', this.ipAddress).catch(this.error);
    this.startPolling();
  }

  onDiscoveryAddressChanged(discoveryResult: Homey.DiscoveryResult) {
    const dr = discoveryResult as any;
    this.ipAddress = dr.address;
    this.setStoreValue('ipAddress', this.ipAddress).catch(this.error);
    this.startPolling();
  }

  onDiscoveryLastSeenChanged(discoveryResult: Homey.DiscoveryResult) {
    this.startPolling();
  }

  async onAdded() {
    this.log('Sparky has been added');
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: any };
    newSettings: { [key: string]: any };
    changedKeys: string[];
  }): Promise<string | void> {
    if (changedKeys.includes('ip_address')) {
      this.ipAddress = newSettings.ip_address;
      this.setStoreValue('ipAddress', this.ipAddress).catch(this.error);
      this.log('Updated IP address:', this.ipAddress);
      this.startPolling();
    }
    this.log('Sparky settings were changed');
  }

  async onRenamed(name: string) {
    this.log('Sparky was renamed');
  }

  async onDeleted() {
    this.stopPolling();
    this.log('Sparky device removed.');
  }
}

module.exports = SparkyDevice;
