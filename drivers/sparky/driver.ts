import Homey from 'homey';

class SparkyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
    // const showToastActionCard = this.homey.flow.getActionCard('show_toast');
    //
    // showToastActionCard.registerRunListener(async ({ device, message }) => {
    //   await device.createToast(message);
    // });

    // DeviceApi.on('power-usage-changed', (watts) => {
    //   this.setCapabilityValue('measure_power', watts).catch(this.error);
    // });
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
      //Example device data, note that `store` is optional
      {
        name: 'Sparky v3 Amstellaan 9',
        data: {
          id: 'my-device',
        },
        store: {
          address: '127.0.0.1',
        },
      },
    ];
  }

}

module.exports = SparkyDriver;
