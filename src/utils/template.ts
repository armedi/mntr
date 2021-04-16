import { render } from 'micromustache';

export const renderTemplate = (
  val: unknown,
  data: Record<string, unknown>
): any => {
  if (Array.isArray(val)) {
    return val.map((v) => renderTemplate(v, data));
  }

  if (typeof val === 'object' && val !== null) {
    return Object.entries(val).reduce((acc, [k, v]) => {
      acc[k] = renderTemplate(v, data);
      return acc;
    }, {} as Record<string, unknown>);
  }

  if (typeof val === 'string') {
    return render(val, data);
  }

  return val;
};

export const evaluate = (expr: string): boolean => {
  // TODO: change to safe evaluation which only evaluate simple comparation
  // allowed operators: <, <=, ==, >, >=

  return eval(expr);
};
