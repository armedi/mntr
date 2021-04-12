import chokidar from 'chokidar';
import {
  fromEvent,
  merge,
  of,
  combineLatest,
  timer,
  Observable,
  Subject,
} from 'rxjs';
import {
  map,
  catchError,
  pluck,
  mergeAll,
  switchMap,
  takeUntil,
  tap,
  startWith,
  multicast,
  refCount,
} from 'rxjs/operators';
import { ZodError } from 'zod';
import { Response } from 'got';
import _ from 'lodash';

import { parse, formatErrorMessage, emptyConfig } from './config';
import { checkResponse, httprequest } from './httprequest';
import { renderTemplate } from './helpers/string';

const configFileWatcher = chokidar.watch(process.env.MNTR_CONFIG_FILE!);

const configSubject = new Subject<ReturnType<typeof parse>>();
const config$ = merge(
  fromEvent<[string]>(configFileWatcher, 'add').pipe(pluck(0)),
  fromEvent<string>(configFileWatcher, 'change')
).pipe(
  map(parse),
  tap(() => {
    console.log('New configuration file detected, starting with new config...');
  }),
  catchError((err, caught) => {
    console.log('The provided config file is invalid. Please fix!');
    if (err instanceof ZodError) {
      console.log(formatErrorMessage(err));
    }
    return caught.pipe(startWith(emptyConfig));
  }),
  multicast(configSubject),
  refCount()
);

const response$ = config$.pipe(
  pluck('probes'),
  switchMap((probes) =>
    probes.map((probe) =>
      combineLatest([
        of(probe),
        timer(0, probe.interval).pipe(takeUntil(config$)),
      ])
    )
  ),
  mergeAll(),
  pluck(0),
  // do probing
  switchMap(({ id, requests }) => {
    return new Observable<{
      probeId: string;
      requestIndex: number;
      response: Response<any> | null;
      checks: Record<string, boolean>;
    }>((subscriber) => {
      (async () => {
        let responses = [];

        for (let i = 0; i < requests.length; i++) {
          const { checks: checkList, ...rest } = requests[i];

          const requestOptions: typeof rest = renderTemplate(rest, {
            $$: responses,
          });
          const response = await httprequest(requestOptions).catch(() => null);
          const checks = checkResponse(checkList, response);

          subscriber.next({
            probeId: id,
            requestIndex: i,
            response: response,
            checks,
          });

          if (!response || Object.values(checks).some((v) => v === false))
            break;

          responses.push(response);
        }
        subscriber.complete();
      })();
    });
  })
);

const checksRecord = new Map<string, Record<string, number>>();
config$.subscribe(() => checksRecord.clear());

const checksRecord$ = response$.pipe(
  // record number of consecutive OK or FAILURE for each check condition
  map((response) => {
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
  })
);

checksRecord$.subscribe((result) => {
  console.log(_.omit(result, 'response'));
});
