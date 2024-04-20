// eslint-disable-next-line strict
import Homey from 'homey';

class SparkyDevice extends Homey.Device {

  currentAddress?: string;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Sparky device has been initialized');
    this.log('Name:', this.getName());
    this.log('Class:', this.getClass());

    this.registerCapabilityListener('measure_power', this.onCapabilityMeasurePower.bind(this));

    this.currentAddress = this.getStoreValue('address');
    // Homey.Device.on('address-changed', (address:string) => {
    //   this.currentAddress = address;
    //   this.setStoreValue('address', address).catch(this.error);
    // });
  }

  async onCapabilityMeasurePower(value:string, opts:string) {
    // ... set value to real device, e.g.
    // await setMyDeviceState({ on: value });
    // or, throw an error
    // throw new Error('Switching the device failed!');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
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
    this.log("MyDevice settings where changed");
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

}

module.exports = SparkyDevice;
