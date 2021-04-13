import { Observable } from 'rxjs';
import { ProbeOptions } from './config';
import { renderTemplate } from './helpers/string';
import { httpRequest, Response } from './httpRequest';

type ProbeResult = {
  probeId: string;
  requestIndex: number;
  response: Response<any> | null;
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
        const checks = checkResponse(checkList, response);

        subscriber.next({
          probeId: id,
          requestIndex: i,
          response: response,
          checks,
        });

        if (!response || Object.values(checks).some((v) => v === false)) break;

        responses.push(response);
      }
      subscriber.complete();
    })();
  });
};

export const countChecks = (
  checksRecord: Map<string, Record<string, number>>
) => (response: ProbeResult) => {
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

export const checkResponse = (
  checks: Record<string, string>,
  response: Response<any> | null
) => {
  let responseChecks: Array<[string, boolean]> | null = null;
  if (response) {
    responseChecks = Object.entries(checks).map(([k, v]) => [
      k,
      renderTemplate(v, { $: response }) === 'true' ? true : false,
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
