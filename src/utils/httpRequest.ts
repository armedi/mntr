import got, { Options } from 'got';

export type { Response } from 'got';

export const httpRequest = (
  options: Pick<
    Options,
    | 'method'
    | 'url'
    | 'headers'
    | 'body'
    | 'json'
    | 'searchParams'
    | 'timeout'
    | 'followRedirect'
    | 'maxRedirects'
    | 'responseType'
  >
) => {
  return got(options);
};
