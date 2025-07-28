const UPDATE_URL = "";
const CryptoJS = require("crypto-js");

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_1 = require("webdav");
let cachedData = {};
function getClient() {
    var _a, _b, _c;
    const { url, username, password, searchPath } = (_b = (_a = env === null || env === void 0 ? void 0 : env.getUserVariables) === null || _a === void 0 ? void 0 : _a.call(env)) !== null && _b !== void 0 ? _b : {};
    if (!(url && username && password)) {
        return null;
    }
    if (!(cachedData.url === url &&
        cachedData.username === username &&
        cachedData.password === password &&
        cachedData.searchPath === searchPath)) {
        cachedData.url = url;
        cachedData.username = username;
        cachedData.password = password;
        cachedData.searchPath = searchPath;
        cachedData.searchPathList = (_c = searchPath === null || searchPath === void 0 ? void 0 : searchPath.split) === null || _c === void 0 ? void 0 : _c.call(searchPath, ",");
        cachedData.cacheFileList = null;
    }
    return (0, webdav_1.createClient)(url, {
        authType: webdav_1.AuthType.Password,
        username,
        password,
    });
}
async function searchMusic(query) {
    var _a, _b;
    const client = getClient();
    if (!cachedData.cacheFileList) {
        const searchPathList = ((_a = cachedData.searchPathList) === null || _a === void 0 ? void 0 : _a.length)
            ? cachedData.searchPathList
            : ["/"];
        let result = [];
        for (let search of searchPathList) {
            try {
                const fileItems = (await client.getDirectoryContents(search)).filter((it) => it.type === "file" && it.mime.startsWith("audio"));
                result = [...result, ...fileItems];
            }
            catch (_c) { }
        }
        cachedData.cacheFileList = result;
    }
    return {
        isEnd: true,
        data: ((_b = cachedData.cacheFileList) !== null && _b !== void 0 ? _b : [])
            .filter((it) => it.basename.includes(query))
            .map((it) => ({
                title: it.basename,
                id: it.filename,
                artist: "未知作者",
                album: "未知专辑",
            })),
    };
}
async function getTopLists() {
    getClient();
    const data = {
        title: "全部歌曲",
        data: (cachedData.searchPathList || []).map((it) => ({
            title: it,
            id: it,
        })),
    };
    return [data];
}
async function getTopListDetail(topListItem) {
    const client = getClient();
    const fileItems = (await client.getDirectoryContents(topListItem.id)).filter((it) => it.type === "file" && it.mime.startsWith("audio"));
    return {
        musicList: fileItems.map((it) => ({
            title: it.basename,
            id: it.filename,
            artist: "未知作者",
            album: "未知专辑",
        })),
    };
}
// 加密函数
function encryptData(data, secretKey) {
    if (!secretKey) {
        return null;
    }
    try {
        // 使用 SHA256 生成密钥
        const key = CryptoJS.SHA256(secretKey);
        // 生成随机 IV (16 字节)
        const iv = CryptoJS.lib.WordArray.random(16);
        
        // 加密数据
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        // 返回 IV + 加密数据的格式
        return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    } catch (error) {
        console.error('加密失败:', error);
        return null;
    }
}
    // 这里只做了改动
 async function getMediaSource(musicItem) {
        const client = getClient();
        const rawUrl = client.getFileDownloadLink(musicItem.id);
        // 从用户变量获取代理地址和加密密钥
        const { proxyUrl: workerProxy, encryptionKey } = env?.getUserVariables?.() ?? {};
        if (!workerProxy) {
            return {
                url: rawUrl,
            };
        }

        // 解析原始URL以提取鉴权信息
        const urlObj = new URL(rawUrl);

        // 如果提供了加密密钥，则使用加密方式
        if (encryptionKey) {
            const authData = {
                username: urlObj.username || '',
                password: urlObj.password || ''
            };

            // 清除URL中的鉴权信息
            urlObj.username = '';
            urlObj.password = '';
            const cleanUrl = urlObj.toString();

            // 加密鉴权信息
            const encryptedAuth = encryptData(authData, encryptionKey);

            if (encryptedAuth) {
                // 构建带有加密鉴权信息的代理URL
                const proxyUrl = `${workerProxy}/?url=${encodeURIComponent(cleanUrl)}&auth=${encodeURIComponent(encryptedAuth)}`;
                return {
                    url: proxyUrl,
                };
            }
        }

        // 如果没有加密密钥或加密失败，使用原始URL方式
        const proxyUrl = `${workerProxy}/?url=${encodeURIComponent(rawUrl)}`;
        return {
            url: proxyUrl,
        };
}

module.exports = {
    platform: "WebDAVProxy",
    author: "Runarry",
    description: "使用此插件前先配置用户变量",
    userVariables: [
        {
            key: "url",
            name: "WebDAV地址",
        },
        {
            key: "username",
            name: "用户名",
        },
        {
            key: "password",
            name: "密码",
            type: "password",
        },
        {
            key: "searchPath",
            name: "存放歌曲的路径",
        },
        {
            key: "proxyUrl",
            name: "代理链接"
        },
        {
            key: "encryptionKey",
            name: "加密密钥（可选）",
            type: "password"
        }
    ],
    version: "0.1.0",
    supportedSearchType: ["music"],
    srcUrl: UPDATE_URL,
    cacheControl: "no-cache",
    search(query, page, type) {
        if (type === "music") {
            return searchMusic(query);
        }
    },
    getTopLists,
    getTopListDetail,
    getMediaSource,

};