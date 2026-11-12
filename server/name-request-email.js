import { databasePool } from './name-request-store.js';
import { openContact } from './name-request-contact.js';
const escape = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nameAvailableEmail(name,source) {
  const url=`https://www.santaradio.co.uk/${source==='paid'?'bespoke-personalised-message-from-santa':'free-santa-message'}`;
  const text=`Good news — ${name} is now available in Santa’s name library!\n\nYou asked us to add this name. Its recording has now been added, ready for you to create your message.\n\n${url}\n\nThis is a one-off update about your name request, not a marketing subscription.\nSanta Radio`;
  return {text,html:`<!doctype html><html lang="en"><body style="margin:0;background:#f2eee4;font-family:Arial,Helvetica,sans-serif;color:#173b2c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:white;border:1px solid #ddcfaa"><tr><td align="center" style="padding:28px;background:#10382a"><img src="https://www.santaradio.co.uk/images/santa-radio-logo.png" width="220" alt="Santa Radio" style="display:block;max-width:100%;height:auto"></td></tr><tr><td style="padding:28px"><h1 style="font-size:26px;line-height:1.3;margin:0 0 20px">${escape(name)} is now available!</h1><p style="font-size:16px;line-height:1.6">You asked Santa to add this name. Its recording is now in the library, ready for you to create your message.</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#a10c1c;color:white;padding:16px 22px;text-decoration:none;border-radius:8px;font-weight:bold">Open Santa’s message maker</a></p><p style="font-size:13px;line-height:1.6">${source==='paid'?'Use your existing Studio access or request a fresh access link using your purchase email. Your remaining message allowance is unchanged.':'Enter your details to return to the free message maker.'}</p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #ddcfaa;font-size:12px;line-height:1.6;color:#617167">A one-off update about your name request. This does not subscribe you to marketing.<br>Santa Radio · Christmas music, all year.</td></tr></table></td></tr></table></body></html>`};
}
export function nameRejectedEmail(name,source) {
  const url=`https://www.santaradio.co.uk/${source==='paid'?'bespoke-personalised-message-from-santa':'free-santa-message'}`;
  const explanation='We could not accept this request because it appears to include a surname. Santa’s name library accepts first names only, including double-barrelled first names written with a space or hyphen, such as Amelia Rose or Lily-Mae. Please return to the message maker, search for the first name on its own, and request it if it is missing. If your request was a double-barrelled first name, please contact us so we can review it. Your existing messages and remaining credits are unchanged.';
  return {subject:'An update about your Santa name request',text:`Your request: ${name}\n\n${explanation}\n\n${url}\n\nThis is a one-off update about your request, not a marketing subscription.\nSanta Radio`,html:`<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#173b2c"><h1>An update about your name request</h1><p>Your request: <strong>${escape(name)}</strong></p><p>${explanation}</p><p><a href="${url}">Return to Santa’s message maker</a></p><p>This is a one-off update about your request, not a marketing subscription.</p><p>Santa Radio</p></body></html>`};
}
export async function sendNameNotifications({pool=databasePool(),fetcher=fetch}={}) {
  if(!process.env.BREVO_API_KEY)return {pending:true};
  // Expire saved addresses after 90 days; completed addresses are erased immediately.
  await pool.query("DELETE FROM santa_name_request_notifications WHERE created_at < now()-interval '90 days'");
  const result=await pool.query(`WITH selected AS (
    SELECT n.request_key,n.recipient_key FROM santa_name_request_notifications n
    JOIN santa_name_requests r USING(request_key)
    WHERE n.state='pending' AND n.next_attempt_at<=now() AND ((n.notification_kind='available' AND r.recorded_at IS NOT NULL AND r.dismissed_at IS NULL) OR (n.notification_kind='rejected' AND r.dismissed_at IS NOT NULL))
    ORDER BY n.created_at LIMIT 10 FOR UPDATE OF n SKIP LOCKED
  ) UPDATE santa_name_request_notifications n SET state='sending',attempts=attempts+1
    FROM selected s WHERE n.request_key=s.request_key AND n.recipient_key=s.recipient_key
    RETURNING n.*,(SELECT name FROM santa_name_requests r WHERE r.request_key=n.request_key) AS name`);
  await Promise.all(result.rows.map(async row => {
    let state='review';
    try {
      const contact=openContact(row.contact);
      if(!contact?.email)throw new Error('CONTACT_UNAVAILABLE');
      const content=row.notification_kind==='rejected'?nameRejectedEmail(row.name,row.source):nameAvailableEmail(row.name,row.source);
      const response=await fetcher('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({sender:{name:'Santa Radio',email:'santa@santaradio.co.uk'},to:[{email:contact.email}],subject:content.subject || `${row.name} is now in Santa’s name library`,htmlContent:content.html,textContent:content.text}),signal:AbortSignal.timeout(10000)});
      state=response.ok?'sent':[401,403,429].includes(response.status)?'pending':'review';
    }catch { /* Ambiguous delivery is held for review rather than sending duplicates. */ }
    await pool.query(`UPDATE santa_name_request_notifications SET state=$3,
      contact=CASE WHEN $3='sent' THEN NULL ELSE contact END,
      sent_at=CASE WHEN $3='sent' THEN now() ELSE sent_at END,next_attempt_at=now()+interval '5 minutes'
      WHERE request_key=$1 AND recipient_key=$2`,[row.request_key,row.recipient_key,state]);
  }));
  return {processed:result.rowCount};
}
