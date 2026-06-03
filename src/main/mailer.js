/**
 * mailer.js
 *
 * Thin wrapper around nodemailer for sending transactional email
 * (currently: TOTP enrollment QR codes to newly registered users).
 *
 * SMTP settings are read from the app config / environment:
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 465 (SSL) or 587 (STARTTLS)
 *   SMTP_SECURE     "true" for port 465, "false" for 587
 *   SMTP_USER       full email/login
 *   SMTP_PASS       password or app-password
 *   SMTP_FROM       optional "Name <addr>" override; defaults to SMTP_USER
 *
 * If SMTP is not configured, sendTotpQrEmail returns { ok:false, reason }
 * rather than throwing, so the enrollment flow never breaks because of
 * mail issues.
 */

const nodemailer = require('nodemailer');

let _transporter = null;
let _configSignature = null;

function readSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 0) || 587,
    secure: /^(1|true|yes)$/i.test(String(process.env.SMTP_SECURE || '')),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };
}

function isConfigured() {
  const c = readSmtpConfig();
  return Boolean(c.host && c.user && c.pass);
}

function getTransporter() {
  const c = readSmtpConfig();
  if (!c.host || !c.user || !c.pass) return null;
  const signature = [c.host, c.port, c.secure, c.user, c.pass].join('|');
  if (_transporter && _configSignature === signature) return _transporter;
  _transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  _configSignature = signature;
  return _transporter;
}

/**
 * Send a TOTP enrollment email with the QR code embedded inline.
 *
 * @param {object} opts
 * @param {string} opts.to        recipient email address
 * @param {string} opts.username  account username (shown in the email)
 * @param {string} opts.fullName  display name (optional)
 * @param {string} opts.secret    base32 TOTP secret (shown as manual entry)
 * @param {string} opts.qrCodeDataUrl  data:image/png;base64,... QR image
 * @returns {Promise<{ok:boolean, messageId?:string, reason?:string}>}
 */
async function sendTotpQrEmail(opts) {
  const o = opts || {};
  const to = String(o.to || '').trim();
  if (!to) return { ok: false, reason: 'no-recipient' };
  if (!isConfigured()) return { ok: false, reason: 'smtp-not-configured' };

  const transporter = getTransporter();
  if (!transporter) return { ok: false, reason: 'smtp-not-configured' };

  const cfg = readSmtpConfig();
  const username = String(o.username || '').trim();
  const fullName = String(o.fullName || '').trim();
  const secret = String(o.secret || '').trim();
  const qrDataUrl = String(o.qrCodeDataUrl || '');

  // Convert data URL to a CID attachment so it renders inline in the email.
  let attachments = [];
  let qrImgHtml = '';
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(qrDataUrl);
  if (m) {
    attachments.push({
      filename: 'totp-qr.png',
      content: Buffer.from(m[2], 'base64'),
      contentType: m[1],
      cid: 'totpqr@apollo',
      contentDisposition: 'inline',
    });
    qrImgHtml = '<img src="cid:totpqr@apollo" alt="TOTP QR Code" width="220" height="220" style="display:block;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;" />';
  }

  const greeting = fullName ? ('Hello ' + escapeHtml(fullName) + ',') : 'Hello,';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">' +
    '<h2 style="color:#1e293b;">APOLLO Personnel Database</h2>' +
    '<p>' + greeting + '</p>' +
    '<p>An account has been created for you. To finish setting up two-factor authentication, ' +
    'scan the QR code below with an authenticator app (Google Authenticator, Authy, etc.).</p>' +
    (username ? '<p><strong>Username:</strong> ' + escapeHtml(username) + '</p>' : '') +
    '<div style="text-align:center;margin:20px 0;">' + qrImgHtml + '</div>' +
    (secret ? '<p style="font-size:13px;color:#475569;">If you cannot scan the code, enter this key manually:<br/>' +
      '<code style="font-size:15px;background:#f1f5f9;padding:6px 10px;border-radius:6px;display:inline-block;margin-top:6px;letter-spacing:1px;">' +
      escapeHtml(secret) + '</code></p>' : '') +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />' +
    '<p style="font-size:12px;color:#94a3b8;">This message contains sensitive security information. ' +
    'Do not forward it. If you did not expect this email, contact your administrator.</p>' +
    '</div>';

  const text =
    (fullName ? 'Hello ' + fullName + ',\n\n' : 'Hello,\n\n') +
    'An account has been created for you in the APOLLO Personnel Database.\n' +
    (username ? 'Username: ' + username + '\n' : '') +
    'Set up two-factor authentication by scanning the attached QR code with an authenticator app.\n' +
    (secret ? 'Manual entry key: ' + secret + '\n' : '') +
    '\nThis message contains sensitive security information. Do not forward it.';

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: to,
      subject: 'Your APOLLO account — set up two-factor authentication',
      text: text,
      html: html,
      attachments: attachments,
    });
    return { ok: true, messageId: info && info.messageId };
  } catch (e) {
    return { ok: false, reason: (e && e.message) ? e.message : String(e) };
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a one-time login code (email-OTP fallback). This is a SEPARATE,
 * short-lived random code — NOT the user's TOTP secret/code.
 *
 * @param {object} opts
 * @param {string} opts.to        recipient email
 * @param {string} opts.code      6-digit code
 * @param {string} opts.username  account username (optional)
 * @param {string} opts.fullName  display name (optional)
 * @param {number} opts.ttlMinutes minutes until expiry (for the email copy)
 * @returns {Promise<{ok:boolean, messageId?:string, reason?:string}>}
 */
async function sendLoginCodeEmail(opts) {
  const o = opts || {};
  const to = String(o.to || '').trim();
  if (!to) return { ok: false, reason: 'no-recipient' };
  if (!isConfigured()) return { ok: false, reason: 'smtp-not-configured' };

  const transporter = getTransporter();
  if (!transporter) return { ok: false, reason: 'smtp-not-configured' };

  const cfg = readSmtpConfig();
  const code = String(o.code || '').trim();
  const fullName = String(o.fullName || '').trim();
  const username = String(o.username || '').trim();
  const ttl = Number(o.ttlMinutes || 5);

  const greeting = fullName ? ('Hello ' + escapeHtml(fullName) + ',') : 'Hello,';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">' +
    '<h2 style="color:#1e293b;">APOLLO Personnel Database</h2>' +
    '<p>' + greeting + '</p>' +
    '<p>Use the following one-time code to finish signing in' +
    (username ? ' as <strong>' + escapeHtml(username) + '</strong>' : '') + ':</p>' +
    '<div style="text-align:center;margin:24px 0;">' +
    '<span style="font-size:30px;letter-spacing:8px;font-weight:700;background:#f1f5f9;padding:14px 22px;border-radius:10px;display:inline-block;">' +
    escapeHtml(code) + '</span>' +
    '</div>' +
    '<p style="font-size:13px;color:#475569;">This code expires in ' + ttl + ' minutes. ' +
    'If you did not try to sign in, ignore this email and consider changing your password.</p>' +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />' +
    '<p style="font-size:12px;color:#94a3b8;">Never share this code with anyone.</p>' +
    '</div>';

  const text =
    (fullName ? 'Hello ' + fullName + ',\n\n' : 'Hello,\n\n') +
    'Your one-time login code is: ' + code + '\n' +
    'It expires in ' + ttl + ' minutes.\n\n' +
    'If you did not try to sign in, ignore this email.';

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: to,
      subject: 'Your APOLLO login code: ' + code,
      text: text,
      html: html,
    });
    return { ok: true, messageId: info && info.messageId };
  } catch (e) {
    return { ok: false, reason: (e && e.message) ? e.message : String(e) };
  }
}

module.exports = {
  isConfigured,
  sendTotpQrEmail,
  sendLoginCodeEmail,
};
