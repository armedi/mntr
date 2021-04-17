import { ProbeOptions, ProbeResult } from './probe';
import { Response } from './utils/httpRequest';

export type Alert = ReturnType<typeof createAlert>;

export const createAlert = (
  request: {
    check: [string, number];
    probeId: string;
    requestIndex: number;
    response: ProbeResult['response'] | null;
  },
  probes: ProbeOptions[]
) => {
  const probe = probes.find((probe) => probe.id === request.probeId)!;

  return {
    probe: probe,
    requestIndex: request.requestIndex,
    response: request.response,
    check: request.check[0],
    checkResult: (request.check[1] < 0 ? 'FAIL' : 'OK') as 'FAIL' | 'OK',
    consecutiveEvent: Math.abs(request.check[1]),
  };
};

export type LastAlerts = Map<string, 'FAIL' | 'OK'>;

// There is a side effect of lastAlerts mutation here
// TODO: refactor to remove side effect
export const shouldSendAlert = (lastAlerts: LastAlerts) => (
  alert: ReturnType<typeof createAlert>
) => {
  const key = `${alert.probe.id}_${alert.requestIndex}_${alert.check[0]}`;

  const lastAlert = lastAlerts.get(key);

  const shouldSend =
    (alert.checkResult === 'FAIL' &&
      alert.probe.incidentThreshold === alert.consecutiveEvent &&
      lastAlert !== 'FAIL') ||
    (alert.checkResult === 'OK' &&
      alert.probe.recoveryThreshold === alert.consecutiveEvent &&
      lastAlert === 'FAIL');

  if (shouldSend) {
    lastAlerts.set(key, alert.checkResult);
  }

  return shouldSend;
};
