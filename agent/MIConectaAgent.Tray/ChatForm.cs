using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Media;
using System.Net.Http;

namespace MIConectaAgent.Tray;

/// <summary>
/// Janela de chat nativa estilo widget (Zendesk-like).
/// Aparece no canto inferior direito da tela.
/// Permite conversar com o suporte técnico sem abrir o navegador.
/// </summary>
public partial class ChatForm : Form
{
    // ── Paleta alinhada ao painel (clean / logo Maginf) ──
    private static readonly Color BgPage       = Color.FromArgb(248, 250, 252);
    private static readonly Color BgPanel      = Color.White;
    private static readonly Color BgCard       = Color.FromArgb(241, 245, 249);
    private static readonly Color BgInput      = Color.FromArgb(248, 250, 252);
    private static readonly Color BorderSubtle = Color.FromArgb(226, 232, 240);
    private static readonly Color BgBubbleMe   = Color.FromArgb(219, 234, 254);
    private static readonly Color BgBubbleThem = Color.FromArgb(209, 250, 229);
    private static readonly Color TextDark     = Color.FromArgb(15, 23, 42);
    private static readonly Color TextMuted    = Color.FromArgb(100, 116, 139);
    private static readonly Color AccentGreen  = Color.FromArgb(16, 185, 129);
    private static readonly Color BrandColor   = Color.FromArgb(37, 99, 235);
    private static readonly Color BrandAccent  = Color.FromArgb(59, 130, 246);

    private static GraphicsPath CreateRoundRect(Rectangle bounds, int radius)
    {
        int d = Math.Min(radius * 2, Math.Min(bounds.Width, bounds.Height));
        var path = new GraphicsPath();
        if (d <= 0) { path.AddRectangle(bounds); return path; }
        path.AddArc(bounds.Left, bounds.Top, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Top, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    // ── Controles ──
    private Panel _headerPanel = null!;
    private Panel _messagesPanel = null!;
    private Panel _inputPanel = null!;
    private Panel _ticketListPanel = null!;
    private TextBox _inputBox = null!;
    private Button _sendBtn = null!;
    private Button _backBtn = null!;
    private Label _headerTitle = null!;
    private Label _headerSubtitle = null!;
    private FlowLayoutPanel _messagesFlow = null!;
    private System.Windows.Forms.Timer _pollTimer = null!;
    private Button _concluirBtn = null!;
    private NotifyIcon? _notifyIcon;

    private Panel _titleBar = null!;
    private Button _winMinBtn = null!;
    private Button _winMaxBtn = null!;
    private Button _winCloseBtn = null!;
    private Panel _brandingPanel = null!;
    private PictureBox _logoPicture = null!;
    private PictureBox _techAvatarPicture = null!;
    private Label _techNameLabel = null!;
    private Label _motivationLabel = null!;
    private Button _historicoBtn = null!;
    private Rectangle _restoreBounds;
    private bool _maximized;

    private string? _reminderTechMessageId;
    private string _reminderTitle = "";
    private string _reminderBody = "";
    private System.Windows.Forms.Timer _techReminderTimer = null!;

    private static readonly string[] FrasesMotivacionais =
    [
        "Estamos aqui para ajudar você.",
        "Cada chamado é uma prioridade para nossa equipe.",
        "Obrigado por confiar no nosso suporte.",
        "Respire — vamos resolver juntos.",
        "Seu tempo é importante: conte conosco.",
        "Um passo de cada vez, com dedicação.",
    ];

    // ── State ──
    private readonly ChatApiClient _api;
    private readonly string _hostname;
    private string? _activeTicketId;
    private string? _activeTicketTitle;
    private string? _activeTicketStatus;
    private int _activeTicketNumero;
    private bool _activeIsConversation;
    private readonly HashSet<string> _renderedMessageIds = [];
    private bool _isTicketListView = true;

    public ChatForm(ChatApiClient api, string hostname)
    {
        _api = api;
        _hostname = hostname;
        InitializeComponent();
        _ = LoadTicketsAsync();
    }

    private void InitializeComponent()
    {
        Text = $"MIConecta Suporte v{TrayVersionInfo.DisplayVersion}";
        FormBorderStyle = FormBorderStyle.None;
        Size = new Size(420, 660);
        StartPosition = FormStartPosition.Manual;
        BackColor = BgPage;
        ShowInTaskbar = true;
        TopMost = true;
        DoubleBuffered = true;

        var screen = Screen.PrimaryScreen!.WorkingArea;
        Location = new Point(screen.Right - Width - 16, screen.Bottom - Height - 16);
        _restoreBounds = Bounds;

        void StartDrag(object? s, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            Capture = false;
            var m = Message.Create(Handle, 0xA1, (IntPtr)2, IntPtr.Zero);
            WndProc(ref m);
        }

        // ── Barra título: minimizar / maximizar / fechar ──
        _titleBar = new Panel { Dock = DockStyle.Top, Height = 32, BackColor = Color.FromArgb(241, 245, 249) };
        _titleBar.Paint += (_, e) =>
        {
            using var pen = new Pen(BorderSubtle, 1);
            e.Graphics.DrawLine(pen, 0, _titleBar.Height - 1, _titleBar.Width, _titleBar.Height - 1);
        };
        _titleBar.MouseDown += StartDrag;

        _winCloseBtn = new Button
        {
            Text = "✕",
            Dock = DockStyle.Right,
            Width = 44,
            Height = 32,
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            Cursor = Cursors.Hand,
        };
        _winCloseBtn.FlatAppearance.BorderSize = 0;
        _winCloseBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(254, 226, 226);
        _winCloseBtn.Click += (_, _) => { PararLembreteTecnico(); _pollTimer.Stop(); Hide(); };

        _winMaxBtn = new Button
        {
            Text = "□",
            Dock = DockStyle.Right,
            Width = 44,
            Height = 32,
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 10f),
            Cursor = Cursors.Hand,
        };
        _winMaxBtn.FlatAppearance.BorderSize = 0;
        _winMaxBtn.Click += (_, _) => ToggleMaximize();

        _winMinBtn = new Button
        {
            Text = "—",
            Dock = DockStyle.Right,
            Width = 44,
            Height = 32,
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            Cursor = Cursors.Hand,
        };
        _winMinBtn.FlatAppearance.BorderSize = 0;
        _winMinBtn.Click += (_, _) => WindowState = FormWindowState.Minimized;

        var dragFill = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        dragFill.MouseDown += StartDrag;
        var barTitle = new Label
        {
            Text = $"  Suporte MIConecta  ·  v{TrayVersionInfo.DisplayVersion}",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            BackColor = Color.Transparent,
        };
        barTitle.MouseDown += StartDrag;
        dragFill.Controls.Add(barTitle);

        _titleBar.Controls.Add(dragFill);
        _titleBar.Controls.Add(_winMinBtn);
        _titleBar.Controls.Add(_winMaxBtn);
        _titleBar.Controls.Add(_winCloseBtn);

        // ── Topo: logo, técnico, frase, histórico ──
        _brandingPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 172,
            BackColor = BgPanel,
            Padding = new Padding(14, 10, 14, 8),
        };
        _brandingPanel.Paint += (_, e) =>
        {
            using var pen = new Pen(BorderSubtle, 1);
            e.Graphics.DrawLine(pen, 0, _brandingPanel.Height - 1, _brandingPanel.Width, _brandingPanel.Height - 1);
        };

        _historicoBtn = new Button
        {
            Text = "Histórico",
            Size = new Size(90, 26),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            Location = new Point(300, 8),
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 8.5f),
            Cursor = Cursors.Hand,
            TabStop = false,
        };
        _historicoBtn.FlatAppearance.BorderColor = BorderSubtle;
        _historicoBtn.FlatAppearance.BorderSize = 1;
        _historicoBtn.Click += async (_, _) => await MostrarHistoricoAsync();

        _logoPicture = new PictureBox
        {
            Size = new Size(220, 52),
            Location = new Point(14, 8),
            SizeMode = PictureBoxSizeMode.Zoom,
            BackColor = Color.Transparent,
        };

        _techAvatarPicture = new PictureBox
        {
            Size = new Size(56, 56),
            Location = new Point(14, 68),
            SizeMode = PictureBoxSizeMode.Zoom,
            BackColor = Color.FromArgb(226, 232, 240),
        };
        _techAvatarPicture.Paint += TechAvatarPaintCircle;

        _techNameLabel = new Label
        {
            Location = new Point(78, 74),
            Size = new Size(310, 44),
            Font = new Font("Segoe UI", 12f, FontStyle.Bold),
            ForeColor = TextDark,
            BackColor = Color.Transparent,
            Text = "Equipe de suporte",
        };

        _motivationLabel = new Label
        {
            Location = new Point(14, 128),
            Size = new Size(380, 40),
            Font = new Font("Segoe UI", 9.2f, FontStyle.Italic),
            ForeColor = TextMuted,
            BackColor = Color.Transparent,
            Text = FrasesMotivacionais[Random.Shared.Next(FrasesMotivacionais.Length)],
        };

        _brandingPanel.Controls.Add(_historicoBtn);
        _brandingPanel.Controls.Add(_logoPicture);
        _brandingPanel.Controls.Add(_techAvatarPicture);
        _brandingPanel.Controls.Add(_techNameLabel);
        _brandingPanel.Controls.Add(_motivationLabel);
        _brandingPanel.Resize += (_, _) =>
        {
            _historicoBtn.Left = _brandingPanel.Width - _historicoBtn.Width - 14;
        };

        // ── Cabeçalho modo chat (ticket) ──
        _headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 52,
            BackColor = BgPanel,
            Visible = false,
            Padding = new Padding(6, 4, 6, 4),
        };
        _headerPanel.Paint += (_, e) =>
        {
            using var pen = new Pen(BorderSubtle, 1);
            e.Graphics.DrawLine(pen, 0, _headerPanel.Height - 1, _headerPanel.Width, _headerPanel.Height - 1);
        };
        _headerPanel.MouseDown += StartDrag;

        _backBtn = new Button
        {
            Text = "←",
            FlatStyle = FlatStyle.Flat,
            ForeColor = BrandColor,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Size = new Size(36, 36),
            Location = new Point(4, 8),
            Cursor = Cursors.Hand,
            Visible = false,
            TabStop = false,
        };
        _backBtn.FlatAppearance.BorderSize = 0;
        _backBtn.Click += (_, _) => VoltarParaLista();

        _concluirBtn = new Button
        {
            Text = "Encerrar",
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.White,
            BackColor = AccentGreen,
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            Size = new Size(88, 30),
            Location = new Point(320, 11),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            Cursor = Cursors.Hand,
            Visible = false,
            TabStop = false,
        };
        _concluirBtn.FlatAppearance.BorderSize = 0;
        _concluirBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(5, 150, 105);
        _concluirBtn.Click += async (_, _) => await ConcluirTicketAsync();

        _headerTitle = new Label
        {
            Text = "",
            ForeColor = TextDark,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            AutoSize = false,
            Location = new Point(44, 8),
            Size = new Size(260, 22),
            BackColor = Color.Transparent,
        };

        _headerSubtitle = new Label
        {
            Text = "",
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 8.25f),
            AutoSize = false,
            Location = new Point(44, 30),
            Size = new Size(260, 18),
            BackColor = Color.Transparent,
        };

        _headerPanel.Controls.Add(_concluirBtn);
        _headerPanel.Controls.Add(_backBtn);
        _headerPanel.Controls.Add(_headerTitle);
        _headerPanel.Controls.Add(_headerSubtitle);
        _headerPanel.Resize += (_, _) =>
        {
            _concluirBtn.Left = _headerPanel.Width - _concluirBtn.Width - 8;
        };

        _ticketListPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgPage,
            AutoScroll = true,
            Padding = new Padding(12, 12, 12, 12),
        };

        _messagesPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgPage,
            Visible = false,
        };

        _messagesFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = BgPage,
            Padding = new Padding(8, 8, 8, 8),
        };
        _messagesPanel.Controls.Add(_messagesFlow);

        _inputPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 58,
            BackColor = BgPanel,
            Padding = new Padding(10, 10, 10, 10),
            Visible = false,
        };

        _inputBox = new TextBox
        {
            Dock = DockStyle.Fill,
            BackColor = BgInput,
            ForeColor = TextDark,
            Font = new Font("Segoe UI", 10f),
            BorderStyle = BorderStyle.None,
        };
        _inputBox.KeyDown += (s, e) =>
        {
            if (e.KeyCode == Keys.Enter && !e.Shift)
            {
                e.SuppressKeyPress = true;
                _ = EnviarMensagemAsync();
            }
        };

        var inputWrapper = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgInput,
            Padding = new Padding(10, 8, 6, 8),
        };
        inputWrapper.Controls.Add(_inputBox);
        inputWrapper.Paint += (s, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(0, 0, inputWrapper.Width - 1, inputWrapper.Height - 1);
            using var path = CreateRoundRect(rect, 10);
            using var pen = new Pen(BorderSubtle, 1);
            e.Graphics.DrawPath(pen, path);
        };

        _sendBtn = new Button
        {
            Text = "➤",
            Dock = DockStyle.Right,
            Width = 44,
            FlatStyle = FlatStyle.Flat,
            BackColor = BrandColor,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 14f),
            Cursor = Cursors.Hand,
        };
        _sendBtn.FlatAppearance.BorderSize = 0;
        _sendBtn.Click += async (_, _) => await EnviarMensagemAsync();

        _inputPanel.Controls.Add(inputWrapper);
        _inputPanel.Controls.Add(_sendBtn);

        Controls.Add(_ticketListPanel);
        Controls.Add(_messagesPanel);
        Controls.Add(_inputPanel);
        Controls.Add(_headerPanel);
        Controls.Add(_brandingPanel);
        Controls.Add(_titleBar);

        _pollTimer = new System.Windows.Forms.Timer { Interval = 5000 };
        _pollTimer.Tick += async (_, _) =>
        {
            if (_activeTicketId != null && Visible)
                await LoadMessagesAsync(_activeTicketId);
        };

        _techReminderTimer = new System.Windows.Forms.Timer { Interval = 60_000 };
        _techReminderTimer.Tick += (_, _) =>
        {
            if (Visible || string.IsNullOrEmpty(_reminderTechMessageId)) return;
            MostrarToastTecnico(_reminderTitle, _reminderBody);
        };

        var notifyTimer = new System.Windows.Forms.Timer { Interval = 12_000 };
        notifyTimer.Tick += async (_, _) =>
        {
            try
            {
                if (Visible) return;
                await VerificarNovasRespostasTecnicoAsync();
            }
            catch { /* ignore */ }
        };
        notifyTimer.Start();

        AplicarIconeJanela();
    }

    private void ToggleMaximize()
    {
        if (!_maximized)
        {
            _restoreBounds = Bounds;
            var wa = Screen.FromHandle(Handle).WorkingArea;
            Location = wa.Location;
            Size = wa.Size;
            _maximized = true;
            _winMaxBtn.Text = "❐";
        }
        else
        {
            Bounds = _restoreBounds;
            _maximized = false;
            _winMaxBtn.Text = "□";
        }
    }

    private void TechAvatarPaintCircle(object? sender, PaintEventArgs e)
    {
        var pb = (PictureBox)sender!;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var path = new GraphicsPath();
        path.AddEllipse(0, 0, pb.Width - 1, pb.Height - 1);
        pb.Region = new Region(path);
    }

    private async Task AplicarContextoSuporteAsync()
    {
        var ctx = await _api.ObterContextoSuporteAsync();
        if (ctx == null) return;

        _techNameLabel.Text = ctx.TechnicianName;
        if (!string.IsNullOrEmpty(ctx.LogoUrl))
            _ = CarregarImagemUrlAsync(_logoPicture, ctx.LogoUrl);
        else
            _logoPicture.Image = null;

        if (!string.IsNullOrEmpty(ctx.TechnicianAvatarUrl))
            _ = CarregarImagemUrlAsync(_techAvatarPicture, ctx.TechnicianAvatarUrl);
        else
            _techAvatarPicture.Image = null;
    }

    private static async Task CarregarImagemUrlAsync(PictureBox box, string url)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            var bytes = await client.GetByteArrayAsync(url);
            using var ms = new MemoryStream(bytes);
            using var img = Image.FromStream(ms);
            var clone = new Bitmap(img);
            var old = box.Image;
            box.Image = clone;
            old?.Dispose();
        }
        catch
        {
            /* mantém placeholder */
        }
    }

    private async Task MostrarHistoricoAsync()
    {
        var itens = await _api.ListarTicketsHistoricoAsync();
        using var f = new Form
        {
            Text = "Histórico de chamados",
            Size = new Size(400, 420),
            StartPosition = FormStartPosition.CenterParent,
            BackColor = BgPage,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true,
        };
        var list = new ListBox
        {
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI", 9.5f),
            IntegralHeight = false,
        };
        foreach (var t in itens)
            list.Items.Add($"#{t.Numero} · {t.Titulo} ({t.Status})");
        if (list.Items.Count == 0)
            list.Items.Add("Nenhum chamado finalizado ainda.");
        f.Controls.Add(list);
        f.ShowDialog(this);
    }

    private async Task VerificarNovasRespostasTecnicoAsync()
    {
        ChatMessage? bestMsg = null;
        var bestTitle = "";

        void consider(ChatMessage? m, string title)
        {
            if (m == null || !m.IsTechnician) return;
            if (!DateTime.TryParse(m.CriadoEm, out var dt)) dt = DateTime.MinValue;
            if (bestMsg == null)
            {
                bestMsg = m;
                bestTitle = title;
                return;
            }
            if (!DateTime.TryParse(bestMsg.CriadoEm, out var bestDt)) bestDt = DateTime.MinValue;
            if (dt >= bestDt)
            {
                bestMsg = m;
                bestTitle = title;
            }
        }

        foreach (var t in await _api.ListarTicketsAsync())
        {
            var msgs = await _api.ListarMensagensAsync(t.Id);
            consider(msgs.LastOrDefault(m => m.IsTechnician), t.Titulo);
        }

        foreach (var c in await _api.ListarConversacoesAsync())
        {
            var msgs = await _api.ListarMensagensConversaAsync(c.Id);
            consider(msgs.LastOrDefault(m => m.IsTechnician), c.Titulo);
        }

        if (bestMsg == null)
        {
            PararLembreteTecnico();
            return;
        }

        if (_reminderTechMessageId == bestMsg.Id)
            return;

        _reminderTechMessageId = bestMsg.Id;
        _reminderTitle = $"Nova mensagem — {bestTitle}";
        _reminderBody = $"{bestMsg.RemetenteNome}: {bestMsg.Conteudo}";
        MostrarToastTecnico(_reminderTitle, _reminderBody);
        _techReminderTimer.Stop();
        _techReminderTimer.Start();
    }

    private void MostrarToastTecnico(string titulo, string corpo)
    {
        try
        {
            void open()
            {
                PararLembreteTecnico();
                ShowChat();
            }
            var toast = new TechReplyToastForm(titulo, corpo, open);
            toast.Show();
        }
        catch
        {
            MostrarNotificacao(titulo, corpo);
        }
    }

    private void PararLembreteTecnico()
    {
        _techReminderTimer.Stop();
        _reminderTechMessageId = null;
        _reminderTitle = "";
        _reminderBody = "";
    }

    private void MostrarNotificacao(string titulo, string mensagem)
    {
        if (_notifyIcon == null)
        {
            _notifyIcon = new NotifyIcon
            {
                Icon = Icon ?? SystemIcons.Information,
                Visible = true,
            };
            _notifyIcon.BalloonTipClicked += (_, _) => ShowChat();
        }

        _notifyIcon.BalloonTipTitle = titulo;
        _notifyIcon.BalloonTipText = mensagem.Length > 80 ? mensagem[..80] + "…" : mensagem;
        _notifyIcon.BalloonTipIcon = ToolTipIcon.Info;
        _notifyIcon.ShowBalloonTip(5000);

        try { SystemSounds.Asterisk.Play(); } catch { }
    }

    private void AplicarIconeJanela()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "icon.ico");
            if (File.Exists(path))
            {
                Icon = new Icon(path);
                return;
            }
        }
        catch { /* mantém ícone padrão */ }

        try
        {
            var extracted = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            if (extracted != null)
            {
                Icon = (Icon)extracted.Clone();
                extracted.Dispose();
            }
        }
        catch { /* ignore */ }
    }

    // ══════════════════════════════════════════════════════
    // TICKET LIST VIEW
    // ══════════════════════════════════════════════════════

    private async Task LoadTicketsAsync()
    {
        _ticketListPanel.Controls.Clear();

        // Loading
        var loadingLabel = new Label
        {
            Text = "Conectando ao servidor...",
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 10f),
            Dock = DockStyle.Top,
            TextAlign = ContentAlignment.MiddleCenter,
            Height = 40,
        };
        _ticketListPanel.Controls.Add(loadingLabel);

        // Testar conexão primeiro
        var connected = await _api.TestarConexaoAsync();
        if (!connected)
        {
            _ticketListPanel.Controls.Clear();
            var errorLabel = new Label
            {
                Text = $"⚠ Não foi possível conectar ao servidor.\n\n{_api.LastError ?? "Verifique a conexão de internet."}\n\nServidor: {_api.ToString()}",
                ForeColor = Color.FromArgb(239, 68, 68),
                Font = new Font("Segoe UI", 9f),
                Dock = DockStyle.Top,
                TextAlign = ContentAlignment.MiddleCenter,
                Height = 120,
                Padding = new Padding(12, 20, 12, 0),
            };
            var retryBtn = new Button
            {
                Text = "Tentar novamente",
                Dock = DockStyle.Top,
                Height = 36,
                FlatStyle = FlatStyle.Flat,
                BackColor = BrandColor,
                ForeColor = TextDark,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand,
                Margin = new Padding(40, 8, 40, 0),
            };
            retryBtn.FlatAppearance.BorderSize = 0;
            retryBtn.Click += async (s, e) => await LoadTicketsAsync();
            _ticketListPanel.Controls.Add(retryBtn);
            _ticketListPanel.Controls.Add(errorLabel);
            return;
        }

        loadingLabel.Text = "Carregando chamados...";
        await AplicarContextoSuporteAsync();
        _motivationLabel.Text = FrasesMotivacionais[Random.Shared.Next(FrasesMotivacionais.Length)];

        var conversas = await _api.ListarConversacoesAsync();
        var tickets = await _api.ListarTicketsAsync();
        _ticketListPanel.Controls.Clear();

        if (_api.LastError != null)
        {
            var apiErrorLabel = new Label
            {
                Text = $"⚠ {_api.LastError}",
                ForeColor = Color.FromArgb(217, 119, 6),
                Font = new Font("Segoe UI", 8f),
                Dock = DockStyle.Top,
                TextAlign = ContentAlignment.MiddleCenter,
                Height = 24,
            };
            _ticketListPanel.Controls.Add(apiErrorLabel);
        }

        void AddSectionTitle(string text)
        {
            _ticketListPanel.Controls.Add(new Label
            {
                Text = text,
                Dock = DockStyle.Top,
                Height = 28,
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(4, 8, 0, 0),
            });
        }

        AddSectionTitle("CHAMADOS EM ABERTO");
        var newTicketBtn = CriarBotaoNovoTicket();
        _ticketListPanel.Controls.Add(newTicketBtn);

        if (tickets.Count == 0)
        {
            _ticketListPanel.Controls.Add(new Label
            {
                Text = "Nenhum chamado aberto no momento.",
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 9f),
                Dock = DockStyle.Top,
                Height = 36,
                TextAlign = ContentAlignment.MiddleCenter,
            });
        }
        else
        {
            for (int i = tickets.Count - 1; i >= 0; i--)
                _ticketListPanel.Controls.Add(CriarItemTicket(tickets[i]));
        }

        AddSectionTitle("DÚVIDAS RÁPIDAS (CHAT LIVRE)");
        var novaConversaBtn = CriarBotaoNovaConversa();
        _ticketListPanel.Controls.Add(novaConversaBtn);

        if (conversas.Count == 0)
        {
            _ticketListPanel.Controls.Add(new Label
            {
                Text = "Abra um chat livre para falar com o suporte sem abrir chamado.",
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 9f),
                Dock = DockStyle.Top,
                Height = 40,
                TextAlign = ContentAlignment.MiddleCenter,
            });
        }
        else
        {
            for (int i = conversas.Count - 1; i >= 0; i--)
                _ticketListPanel.Controls.Add(CriarItemTicket(conversas[i]));
        }
    }

    private Button CriarBotaoNovoTicket()
    {
        var btn = new Button
        {
            Text = "＋  Abrir chamado formal",
            Dock = DockStyle.Top,
            Height = 48,
            FlatStyle = FlatStyle.Flat,
            BackColor = BrandColor,
            ForeColor = TextDark,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(2, 0, 2, 10),
        };
        btn.FlatAppearance.BorderSize = 0;
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(100, 120, 255);
        btn.Click += async (s, e) => await CriarNovoTicketAsync();
        return btn;
    }

    private Button CriarBotaoNovaConversa()
    {
        var btn = new Button
        {
            Text = "Mensagem rápida ao suporte (sem chamado)",
            Dock = DockStyle.Top,
            Height = 48,
            FlatStyle = FlatStyle.Flat,
            BackColor = BgCard,
            ForeColor = TextDark,
            Font = new Font("Segoe UI", 9.25f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(2, 0, 2, 10),
        };
        btn.FlatAppearance.BorderSize = 1;
        btn.FlatAppearance.BorderColor = BorderSubtle;
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(226, 232, 240);
        btn.Click += async (s, e) => await CriarConversaRapidaAsync();
        return btn;
    }

    private async Task CriarConversaRapidaAsync()
    {
        var c = await _api.CriarConversaAsync($"Suporte — {_hostname}", null);
        if (c != null)
            await AbrirTicketAsync(c);
        else
            MessageBox.Show("Não foi possível abrir a conversa.\nVerifique a conexão.",
                "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private Panel CriarItemTicket(ChatTicket ticket)
    {
        var panel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 76,
            BackColor = BgPage,
            Margin = new Padding(2, 0, 2, 8),
            Cursor = Cursors.Hand,
            Padding = new Padding(0),
        };
        panel.Paint += (_, ev) =>
        {
            ev.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new Rectangle(2, 1, panel.Width - 5, panel.Height - 3);
            using var path = CreateRoundRect(r, 12);
            using var fill = new SolidBrush(BgCard);
            ev.Graphics.FillPath(fill, path);
            using var border = new Pen(BorderSubtle, 1);
            ev.Graphics.DrawPath(border, path);
        };

        var statusColor = ticket.IsConversation
            ? Color.FromArgb(129, 140, 248)
            : ticket.Status switch
            {
                "aberto" => AccentGreen,
                "em_atendimento" => Color.FromArgb(251, 191, 36),
                _ => TextMuted,
            };

        var dot = new Label
        {
            Text = "●",
            ForeColor = statusColor,
            Font = new Font("Segoe UI", 9f),
            AutoSize = true,
            Location = new Point(18, 28),
            BackColor = Color.Transparent,
        };

        var tituloLinha = ticket.IsConversation || ticket.Numero <= 0
            ? ticket.Titulo
            : $"#{ticket.Numero} · {ticket.Titulo}";
        var titleLabel = new Label
        {
            Text = tituloLinha.Length > 36 ? tituloLinha[..36] + "…" : tituloLinha,
            ForeColor = TextDark,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(34, 14),
            BackColor = Color.Transparent,
        };

        var statusLabel = new Label
        {
            Text = ticket.IsConversation ? "Chat direto" : ticket.Status.Replace("_", " "),
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 8.25f),
            AutoSize = true,
            Location = new Point(34, 38),
            BackColor = Color.Transparent,
        };

        var arrow = new Label
        {
            Text = "›",
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 18f),
            AutoSize = true,
            Location = new Point(panel.Width - 36, 22),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            BackColor = Color.Transparent,
        };

        panel.Controls.AddRange([dot, titleLabel, statusLabel, arrow]);

        // Click on any part
        void onClick(object? s, EventArgs e) => _ = AbrirTicketAsync(ticket);
        panel.Click += onClick;
        titleLabel.Click += onClick;
        statusLabel.Click += onClick;
        dot.Click += onClick;
        arrow.Click += onClick;

        return panel;
    }

    // ══════════════════════════════════════════════════════
    // CHAT VIEW
    // ══════════════════════════════════════════════════════

    private async Task AbrirTicketAsync(ChatTicket ticket)
    {
        _activeIsConversation = ticket.IsConversation;
        _activeTicketId = ticket.Id;
        _activeTicketTitle = ticket.Titulo;
        _activeTicketStatus = ticket.Status;
        _activeTicketNumero = ticket.Numero;
        _renderedMessageIds.Clear();
        _messagesFlow.Controls.Clear();

        _isTicketListView = false;
        _ticketListPanel.Visible = false;
        _brandingPanel.Visible = false;
        _headerPanel.Visible = true;
        _messagesPanel.Visible = true;
        _inputPanel.Visible = true;
        _backBtn.Visible = true;
        _headerTitle.Text = ticket.IsConversation
            ? ticket.Titulo
            : (ticket.Numero > 0 ? $"#{ticket.Numero} · {ticket.Titulo}" : ticket.Titulo);
        if (_headerTitle.Text.Length > 42)
            _headerTitle.Text = _headerTitle.Text[..42] + "…";
        _headerSubtitle.Text = ticket.IsConversation ? "Chat livre · dúvidas e esclarecimentos" : ticket.Status.Replace("_", " ");

        var canConcluir = !ticket.IsConversation && ticket.Status is "aberto" or "em_atendimento" or "aguardando_cliente" or "aguardando_tecnico";
        _concluirBtn.Visible = canConcluir;
        _concluirBtn.Text = "Encerrar";
        _inputPanel.Visible = ticket.IsConversation || canConcluir;

        await LoadMessagesAsync(ticket.Id);
        _pollTimer.Start();
        if (canConcluir) _inputBox.Focus();
    }

    private void VoltarParaLista()
    {
        _pollTimer.Stop();
        _activeTicketId = null;
        _activeTicketStatus = null;
        _activeIsConversation = false;
        _activeTicketNumero = 0;
        _isTicketListView = true;

        _messagesPanel.Visible = false;
        _inputPanel.Visible = false;
        _ticketListPanel.Visible = true;
        _backBtn.Visible = false;
        _concluirBtn.Visible = false;
        _headerPanel.Visible = false;
        _brandingPanel.Visible = true;
        _headerTitle.Text = "";
        _headerSubtitle.Text = "";

        _ = LoadTicketsAsync();
    }

    private async Task LoadMessagesAsync(string ticketId)
    {
        var messages = _activeIsConversation
            ? await _api.ListarMensagensConversaAsync(ticketId)
            : await _api.ListarMensagensAsync(ticketId);

        foreach (var msg in messages)
        {
            if (_renderedMessageIds.Contains(msg.Id)) continue;
            _renderedMessageIds.Add(msg.Id);
            AdicionarBolha(msg);
        }

        // Scroll to bottom
        ScrollToBottom();
    }

    private void AdicionarBolha(ChatMessage msg)
    {
        if (msg.IsSystem)
        {
            var wrap = new Panel
            {
                Width = _messagesFlow.ClientSize.Width - 20,
                AutoSize = true,
                Margin = new Padding(0, 6, 0, 6),
                BackColor = Color.Transparent,
            };
            var sys = new Label
            {
                Text = msg.Conteudo,
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Italic),
                AutoSize = true,
                MaximumSize = new Size(wrap.Width - 8, 0),
                TextAlign = ContentAlignment.MiddleCenter,
            };
            wrap.Controls.Add(sys);
            sys.Left = Math.Max(0, (wrap.Width - sys.PreferredWidth) / 2);
            _messagesFlow.Controls.Add(wrap);
            return;
        }

        var isMine = msg.IsClientSide || (!msg.IsTechnician && !msg.IsSystem);
        var bubbleColor = isMine ? BgBubbleMe : BgBubbleThem;

        var wrapper = new Panel
        {
            Width = _messagesFlow.ClientSize.Width - 20,
            AutoSize = true,
            MinimumSize = new Size(_messagesFlow.ClientSize.Width - 20, 40),
            MaximumSize = new Size(_messagesFlow.ClientSize.Width - 20, 0),
            Margin = new Padding(0, 2, 0, 2),
            BackColor = Color.Transparent,
        };

        if (msg.IsTechnician && !string.IsNullOrEmpty(msg.RemetenteNome))
        {
            var nameLabel = new Label
            {
                Text = msg.RemetenteNome + " · Técnico",
                ForeColor = Color.FromArgb(5, 150, 105),
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(0, 0),
            };
            wrapper.Controls.Add(nameLabel);
        }
        else if (isMine && !string.IsNullOrEmpty(msg.RemetenteNome))
        {
            var nameLabel = new Label
            {
                Text = msg.RemetenteNome + " · Você",
                ForeColor = BrandColor,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(0, 0),
                TextAlign = ContentAlignment.MiddleRight,
            };
            wrapper.Controls.Add(nameLabel);
        }

        var topOffset = (msg.IsTechnician || (isMine && !string.IsNullOrEmpty(msg.RemetenteNome))) ? 16 : 0;

        var bubble = new Label
        {
            Text = msg.Conteudo,
            ForeColor = TextDark,
            BackColor = bubbleColor,
            Font = new Font("Segoe UI", 9.5f),
            AutoSize = true,
            MaximumSize = new Size((int)(_messagesFlow.ClientSize.Width * 0.75), 0),
            Padding = new Padding(10, 6, 10, 6),
            Margin = new Padding(0),
        };

        // Position bubble left or right
        if (isMine)
        {
            bubble.Location = new Point(wrapper.Width - bubble.PreferredWidth - 4, topOffset);
            bubble.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        }
        else
        {
            bubble.Location = new Point(4, topOffset);
        }

        // Timestamp
        var timeText = "";
        if (DateTime.TryParse(msg.CriadoEm, out var dt))
            timeText = dt.ToLocalTime().ToString("HH:mm");

        var timeLabel = new Label
        {
            Text = timeText,
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 7f),
            AutoSize = true,
        };

        wrapper.Controls.Add(bubble);

        // Need to set time position after bubble layout
        wrapper.Layout += (s, e) =>
        {
            if (isMine)
                timeLabel.Location = new Point(bubble.Right - timeLabel.PreferredWidth, bubble.Bottom + 1);
            else
                timeLabel.Location = new Point(bubble.Left, bubble.Bottom + 1);

            wrapper.Height = Math.Max(wrapper.Height, timeLabel.Bottom + 4);
        };

        wrapper.Controls.Add(timeLabel);
        _messagesFlow.Controls.Add(wrapper);
    }

    private void ScrollToBottom()
    {
        if (_messagesFlow.Controls.Count == 0) return;
        _messagesFlow.PerformLayout();
        _messagesFlow.ScrollControlIntoView(_messagesFlow.Controls[^1]);
    }

    // ══════════════════════════════════════════════════════
    // ACTIONS
    // ══════════════════════════════════════════════════════

    private async Task ConcluirTicketAsync()
    {
        if (_activeTicketId == null) return;

        var num = _activeTicketNumero > 0 ? _activeTicketNumero : 0;
        using var confirmDlg = new EncerrarTicketDialog(num, _activeTicketTitle ?? "");
        if (confirmDlg.ShowDialog(this) != DialogResult.Yes) return;

        _concluirBtn.Enabled = false;
        _concluirBtn.Text = "…";

        try
        {
            var ok = await _api.ConcluirTicketAsync(_activeTicketId);
            if (!ok)
            {
                MessageBox.Show("Não foi possível concluir o chamado.", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                _concluirBtn.Enabled = true;
                _concluirBtn.Text = "Encerrar";
                return;
            }

            using var satisfacaoDialog = new SatisfacaoColoridaDialog();
            if (satisfacaoDialog.ShowDialog(this) == DialogResult.OK && satisfacaoDialog.Nota > 0)
            {
                await _api.AvaliarTicketAsync(_activeTicketId, satisfacaoDialog.Nota, satisfacaoDialog.Comentario);
            }

            VoltarParaLista();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Erro ao finalizar: {ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _concluirBtn.Enabled = true;
            _concluirBtn.Text = "Encerrar";
        }
    }

    private async Task EnviarMensagemAsync()
    {
        var text = _inputBox.Text.Trim();
        if (string.IsNullOrEmpty(text) || _activeTicketId == null) return;

        _inputBox.Text = "";
        _inputBox.Enabled = false;
        _sendBtn.Enabled = false;

        ChatMessage? msg = _activeIsConversation
            ? await _api.EnviarMensagemConversaAsync(_activeTicketId, text)
            : await _api.EnviarMensagemAsync(_activeTicketId, text);
        if (msg != null && !_renderedMessageIds.Contains(msg.Id))
        {
            _renderedMessageIds.Add(msg.Id);
            AdicionarBolha(msg);
            ScrollToBottom();
        }
        else if (msg == null)
        {
            _inputBox.Text = text;
            var det = string.IsNullOrEmpty(_api.LastError) ? "Tente novamente." : _api.LastError;
            MessageBox.Show($"Não foi possível enviar a mensagem.\n{det}", "MIConecta Chat",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        _inputBox.Enabled = true;
        _sendBtn.Enabled = true;
        _inputBox.Focus();
    }

    private async Task CriarNovoTicketAsync()
    {
        using var dialog = new NovoTicketDialog();
        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            var titulo = dialog.Titulo;
            var descricao = dialog.Descricao;
            if (string.IsNullOrWhiteSpace(titulo)) return;

            var ticket = await _api.CriarTicketAsync(titulo, descricao);
            if (ticket != null)
            {
                await AbrirTicketAsync(ticket);
            }
            else
            {
                MessageBox.Show("Não foi possível criar o chamado.\nVerifique a conexão com o servidor.",
                    "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // Hide instead of close (keep in tray)
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            _pollTimer.Stop();
            Hide();
            return;
        }
        _pollTimer.Stop();
        _pollTimer.Dispose();
        if (_notifyIcon != null) { _notifyIcon.Visible = false; _notifyIcon.Dispose(); }
        base.OnFormClosing(e);
    }

    /// <summary>Show or bring to front.</summary>
    public void ShowChat()
    {
        PararLembreteTecnico();
        if (!Visible)
        {
            Show();
            if (_isTicketListView)
                _ = LoadTicketsAsync();
            else if (_activeTicketId != null)
                _pollTimer.Start();
        }
        BringToFront();
        Activate();
    }
}

// ══════════════════════════════════════════════════════
// Dialog: Novo ticket
// ══════════════════════════════════════════════════════

public class NovoTicketDialog : Form
{
    public string Titulo { get; private set; } = "";
    public string Descricao { get; private set; } = "";

    private TextBox _tituloBox = null!;
    private TextBox _descricaoBox = null!;

    public NovoTicketDialog()
    {
        var bg = Color.FromArgb(248, 250, 252);
        var text = Color.FromArgb(15, 23, 42);
        var muted = Color.FromArgb(100, 116, 139);
        var inputBg = Color.FromArgb(248, 250, 252);
        var brand = Color.FromArgb(37, 99, 235);
        var border = Color.FromArgb(226, 232, 240);

        Text = "Novo chamado";
        Size = new Size(380, 288);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        BackColor = bg;
        ForeColor = text;

        var head = new Label
        {
            Text = "Abrir um chamado para o suporte",
            Location = new Point(16, 14),
            Size = new Size(340, 22),
            ForeColor = muted,
            Font = new Font("Segoe UI", 9f),
        };

        var titleLabel = new Label
        {
            Text = "Assunto",
            Location = new Point(16, 42),
            AutoSize = true,
            ForeColor = text,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
        };
        _tituloBox = new TextBox
        {
            Location = new Point(16, 64),
            Size = new Size(330, 28),
            BackColor = Color.White,
            ForeColor = text,
            Font = new Font("Segoe UI", 10f),
            BorderStyle = BorderStyle.FixedSingle,
        };

        var descLabel = new Label
        {
            Text = "Descrição",
            Location = new Point(16, 100),
            AutoSize = true,
            ForeColor = text,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
        };
        _descricaoBox = new TextBox
        {
            Location = new Point(16, 122),
            Size = new Size(330, 88),
            Multiline = true,
            BackColor = inputBg,
            ForeColor = text,
            Font = new Font("Segoe UI", 10f),
            BorderStyle = BorderStyle.FixedSingle,
        };

        var okBtn = new Button
        {
            Text = "Criar chamado",
            Location = new Point(16, 224),
            Size = new Size(160, 34),
            BackColor = brand,
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            DialogResult = DialogResult.OK,
            Cursor = Cursors.Hand,
        };
        okBtn.FlatAppearance.BorderSize = 0;
        okBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(29, 78, 216);

        var cancelBtn = new Button
        {
            Text = "Cancelar",
            Location = new Point(186, 224),
            Size = new Size(160, 34),
            BackColor = border,
            ForeColor = Color.FromArgb(51, 65, 85),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f),
            DialogResult = DialogResult.Cancel,
            Cursor = Cursors.Hand,
        };
        cancelBtn.FlatAppearance.BorderSize = 0;
        cancelBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(203, 213, 225);

        Controls.AddRange([head, titleLabel, _tituloBox, descLabel, _descricaoBox, okBtn, cancelBtn]);
        AcceptButton = okBtn;
        CancelButton = cancelBtn;
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        Titulo = _tituloBox.Text.Trim();
        Descricao = _descricaoBox.Text.Trim();
        base.OnFormClosing(e);
    }
}
