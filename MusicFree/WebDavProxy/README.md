## MusicFree WebDAV 代理版
部分WebDav跨域问题无法解决，最后只好使用粗暴的解决方案 - 使用代理地址。脚本只考虑自用，因此鉴请注意**重要提示**中的内容。

- webdav.js 脚本是在MusicFree作者提供的原始WebDAV插件基础上修改的，增加了请求代理地址。
- cloudflare_worker.js 是我使用cloudflare worker部署代理的脚本。

---
**重要提示**：脚本中WebDAV鉴权信息为明文传输，没有加密，而我个人WebDAV设置了只读权限，懒得加。