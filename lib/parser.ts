interface ParsedPacket {
  meterType: string;
  version: string | null;
  timestamp: string | null;
  equipmentId: string | null;
  textMessage: {
    codes: string | null;
    message: string | null;
  };
  electricity: {
    received: {
      tariff1: { reading: number | null; unit: string | null };
      tariff2: { reading: number | null; unit: string | null };
      actual: { reading: number | null; unit: string | null };
    };
    delivered: {
      tariff1: { reading: number | null; unit: string | null };
      tariff2: { reading: number | null; unit: string | null };
      actual: { reading: number | null; unit: string | null };
    };
    tariffIndicator: number | null;
    threshold: { value: number | null; unit: string | null } | null;
    fuseThreshold: { value: number | null; unit: string | null } | null;
    switchPosition: string | null;
    numberOfPowerFailures: number | null;
    numberOfLongPowerFailures: number | null;
    longPowerFailureLog: { count: number; log: LogItem[] } | null;
    voltageSags: { L1: number | null; L2: number | null; L3: number | null };
    voltageSwell: { L1: number | null; L2: number | null; L3: number | null };
    instantaneous: {
      current: { L1: ReadingUnit; L2: ReadingUnit; L3: ReadingUnit };
      voltage: { L1: ReadingUnit; L2: ReadingUnit; L3: ReadingUnit };
      power: {
        positive: { L1: ReadingUnit; L2: ReadingUnit; L3: ReadingUnit };
        negative: { L1: ReadingUnit; L2: ReadingUnit; L3: ReadingUnit };
      };
    };
    demand: {
      positiveActiveDemand?: DemandPeriod;
      negativeActiveDemand?: DemandPeriod;
      maximumDemandLastMonths?: {
        count: number;
        months: MonthlyDemand[];
      };
    };
  };
  gas: {
    deviceType: string | null;
    equipmentId: string | null;
    timestamp: string | null;
    reading: number | null;
    unit: string | null;
    valvePosition: string | null;
  };
}

interface LogItem {
  startOfFailure: string;
  endOfFailure: string;
  duration: number;
  unit: string;
}

interface ReadingUnit {
  reading: number | null;
  unit: string | null | undefined;
}

interface DemandPeriod {
  currentDemandPeriod?: ReadingUnit;
  maximumDemand?: { timestamp: string | null; reading: number | null; unit: string | null };
}

interface MonthlyDemand {
  month: string;
  timestamp: string;
  value: number;
  unit: string;
}

interface LineOutput {
  obisCode: string;
  value: string;
  unit?: string;
}

interface PowerFailureEventLog {
  count: number;
  log: Array<{
    endOfFailure: string;
    duration: number;
    unit: string;
  }>;
}

function _parsePowerFailureEventLog(value: string): PowerFailureEventLog {
  const split = value.split(")(0-0:96.7.19)(");
  const output: PowerFailureEventLog = {
    count: parseInt(split[0], 10) || 0,
    log: [],
  };

  if (split[1]) {
    const log = split[1].split(")(");

    // Loop through the log structure: timestamp)(duration)(timestamp)(duration...
    for (let i = 0; i < log.length; i += 2) {
      if (log[i] && log[i + 1]) {
        output.log.push({
          endOfFailure: _parseTimestamp(log[i]),
          duration: parseInt(log[i + 1].split("*")[0], 10),
          unit: log[i + 1].split("*")[1],
        });
      }
    }
  }

  return output;
}

function _subtractNumberOfSecondsFromDate(date: string, seconds: number): string {
  const output = new Date(date);
  output.setSeconds(output.getSeconds() - seconds);
  return output.toISOString();
}

interface HourlyReading {
  timestamp: string | null;
  value: string | null;
  unit: string | null;
}

function _parseHourlyReading(reading: string): HourlyReading {
  const output: HourlyReading = {
    timestamp: null,
    value: null,
    unit: null,
  };

  const split = reading.split(")(");

  if (split[0] && split[1]) {
    output.timestamp = split[0];
    const [value, unit] = split[1].split("*");
    output.value = value;
    output.unit = unit;
  }

  return output;
}

function _convertHexToAscii(hexString: string): string {
  let asciiString = '';

  for (let i = 0; i < hexString.length; i += 2) {
    const hexChar = hexString.substring(i, i + 2);
    asciiString += String.fromCharCode(parseInt(hexChar, 16));
  }

  return asciiString;
}

function _parseTimestamp(timestamp: string): string {
  const parsedTimestamp = new Date();
  parsedTimestamp.setUTCFullYear(parseInt(timestamp.substring(0, 2), 10) + 2000);
  parsedTimestamp.setUTCMonth(parseInt(timestamp.substring(2, 4)) - 1);
  parsedTimestamp.setUTCDate(parseInt(timestamp.substring(4, 6)));
  parsedTimestamp.setUTCHours(parseInt(timestamp.substring(6, 8)));
  parsedTimestamp.setUTCMinutes(parseInt(timestamp.substring(8, 10)));
  parsedTimestamp.setUTCSeconds(parseInt(timestamp.substring(10, 12)));
  parsedTimestamp.setUTCMilliseconds(0);

  return parsedTimestamp.toISOString();
}

/**
 * Parse P1 packet
 *
 * @param packet P1 packet according to DSMR 2.2 or 4.0 specification
 */
function parsePacket(packet: string): ParsedPacket {
  const lines = packet.split(/\r\n|\n|\r/);
  const parsedPacket: ParsedPacket = {
    meterType: lines[0]?.substring(1) || '',
    version: null,
    timestamp: null,
    equipmentId: null,
    textMessage: {
      codes: null,
      message: null,
    },
    electricity: {
      received: {
        tariff1: { reading: null, unit: null },
        tariff2: { reading: null, unit: null },
        actual: { reading: null, unit: null },
      },
      delivered: {
        tariff1: { reading: null, unit: null },
        tariff2: { reading: null, unit: null },
        actual: { reading: null, unit: null },
      },
      tariffIndicator: null,
      threshold: null,
      fuseThreshold: null,
      switchPosition: null,
      numberOfPowerFailures: null,
      numberOfLongPowerFailures: null,
      longPowerFailureLog: null,
      voltageSags: { L1: null, L2: null, L3: null },
      voltageSwell: { L1: null, L2: null, L3: null },
      instantaneous: {
        current: { L1: { reading: null, unit: null }, L2: { reading: null, unit: null }, L3: { reading: null, unit: null } },
        voltage: { L1: { reading: null, unit: null }, L2: { reading: null, unit: null }, L3: { reading: null, unit: null } },
        power: {
          positive: { L1: { reading: null, unit: null }, L2: { reading: null, unit: null }, L3: { reading: null, unit: null } },
          negative: { L1: { reading: null, unit: null }, L2: { reading: null, unit: null }, L3: { reading: null, unit: null } },
        },
      },
      demand: {},
    },
    gas: {
      deviceType: null,
      equipmentId: null,
      timestamp: null,
      reading: null,
      unit: null,
      valvePosition: null,
    },
  };

  for (let i = 1; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine) {
      const line = _parseLine(trimmedLine);

      switch (line.obisCode) {
        case '1-3:0.2.8':
        case '0-0:96.1.4':
          parsedPacket.version = line.value;
          break;

        case '0-0:1.0.0':
          parsedPacket.timestamp = _parseTimestamp(line.value);
          break;

        case '0-0:96.1.1':
          parsedPacket.equipmentId = line.value;
          break;

        case '0-0:96.13.1':
          parsedPacket.textMessage.codes = line.value;
          break;

        case '0-0:96.13.0':
          parsedPacket.textMessage.message = _convertHexToAscii(line.value);
          break;

        case '1-0:1.8.1':
          parsedPacket.electricity.received.tariff1.reading = parseFloat(line.value);
          parsedPacket.electricity.received.tariff1.unit = line.unit || null;
          break;

        case '1-0:1.8.2':
          parsedPacket.electricity.received.tariff2.reading = parseFloat(line.value);
          parsedPacket.electricity.received.tariff2.unit = line.unit || null;
          break;

        case '1-0:2.8.1':
          parsedPacket.electricity.delivered.tariff1.reading = parseFloat(line.value);
          parsedPacket.electricity.delivered.tariff1.unit = line.unit || null;
          break;

        case '1-0:2.8.2':
          parsedPacket.electricity.delivered.tariff2.reading = parseFloat(line.value);
          parsedPacket.electricity.delivered.tariff2.unit = line.unit || null;
          break;

        case '0-0:96.14.0':
          parsedPacket.electricity.tariffIndicator = parseInt(line.value, 10);
          break;

        case '1-0:1.7.0':
          parsedPacket.electricity.received.actual.reading = parseFloat(line.value);
          parsedPacket.electricity.received.actual.unit = line.unit || null;
          break;

        case '1-0:2.7.0':
          parsedPacket.electricity.delivered.actual.reading = parseFloat(line.value);
          parsedPacket.electricity.delivered.actual.unit = line.unit || null;
          break;

        case '0-0:17.0.0':
          parsedPacket.electricity.threshold = {
            value: parseFloat(line.value),
            unit: line.unit || null,
          };
          break;

        case '0-0:96.3.10':
          parsedPacket.electricity.switchPosition = line.value;
          break;

        case '0-0:96.7.21':
          parsedPacket.electricity.numberOfPowerFailures = parseInt(line.value, 10);
          break;

        case '0-0:96.7.9':
          parsedPacket.electricity.numberOfLongPowerFailures = parseInt(line.value, 10);
          break;

        case '1-0:99.97.0':
          const powerFailureEventLog = _parsePowerFailureEventLog(line.value);
          parsedPacket.electricity.longPowerFailureLog = {
            count: powerFailureEventLog.count,
            log: powerFailureEventLog.log.map((event) => ({
              startOfFailure: _subtractNumberOfSecondsFromDate(event.endOfFailure, event.duration),
              endOfFailure: event.endOfFailure,
              duration: event.duration,
              unit: event.unit,
            })),
          };
          break;

        case '1-0:32.32.0':
          parsedPacket.electricity.voltageSags.L1 = parseInt(line.value, 10);
          break;

        case '1-0:52.32.0':
          parsedPacket.electricity.voltageSags.L2 = parseInt(line.value, 10);
          break;

        case '1-0:72.32.0':
          parsedPacket.electricity.voltageSags.L3 = parseInt(line.value, 10);
          break;

        case '1-0:32.36.0':
          parsedPacket.electricity.voltageSwell.L1 = parseInt(line.value, 10);
          break;

        case '1-0:52.36.0':
          parsedPacket.electricity.voltageSwell.L2 = parseInt(line.value, 10);
          break;

        case '1-0:72.36.0':
          parsedPacket.electricity.voltageSwell.L3 = parseInt(line.value, 10);
          break;

        case '1-0:31.7.0':
          parsedPacket.electricity.instantaneous.current.L1.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.current.L1.unit = line.unit || null;
          break;

        case '1-0:51.7.0':
          parsedPacket.electricity.instantaneous.current.L2.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.current.L2.unit = line.unit || null;
          break;

        case '1-0:71.7.0':
          parsedPacket.electricity.instantaneous.current.L3.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.current.L3.unit = line.unit || null;
          break;

        case '1-0:32.7.0':
          parsedPacket.electricity.instantaneous.voltage.L1.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.voltage.L1.unit = line.unit || null;
          break;

        case '1-0:52.7.0':
          parsedPacket.electricity.instantaneous.voltage.L2.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.voltage.L2.unit = line.unit || null;
          break;

        case '1-0:72.7.0':
          parsedPacket.electricity.instantaneous.voltage.L3.reading = parseInt(line.value, 10);
          parsedPacket.electricity.instantaneous.voltage.L3.unit = line.unit || null;
          break;

          // Handle gas-specific mappings
        case '0-1:24.1.0':
          parsedPacket.gas.deviceType = line.value;
          break;

        case '0-1:96.1.0':
          parsedPacket.gas.equipmentId = line.value;
          break;

        case '0-1:24.2.1':
          const hourlyReading = _parseHourlyReading(line.value);
          parsedPacket.gas.timestamp = _parseTimestamp(hourlyReading.timestamp ? hourlyReading.timestamp : '');
          parsedPacket.gas.reading = parseFloat(hourlyReading.value ? hourlyReading.value : '');
          parsedPacket.gas.unit = hourlyReading.unit;
          break;

        case '0-1:24.4.0':
          parsedPacket.gas.valvePosition = line.value;
          break;

        case '1-0:21.7.0':
          parsedPacket.electricity.instantaneous.power.positive.L1.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.positive.L1.unit = line.unit;
          break;

        case '1-0:41.7.0':
          parsedPacket.electricity.instantaneous.power.positive.L2.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.positive.L2.unit = line.unit;
          break;

        case '1-0:61.7.0':
          parsedPacket.electricity.instantaneous.power.positive.L3.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.positive.L3.unit = line.unit;
          break;
        case '1-0:22.7.0':
          parsedPacket.electricity.instantaneous.power.negative.L1.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.negative.L1.unit = line.unit;
          break;

        case '1-0:42.7.0':
          parsedPacket.electricity.instantaneous.power.negative.L2.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.negative.L2.unit = line.unit;
          break;

        case '1-0:62.7.0':
          parsedPacket.electricity.instantaneous.power.negative.L3.reading = parseFloat(line.value);
          parsedPacket.electricity.instantaneous.power.negative.L3.unit = line.unit;
          break;

        default:
          // Handle unexpected lines, e.g., gas readings in DSMR 2.2 format
          if (trimmedLine.match(/\([0-9]{5}\.[0-9]{3}\)/)) {
            parsedPacket.gas.reading = parseFloat(trimmedLine.substring(1, 10));
          } else {
            // console.error('Unable to parse line:', trimmedLine);
          }
          break;
      }
    }
  }

  // Fallback logic for DSMR 2.2 version
  if (!parsedPacket.version) {
    parsedPacket.version = '22';
    const now = new Date();
    now.setMilliseconds(0);
    parsedPacket.timestamp = now.toISOString();
  }

  return parsedPacket;
}

function _parseLine(line: string): LineOutput {
  const output: LineOutput = { obisCode: '', value: '' };
  const split = line.split(/\((.+)?/);

  if (split[0] && split[1]) {
    output.obisCode = split[0];
    const value = split[1].substring(0, split[1].length - 1);

    if (value.includes('*')) {
      const [val, unit] = value.split('*');
      output.value = val;
      output.unit = unit;
    } else {
      output.value = value;
    }
  }

  return output;
}



export default parsePacket;
