const ipcRenderer = window.$ipcRenderer;

const request = async (url, options) => {
  return await ipcRenderer.invoke('request', {
    url,
    method: 'get',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36' },
    ...options,
  });
};

export default request;
