using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace GkMapWinForms
{
    /// <summary>
    /// 极简本地 HTTP 服务（基于 TcpListener，不经 http.sys，无需 urlacl 提权）。
    /// 作用：承载 React 构建产物，并提供 /api/upload、/api/file 供 WinForms ↔ JS 传递文件字节。
    /// 静态资源优先从嵌入资源（webroot.*）读取，其次从磁盘 _root 目录读取。
    /// </summary>
    public class LocalServer
    {
        private readonly TcpListener _listener;
        private readonly string _root;
        private readonly Dictionary<string, (byte[] data, string name)> _files = new();
        private readonly object _lock = new();
        private readonly Assembly _asm = typeof(LocalServer).Assembly;
        public int Port { get; private set; }

        public LocalServer(string root)
        {
            _root = root;
            _listener = new TcpListener(IPAddress.Loopback, 0);
        }

        public void Start()
        {
            _listener.Start();
            Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
            _ = AcceptLoop();
        }

        public void Stop() { try { _listener.Stop(); } catch { } }

        public Task<string> UploadAsync(string name, byte[] data, bool isBinary)
        {
            var token = Guid.NewGuid().ToString("N");
            lock (_lock) _files[token] = (data, name);
            return Task.FromResult(token);
        }

        private async Task AcceptLoop()
        {
            while (true)
            {
                TcpClient client;
                try { client = await _listener.AcceptTcpClientAsync(); }
                catch { break; }
                _ = HandleClient(client);
            }
        }

        private async Task HandleClient(TcpClient client)
        {
            using (client)
            using (var ns = client.GetStream())
            {
                try
                {
                    var req = await ReadRequest(ns);
                    if (req == null) return;
                    if (req.Method == "GET") await HandleGet(ns, req);
                    else if (req.Method == "POST") await HandlePost(ns, req);
                    else await SendStatus(ns, 405, "Method Not Allowed");
                }
                catch { }
            }
        }

        private async Task<HttpRequest> ReadRequest(NetworkStream ns)
        {
            var buf = new byte[4096];
            var ms = new MemoryStream();
            int total = 0;
            while (true)
            {
                int n = await ns.ReadAsync(buf, 0, buf.Length);
                if (n <= 0) return null;
                ms.Write(buf, 0, n);
                total += n;
                var arr = ms.ToArray();
                int idx = IndexOf(arr, 0, total, "\r\n\r\n");
                if (idx >= 0)
                {
                    string head = Encoding.ASCII.GetString(arr, 0, idx);
                    var lines = head.Split("\r\n");
                    var reqLine = lines[0].Split(' ');
                    if (reqLine.Length < 2) return null;
                    string method = reqLine[0];
                    string url = reqLine[1];
                    int contentLen = 0;
                    foreach (var l in lines)
                    {
                        if (l.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                            int.TryParse(l.Substring(15).Trim(), out contentLen);
                    }
                    byte[] body = null;
                    int headerEnd = idx + 4;
                    int bodyAvail = total - headerEnd;
                    if (contentLen > 0)
                    {
                        while (bodyAvail < contentLen)
                        {
                            int m = await ns.ReadAsync(buf, 0, buf.Length);
                            if (m <= 0) break;
                            ms.Write(buf, 0, m);
                            total += m;
                            bodyAvail = total - headerEnd;
                        }
                        body = new byte[contentLen];
                        Array.Copy(ms.ToArray(), headerEnd, body, 0, contentLen);
                    }
                    return new HttpRequest { Method = method, Url = url, Body = body };
                }
                if (total > (1 << 20)) return null;
            }
        }

        private static int IndexOf(byte[] arr, int start, int len, string pat)
        {
            var p = Encoding.ASCII.GetBytes(pat);
            for (int i = start; i <= len - p.Length; i++)
            {
                bool ok = true;
                for (int j = 0; j < p.Length; j++) if (arr[i + j] != p[j]) { ok = false; break; }
                if (ok) return i;
            }
            return -1;
        }

        private async Task HandleGet(NetworkStream ns, HttpRequest req)
        {
            if (req.Url.StartsWith("/api/file?", StringComparison.OrdinalIgnoreCase))
            {
                var q = ParseQuery(req.Url);
                if (q.TryGetValue("token", out var token))
                {
                    (byte[] data, string name) item;
                    lock (_lock) _files.TryGetValue(token, out item);
                    if (item.data != null) { await SendBytes(ns, 200, "application/octet-stream", item.data); return; }
                }
                await SendStatus(ns, 404, "Not Found");
                return;
            }
            string path = req.Url.Split('?')[0];
            if (path == "/" || path == "") path = "/index.html";
            string filePath = Path.GetFullPath(Path.Combine(_root, path.TrimStart('/')));
            string rootFull = Path.GetFullPath(_root);
            if (!filePath.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase)) { await SendStatus(ns, 403, "Forbidden"); return; }
            if (!File.Exists(filePath))
            {
                if (TryEmbedded(path, out var edata, out var ect)) { await SendBytes(ns, 200, ect, edata); return; }
                // SPA 回退：非 /api 的未知 GET 路径（如刷新后的子路径）统一返回 index.html，避免空白 404
                if (!req.Url.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                    && !Path.HasExtension(path)
                    && TryEmbedded("index.html", out var idxData, out var idxCt))
                { await SendBytes(ns, 200, idxCt, idxData); return; }
                filePath = Path.Combine(_root, "index.html");
                if (!File.Exists(filePath)) { await SendStatus(ns, 404, "Not Found"); return; }
            }
            byte[] content = File.ReadAllBytes(filePath);
            await SendBytes(ns, 200, MimeType(filePath), content);
        }

        private bool TryEmbedded(string vpath, out byte[] data, out string ct)
        {
            data = null;
            ct = "application/octet-stream";
            string rel = vpath.TrimStart('/');
            string relBack = rel.Replace('/', '\\');
            string[] names = { "webroot." + relBack, "webroot." + rel.Replace('/', '.') };
            foreach (var name in names)
            {
                using var s = _asm.GetManifestResourceStream(name);
                if (s != null)
                {
                    using var ms = new MemoryStream();
                    s.CopyTo(ms);
                    data = ms.ToArray();
                    ct = MimeType(relBack);
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// 把嵌入的 webroot.* 资源解压到磁盘目录（供单文件交付使用）。
        /// 若目标已存在 index.html 则直接复用，避免重复解压。
        /// </summary>
        public static string ExtractEmbeddedToDisk(string destDir)
        {
            try
            {
                if (File.Exists(Path.Combine(destDir, "index.html")))
                    return destDir;
                var asm = typeof(LocalServer).Assembly;
                bool any = false;
                foreach (var name in asm.GetManifestResourceNames())
                {
                    if (!name.StartsWith("webroot.", StringComparison.OrdinalIgnoreCase)) continue;
                    any = true;
                    string rel = name.Substring("webroot.".Length)
                        .Replace('\\', Path.DirectorySeparatorChar)
                        .Replace('/', Path.DirectorySeparatorChar);
                    string outPath = Path.Combine(destDir, rel);
                    Directory.CreateDirectory(Path.GetDirectoryName(outPath));
                    using var s = asm.GetManifestResourceStream(name);
                    if (s == null) continue;
                    using var fs = File.Create(outPath);
                    s.CopyTo(fs);
                }
                return any ? destDir : null;
            }
            catch (Exception ex)
            {
                Program.LogFatal("ExtractEmbeddedToDisk", ex);
                return null;
            }
        }

        private async Task HandlePost(NetworkStream ns, HttpRequest req)
        {
            if (req.Url.StartsWith("/api/upload", StringComparison.OrdinalIgnoreCase))
            {
                var q = ParseQuery(req.Url);
                string name = q.TryGetValue("name", out var n) ? n : "file.bin";
                string token = Guid.NewGuid().ToString("N");
                lock (_lock) _files[token] = (req.Body ?? Array.Empty<byte>(), name);
                string resp = "{\"token\":\"" + token + "\"}";
                await SendBytes(ns, 200, "application/json", Encoding.UTF8.GetBytes(resp));
                return;
            }
            await SendStatus(ns, 404, "Not Found");
        }

        private static Dictionary<string, string> ParseQuery(string url)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            int qi = url.IndexOf('?');
            if (qi < 0) return d;
            foreach (var pair in url.Substring(qi + 1).Split('&'))
            {
                if (string.IsNullOrEmpty(pair)) continue;
                var kv = pair.Split('=');
                string k = Uri.UnescapeDataString(kv[0]);
                string v = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : "";
                d[k] = v;
            }
            return d;
        }

        private static string MimeType(string path)
        {
            var ext = Path.GetExtension(path).ToLower();
            return ext switch
            {
                ".html" or ".htm" => "text/html; charset=utf-8",
                ".js" or ".mjs" => "application/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" or ".map" or ".geojson" => "application/json; charset=utf-8",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                ".ico" => "image/x-icon",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf" => "font/ttf",
                ".txt" or ".csv" => "text/plain; charset=utf-8",
                _ => "application/octet-stream"
            };
        }

        private async Task SendBytes(NetworkStream ns, int code, string contentType, byte[] body)
        {
            var header = $"HTTP/1.1 {code} OK\r\nContent-Type: {contentType}\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n";
            var hb = Encoding.ASCII.GetBytes(header);
            await ns.WriteAsync(hb, 0, hb.Length);
            await ns.WriteAsync(body, 0, body.Length);
            await ns.FlushAsync();
        }

        private async Task SendStatus(NetworkStream ns, int code, string msg)
        {
            await SendBytes(ns, code, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(msg));
        }

        private class HttpRequest
        {
            public string Method = "";
            public string Url = "";
            public byte[] Body = null;
        }
    }
}
