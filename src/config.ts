import fs from 'fs';
import util from 'util';
import * as z from 'zod';
import { ZodError } from 'zod';

type Literal = boolean | null | number | string;
type Json = Literal | { [key: string]: Json } | Json[];

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonSchema: z.ZodSchema<Exclude<Json, Literal>> = z.lazy(() =>
  z.union([
    z.array(jsonSchema.or(literalSchema)),
    z.record(jsonSchema.or(literalSchema)),
  ])
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

const probeOptionsSchema = z.object({
  id: z.any().transform((val) => String(val)),
  name: z.string().optional(),
  description: z.string().optional(),
  interval: z.number().default(60000),
  requests: requestOptionsSchema.array(),
  incidentThreshold: z.number().default(3),
  recoveryThreshold: z.number().default(3),
});

export type ProbeOptions = z.infer<typeof probeOptionsSchema>;

const notificationOptionsSchema = z.object({
  id: z.any().transform((val) => String(val)),
  type: z.enum(['webhook']).default('webhook'),
  request: requestOptionsSchema.pick({
    method: true,
    url: true,
    headers: true,
    body: true,
    json: true,
    searchParams: true,
  }),
});

export type NotificationOptions = z.infer<typeof notificationOptionsSchema>;

const configSchema = z.object({
  probes: probeOptionsSchema.array().default([]),
  notifications: notificationOptionsSchema.array().default([]),
});

export type Config = z.infer<typeof configSchema>;

export const emptyConfig: Config = { probes: [], notifications: [] };

export const parse = (filepath: string) => {
  const json = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return configSchema.parse(json);
};

// TODO: create informative error messages
export const formatErrorMessage = (error: ZodError) => {
  return util.inspect(error.errors, false, null, true);
};
