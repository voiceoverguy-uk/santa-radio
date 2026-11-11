import account from '../server/message-account.js';
export default function expiry(req,res){req.url='/api/my-santa-messages?action=cleanup';req.query={action:'cleanup'};return account(req,res)}
