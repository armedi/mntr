import _ from 'lodash';
import { Alert } from './alert';
import { NotificationOptions, IFTTTWebhook } from './config';
import { httpRequest } from './utils/httpRequest';

export { NotificationOptions } from './config';

export const sendNotifications = (
  notifications: NotificationOptions[],
  alert: Alert
) => {
  notifications.forEach((notif) => {
    if (notif.type === 'ifttt-webhook') {
      postIFTTTwebhook(notif, alert);
    } else if (notif.type === 'webhook') {
      httpRequest({ ...notif.request, json: _.omit(alert, 'response') });
    }
  });
};

const postIFTTTwebhook = (iftttOption: IFTTTWebhook, alert: Alert) => {
  const { check, checkResult, probe, requestIndex, consecutiveEvent } = alert;
  const request = probe.requests[requestIndex];

  const requestInfo = `probe id : ${probe.id} <br>
probe name : ${probe.name || '-'} <br>
request : #${requestIndex + 1} ${request.method.toUpperCase()} ${
    probe.requests[requestIndex].url
  } <br>`;

  const title =
    checkResult === 'FAIL'
      ? `INCIDENT: ${check}' failure on probe '${probe.id}' request #${
          requestIndex + 1
        }`
      : `RECOVERY: probe '${probe.id}' request #${
          requestIndex + 1
        } has recovered from '${check}' failure`;

  const body =
    checkResult === 'FAIL'
      ? `The following request has failed '${check}' check ${consecutiveEvent} time${
          consecutiveEvent > 1 ? 's' : ''
        } in a row <br><br>

${requestInfo}
`
      : `The following request has recovered from '${check}' check failure with ${consecutiveEvent} time${
          consecutiveEvent > 1 ? 's' : ''
        } OK result in a row <br><br>

${requestInfo}
`;

  return httpRequest({
    method: 'POST',
    url: iftttOption.request.url,
    json: {
      value1: title,
      value2: body,
      value3: '',
    },
  });
};
