// sw.js — Service Worker
// Intercepta requisições para /proxy-stream
// Busca o stream real, serve os bytes como video/mp4
// O Chrome vê só "video/mp4" e não questiona o formato

const STREAM_URL = 'http://46.151.196.223:14432/';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Intercepta apenas /proxy-stream
  if (url.pathname !== '/proxy-stream') return;

  event.respondWith(fetchStream());
});

async function fetchStream() {
  try {
    const response = await fetch(STREAM_URL, {
      method: 'GET',
      headers: {
        // Finge ser um cliente de vídeo comum
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
      },
      // mode: 'no-cors' se o servidor não tiver CORS — recebe bytes opacos
      mode: 'cors',
    });

    // Pega o body como stream de bytes
    const reader  = response.body.getReader();
    const stream  = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { controller.close(); break; }
          controller.enqueue(value);
        }
      }
    });

    // Serve os bytes com Content-Type video/mp4
    // Chrome acredita que é MP4 e passa para o decodificador
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      }
    });

  } catch (e) {
    // Se CORS falhar, tenta no-cors (bytes opacos)
    try {
      const r = await fetch(STREAM_URL, { mode: 'no-cors' });
      const body = await r.blob();

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (e2) {
      return new Response('Erro: ' + e2.message, { status: 500 });
    }
  }
}
