// VLESS Proxy Script

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    let url = new URL(request.url);
    let response;

    // Configure your backend server
    let backendServer = 'https://your-backend-server.com';

    // Set up VLESS options
    let vlessOptions = {
        method: request.method,
        headers: { ...request.headers },
        body: request.body
    };

    // Fetch the response from the backend server
    response = await fetch(`${backendServer}${url.pathname}`, vlessOptions);

    // Modify response if needed
    let modifiedResponse = new Response(response.body, response);
    modifiedResponse.headers.set('X-Custom-Header', 'Hello from Cloudflare');

    return modifiedResponse;
}