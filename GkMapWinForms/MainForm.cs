using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace GkMapWinForms
{
    public class MainForm : Form
    {
        private MenuStrip menuStrip;
        private ToolStrip toolStrip;
        private StatusStrip statusStrip;
        private ToolStripStatusLabel statusLabel;
        private TreeView layerTree;
        private PropertyGrid propGrid;
        private WebView2 webView;
        private SplitContainer outerSplit;
        private SplitContainer rightSplit;
        private LocalServer server;
        private readonly Dictionary<string, string> layerNames = new();
        private bool suppressCheck = false;

        public MainForm()
        {
            Text = "广勘智图";
            Width = 1280;
            Height = 800;
            MinimumSize = new Size(900, 600);
            InitializeComponent();
            InitServer();
            _ = InitWebView();
        }

        private void InitializeComponent()
        {
            menuStrip = new MenuStrip();
            toolStrip = new ToolStrip();
            statusStrip = new StatusStrip();
            statusLabel = new ToolStripStatusLabel { Text = "就绪", Spring = true };
            statusStrip.Items.Add(statusLabel);

            // 图层树（左）
            layerTree = new TreeView { Dock = DockStyle.Fill, CheckBoxes = true, HideSelection = false, BorderStyle = BorderStyle.None };
            layerTree.AfterCheck += LayerTree_AfterCheck;
            layerTree.NodeMouseDoubleClick += (s, e) =>
            {
                if (e.Node?.Tag != null) _ = CallJs($"window.__gkApp && window.__gkApp.fit();");
            };

            // 属性面板（右）
            propGrid = new PropertyGrid { Dock = DockStyle.Fill, HelpVisible = false, ToolbarVisible = true, PropertySort = PropertySort.Categorized };
            propGrid.PropertyValueChanged += PropGrid_PropertyValueChanged;

            // 地图（中）
            webView = new WebView2 { Dock = DockStyle.Fill };

            rightSplit = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Vertical };
            rightSplit.Panel1.Controls.Add(webView);
            rightSplit.Panel2.Controls.Add(propGrid);
            rightSplit.FixedPanel = FixedPanel.Panel2;

            outerSplit = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Vertical };
            outerSplit.Panel1.Controls.Add(layerTree);
            outerSplit.Panel2.Controls.Add(rightSplit);
            outerSplit.FixedPanel = FixedPanel.Panel1;

            BuildMenu();
            BuildToolbar();

            Controls.Add(outerSplit);
            Controls.Add(toolStrip);
            Controls.Add(menuStrip);
            Controls.Add(statusStrip);

            Load += (s, e) =>
            {
                outerSplit.SplitterDistance = 220;
                if (rightSplit.Width > 320) rightSplit.SplitterDistance = rightSplit.Width - 300;
            };
        }

        private void BuildMenu()
        {
            var fileMenu = new ToolStripMenuItem("文件(&F)");
            fileMenu.DropDownItems.Add(new ToolStripMenuItem("打开(&O)...", null, (s, e) => OpenFile()));
            fileMenu.DropDownItems.Add(new ToolStripSeparator());
            fileMenu.DropDownItems.Add(new ToolStripMenuItem("导出 KML", null, (s, e) => ExportKml()));
            fileMenu.DropDownItems.Add(new ToolStripMenuItem("导出 GeoJSON", null, (s, e) => ExportGeoJson()));
            fileMenu.DropDownItems.Add(new ToolStripSeparator());
            fileMenu.DropDownItems.Add(new ToolStripMenuItem("退出(&X)", null, (s, e) => Close()));
            menuStrip.Items.Add(fileMenu);

            var viewMenu = new ToolStripMenuItem("视图(&V)");
            viewMenu.DropDownItems.Add(new ToolStripMenuItem("适应窗口", null, (s, e) => Fit()));
            viewMenu.DropDownItems.Add(new ToolStripMenuItem("放大", null, (s, e) => ZoomIn()));
            viewMenu.DropDownItems.Add(new ToolStripMenuItem("缩小", null, (s, e) => ZoomOut()));
            menuStrip.Items.Add(viewMenu);

            var helpMenu = new ToolStripMenuItem("帮助(&H)");
            helpMenu.DropDownItems.Add(new ToolStripMenuItem("关于", null, (s, e) =>
                MessageBox.Show("广勘智图 v1.0.0\nWinForms + WebView2 架构\n专业测绘看图软件", "关于广勘智图")));
            menuStrip.Items.Add(helpMenu);
        }

        private void BuildToolbar()
        {
            toolStrip.Items.Add(new ToolStripButton("打开", null, (s, e) => OpenFile()) { ToolTipText = "打开 DXF/ovobj 等" });
            toolStrip.Items.Add(new ToolStripButton("适应", null, (s, e) => Fit()) { ToolTipText = "适应窗口" });
            toolStrip.Items.Add(new ToolStripButton("放大", null, (s, e) => ZoomIn()));
            toolStrip.Items.Add(new ToolStripButton("缩小", null, (s, e) => ZoomOut()));
            toolStrip.Items.Add(new ToolStripSeparator());
            toolStrip.Items.Add(new ToolStripButton("导出KML", null, (s, e) => ExportKml()));
            toolStrip.Items.Add(new ToolStripButton("导出GeoJSON", null, (s, e) => ExportGeoJson()));
            toolStrip.Items.Add(new ToolStripSeparator());
            toolStrip.Items.Add(new ToolStripButton("关于", null, (s, e) =>
                MessageBox.Show("广勘智图 v1.0.0\nWinForms + WebView2 架构", "关于")));
        }

        private void InitServer()
        {
            string root = ResolveWebRoot();
            server = new LocalServer(root);
            server.Start();
            Debug.WriteLine("LocalServer on port " + server.Port + " root=" + root);
        }

        private string ResolveWebRoot()
        {
            // 1) 优先用磁盘 webroot（文件夹交付 / 开发场景）
            var candidates = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "webroot"),
                Path.Combine(AppContext.BaseDirectory, "react-app", "build"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "react-app", "build"),
                Path.Combine(AppContext.BaseDirectory, "..", "react-app", "build"),
            };
            foreach (var c in candidates)
            {
                var full = Path.GetFullPath(c);
                if (Directory.Exists(full)) return full;
            }
            // 2) 单文件交付：把嵌入的 webroot 解压到可写目录，由磁盘提供（最可靠）
            string appData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "GkMapWinForms", "webroot");
            string extracted = LocalServer.ExtractEmbeddedToDisk(appData);
            if (extracted != null) return extracted;
            // 3) 兜底：直接读嵌入资源（HandleGet 内的 TryEmbedded）
            return appData;
        }

        private async System.Threading.Tasks.Task InitWebView()
        {
            string userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "GkMapWinForms");
            Directory.CreateDirectory(userData);

            // 尝试最多 2 次：第 1 次正常初始化；失败后尝试引导安装 WebView2 再重试
            for (int attempt = 0; attempt < 2; attempt++)
            {
                try
                {
                    var env = await CoreWebView2Environment.CreateAsync(null, userData);
                    await webView.EnsureCoreWebView2Async(env);
                    Program.LogInfo("WebView2 初始化成功 (attempt=" + attempt + ")");
                    break; // 成功，跳出循环
                }
                catch (Exception ex)
                {
                    Program.LogFatal("InitWebView attempt=" + attempt, ex);
                    if (attempt == 0 && IsWebView2Missing(ex))
                    {
                        // 第 1 次失败且疑似缺运行时 → 引导安装
                        Program.LogInfo("检测到 WebView2 缺失，尝试自动安装...");
                        bool installed = await InstallWebView2Runtime();
                        if (!installed)
                        {
                            statusLabel.Text = "WebView2 缺失";
                            MessageBox.Show(
                                "未能初始化 WebView2（系统缺少 Microsoft Edge WebView2 运行时）。\n\n" +
                                "请手动安装：\n" +
                                "https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/\n\n" +
                                "原始错误：" + ex.Message + "\n\n日志已写入 GkMapWinForms.log。",
                                "广勘智图 - 错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            return;
                        }
                        // 安装成功 → 继续循环重试
                        continue;
                    }
                    // 非缺失类错误 / 已重试仍失败 → 弹框退出
                    statusLabel.Text = "WebView2 初始化失败";
                    MessageBox.Show(
                        "WebView2 初始化失败：\n" + ex.Message +
                        "\n\n日志已写入同目录 GkMapWinForms.log。",
                        "广勘智图 - 错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            if (webView?.CoreWebView2 == null) return;

            webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
            webView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
            webView.CoreWebView2.WebMessageReceived += OnWebMessage;
            webView.CoreWebView2.DownloadStarting += OnDownloadStarting;
            webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                if (!e.IsSuccess)
                {
                    string err = "页面加载失败：" + (e.WebErrorStatus.ToString());
                    Program.LogInfo(err + "  url=http://127.0.0.1:" + server.Port + "/");
                    statusLabel.Text = err;
                    MessageBox.Show(err + "\n\n请查看同目录 GkMapWinForms.log 获取详情。",
                        "广勘智图", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                else
                {
                    statusLabel.Text = "就绪";
                    Program.LogInfo("页面加载完成 (NavigationCompleted)");
                }
            };

            statusLabel.Text = "正在加载地图…";
            Program.LogInfo("Navigate -> http://127.0.0.1:" + server.Port + "/");
            webView.CoreWebView2.Navigate($"http://127.0.0.1:{server.Port}/");
        }

        /// <summary>
        /// 从微软官方下载 WebView2 引导程序并静默安装。
        /// 返回 true 表示安装成功（或已存在）。
        /// </summary>
        private async System.Threading.Tasks.Task<bool> InstallWebView2Runtime()
        {
            try
            {
                string tempDir = Path.GetTempPath();
                string installer = Path.Combine(tempDir, "MicrosoftEdgeWebview2Setup.exe");
                string logFile = Path.Combine(tempDir, "GkMap_WebView2_install.log");

                // 若引导程序已下载则跳过
                if (!File.Exists(installer))
                {
                    statusLabel.Text = "正在下载 WebView2 运行时...";
                    using var client = new System.Net.Http.HttpClient();
                    client.Timeout = TimeSpan.FromMinutes(3);
                    var bytes = await client.GetByteArrayAsync(
                        "https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                    File.WriteAllBytes(installer, bytes);
                    Program.LogInfo("WebView2 bootstrapper downloaded: " + installer);
                }

                // 静默安装（/silent /install）——引导程序会检测已有版本，不会重复安装
                statusLabel.Text = "正在安装 WebView2 运行时...";
                var psi = new ProcessStartInfo
                {
                    FileName = installer,
                    Arguments = "/silent /install",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                var proc = Process.Start(psi);
                if (proc != null)
                {
                    await proc.WaitForExitAsync(new CancellationTokenSource(120000).Token);
                    int code = proc.ExitCode;
                    Program.LogInfo("WebView2 installer exit code: " + code);
                    // ExitCode=0 成功；某些版本用其他成功码
                    if (code == 0 || IsWebView2AvailableNow()) return true;
                }
            }
            catch (Exception ex)
            {
                Program.LogFatal("InstallWebView2Runtime", ex);
            }
            return false;
        }

        private static bool IsWebView2Missing(Exception ex)
        {
            string s = (ex?.ToString() ?? "");
            return s.Contains("0x80070002") || s.Contains("0x80004005") ||
                   s.Contains("Dll") && s.Contains("not found") ||
                   s.Contains("WebView2") && s.Contains("not found");
        }

        private static bool IsWebView2AvailableNow()
        {
            // 快速检查：注册表 或 msedgewebview2 可执行文件
            try
            {
                return File.Exists(@"C:\Program Files (x86)\Microsoft\EdgeWebView\Application\msedgewebview2.exe")
                    || File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                        @"Microsoft\EdgeWebView\Application\msedgewebview2.exe"));
            }
            catch { return false; }
        }

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string json = e.WebMessageAsJson;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var typeEl)) return;
                string type = typeEl.GetString();
                if (type == "layers") UpdateLayerTree(root.GetProperty("layers"));
                else if (type == "select") UpdatePropertyPanel(root.TryGetProperty("feature", out var f) ? f : null);
                else if (type == "status") { if (root.TryGetProperty("msg", out var m)) statusLabel.Text = m.GetString(); }
            }
            catch { }
        }

        private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
        {
            using var dlg = new SaveFileDialog();
            dlg.FileName = Path.GetFileName(e.ResultFilePath);
            dlg.Filter = "所有文件|*.*";
            if (dlg.ShowDialog() == DialogResult.OK)
            {
                e.ResultFilePath = dlg.FileName;
                e.Handled = true;
            }
            else { e.Cancel = true; }
        }

        private void UpdateLayerTree(JsonElement layers)
        {
            if (layerTree.InvokeRequired) { layerTree.Invoke(new Action<JsonElement>(UpdateLayerTree), layers); return; }
            suppressCheck = true;
            layerTree.BeginUpdate();
            layerTree.Nodes.Clear();
            layerNames.Clear();
            foreach (var l in layers.EnumerateArray())
            {
                string id = l.GetProperty("id").GetString();
                string name = l.GetProperty("name").GetString();
                bool visible = l.GetProperty("visible").GetBoolean();
                var node = new TreeNode(name ?? id) { Tag = id, Checked = visible };
                layerTree.Nodes.Add(node);
                layerNames[id] = name ?? id;
            }
            layerTree.EndUpdate();
            suppressCheck = false;
        }

        private void LayerTree_AfterCheck(object sender, TreeViewEventArgs e)
        {
            if (suppressCheck || e.Node.Tag == null) return;
            string id = e.Node.Tag.ToString();
            bool vis = e.Node.Checked;
            _ = CallJs($"window.__gkApp && window.__gkApp.setLayerVisible({JsonSerializer.Serialize(id)}, {(vis ? "true" : "false")});");
        }

        private void UpdatePropertyPanel(JsonElement? feature)
        {
            if (propGrid.InvokeRequired) { propGrid.Invoke(new Action<JsonElement?>(UpdatePropertyPanel), feature); return; }
            if (feature == null || !feature.HasValue || feature.Value.ValueKind == JsonValueKind.Null) { propGrid.SelectedObject = null; return; }
            var f = feature.Value;
            var fp = new FeatureProps
            {
                Fid = f.GetProperty("fid").GetString(),
                Layer = f.GetProperty("layer").GetString(),
                Type = f.GetProperty("type").GetString(),
                Name = f.TryGetProperty("name", out var n) ? n.GetString() : "",
                ColorOverride = f.TryGetProperty("colorOverride", out var c) ? c.GetString() : "",
                FontSize = f.TryGetProperty("fontSize", out var fs) ? fs.GetDouble() : 0,
                PointRadius = f.TryGetProperty("pointRadius", out var pr) ? pr.GetDouble() : 0,
                LineWidth = f.TryGetProperty("lineWidth", out var lw) ? lw.GetDouble() : 0,
                FromBlock = f.TryGetProperty("fromBlock", out var fb) && fb.GetBoolean(),
                FromAttrib = f.TryGetProperty("fromAttrib", out var fa) && fa.GetBoolean(),
            };
            propGrid.SelectedObject = fp;
        }

        private void PropGrid_PropertyValueChanged(object s, PropertyValueChangedEventArgs e)
        {
            var fp = propGrid.SelectedObject as FeatureProps;
            if (fp == null || string.IsNullOrEmpty(fp.Fid)) return;
            var patch = new Dictionary<string, object>
            {
                ["name"] = fp.Name,
                ["colorOverride"] = fp.ColorOverride,
                ["fontSize"] = fp.FontSize,
                ["pointRadius"] = fp.PointRadius,
                ["lineWidth"] = fp.LineWidth,
            };
            string patchJson = JsonSerializer.Serialize(patch);
            _ = CallJs($"window.__gkApp && window.__gkApp.updateFeature({JsonSerializer.Serialize(fp.Fid)}, {patchJson});");
        }

        private async void OpenFile()
        {
            using var dlg = new OpenFileDialog();
            dlg.Filter = "支持的格式|*.kml;*.kmz;*.gpx;*.csv;*.xlsx;*.geojson;*.shp;*.dxf;*.dwg;*.ovobj;*.ovkml;*.ovkmz;*.gkzt|所有文件|*.*";
            if (dlg.ShowDialog() != DialogResult.OK) return;
            try
            {
                byte[] data = File.ReadAllBytes(dlg.FileName);
                string name = Path.GetFileName(dlg.FileName);
                string ext = Path.GetExtension(dlg.FileName).ToLower().TrimStart('.');
                bool isBinary = new[] { "dxf", "dwg", "shp", "kmz", "ovobj" }.Contains(ext);
                string token = await server.UploadAsync(name, data, isBinary);
                string items = JsonSerializer.Serialize(new[] { new { name, token, isBinary } });
                await CallJs($"window.__gkApp && window.__gkApp.importFiles({items});");
                statusLabel.Text = "已发送：" + name;
            }
            catch (Exception ex) { MessageBox.Show("打开失败：" + ex.Message, "错误", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }

        private void Fit() => _ = CallJs("window.__gkApp && window.__gkApp.fit();");
        private void ZoomIn() => _ = CallJs("window.__gkApp && window.__gkApp.zoomIn();");
        private void ZoomOut() => _ = CallJs("window.__gkApp && window.__gkApp.zoomOut();");
        private void ExportKml() => _ = CallJs("window.__gkApp && window.__gkApp.exportData('kml');");
        private void ExportGeoJson() => _ = CallJs("window.__gkApp && window.__gkApp.exportData('geojson');");

        private async System.Threading.Tasks.Task CallJs(string script)
        {
            try { if (webView?.CoreWebView2 != null) await webView.CoreWebView2.ExecuteScriptAsync(script); }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            server?.Stop();
            base.OnFormClosing(e);
        }
    }

    public class FeatureProps
    {
        [Category("标识"), ReadOnly(true)] public string Fid { get; set; }
        [Category("标识"), ReadOnly(true)] public string Layer { get; set; }
        [Category("标识"), ReadOnly(true)] public string Type { get; set; }
        [Category("标注")] public string Name { get; set; }
        [Category("样式")] public string ColorOverride { get; set; }
        [Category("样式")] public double FontSize { get; set; }
        [Category("样式")] public double PointRadius { get; set; }
        [Category("样式")] public double LineWidth { get; set; }
        [Category("来源"), ReadOnly(true)] public bool FromBlock { get; set; }
        [Category("来源"), ReadOnly(true)] public bool FromAttrib { get; set; }
    }
}
