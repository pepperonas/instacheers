document.getElementById('open').addEventListener('click', async () => {
  const status = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https:\/\/(www\.)?instagram\.com\//.test(tab.url || '')) throw new Error('Open Instagram in the active tab first.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.__cheersMateV3?.show()});
    window.close();
  } catch (error) { status.textContent = error.message; }
});
