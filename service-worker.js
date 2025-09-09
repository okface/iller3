const CACHE_NAME = 'medq-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './data/questions.yaml',
  './assets/icon.svg',
  './manifest.webmanifest'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=> c.addAll(CORE_ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{
        if(res.ok && e.request.method==='GET'){
          const copy = res.clone();
            caches.open(CACHE_NAME).then(c=> c.put(e.request, copy));
        }
        return res;
      }).catch(()=> cached))
    );
  }
});
