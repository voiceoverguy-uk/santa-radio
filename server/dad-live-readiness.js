import {verifyLiveOffer} from './dad-live-stripe.js';
import {liveStoreReady} from './dad-live-store.js';
import {studioAllowanceReady} from './dad-creation-allowance.js';
import {blobDadLibrary} from './blob-dad-library.js';
export async function studioLiveReadiness({config,stripe,pool}){
 await Promise.all([verifyLiveOffer(stripe,config),liveStoreReady(pool),studioAllowanceReady(pool)]);
 const library=await blobDadLibrary.load();if(!library||library.records.size!==233)throw Error('DAD_LIBRARY_NOT_READY');
 const endpoint=await stripe.webhookEndpoints.retrieve(config.webhookId);
 if(endpoint.status!=='enabled'||endpoint.url!==`${config.origin}/api/stripe/webhook`)throw Error('DAD_WEBHOOK_NOT_READY');
}
