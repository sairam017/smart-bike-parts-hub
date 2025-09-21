const twilio = require('twilio');

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_MESSAGING_SERVICE_SID, DEFAULT_COUNTRY_CODE = '+91', APP_NAME } = process.env;
let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const maskedSid = TWILIO_ACCOUNT_SID.slice(0,4) + '...' + TWILIO_ACCOUNT_SID.slice(-4);
    console.log(`[SMS] Twilio client initialized for ${maskedSid} (MSID:${TWILIO_MESSAGING_SERVICE_SID? 'yes':'no'} FROM:${TWILIO_FROM_NUMBER? 'yes':'no'})`);
  } catch (e) {
    console.warn('Failed to init Twilio client:', e.message);
  }
} else {
  console.warn('[SMS] Twilio credentials missing (SID or AUTH TOKEN not set).');
}

function normalizePhone(raw){
  if (!raw) return raw;
  let to = raw.trim();
  // If only digits and length 10 (likely local India mobile), prepend default country
  if (/^[0-9]{10}$/.test(to)) {
    to = `${DEFAULT_COUNTRY_CODE}${to}`;
  }
  // Ensure starts with +
  if (!to.startsWith('+') && DEFAULT_COUNTRY_CODE.startsWith('+')) {
    // Remove non-digits then prepend
    const digits = to.replace(/[^0-9]/g,'');
    to = DEFAULT_COUNTRY_CODE + digits;
  }
  return to;
}

async function sendSMS(to, body){
  // Prefix body with app name if provided and not already included
  if (APP_NAME && body && !body.startsWith(APP_NAME)) {
    body = `${APP_NAME}: ${body}`.slice(0, 1590); // keep under 1600 chars
  }
  if (!client) { return { ok:false, error:'Twilio not configured' }; }
  if (!to) { return { ok:false, error:'No destination phone provided' }; }
  const norm = normalizePhone(to);
  try {
    const params = { to: norm, body };
    if (TWILIO_MESSAGING_SERVICE_SID) {
      params.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    } else if (TWILIO_FROM_NUMBER) {
      params.from = TWILIO_FROM_NUMBER;
    } else {
      return { ok:false, error:'No FROM or Messaging Service configured' };
    }
  const resp = await client.messages.create(params);
  return { ok:true, to: norm, sid: resp.sid };
  } catch (e) {
    // If messaging service failed and we have a from number, retry once using from
    if (TWILIO_MESSAGING_SERVICE_SID && TWILIO_FROM_NUMBER) {
      try {
        const retryParams = { to: norm, body, from: TWILIO_FROM_NUMBER };
        const retryResp = await client.messages.create(retryParams);
        return { ok:true, to: norm, sid: retryResp.sid, retry:true };
      } catch (e2) {
        return { ok:false, error: e2.message || e.message, code: e2.code || e.code };
      }
    }
    return { ok:false, error: e.message, code: e.code };
  }
}

module.exports = { sendSMS };
