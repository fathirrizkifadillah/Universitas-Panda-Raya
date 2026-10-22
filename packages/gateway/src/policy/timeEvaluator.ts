import { config } from '../../../shared/src/config.js';

export interface TimeCheckResult {
  isWithinWindow: boolean;
  serverHourMinute: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

export function isWithinAccessWindow(mockTimeString?: string): TimeCheckResult {
  const timezone = config.accessWindow.timezone;
  const windowStart = config.accessWindow.start; // "07:00"
  const windowEnd = config.accessWindow.end;     // "21:00"

  let now: Date;
  if (mockTimeString) {
    now = new Date(mockTimeString);
  } else {
    now = new Date();
  }

  // Format time in target timezone HH:mm
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const serverHourMinute = formatter.format(now); // e.g. "08:30" or "21:05"

  // Compare as HH:mm strings
  // Window: start <= current <= end (or strictly < end depending on boundary)
  // Per rubric: "perubahan dan finalisasi nilai hanya diizinkan pukul 07.00–21.00"
  // Test matrix page 12 specifies: 06:59 -> deny, 07:00 -> allow, 20:59 -> allow, 21:00 -> allow, 21:01 -> deny
  const isWithinWindow = serverHourMinute >= windowStart && serverHourMinute <= windowEnd;

  return {
    isWithinWindow,
    serverHourMinute,
    windowStart,
    windowEnd,
    timezone,
  };
}
