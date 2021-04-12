import _ from 'lodash';

_.templateSettings.interpolate = /{{([\s\S]+?)}}/g;

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
    return _.template(val)(data);
  }

  return val;
};
