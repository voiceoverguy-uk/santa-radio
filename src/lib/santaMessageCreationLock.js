const LOCK_NAME = 'santa-message-creation';
const LEASE_MS = 180000;

// Web Locks serialize tabs without persisting a running request. Older browsers
// use a short IndexedDB lease; a late response cannot commit after losing it.
async function leaseLock(browser, action) {
  if (!browser.indexedDB) throw new Error('Your browser can’t coordinate message creation. Please allow browser storage or try another browser.');
  const db = await new Promise((resolve, reject) => {
    const request = browser.indexedDB.open(LOCK_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('locks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Your browser can’t coordinate message creation. Please allow browser storage or try another browser.'));
    request.onblocked = () => reject(new Error('Please close other message tabs and try again.'));
  });
  const token = browser.crypto.randomUUID();
  const transact = callback => new Promise((resolve, reject) => {
    const transaction = db.transaction('locks', 'readwrite');
    const table = transaction.objectStore('locks');
    const request = table.get(LOCK_NAME);
    let result, failure;
    request.onsuccess = () => {
      try { result = callback(request.result, table); }
      catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = transaction.onerror = () => reject(failure || new Error('Your browser could not remember this request. Please try again.'));
  });
  try {
    await transact((lease, table) => {
      if (lease && lease.expiresAt > Date.now()) throw new Error('Another message is being created in this browser. Please wait for it to finish.');
      table.put({ token, expiresAt: Date.now() + LEASE_MS }, LOCK_NAME);
    });
    return await action(commit => transact(lease => {
      if (lease?.token !== token || lease.expiresAt <= Date.now()) {
        throw new Error('This request took too long. Please try creating the message again.');
      }
      return commit();
    }));
  } finally {
    try {
      await transact((lease, table) => {
        if (lease?.token === token) table.delete(LOCK_NAME);
      });
    } catch {
      // A blocked cleanup must not turn a committed success into a failure.
      // The lease is bounded and can be replaced after its three-minute expiry.
    } finally { db.close(); }
  }
}

export async function withMessageCreationLock(browser, persistent, action) {
  if (!persistent) return action(commit => commit());
  if (browser.navigator.locks?.request) {
    return browser.navigator.locks.request(LOCK_NAME, { ifAvailable: true }, lock => {
      if (!lock) throw new Error('Another message is being created in this browser. Please wait for it to finish.');
      return action(commit => commit());
    });
  }
  return leaseLock(browser, action);
}
