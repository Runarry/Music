/**
 * cloudflare worker webdav代理脚本
 */

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const { searchParams } = new URL(request.url)
    const rawUrl = searchParams.get('url')
    if (!rawUrl) return new Response('Missing url param', { status: 400 })

    let upstreamUrl
    try {
        upstreamUrl = new URL(rawUrl)
        if (!/^https?:$/.test(upstreamUrl.protocol)) throw new Error('Invalid protocol')
    } catch (e) {
        return new Response('Invalid url', { status: 400 })
    }

    // 手动加 Authorization 头
    const headers = new Headers()
    for (const h of ['Range', 'Accept', 'User-Agent']) {
        if (request.headers.has(h)) headers.set(h, request.headers.get(h))
    }

    if (upstreamUrl.username && upstreamUrl.password) {
        const basic = btoa(`${upstreamUrl.username}:${upstreamUrl.password}`)
        headers.set('Authorization', `Basic ${basic}`)
        // 去掉url中的用户名密码（以防止某些fetch实现不安全处理）
        upstreamUrl.username = ''
        upstreamUrl.password = ''
    }

    const upstreamResp = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers,
        redirect: 'follow'
    })

    const respHeaders = new Headers(upstreamResp.headers)
    respHeaders.set('Access-Control-Allow-Origin', '*')
    respHeaders.set('Access-Control-Allow-Headers', '*')
    respHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
    respHeaders.set('Access-Control-Expose-Headers', '*')

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: respHeaders })
    }
    return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers: respHeaders
    })
}