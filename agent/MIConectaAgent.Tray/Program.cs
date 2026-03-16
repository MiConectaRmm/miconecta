namespace MIConectaAgent.Tray;

static class Program
{
    [STAThread]
    static void Main()
    {
        // Garantir instância única
        using var mutex = new Mutex(true, "MIConectaRMM_Tray", out bool isNew);
        if (!isNew)
        {
            MessageBox.Show("MIConectaRMM Tray já está em execução.", "MIConectaRMM",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new TrayApplicationContext());
    }
}
