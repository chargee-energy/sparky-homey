import Homey from 'homey';
import net from 'net';
import os from 'os'; // Import the os module to fetch network interfaces.

class SparkyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Sparky driver has been initialized');
  }

  async onPair(session: any) {

    // handle IP address entered by user
    session.setHandler('ip_entered', async (data:any) => {
      if (data && data.ip_address) {
        const manualIp = data.ip_address;
        const port = 3602;
        const timeout = 2000; // Timeout in milliseconds
        const isOpen = await this.checkPort(manualIp, port, timeout);
        if (isOpen) {
          // console.log(`Sparky with IP Address ${manualIp} is open on port ${port}.`);
          await session.emit('ip_entered', 'Success');
          return 'Success';
        }
        return 'Failed';
      }
    });
  }

  /**
   * Get the local IP address of the Homey device.
   * @returns {string | null} Local IP address or null if not found.
   */
  getLocalIpAddress(): string | null {
    const interfaces = os.networkInterfaces();
    for (const ifaceName in interfaces) {
      for (const iface of interfaces[ifaceName] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // Check if IP is within common private IP ranges (e.g., 192.168.x.x, 10.x.x.x).

          return iface.address;
        }
      }
    }
    return null;
  }

  /**
   * Generate a range of IP addresses based on the Homey's local IP.
   * Assumes a /24 subnet (e.g., 192.168.1.0 to 192.168.1.255).
   * @param {string} localIp Homey's local IP address.
   * @returns {string[]} List of IP addresses in the subnet.
   */
  generateIpRangeFromLocalIp(localIp: string): string[] {
    const baseIp = localIp.split('.').slice(0, 3).join('.'); // Get base IP (e.g., 192.168.1)
    const ips: string[] = [];

    for (let i = 1; i <= 254; i++) { // Avoid .0 (network) and .255 (broadcast)
      ips.push(`${baseIp}.${i}`);
    }

    return ips;
  }

  /**
   * Scan a range of IP addresses for a specific port.
   * @param {string[]} ipRange List of IP addresses.
   * @param {number} port Port to scan.
   * @param {number} timeout Timeout in milliseconds.
   * @returns {Promise<string[]>} List of IPs that respond on the port.
   */
  async scanForDevices(ipRange: string[], port: number, timeout: number): Promise<string[]> {
    const devices: string[] = [];
    const checks = ipRange.map((ip) => this.checkPort(ip, port, timeout).then((isOpen) => {
      if (isOpen) {
        devices.push(ip);
      }
    }));

    await Promise.all(checks); // Wait for all checks to complete.
    return devices;
  }

  /**
   * Check if a port is open on a specific IP address.
   * @param {string} ip IP address to check.
   * @param {number} port Port to check.
   * @param {number} timeout Timeout in milliseconds.
   * @returns {Promise<boolean>} Whether the port is open.
   */
  checkPort(ip: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      const onSuccess = () => {
        socket.destroy();
        resolve(true);
      };

      const onError = () => {
        socket.destroy();
        resolve(false);
      };

      socket.setTimeout(timeout);
      socket.once('connect', onSuccess);
      socket.once('error', onError);
      socket.once('timeout', onError);

      // console.log(`Checking ${ip}:${port}`);
      socket.connect(port, ip);
    });
  }

  /**
   * Prompt the user to manually enter an IP address.
   * This relies on Homey's pairing input handling.
   * @param {Homey.Pairing.Session} session The pairing session object.
   * @returns {Promise<string | null>} User-entered IP address or null if no input is provided.
   */
  async promptForManualIp(session: any): Promise<string | null> {
    return new Promise((resolve) => {
      this.log('Showing enter_ip view');
      session.showView('enter_ip'); // Ensure this matches the ID in app.json.
      session.on('input', async (viewId:any, input:any) => {
        this.log(`Received input: viewId=${viewId}, input=${JSON.stringify(input)}`);
        if (viewId === 'enter_ip' && input && input.ip) {
          resolve(input.ip);
        } else {
          resolve(null);
        }
      });
    });
  }

}

module.exports = SparkyDriver;
