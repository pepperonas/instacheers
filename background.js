const key = id => 'run:' + id;
chrome.runtime.onMessage.addListener((msg,sender,reply) => {
  if (!sender.tab || !['follow:get','follow:set'].includes(msg.type)) return;
  const k = key(sender.tab.id);
  (async () => {
    if(msg.type === 'follow:set') await chrome.storage.session.set({[k]:msg.state});
    reply((await chrome.storage.session.get(k))[k] || null);
  })().catch(error => reply({error:error.message}));
  return true;
});
chrome.tabs.onRemoved.addListener(id => chrome.storage.session.remove(key(id)));
