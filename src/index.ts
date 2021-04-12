import chokidar from 'chokidar';
import { fromEvent, merge, of, combineLatest, timer, Observable } from 'rxjs';
import {
  map,
  catchError,
  pluck,
  mergeAll,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { ZodError } from 'zod';
import { Response } from 'got';
import _ from 'lodash';

import { parse, formatErrorMessage } from './config';
import { checkResponse, httprequest } from './httprequest';
import { renderTemplate } from './helpers/string';

const configFileWatcher = chokidar.watch(process.env.CONFIG_FILE_PATH!);

const config$ = merge(
  fromEvent<[string]>(configFileWatcher, 'add').pipe(map(([path]) => path)),
  fromEvent<string>(configFileWatcher, 'change')
).pipe(
  map(parse),
  tap(() => {
    console.log(
      'New configuration file detected. Restarting with new config...'
    );
  }),
  catchError((err, caught) => {
    console.log('The provided config file is invalid');
    if (err instanceof ZodError) {
      console.log(formatErrorMessage(err));
    }
    console.log('Using previous valid configuration');
    return caught;
  })
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

response$.subscribe((result) => {
  // console.log(result);
  console.log(_.omit(result, 'response'));
});
