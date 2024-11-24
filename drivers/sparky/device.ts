// eslint-disable-next-line strict
import Homey from 'homey';
import net from 'net';
import parsePacket from '../../lib/parser'; // Update with the actual path to the parser

class SparkyDevice extends Homey.Device {

  ipAddress?: boolean | string | number | undefined | null;
  pollingInterval?: NodeJS.Timeout;
  intervalTime?: number;

  initialGasReading?: number;
  initialPowerReading?: number;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Sparky device has been initialized');
    // Set interval time to 3 seconds
    this.intervalTime = 3000;

    this.ipAddress = this.getStoreValue('ipAddress');
    this.log('Device IP address:', this.ipAddress);

    this.initialGasReading = await this.getStoreValue('initialGasReading');
    this.initialPowerReading = await this.getStoreValue('initialPowerReading');

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

    // Start polling
    await this.startPolling();
  }

  async onCapabilityMeasurePower(value:string, opts:string) {
    // ... set value to real device, e.g.
    // await setMyDeviceState({ on: value });
    // or, throw an error
    // throw new Error('Switching the device failed!');
  }

  async startPolling() {
    this.log('Started polling Sparky energy meter...');
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    if (this.intervalTime != null) {
      this.pollingInterval = this.homey.setInterval(async () => {
        try {
          const p1Data = await this.getP1Data();

          // if  this.getStoreValue('initialGasReading') is null, set it to the current gas reading
          if (this.initialGasReading === null) {
            // @ts-ignore
            this.initialGasReading = p1Data.gas?.reading;
            await this.setStoreValue('initialGasReading', this.initialGasReading);
          }

          // @ts-ignore
          const meter_gas = p1Data.gas?.reading ? (p1Data.gas.reading - this.initialGasReading) : 0;
          // sum of all parsedPacket.electricity.received.tariff1.reading and parsedPacket.electricity.received.tariff2.reading
          // @ts-ignore
          const meter_power_tariff1 = p1Data.electricity?.received?.tariff1?.reading;
          // @ts-ignore
          const meter_power_tariff2 = p1Data.electricity?.received?.tariff2?.reading;

          // sum of all parsedPacket.electricity.delivered.tariff1.reading and parsedPacket.electricity.delivered.tariff2.reading
          // @ts-ignore
          const meter_power_delivered_tariff1 = p1Data.electricity?.delivered?.tariff1?.reading;
          // @ts-ignore
          const meter_power_delivered_tariff2 = p1Data.electricity?.delivered?.tariff2?.reading;

          const meter_power = (meter_power_tariff1 + meter_power_tariff2) - (meter_power_delivered_tariff1 + meter_power_delivered_tariff2) - (this.initialPowerReading ? this.initialPowerReading : 0);

          // if  this.getStoreValue('initialPowerReading') is null, set it to the current power reading
          if (this.initialPowerReading === null) {
            // @ts-ignore
            this.initialPowerReading = meter_power;
            await this.setStoreValue('initialPowerReading', this.initialPowerReading);
          }

          // @ts-ignore
          const received = p1Data.electricity?.received?.actual?.reading;
          // @ts-ignore
          const delivered = p1Data.electricity?.delivered?.actual?.reading;

          const power = (received - delivered) * 1000;

          // @ts-ignore
          const powerInstant = p1Data.electricity?.instantaneous?.power;

          // @ts-ignore
          const current1 = p1Data.electricity?.instantaneous?.current?.L1?.reading;
          // @ts-ignore
          const current2 = p1Data.electricity?.instantaneous?.current?.L2?.reading;
          // @ts-ignore
          const current3 = p1Data.electricity?.instantaneous?.current?.L3?.reading;

          // @ts-ignore
          const volt1 = p1Data.electricity?.instantaneous?.voltage?.L1?.reading;
          // @ts-ignore
          const volt2 = p1Data.electricity?.instantaneous?.voltage?.L2?.reading;
          // @ts-ignore
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
          // this.error('Error polling power data:', error);
        }
      }, this.intervalTime);
    }
  }

  async getP1Data() {
    if (!this.ipAddress) {
      // this.log('IP address not set. Skipping data fetch.');
      return null;
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      if (typeof this.ipAddress === 'string') {
        client.connect(3602, this.ipAddress, () => {
          // this.log(`Connected to DSMR meter at ${this.ipAddress}:3602`);
        });
      }

      let buffer = '';

      client.on('data', (data) => {
        buffer += data.toString();

        // DSMR messages end with "!"
        if (buffer.includes('!')) {
          client.destroy(); // Close the connection after receiving the full message

          try {
            const result = this.parseDSMRMessage(buffer);
            // const powerData = result.powerInWatts;
            // console.log(result);
            resolve(result);
          } catch (error:any) {
            reject(new Error(`Failed to parse DSMR message: ${error.message}`));
          }
        }
      });

      client.on('error', (error) => {
        // this.error('Socket error:', error);
        client.destroy();
        reject(error);
      });

      client.on('close', () => {
        // this.log('Connection to DSMR meter closed.');
      });

      client.on('timeout', () => {
        // this.error('Socket timeout.');
        client.destroy();
        reject(new Error('Socket timeout'));
      });
    });
  }

  parseDSMRMessage(message:any) {
    // this.log('Parsing DSMR message:', message);

    try {
      // Use the DSMR parser to process the message
      const parsedPacket = parsePacket(message);
      // Return the structured parsed data along with power in watts
      return parsedPacket;
    } catch (error:any) {
      this.error('Error parsing DSMR message:', error.message);
      // throw new Error(`DSMR parsing failed: ${error.message}`);
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
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    if (changedKeys.includes('ipAddress')) {
      this.ipAddress = newSettings.ipAddress;
      this.log('Updated IP address:', this.ipAddress);
    }
    this.log('Sparky settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Sparky was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    if (this.pollingInterval) {
      this.homey.clearInterval(this.pollingInterval);
      this.log('Stopped polling Sparky energy meter.');
    }
  }

}

module.exports = SparkyDevice;
