using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;

namespace MIConectaAgent.Tray;

/// <summary>Toast personalizado quando o técnico responde (canto inferior direito).</summary>
public sealed class TechReplyToastForm : Form
{
    public TechReplyToastForm(string title, string body, Action? onClickOpenChat)
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        Size = new Size(340, 96);
        BackColor = Color.FromArgb(30, 58, 138);
        TopMost = true;
        DoubleBuffered = true;

        var screen = Screen.PrimaryScreen!.WorkingArea;
        Location = new Point(screen.Right - Width - 20, screen.Bottom - Height - 20);

        var titleLbl = new Label
        {
            Text = title,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
            Location = new Point(14, 12),
            Size = new Size(Width - 28, 22),
            BackColor = Color.Transparent,
        };
        var bodyLbl = new Label
        {
            Text = body.Length > 120 ? body[..117] + "…" : body,
            ForeColor = Color.FromArgb(224, 231, 255),
            Font = new Font("Segoe UI", 9f),
            Location = new Point(14, 36),
            Size = new Size(Width - 28, 44),
            BackColor = Color.Transparent,
        };
        Controls.Add(titleLbl);
        Controls.Add(bodyLbl);

        var closeBtn = new Button
        {
            Text = "×",
            Size = new Size(28, 28),
            Location = new Point(Width - 32, 4),
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            Cursor = Cursors.Hand,
            TabStop = false,
        };
        closeBtn.FlatAppearance.BorderSize = 0;
        closeBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(59, 130, 246);
        closeBtn.Click += (_, _) => Close();
        Controls.Add(closeBtn);

        void open(object? _, EventArgs __)
        {
            onClickOpenChat?.Invoke();
            Close();
        }
        Click += open;
        titleLbl.Click += open;
        bodyLbl.Click += open;

        var t = new System.Windows.Forms.Timer { Interval = 6500 };
        t.Tick += (_, _) => { t.Stop(); Close(); };
        t.Start();

        Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var pen = new Pen(Color.FromArgb(96, 165, 250), 2);
            e.Graphics.DrawRectangle(pen, 1, 1, Width - 3, Height - 3);
        };
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= 0x80;
            return cp;
        }
    }
}

/// <summary>Confirmação de encerramento com número do chamado.</summary>
public sealed class EncerrarTicketDialog : Form
{
    public EncerrarTicketDialog(int numeroTicket, string titulo)
    {
        Text = "Encerrar chamado";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        Size = new Size(400, 220);
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        BackColor = Color.FromArgb(248, 250, 252);
        ForeColor = Color.FromArgb(15, 23, 42);

        var head = new Label
        {
            Text = numeroTicket > 0 ? $"Chamado #{numeroTicket}" : "Encerrar chamado",
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            ForeColor = Color.FromArgb(37, 99, 235),
            Location = new Point(20, 16),
            AutoSize = true,
        };
        var sub = new Label
        {
            Text = "Confirma o encerramento deste chamado?\nEle será marcado como resolvido e poderá ser avaliado em seguida.",
            Font = new Font("Segoe UI", 9.5f),
            ForeColor = Color.FromArgb(71, 85, 105),
            Location = new Point(20, 48),
            Size = new Size(360, 48),
        };
        var tit = new Label
        {
            Text = string.IsNullOrWhiteSpace(titulo) ? "" : $"“{titulo}”",
            Font = new Font("Segoe UI", 9f, FontStyle.Italic),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(20, 100),
            Size = new Size(360, 36),
        };

        var sim = new Button
        {
            Text = "Sim, encerrar",
            DialogResult = DialogResult.Yes,
            Location = new Point(20, 140),
            Size = new Size(170, 36),
            BackColor = Color.FromArgb(37, 99, 235),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand,
        };
        sim.FlatAppearance.BorderSize = 0;

        var nao = new Button
        {
            Text = "Cancelar",
            DialogResult = DialogResult.No,
            Location = new Point(200, 140),
            Size = new Size(170, 36),
            BackColor = Color.FromArgb(226, 232, 240),
            ForeColor = Color.FromArgb(51, 65, 85),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9.5f),
            Cursor = Cursors.Hand,
        };
        nao.FlatAppearance.BorderSize = 0;

        Controls.AddRange([head, sub, tit, sim, nao]);
        AcceptButton = sim;
        CancelButton = nao;
    }
}

/// <summary>Pesquisa de satisfação com rostos em cores vivas.</summary>
public sealed class SatisfacaoColoridaDialog : Form
{
    public int Nota { get; private set; }
    public string Comentario { get; private set; } = "";

    private TextBox _comentarioBox = null!;
    private Button? _selectedBtn;

    private static readonly (string emoji, string label, int nota, Color bg, Color border)[] Opcoes =
    [
        ("😠", "Péssimo", 1, Color.FromArgb(254, 226, 226), Color.FromArgb(239, 68, 68)),
        ("😟", "Ruim", 2, Color.FromArgb(255, 237, 213), Color.FromArgb(249, 115, 22)),
        ("😐", "Regular", 3, Color.FromArgb(254, 249, 195), Color.FromArgb(234, 179, 8)),
        ("😊", "Bom", 4, Color.FromArgb(220, 252, 231), Color.FromArgb(34, 197, 94)),
        ("😄", "Excelente", 5, Color.FromArgb(209, 250, 229), Color.FromArgb(16, 185, 129)),
    ];

    public SatisfacaoColoridaDialog()
    {
        Text = "Pesquisa de satisfação";
        Size = new Size(420, 400);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterParent;
        MaximizeBox = false;
        MinimizeBox = false;
        TopMost = true;
        BackColor = Color.White;

        var questionLabel = new Label
        {
            Text = "Como foi nosso atendimento?",
            ForeColor = Color.FromArgb(15, 23, 42),
            Font = new Font("Segoe UI", 13f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Top,
            Height = 52,
            Padding = new Padding(0, 16, 0, 0),
        };
        Controls.Add(questionLabel);

        var facesPanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 120,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            Padding = new Padding(12, 8, 12, 8),
            AutoSize = false,
            BackColor = Color.White,
        };
        Controls.Add(facesPanel);

        foreach (var (emoji, label, nota, bg, border) in Opcoes)
        {
            var cell = new Panel
            {
                Size = new Size(72, 108),
                Margin = new Padding(4, 0, 4, 0),
                BackColor = Color.White,
            };

            var btn = new Button
            {
                Text = emoji,
                Font = new Font("Segoe UI Emoji", 28f),
                Size = new Size(64, 64),
                Location = new Point(4, 4),
                FlatStyle = FlatStyle.Flat,
                BackColor = bg,
                Cursor = Cursors.Hand,
                Tag = nota,
            };
            btn.FlatAppearance.BorderSize = 2;
            btn.FlatAppearance.BorderColor = border;

            var lbl = new Label
            {
                Text = label,
                ForeColor = border,
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(72, 32),
                Location = new Point(0, 72),
                BackColor = Color.White,
            };

            btn.Click += (_, _) =>
            {
                if (_selectedBtn != null)
                {
                    var prev = (int)_selectedBtn.Tag!;
                    var prevOpt = Opcoes.First(o => o.nota == prev);
                    _selectedBtn.BackColor = prevOpt.bg;
                    _selectedBtn.FlatAppearance.BorderColor = prevOpt.border;
                }
                Nota = nota;
                _selectedBtn = btn;
                btn.BackColor = Color.FromArgb(
                    Math.Min(255, bg.R + 30),
                    Math.Min(255, bg.G + 30),
                    Math.Min(255, bg.B + 30));
                btn.FlatAppearance.BorderColor = Color.FromArgb(30, 64, 175);
            };

            cell.Controls.Add(btn);
            cell.Controls.Add(lbl);
            facesPanel.Controls.Add(cell);
        }

        var commentLabel = new Label
        {
            Text = "Comentário (opcional)",
            Location = new Point(20, 188),
            AutoSize = true,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            ForeColor = Color.FromArgb(71, 85, 105),
        };
        Controls.Add(commentLabel);

        _comentarioBox = new TextBox
        {
            Location = new Point(20, 210),
            Size = new Size(368, 72),
            Multiline = true,
            BackColor = Color.FromArgb(248, 250, 252),
            ForeColor = Color.FromArgb(15, 23, 42),
            Font = new Font("Segoe UI", 9.5f),
            BorderStyle = BorderStyle.FixedSingle,
        };
        Controls.Add(_comentarioBox);

        var enviarBtn = new Button
        {
            Text = "Enviar avaliação",
            Location = new Point(20, 296),
            Size = new Size(180, 40),
            BackColor = Color.FromArgb(16, 185, 129),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            Cursor = Cursors.Hand,
        };
        enviarBtn.FlatAppearance.BorderSize = 0;
        enviarBtn.Click += (_, _) =>
        {
            if (Nota == 0)
            {
                MessageBox.Show("Escolha uma das carinhas para avaliar.", "Avaliação",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
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
            Location = new Point(210, 296),
            Size = new Size(178, 40),
            BackColor = Color.FromArgb(241, 245, 249),
            ForeColor = Color.FromArgb(71, 85, 105),
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
