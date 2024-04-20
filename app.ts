'use strict';

import Homey from 'homey';

class Sparky extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Firing up Sparky integration...');
  }

}

module.exports = Sparky;
