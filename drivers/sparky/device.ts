// eslint-disable-next-line strict
import Homey from 'homey';
import net from 'net';
import parsePacket from '../../lib/parser'; // Update with the actual path to the parser

class SparkyDevice extends Homey.Device {

  ipAddress?: string;
  client?: net.Socket;
  buffer: string = '';
  initialGasReading?: number;
  initialPowerReading?: number;
  pollingInterval?: NodeJS.Timeout;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    // this.log('Sparky device has been initialized');

    this.ipAddress = this.getStoreValue('ipAddress') as string;
    this.log('Sparky IP address:', this.ipAddress);


    this.initialGasReading = await this.getStoreValue('initialGasReading') as number;
    this.initialPowerReading = await this.getStoreValue('initialPowerReading') as number;

    if (!this.ipAddress) {
      this.error('IP address not found in store!');
      return;
    }

    this.registerCapabilityListener('measure_power', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('meter_power', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_current.L1', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_current.L2', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_current.L3', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_voltage.L1', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_voltage.L2', this.onCapabilityMeasurePower.bind(this));
    this.registerCapabilityListener('measure_voltage.L3', this.onCapabilityMeasurePower.bind(this));

    // Initialize the socket connection
    await this.initializeSocket();
  }

  async onCapabilityMeasurePower(value: string, opts: string) {
    // Implement capability handling if needed
  }

  async initializeSocket() {
    this.log('Initializing new socket connection to Sparky energy meter...');

    if (this.pollingInterval) clearInterval(this.pollingInterval); // clear out early polling interval

    this.client = new net.Socket();

    this.client.connect(3602, this.ipAddress!, () => {
      this.log(`Connected to DSMR meter at ${this.ipAddress}:3602`);
    });

    this.client.on('data', (data) => {
      this.buffer += data.toString();

      // DSMR messages end with "!"
      if (this.buffer.includes('!')) {
        const message = this.buffer;
        this.buffer = ''; // Reset the buffer

        try {
          const result = this.parseDSMRMessage(message);
          // Process the result and update capabilities
          this.processP1Data(result);
        } catch (error: any) {
          this.error(`Failed to parse DSMR message: ${error.message}`);
        }
      }
    });

    this.client.on('error', (error) => {
      this.error('Socket error:', error);
      this.client?.destroy();
      this.pollingInterval = this.homey.setInterval(async () => {
        this.log('Reconnecting to DSMR meter after socket error...');
        await this.initializeSocket();
      }, 5000);
    });

    this.client.on('close', () => {
      this.log('Connection to DSMR meter closed.');
      this.client?.destroy();
      // Optionally, attempt to reconnect
      this.pollingInterval = this.homey.setInterval(async () => {
        this.log('Reconnecting to DSMR after closed socket...');
        await this.initializeSocket();
      }, 5000);
    });

    this.client.on('timeout', () => {
      this.error('Socket timeout.');
      this.client?.destroy();
      this.pollingInterval = this.homey.setInterval(async () => {
        this.log('Reconnecting to DSMR after socket timeout...');
        await this.initializeSocket();
      }, 5000);
    });
  }

  parseDSMRMessage(message: any) {
    try {
      return parsePacket(message);
    } catch (error: any) {
      this.error('Error parsing DSMR message:', error.message);
    }
  }

  processP1Data(p1Data: any) {
    try {
      // Initialize initial readings if they are null or undefined
      if (this.initialGasReading == null) {
        this.initialGasReading = p1Data.gas?.reading;
        this.setStoreValue('initialGasReading', this.initialGasReading);
      }

      // @ts-ignore
      const meter_gas = p1Data.gas?.reading ? (p1Data.gas.reading - this.initialGasReading) : 0;

      const meter_power_tariff1 = p1Data.electricity?.received?.tariff1?.reading || 0;
      const meter_power_tariff2 = p1Data.electricity?.received?.tariff2?.reading || 0;

      const meter_power_delivered_tariff1 = p1Data.electricity?.delivered?.tariff1?.reading || 0;
      const meter_power_delivered_tariff2 = p1Data.electricity?.delivered?.tariff2?.reading || 0;

      // @ts-ignore
      const meter_power = (meter_power_tariff1 + meter_power_tariff2) - (meter_power_delivered_tariff1 + meter_power_delivered_tariff2) - (this.initialPowerReading || 0);

      if (this.initialPowerReading == null) {
        this.initialPowerReading = meter_power;
        this.setStoreValue('initialPowerReading', this.initialPowerReading);
      }

      const received = p1Data.electricity?.received?.actual?.reading || 0;
      const delivered = p1Data.electricity?.delivered?.actual?.reading || 0;

      const power = (received - delivered) * 1000;

      const current1 = p1Data.electricity?.instantaneous?.current?.L1?.reading;
      const current2 = p1Data.electricity?.instantaneous?.current?.L2?.reading;
      const current3 = p1Data.electricity?.instantaneous?.current?.L3?.reading;

      const volt1 = p1Data.electricity?.instantaneous?.voltage?.L1?.reading;
      const volt2 = p1Data.electricity?.instantaneous?.voltage?.L2?.reading;
      const volt3 = p1Data.electricity?.instantaneous?.voltage?.L3?.reading;

      this.setCapabilityValue('meter_gas', meter_gas).catch(this.error);
      this.setCapabilityValue('meter_power', meter_power).catch(this.error);
      this.setCapabilityValue('measure_power', power).catch(this.error);
      this.setCapabilityValue('measure_current.L1', current1).catch(this.error);
      this.setCapabilityValue('measure_current.L2', current2).catch(this.error);
      this.setCapabilityValue('measure_current.L3', current3).catch(this.error);
      this.setCapabilityValue('measure_voltage.L1', volt1).catch(this.error);
      this.setCapabilityValue('measure_voltage.L2', volt2).catch(this.error);
      this.setCapabilityValue('measure_voltage.L3', volt3).catch(this.error);
    } catch (error) {
      this.error('Error processing P1 data:', error);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Sparky has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: any };
    newSettings: { [key: string]: any };
    changedKeys: string[];
  }): Promise<string | void> {
    if (changedKeys.includes('ipAddress')) {
      this.ipAddress = newSettings.ipAddress;
      this.log('Updated IP address:', this.ipAddress);

      // Reinitialize the socket with the new IP address
      this.client?.destroy();
      await this.initializeSocket();
    }
    this.log('Sparky settings were changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used to synchronize the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Sparky was renamed');
  }

  /**
   * onDeleted is called when the user deletes the device.
   */
  async onDeleted() {
    if (this.client) {
      this.client.destroy();
      this.log('Closed socket connection to Sparky energy meter.');
    }
  }
}

module.exports = SparkyDevice;
