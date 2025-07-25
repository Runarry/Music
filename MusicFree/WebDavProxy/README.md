## MusicFree WebDAV 代理版
部分WebDav跨域问题无法解决，最后只好使用粗暴的解决方案 - 使用代理地址。脚本只考虑自用，因此鉴请注意**重要提示**中的内容。

- webdav.js 脚本是在MusicFree作者提供的原始WebDAV插件基础上修改的，增加了请求代理地址。
- cloudflare_worker.js 是我使用cloudflare worker部署代理的脚本，如果你在非中国地区，它既免费又好用。
- nodejs_proxy.js 通用的nodejs代理脚本。

---
**重要提示**：
- 脚本支持加密传输鉴权信息（可选）
- 如果不设置加密密钥，将使用明文传输（兼容旧版本）
- 建议为安全起见，设置加密密钥或确保WebDAV只有只读权限

### 加密功能说明

#### WebDAV插件配置
在MusicFree的WebDAV插件设置中，新增了"加密密钥"字段：
- 如果设置了加密密钥，鉴权信息将使用AES-256-CBC加密后传输
- 如果不设置（留空），将使用原始的明文传输方式

#### 代理服务器配置
使用Docker部署时，需要在docker-compose.yml中设置相同的加密密钥：

```yaml
environment:
  - PORT=3000
  - ENCRYPTION_KEY=your-secret-key-here  # 必须与插件中的加密密钥一致
```

或者直接运行Node.js脚本时：
```bash
ENCRYPTION_KEY=your-secret-key-here node nodejs_proxy.js
```

**注意**：代理服务器和WebDAV插件必须使用相同的加密密钥，否则无法正确解密鉴权信息。