import chokidar from 'chokidar';
import { combineLatest, fromEvent, merge, of, Subject, timer } from 'rxjs';
import {
  catchError,
  filter,
  map,
  mergeAll,
  mergeMap,
  multicast,
  pluck,
  refCount,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { ZodError } from 'zod';
import _ from 'lodash';

import { Config, emptyConfig, formatErrorMessage, parse } from './config';
import { ChecksRecord, countChecks, CountedChecks, probe } from './probe';
import { createAlert, LastAlerts, shouldSendAlert } from './alert';
import { sendNotifications } from './notification';

export const main = (filepath: string) => {
  const configFileWatcher = chokidar.watch(filepath);

  const configSubject = new Subject<Config>();

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

  const checksRecord: ChecksRecord = new Map();
  config$.subscribe(() => checksRecord.clear());

  const requestSubject = new Subject<CountedChecks>();

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

  const lastAlerts: LastAlerts = new Map();
  config$.subscribe(() => lastAlerts.clear());

  const alert$ = request$.pipe(
    mergeMap((req) =>
      Object.entries(req.checks).map((check) => ({
        ..._.omit(req, 'checks'),
        check,
      }))
    ),
    withLatestFrom(config$.pipe(pluck('probes'))),
    map((args) => createAlert(...args)),
    filter(shouldSendAlert(lastAlerts))
  );

  alert$
    .pipe(withLatestFrom(config$.pipe(pluck('notifications'))))
    .subscribe((args) => {
      console.log(args[0]);
      sendNotifications(...args);
    });
};
