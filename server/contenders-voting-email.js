export function votingCodeEmail(code) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid voting code');
  const url='https://www.santaradio.co.uk/christmas-contenders';
  return {
    text:`Your Christmas Contenders voting code is ${code}.\n\nEnter it on the Santa Radio voting page within 15 minutes to confirm your chosen song. Your vote is not counted until you confirm.\n\n${url}\n\nOne vote per person. This does not subscribe you to marketing. If you did not request this code, ignore this email.\n\nSanta Radio`,
    html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Santa Radio voting code</title></head><body style="margin:0;padding:0;background:#f2eee4;color:#173b2c;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code to confirm your Christmas Contenders vote. Valid for 15 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2eee4;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #ddcfaa;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:30px 24px;background:#10382a;"><img src="https://www.santaradio.co.uk/images/santa-radio-logo.png" width="220" alt="Santa Radio" style="display:block;width:220px;max-width:100%;height:auto;border:0;color:#eed180;font-size:28px;"></td></tr>
<tr><td style="padding:32px 28px 28px;"><p style="margin:0 0 12px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#8a6426;">CHRISTMAS CONTENDERS</p><h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#173b2c;">Confirm your vote</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.6;">One small code. A little Christmas magic.<br>Enter this code on the voting page:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 8px;background:#f7f0dc;border:1px solid #dcc58b;border-radius:10px;font-family:'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:7px;line-height:1.3;color:#143c2d;">${code}</td></tr></table>
<p style="margin:20px 0 24px;font-size:14px;line-height:1.6;">This code expires in <strong>15 minutes</strong>.<br>Your vote counts once you enter it and confirm.</p>

<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#617167;">Return to the voting tab you already have open to enter your code. If you didn’t request a code, you can ignore this message.</p></td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e8dfc9;font-size:12px;line-height:1.6;color:#667168;">One vote per person. Voting does not subscribe you to marketing.<br><a href="https://www.santaradio.co.uk" style="color:#245540;">Santa Radio</a> · Christmas music, all year.</td></tr>
</table></td></tr></table></body></html>`
  };
}
