const fs = require('fs');
const nodemailer = require('nodemailer');

async function main() {
  if (!fs.existsSync('pending_email.json')) {
    console.log('No pending email.');
    return;
  }

  const hrs = JSON.parse(fs.readFileSync('pending_email.json', 'utf8'));

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  for (const hr of hrs) {
    const body = [
      '--- COPY FOR TWITTER ---',
      hr.text,
      '--- END ---',
      '',
      hr.videoUrl ? `Video clip: ${hr.videoUrl}` : '(No video clip available)',
    ].join('\n');

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `⚾️ HR: ${hr.playerName}`,
      text: body,
    });

    console.log('Email sent for', hr.playerName);
  }

  fs.unlinkSync('pending_email.json');
}

main().catch(e => { console.error('Email failed:', e.message); process.exit(1); });
