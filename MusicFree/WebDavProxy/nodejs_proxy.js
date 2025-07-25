/**
 * Node.js 通用地址代理服务
 * 基于 Cloudflare Worker 脚本逻辑实现
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// 从环境变量获取加密密钥（可选）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-cbc';

// 解密函数
function decryptData(encryptedData, secretKey) {
    if (!secretKey || !encryptedData) {
        return null;
    }
    try {
        const key = crypto.createHash('sha256').update(secretKey).digest();
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('解密失败:', error);
        return null;
    }
}

/**
 * 处理代理请求
 */
async function handleRequest(req, res) {
    // 只允许 GET 和 HEAD 方法
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }

    // 解析请求 URL
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const rawUrl = requestUrl.searchParams.get('url');
    
    if (!rawUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing url param');
        return;
    }

    // 验证目标 URL
    let upstreamUrl;
    try {
        upstreamUrl = new URL(rawUrl);
        if (!/^https?:$/.test(upstreamUrl.protocol)) {
            throw new Error('Invalid protocol');
        }
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid url');
        return;
    }

    // 构建请求头
    const headers = {};
    const headersToForward = ['Range', 'Accept', 'User-Agent'];
    for (const h of headersToForward) {
        if (req.headers[h.toLowerCase()]) {
            headers[h] = req.headers[h.toLowerCase()];
        }
    }

    // 处理加密的鉴权信息
    const encryptedAuth = requestUrl.searchParams.get('auth');
    if (encryptedAuth && ENCRYPTION_KEY) {
        // 如果有加密的auth参数且配置了密钥，尝试解密
        const authData = decryptData(decodeURIComponent(encryptedAuth), ENCRYPTION_KEY);
        if (authData && authData.username && authData.password) {
            const basic = Buffer.from(`${authData.username}:${authData.password}`).toString('base64');
            headers['Authorization'] = `Basic ${basic}`;
        }
    } else if (upstreamUrl.username && upstreamUrl.password) {
        // 使用URL中的鉴权信息（未加密方式）
        const basic = Buffer.from(`${upstreamUrl.username}:${upstreamUrl.password}`).toString('base64');
        headers['Authorization'] = `Basic ${basic}`;
        // 清除 URL 中的用户名密码
        upstreamUrl.username = '';
        upstreamUrl.password = '';
    }

    // 设置 CORS 响应头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Expose-Headers': '*'
    };

    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // 选择协议模块
    const protocol = upstreamUrl.protocol === 'https:' ? https : http;
    
    // 构建请求选项
    const options = {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (upstreamUrl.protocol === 'https:' ? 443 : 80),
        path: upstreamUrl.pathname + upstreamUrl.search,
        method: req.method,
        headers: headers
    };

    // 发起代理请求
    const proxyReq = protocol.request(options, (proxyRes) => {
        // 合并响应头
        const responseHeaders = { ...proxyRes.headers, ...corsHeaders };
        
        // 发送响应头
        res.writeHead(proxyRes.statusCode, responseHeaders);
        
        // 管道传输响应体
        proxyRes.pipe(res);
    });

    // 错误处理
    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain', ...corsHeaders });
            res.end('Bad Gateway');
        }
    });

    // 设置超时
    proxyReq.setTimeout(30000, () => {
        proxyReq.abort();
        if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'text/plain', ...corsHeaders });
            res.end('Gateway Timeout');
        }
    });

    // 结束请求
    proxyReq.end();
}

// 创建 HTTP 服务器
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`代理服务器运行在端口 ${PORT}`);
    console.log(`使用方式: http://localhost:${PORT}/?url=<目标URL>`);
    if (ENCRYPTION_KEY) {
        console.log(`已启用加密模式`);
    } else {
        console.log(`未配置加密密钥，使用明文传输模式`);
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});