⚠️ De Chargee Sparky App is nog in ontwikkeling. Deze versie wordt momenteel getest en is nog niet goedgekeurd. Wees extra voorzichtig bij het gebruik van deze app.

# Chargee Sparky
Access P1 meter data from the Sparky P1 meter through the local API. The app supports version 1.0 / 2.0 and 3.0 of the P1 meter.

### Status
Publicly released version 1.0.2. Available in the Athom App Store.

### Author
Chargee Energy - https://chargee.energy

### Release Notes

#### 1.0.9
- Added additional capabilities
- Removed cumulative values from install date to show raw meter values
- Better onboarding for Sparky P1 meter version 3.0
- Release for the Athom App Store

#### 1.0.3
- Copy and images changes
- Release for the Athom App Store

#### 1.0.1
- Copy changes
- Release for the Athom App Store

#### 1.0.0
- First full version accessing the local API of the Sparky P1 meter
- Detection of new devices
- Configuration of the local API access
- Mapping of the P1 meter data to Homey capabilities
- Initial release for the Athom App Store

### Known Issues
- When the P1 meter is not reachable, the app will not be able to retrieve the data. The app will try to reconnect every 5 seconds.
- Updating the IP address post installation is not supported. Please remove the device and add it again with the new IP address. 
