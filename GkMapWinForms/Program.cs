using System;
using System.IO;
using System.Windows.Forms;

namespace GkMapWinForms
{
    internal static class Program
    {
        public static string LogPath =>
            Path.Combine(AppContext.BaseDirectory, "GkMapWinForms.log");

        [STAThread]
        static void Main()
        {
            ApplicationConfiguration.Initialize();

            // 全局未处理异常 -> 写日志，避免静默崩溃且便于回传错误
            AppDomain.CurrentDomain.UnhandledException += (s, e) =>
                LogFatal("UnhandledException", e.ExceptionObject as Exception);
            Application.ThreadException += (s, e) =>
                LogFatal("ThreadException", e.Exception);

            try
            {
                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                LogFatal("Application.Run", ex);
                MessageBox.Show("程序启动异常：\n" + ex.Message, "广勘智图 - 错误",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        public static void LogFatal(string where, Exception ex)
        {
            try
            {
                var sb = new System.Text.StringBuilder();
                sb.AppendLine("==== " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [" + where + "] ====");
                sb.AppendLine(ex?.ToString() ?? "null");
                sb.AppendLine();
                File.AppendAllText(LogPath, sb.ToString());
            }
            catch { }
        }

        public static void LogInfo(string msg)
        {
            try
            {
                File.AppendAllText(LogPath,
                    DateTime.Now.ToString("HH:mm:ss") + " [info] " + msg + "\n");
            }
            catch { }
        }
    }
}
