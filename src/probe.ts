import { Observable } from 'rxjs';
import { ProbeOptions } from './config';
import { evaluate, renderTemplate } from './utils/template';
import { httpRequest, Response } from './utils/httpRequest';

export { ProbeOptions } from './config';

export type ProbeResult = {
  probeId: string;
  requestIndex: number;
  response: {
    status_code: number;
    response_size: number;
    response_time?: number;
  } | null;
  checks: Record<string, boolean>;
};

export const probe = ({ id, requests }: ProbeOptions) => {
  return new Observable<ProbeResult>((subscriber) => {
    (async () => {
      let responses = [];

      for (let i = 0; i < requests.length; i++) {
        const { checks: checkList, ...rest } = requests[i];

        const requestOptions: typeof rest = renderTemplate(rest, {
          $$: responses,
        });
        const response = await httpRequest(requestOptions).catch(() => null);
        const response_ = response && {
          status_code: response.statusCode,
          response_size: response.rawBody.byteLength,
          response_time: response.timings.phases.total,
        };
        const checks = checkResponse(checkList, response_);

        subscriber.next({
          probeId: id,
          requestIndex: i,
          response: response_,
          checks,
        });

        if (!response || Object.values(checks).some((v) => v === false)) break;

        responses.push(response);
      }
      subscriber.complete();
    })();
  });
};

export type CountedChecks = ReturnType<ReturnType<typeof countChecks>>;
export type ChecksRecord = Map<string, Record<string, number>>;

// There is a side effect of checksRecord mutation here
// TODO: refactor to remove side effect
export const countChecks = (checksRecord: ChecksRecord) => (
  response: ProbeResult
) => {
  const key = `${response.probeId}_${response.requestIndex}`;

  if (!checksRecord.has(key)) {
    checksRecord.set(
      key,
      Object.keys(response.checks).reduce((acc, k) => {
        acc[k] = 0;
        return acc;
      }, {} as Record<string, number>)
    );
  }

  const checks = checksRecord.get(key)!;

  Object.entries(response.checks).forEach(([k, v]) => {
    // positif value is for consecutive OK
    // negative value is for consecutive FAILURE
    checks[k] = v ? Math.max(checks[k], 0) + 1 : Math.min(checks[k], 0) - 1;
  });

  return {
    ...response,
    checks: Object.assign({}, checks),
  };
};

const checkResponse = (
  checks: Record<string, string>,
  response: ProbeResult['response'] | null
) => {
  let responseChecks: Array<[string, boolean]> | null = null;
  if (response) {
    responseChecks = Object.entries(checks).map(([k, v]) => [
      k,
      evaluate(v, response),
    ]);

    return responseChecks.reduce((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {} as Record<keyof typeof checks, boolean>);
  } else {
    return Object.keys(checks).reduce((acc, k) => {
      acc[k] = false;
      return acc;
    }, {} as Record<keyof typeof checks, boolean>);
  }
};
