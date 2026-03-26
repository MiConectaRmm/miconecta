using System.Drawing;
using System.Drawing.Drawing2D;
using System.Media;

namespace MIConectaAgent.Tray;

/// <summary>
/// Janela de chat nativa estilo widget (Zendesk-like).
/// Aparece no canto inferior direito da tela.
/// Permite conversar com o suporte técnico sem abrir o navegador.
/// </summary>
public class ChatForm : Form
{
    // ── Cores (dark theme) ──
    private static readonly Color BgDark       = Color.FromArgb(24, 24, 32);
    private static readonly Color BgPanel      = Color.FromArgb(32, 32, 44);
    private static readonly Color BgInput      = Color.FromArgb(40, 40, 56);
    private static readonly Color BgBubbleMe   = Color.FromArgb(59, 130, 246); // brand blue
    private static readonly Color BgBubbleThem = Color.FromArgb(48, 48, 64);
    private static readonly Color TextWhite    = Color.FromArgb(240, 240, 245);
    private static readonly Color TextMuted    = Color.FromArgb(140, 140, 165);
    private static readonly Color AccentGreen  = Color.FromArgb(34, 197, 94);
    private static readonly Color BrandColor   = Color.FromArgb(59, 130, 246);

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

    // ── State ──
    private readonly ChatApiClient _api;
    private readonly string _hostname;
    private string? _activeTicketId;
    private string? _activeTicketTitle;
    private string? _activeTicketStatus;
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
        // ── Window config ──
        Text = "MIConecta Chat";
        FormBorderStyle = FormBorderStyle.None;
        Size = new Size(380, 560);
        StartPosition = FormStartPosition.Manual;
        BackColor = BgDark;
        ShowInTaskbar = true;
        TopMost = true;
        DoubleBuffered = true;

        // Position: bottom-right
        var screen = Screen.PrimaryScreen!.WorkingArea;
        Location = new Point(screen.Right - Width - 16, screen.Bottom - Height - 16);

        // Allow dragging
        MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { Capture = false; Message m = Message.Create(Handle, 0xA1, (IntPtr)2, IntPtr.Zero); WndProc(ref m); } };

        // ── Header ──
        _headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 64,
            BackColor = BrandColor,
            Padding = new Padding(12, 8, 12, 8),
        };
        _headerPanel.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { Capture = false; Message m = Message.Create(Handle, 0xA1, (IntPtr)2, IntPtr.Zero); WndProc(ref m); } };

        _backBtn = new Button
        {
            Text = "←",
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Size = new Size(36, 36),
            Location = new Point(6, 14),
            Cursor = Cursors.Hand,
            Visible = false,
        };
        _backBtn.FlatAppearance.BorderSize = 0;
        _backBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(40, 255, 255, 255);
        _backBtn.Click += (s, e) => VoltarParaLista();

        // ── Close button in a right-docked panel to guarantee visibility ──
        var closeBtnPanel = new Panel
        {
            Dock = DockStyle.Right,
            Width = 44,
            BackColor = Color.Transparent,
        };
        var closeBtn = new Button
        {
            Text = "✕",
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Size = new Size(40, 40),
            Location = new Point(2, 12),
            Cursor = Cursors.Hand,
            TabIndex = 0,
        };
        closeBtn.FlatAppearance.BorderSize = 0;
        closeBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(200, 220, 50, 50);
        closeBtn.Click += (s, e) => { _pollTimer.Stop(); Hide(); };
        closeBtnPanel.Controls.Add(closeBtn);

        // ── Concluir (resolve) button ──
        _concluirBtn = new Button
        {
            Text = "✔ Finalizar",
            FlatStyle = FlatStyle.Flat,
            ForeColor = TextWhite,
            BackColor = AccentGreen,
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            Size = new Size(90, 30),
            Location = new Point(0, 17),
            Cursor = Cursors.Hand,
            Visible = false,
        };
        _concluirBtn.FlatAppearance.BorderSize = 0;
        _concluirBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(28, 170, 80);
        _concluirBtn.Click += async (s, e) => await ConcluirTicketAsync();

        var concluirPanel = new Panel
        {
            Dock = DockStyle.Right,
            Width = 96,
            BackColor = Color.Transparent,
        };
        concluirPanel.Controls.Add(_concluirBtn);

        _headerTitle = new Label
        {
            Text = "💬 MIConecta Chat",
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 13f, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(12, 12),
            BackColor = Color.Transparent,
        };

        _headerSubtitle = new Label
        {
            Text = "Suporte técnico",
            ForeColor = Color.FromArgb(200, 255, 255, 255),
            Font = new Font("Segoe UI", 8.5f),
            AutoSize = true,
            Location = new Point(12, 38),
            BackColor = Color.Transparent,
        };

        // Dock order matters: right-docked closeBtnPanel first, then add labels
        _headerPanel.Controls.Add(closeBtnPanel);
        _headerPanel.Controls.Add(concluirPanel);
        _headerPanel.Controls.Add(_backBtn);
        _headerPanel.Controls.Add(_headerTitle);
        _headerPanel.Controls.Add(_headerSubtitle);

        // ── Ticket list panel ──
        _ticketListPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgDark,
            AutoScroll = true,
            Padding = new Padding(8),
        };

        // ── Messages panel ──
        _messagesPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgDark,
            Visible = false,
        };

        _messagesFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = BgDark,
            Padding = new Padding(8, 8, 8, 8),
        };
        _messagesPanel.Controls.Add(_messagesFlow);

        // ── Input panel ──
        _inputPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 56,
            BackColor = BgPanel,
            Padding = new Padding(8, 8, 8, 8),
            Visible = false,
        };

        _inputBox = new TextBox
        {
            Dock = DockStyle.Fill,
            BackColor = BgInput,
            ForeColor = TextWhite,
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

        // Wrapper for input with padding
        var inputWrapper = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = BgInput,
            Padding = new Padding(10, 8, 6, 8),
        };
        inputWrapper.Controls.Add(_inputBox);

        // Round corners effect via paint
        inputWrapper.Paint += (s, e) =>
        {
            using var pen = new Pen(Color.FromArgb(60, 60, 80), 1);
            e.Graphics.DrawRectangle(pen, 0, 0, inputWrapper.Width - 1, inputWrapper.Height - 1);
        };

        _sendBtn = new Button
        {
            Text = "➤",
            Dock = DockStyle.Right,
            Width = 44,
            FlatStyle = FlatStyle.Flat,
            BackColor = BrandColor,
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 14f),
            Cursor = Cursors.Hand,
        };
        _sendBtn.FlatAppearance.BorderSize = 0;
        _sendBtn.Click += async (s, e) => await EnviarMensagemAsync();

        _inputPanel.Controls.Add(inputWrapper);
        _inputPanel.Controls.Add(_sendBtn);

        // ── Assemble ──
        Controls.Add(_ticketListPanel);
        Controls.Add(_messagesPanel);
        Controls.Add(_inputPanel);
        Controls.Add(_headerPanel);

        // ── Poll timer ──
        _pollTimer = new System.Windows.Forms.Timer { Interval = 5000 };
        _pollTimer.Tick += async (s, e) =>
        {
            if (_activeTicketId != null && Visible)
                await LoadMessagesAsync(_activeTicketId);
        };

        // ── Notification timer (poll when chat is hidden to alert new messages) ──
        var notifyTimer = new System.Windows.Forms.Timer { Interval = 15000 };
        notifyTimer.Tick += async (s, e) =>
        {
            try
            {
                if (Visible) return; // already watching live
                var tickets = await _api.ListarTicketsAsync();
                // If we have any active ticket, check messages for new tech replies
                foreach (var t in tickets)
                {
                    if (t.Status is "resolvido" or "fechado" or "cancelado") continue;
                    var msgs = await _api.ListarMensagensAsync(t.Id);
                    var lastMsg = msgs.LastOrDefault();
                    if (lastMsg != null && lastMsg.IsTechnician && !_renderedMessageIds.Contains(lastMsg.Id))
                    {
                        MostrarNotificacao($"💬 {t.Titulo}", $"{lastMsg.RemetenteNome}: {lastMsg.Conteudo}");
                        break; // one notification at a time
                    }
                }
            }
            catch { /* silent */ }
        };
        notifyTimer.Start();
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
                ForeColor = TextWhite,
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
        var conversas = await _api.ListarConversacoesAsync();
        var tickets = await _api.ListarTicketsAsync();
        var merged = new List<ChatTicket>();
        merged.AddRange(conversas);
        merged.AddRange(tickets);
        _ticketListPanel.Controls.Clear();

        // Mostrar erro da API se houver
        if (_api.LastError != null)
        {
            var apiErrorLabel = new Label
            {
                Text = $"⚠ {_api.LastError}",
                ForeColor = Color.FromArgb(251, 191, 36),
                Font = new Font("Segoe UI", 8f),
                Dock = DockStyle.Top,
                TextAlign = ContentAlignment.MiddleCenter,
                Height = 24,
            };
            _ticketListPanel.Controls.Add(apiErrorLabel);
        }

        // Novo chamado + conversa sem ticket
        var newTicketBtn = CriarBotaoNovoTicket();
        _ticketListPanel.Controls.Add(newTicketBtn);
        var novaConversaBtn = CriarBotaoNovaConversa();
        _ticketListPanel.Controls.Add(novaConversaBtn);

        if (merged.Count == 0)
        {
            var emptyLabel = new Label
            {
                Text = "Nenhum chamado ativo.\nClique acima para iniciar uma conversa.",
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 9.5f),
                Dock = DockStyle.Top,
                TextAlign = ContentAlignment.MiddleCenter,
                Height = 80,
                Padding = new Padding(0, 20, 0, 0),
            };
            _ticketListPanel.Controls.Add(emptyLabel);
        }
        else
        {
            // Reverse so newest is at top (controls dock top = first added is lowest)
            for (int i = merged.Count - 1; i >= 0; i--)
            {
                var ticket = merged[i];
                var ticketPanel = CriarItemTicket(ticket);
                _ticketListPanel.Controls.Add(ticketPanel);
            }
        }
    }

    private Button CriarBotaoNovoTicket()
    {
        var btn = new Button
        {
            Text = "＋  Novo chamado",
            Dock = DockStyle.Top,
            Height = 44,
            FlatStyle = FlatStyle.Flat,
            BackColor = BrandColor,
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(0, 0, 0, 8),
        };
        btn.FlatAppearance.BorderSize = 0;
        btn.Click += async (s, e) => await CriarNovoTicketAsync();
        return btn;
    }

    private Button CriarBotaoNovaConversa()
    {
        var btn = new Button
        {
            Text = "💬  Conversa com suporte (sem chamado)",
            Dock = DockStyle.Top,
            Height = 40,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(45, 55, 72),
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(0, 0, 0, 8),
        };
        btn.FlatAppearance.BorderSize = 0;
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
            Height = 60,
            BackColor = BgPanel,
            Margin = new Padding(0, 0, 0, 4),
            Cursor = Cursors.Hand,
            Padding = new Padding(12, 8, 12, 8),
        };

        var statusColor = ticket.IsConversation
            ? BrandColor
            : ticket.Status switch
            {
                "aberto" => AccentGreen,
                "em_atendimento" => Color.FromArgb(251, 191, 36), // amber
                _ => TextMuted,
            };

        var dot = new Label
        {
            Text = "●",
            ForeColor = statusColor,
            Font = new Font("Segoe UI", 8f),
            AutoSize = true,
            Location = new Point(12, 22),
        };

        var titleLabel = new Label
        {
            Text = ticket.Titulo.Length > 35 ? ticket.Titulo[..35] + "…" : ticket.Titulo,
            ForeColor = TextWhite,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            AutoSize = true,
            Location = new Point(30, 10),
            BackColor = Color.Transparent,
        };

        var statusLabel = new Label
        {
            Text = ticket.IsConversation ? "conversa" : ticket.Status.Replace("_", " "),
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 8f),
            AutoSize = true,
            Location = new Point(30, 34),
            BackColor = Color.Transparent,
        };

        var arrow = new Label
        {
            Text = "›",
            ForeColor = TextMuted,
            Font = new Font("Segoe UI", 16f),
            AutoSize = true,
            Location = new Point(panel.Width - 30, 16),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
        };

        panel.Controls.AddRange([dot, titleLabel, statusLabel, arrow]);

        // Click on any part
        void onClick(object? s, EventArgs e) => _ = AbrirTicketAsync(ticket);
        panel.Click += onClick;
        titleLabel.Click += onClick;
        statusLabel.Click += onClick;
        dot.Click += onClick;
        arrow.Click += onClick;

        panel.MouseEnter += (s, e) => panel.BackColor = Color.FromArgb(44, 44, 60);
        panel.MouseLeave += (s, e) => panel.BackColor = BgPanel;

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
        _renderedMessageIds.Clear();
        _messagesFlow.Controls.Clear();

        _isTicketListView = false;
        _ticketListPanel.Visible = false;
        _messagesPanel.Visible = true;
        _inputPanel.Visible = true;
        _backBtn.Visible = true;
        _headerTitle.Text = ticket.Titulo.Length > 28 ? ticket.Titulo[..28] + "…" : ticket.Titulo;
        _headerTitle.Location = new Point(44, 12);
        _headerSubtitle.Text = ticket.Status.Replace("_", " ");
        _headerSubtitle.Location = new Point(44, 38);

        // Finalizar só para tickets ativos (não para conversation pura)
        var canConcluir = !ticket.IsConversation && ticket.Status is "aberto" or "em_atendimento" or "aguardando_cliente" or "aguardando_tecnico";
        _concluirBtn.Visible = canConcluir;
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
        _isTicketListView = true;

        _messagesPanel.Visible = false;
        _inputPanel.Visible = false;
        _ticketListPanel.Visible = true;
        _backBtn.Visible = false;
        _concluirBtn.Visible = false;
        _headerTitle.Text = "💬 MIConecta Chat";
        _headerTitle.Location = new Point(12, 12);
        _headerSubtitle.Text = "Suporte técnico";
        _headerSubtitle.Location = new Point(12, 38);

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
        var isMine = !msg.IsTechnician;
        var bubbleColor = isMine ? BgBubbleMe : BgBubbleThem;
        var align = isMine ? ContentAlignment.MiddleRight : ContentAlignment.MiddleLeft;

        var wrapper = new Panel
        {
            Width = _messagesFlow.ClientSize.Width - 20,
            AutoSize = true,
            MinimumSize = new Size(_messagesFlow.ClientSize.Width - 20, 40),
            MaximumSize = new Size(_messagesFlow.ClientSize.Width - 20, 0),
            Margin = new Padding(0, 2, 0, 2),
            BackColor = Color.Transparent,
        };

        // Sender name (only for technician)
        if (msg.IsTechnician && !string.IsNullOrEmpty(msg.RemetenteNome))
        {
            var nameLabel = new Label
            {
                Text = msg.RemetenteNome,
                ForeColor = BrandColor,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(0, 0),
            };
            wrapper.Controls.Add(nameLabel);
        }

        var topOffset = msg.IsTechnician ? 16 : 0;

        var bubble = new Label
        {
            Text = msg.Conteudo,
            ForeColor = TextWhite,
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

        var confirm = MessageBox.Show(
            "Deseja finalizar este chamado?\nEle será removido da lista ativa e ficará no histórico.",
            "Finalizar Chamado",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (confirm != DialogResult.Yes) return;

        _concluirBtn.Enabled = false;
        _concluirBtn.Text = "…";

        try
        {
            var ok = await _api.ConcluirTicketAsync(_activeTicketId);
            if (!ok)
            {
                MessageBox.Show("Não foi possível concluir o chamado.", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                _concluirBtn.Enabled = true;
                _concluirBtn.Text = "✔ Finalizar";
                return;
            }

            // Show satisfaction dialog
            using var satisfacaoDialog = new SatisfacaoDialog();
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
            _concluirBtn.Text = "✔ Finalizar";
        }
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
            _notifyIcon.BalloonTipClicked += (s, e) => ShowChat();
        }

        _notifyIcon.BalloonTipTitle = titulo;
        _notifyIcon.BalloonTipText = mensagem.Length > 80 ? mensagem[..80] + "…" : mensagem;
        _notifyIcon.BalloonTipIcon = ToolTipIcon.Info;
        _notifyIcon.ShowBalloonTip(5000);

        // Play system notification sound
        try { SystemSounds.Asterisk.Play(); } catch { }
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
        Text = "Novo Chamado";
        Size = new Size(360, 260);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        BackColor = Color.FromArgb(32, 32, 44);
        ForeColor = Color.White;

        var titleLabel = new Label { Text = "Assunto:", Location = new Point(16, 16), AutoSize = true, Font = new Font("Segoe UI", 9.5f) };
        _tituloBox = new TextBox
        {
            Location = new Point(16, 38),
            Size = new Size(310, 28),
            BackColor = Color.FromArgb(40, 40, 56),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 10f),
            BorderStyle = BorderStyle.FixedSingle,
        };

        var descLabel = new Label { Text = "Descrição:", Location = new Point(16, 72), AutoSize = true, Font = new Font("Segoe UI", 9.5f) };
        _descricaoBox = new TextBox
        {
            Location = new Point(16, 94),
            Size = new Size(310, 80),
            Multiline = true,
            BackColor = Color.FromArgb(40, 40, 56),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 10f),
            BorderStyle = BorderStyle.FixedSingle,
        };

        var okBtn = new Button
        {
            Text = "Criar chamado",
            Location = new Point(16, 186),
            Size = new Size(150, 32),
            BackColor = Color.FromArgb(59, 130, 246),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            DialogResult = DialogResult.OK,
        };
        okBtn.FlatAppearance.BorderSize = 0;

        var cancelBtn = new Button
        {
            Text = "Cancelar",
            Location = new Point(176, 186),
            Size = new Size(150, 32),
            BackColor = Color.FromArgb(60, 60, 80),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f),
            DialogResult = DialogResult.Cancel,
        };
        cancelBtn.FlatAppearance.BorderSize = 0;

        Controls.AddRange([titleLabel, _tituloBox, descLabel, _descricaoBox, okBtn, cancelBtn]);
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

// ══════════════════════════════════════════════════════
// Dialog: Pesquisa de satisfação (5 carinhas)
// ══════════════════════════════════════════════════════

public class SatisfacaoDialog : Form
{
    public int Nota { get; private set; }
    public string Comentario { get; private set; } = "";

    private TextBox _comentarioBox = null!;
    private Button? _selectedBtn;

    private static readonly (string emoji, string label, int nota, Color color)[] Opcoes =
    [
        ("😠", "Péssimo", 1, Color.FromArgb(239, 68, 68)),
        ("😟", "Ruim",    2, Color.FromArgb(249, 115, 22)),
        ("😐", "Mediano", 3, Color.FromArgb(234, 179, 8)),
        ("😊", "Bom",     4, Color.FromArgb(132, 204, 22)),
        ("😄", "Excelente", 5, Color.FromArgb(34, 197, 94)),
    ];

    public SatisfacaoDialog()
    {
        Text = "Avaliação do Atendimento";
        Size = new Size(400, 340);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        BackColor = Color.FromArgb(32, 32, 44);
        ForeColor = Color.White;

        var questionLabel = new Label
        {
            Text = "Como foi o atendimento?",
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 12f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Top,
            Height = 44,
            Padding = new Padding(0, 12, 0, 0),
        };
        Controls.Add(questionLabel);

        // Emoji face buttons panel
        var facesPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 90,
            Padding = new Padding(16, 4, 16, 4),
        };
        Controls.Add(facesPanel);

        int btnWidth = 64;
        int spacing = (360 - btnWidth * 5) / 4;
        int x = 10;

        foreach (var (emoji, label, nota, color) in Opcoes)
        {
            var btn = new Button
            {
                Text = emoji,
                Font = new Font("Segoe UI Emoji", 24f),
                Size = new Size(btnWidth, btnWidth),
                Location = new Point(x, 2),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(48, 48, 64),
                ForeColor = Color.White,
                Cursor = Cursors.Hand,
                Tag = nota,
            };
            btn.FlatAppearance.BorderSize = 2;
            btn.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 80);
            btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(60, 60, 80);

            var lbl = new Label
            {
                Text = label,
                ForeColor = color,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(btnWidth, 16),
                Location = new Point(x, btnWidth + 4),
            };

            btn.Click += (s, e) =>
            {
                // Deselect previous
                if (_selectedBtn != null)
                {
                    _selectedBtn.BackColor = Color.FromArgb(48, 48, 64);
                    _selectedBtn.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 80);
                }

                Nota = nota;
                _selectedBtn = btn;
                btn.BackColor = Color.FromArgb(color.R / 4, color.G / 4, color.B / 4);
                btn.FlatAppearance.BorderColor = color;
            };

            facesPanel.Controls.Add(btn);
            facesPanel.Controls.Add(lbl);

            x += btnWidth + spacing;
        }

        // Comment box
        var commentLabel = new Label
        {
            Text = "Comentário (opcional):",
            Location = new Point(16, 146),
            AutoSize = true,
            Font = new Font("Segoe UI", 9f),
        };
        Controls.Add(commentLabel);

        _comentarioBox = new TextBox
        {
            Location = new Point(16, 168),
            Size = new Size(352, 70),
            Multiline = true,
            BackColor = Color.FromArgb(40, 40, 56),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 9.5f),
            BorderStyle = BorderStyle.FixedSingle,
        };
        Controls.Add(_comentarioBox);

        // Buttons
        var enviarBtn = new Button
        {
            Text = "Enviar avaliação",
            Location = new Point(16, 252),
            Size = new Size(170, 36),
            BackColor = Color.FromArgb(34, 197, 94),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            Cursor = Cursors.Hand,
        };
        enviarBtn.FlatAppearance.BorderSize = 0;
        enviarBtn.Click += (s, e) =>
        {
            if (Nota == 0)
            {
                MessageBox.Show("Por favor, selecione uma avaliação.", "Avaliação", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Comentario = _comentarioBox.Text.Trim();
            DialogResult = DialogResult.OK;
            Close();
        };
        Controls.Add(enviarBtn);

        var pularBtn = new Button
        {
            Text = "Pular",
            Location = new Point(200, 252),
            Size = new Size(168, 36),
            BackColor = Color.FromArgb(60, 60, 80),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10f),
            Cursor = Cursors.Hand,
            DialogResult = DialogResult.Cancel,
        };
        pularBtn.FlatAppearance.BorderSize = 0;
        Controls.Add(pularBtn);

        CancelButton = pularBtn;
    }
}
