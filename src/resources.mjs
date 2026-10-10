const pending = new Map();
function resource(url, create) {
  if (!pending.has(url)) pending.set(url, new Promise((resolve, reject) => {
    const element = create();
    element.onload = () => resolve(element);
    element.onerror = () => { element.remove(); pending.delete(url); reject(Error('资源加载失败，请重试。')); };
    document.head.append(element);
  }));
  return pending.get(url);
}
export const loadStyle = url => resource(url, () => {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; return link;
});
export const loadScript = url => resource(url, () => {
  const script = document.createElement('script'); script.src = url; script.async = true; return script;
});
export function retryable(factory) {
  let result;
  return () => result ??= factory().catch(error => { result = undefined; throw error; });
}
