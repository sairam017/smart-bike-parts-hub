const nodemailer = require('nodemailer');
/**
 * Send an email (supports text and html)
 * @param {string} to
 * @param {string} subject
 * @param {string} [text]
 * @param {string} [html]
 */
const sendEmail = async (to, subject, text, html) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"Smart Bike Parts Hub" <${process.env.EMAIL_USER}>`,
    to,
    subject,
  };
  if (text) mailOptions.text = text;
  if (html) mailOptions.html = html;

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;