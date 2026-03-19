const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendPasswordResetEmail(toEmail, resetLink, fullName) {
  const firstName = fullName ? fullName.split(' ')[0] : 'there';
  await transporter.sendMail({
    from: `"SSA — Screen Share App" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your SSA password',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/></head>
      <body style="margin:0;padding:0;background:#07070d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070d;padding:40px 20px;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#0e0e1a;border:1px solid #1e1e32;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e32;">
                  <span style="font-size:32px;font-weight:800;color:#5b5ef4;">S</span><span style="font-size:32px;font-weight:800;color:#e8e8f5;">SA</span>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 40px;">
                  <h1 style="color:#e8e8f5;font-size:22px;font-weight:700;margin:0 0 12px;">Hi ${firstName}!</h1>
                  <p style="color:#9090b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
                    We received a request to reset your SSA password.<br/>
                    Click the button below — this link expires in <strong style="color:#e8e8f5;">1 hour</strong>.
                  </p>
                  <a href="${resetLink}"
                     style="display:inline-block;background:#5b5ef4;color:white;text-decoration:none;
                            padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
                    Reset my password
                  </a>
                  <p style="color:#5a5a80;font-size:13px;margin:28px 0 0;line-height:1.6;">
                    If you didn't request this, ignore this email — your password won't change.<br/><br/>
                    Or copy this link:<br/>
                    <span style="color:#7c7ff7;word-break:break-all;">${resetLink}</span>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 40px;border-top:1px solid #1e1e32;">
                  <p style="color:#3a3a60;font-size:12px;margin:0;">SSA — Screen Share Application</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
