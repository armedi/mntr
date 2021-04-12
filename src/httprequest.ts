import got, { Options, Response } from 'got';
import { renderTemplate } from './helpers/string';

export const httprequest = (
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
