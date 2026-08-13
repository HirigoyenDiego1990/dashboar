self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
});

self.addEventListener('fetch', (event) => {
  // Aquí podrías añadir lógica para caché offline si lo deseas
  event.respondWith(fetch(event.request));
});