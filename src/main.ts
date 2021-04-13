import chokidar from 'chokidar';
import { fromEvent, merge, of, combineLatest, timer, Subject } from 'rxjs';
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
import { countChecks, probe } from './probe';

export const main = (filepath: string) => {
  const configFileWatcher = chokidar.watch(filepath);

  const configSubject = new Subject<ReturnType<typeof parse>>();

  const config$ = merge(
    fromEvent<[string]>(configFileWatcher, 'add').pipe(pluck(0)),
    fromEvent<string>(configFileWatcher, 'change')
  ).pipe(
    map(parse),
    tap(() => {
      console.log(
        'New configuration file detected, starting with new config...'
      );
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

  const checksRecord = new Map<string, Record<string, number>>();

  config$.subscribe(() => checksRecord.clear());

  const requestSubject = new Subject<{
    probeId: string;
    requestIndex: number;
    response: Response<any> | null;
    checks: Record<string, number>; // number of consecutive OK or FAILURE
  }>();

  const request$ = config$.pipe(
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
    switchMap(probe),
    map(countChecks(checksRecord)),
    multicast(requestSubject),
    refCount()
  );

  request$.subscribe((result) => {
    console.log(_.omit(result, 'response'));
  });
};
