import fs from 'fs';
import util from 'util';
import * as z from 'zod';
import { ZodError } from 'zod';

type Literal = boolean | null | number | string;
type Json = Literal | { [key: string]: Json } | Json[];

const jsonSchema: z.ZodSchema<Exclude<Json, Literal>> = z.lazy(() =>
  z.union([z.array(jsonSchema), z.record(jsonSchema)])
);

const methodSchema = z.enum([
  'get',
  'GET',
  'post',
  'POST',
  'put',
  'PUT',
  'patch',
  'PATCH',
  'delete',
  'DELETE',
  'options',
  'OPTIONS',
  'head',
  'HEAD',
  'TRACE',
  'trace',
]);

const requestOptionsSchema = z.object({
  method: methodSchema.default('GET'),
  url: z.string(),
  headers: z.record(z.string().or(z.string().array())).optional(),
  body: z.string().optional(),
  json: jsonSchema.optional(),
  searchParams: z.string().or(z.record(z.any())).optional(),
  timeout: z.number().optional(),
  followRedirect: z.boolean().optional(),
  maxRedirects: z.number().optional(),
  responseType: z.enum(['json', 'buffer', 'text']).optional(),
  checks: z.record(z.string()).default({}),
});

export type RequestOptions = z.infer<typeof requestOptionsSchema>;

const probeSchema = z.object({
  id: z.any().transform((val) => String(val)),
  name: z.string().optional(),
  description: z.string().optional(),
  interval: z.number().default(10),
  requests: requestOptionsSchema.array(),
});

export type Probe = z.infer<typeof probeSchema>;

const configSchema = z.object({
  probes: probeSchema.array(),
});

export type Config = z.infer<typeof configSchema>;

export const parse = (filepath: string) => {
  const json = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return configSchema.parse(json);
};

// TODO: create informative error messages
export const formatErrorMessage = (error: ZodError) => {
  return util.inspect(error.errors, false, null, true);
};
