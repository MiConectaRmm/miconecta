using System.Reflection;

namespace MIConectaAgent.Tray;

/// <summary>Versão do Tray (AssemblyInformationalVersion / Version.props via Directory.Build.props).</summary>
internal static class TrayVersionInfo
{
    private static readonly Lazy<string> LazyDisplay = new(ResolveDisplayVersion);

    public static string DisplayVersion => LazyDisplay.Value;

    private static string ResolveDisplayVersion()
    {
        var asm = Assembly.GetExecutingAssembly();
        var info = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(info))
        {
            var plus = info.IndexOf('+');
            return plus >= 0 ? info[..plus] : info;
        }

        var v = asm.GetName().Version;
        return v == null ? "0.0.0" : $"{v.Major}.{v.Minor}.{v.Build}";
    }
}
