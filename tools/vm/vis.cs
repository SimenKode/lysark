// Shows a file as pictures on the screen, so it can be read off screenshots
// taken from the host: three bits in each cell of 4 x 4 pixels. A click or a
// key shows the next picture; after the last one the window closes.
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

public class LysarkShow : Form {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  // The foot is left alone: Windows writes over it when it is not activated.
  const int CELL = 4, MARGIN = 96, FOOT = 168, HEAD = 40;
  readonly byte[] data;
  readonly int frames, wide, high, per;
  int frame;
  Bitmap picture;

  public LysarkShow(byte[] bytes) {
    data = bytes;
    FormBorderStyle = FormBorderStyle.None;
    StartPosition = FormStartPosition.Manual;
    Bounds = Screen.PrimaryScreen.Bounds;
    TopMost = true;
    ShowInTaskbar = false;
    wide = (Bounds.Width - MARGIN) / CELL;
    high = (Bounds.Height - FOOT) / CELL;
    per = wide * high * 3 / 8 - HEAD;
    frames = Math.Max(1, (data.Length + per - 1) / per);
    SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
    MouseDown += delegate { Next(); };
    KeyDown += delegate(object s, KeyEventArgs e) { if (e.KeyCode == Keys.Escape) Close(); else Next(); };
    Timer end = new Timer();
    end.Interval = 15 * 60 * 1000;
    end.Tick += delegate { Close(); };
    end.Start();
    Draw();
  }

  void Next() {
    frame++;
    if (frame >= frames) { Close(); return; }
    Draw();
    Invalidate();
  }

  void Draw() {
    int start = frame * per, count = Math.Max(0, Math.Min(per, data.Length - start));
    byte[] all = new byte[HEAD + per];
    all[0] = (byte)'L'; all[1] = (byte)'Y'; all[2] = (byte)'S'; all[3] = (byte)'K';
    Put(all, 4, frame, 2); Put(all, 6, frames, 2); Put(all, 8, count, 4);
    Put(all, 12, data.Length, 4); Put(all, 16, wide, 2); Put(all, 18, high, 2);
    using (SHA256 sha = SHA256.Create()) {
      byte[] hash = sha.ComputeHash(data, start, count);
      Array.Copy(hash, 0, all, 20, 16);
    }
    Array.Copy(data, start, all, HEAD, count);
    Bitmap made = new Bitmap(Bounds.Width, Bounds.Height, PixelFormat.Format24bppRgb);
    BitmapData bits = made.LockBits(new Rectangle(0, 0, made.Width, made.Height), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
    byte[] px = new byte[bits.Stride * made.Height];
    int cells = wide * high;
    for (int i = 0; i < cells; i++) {
      byte r = Bit(all, i * 3), g = Bit(all, i * 3 + 1), b = Bit(all, i * 3 + 2);
      int cx = (i % wide) * CELL, cy = (i / wide) * CELL;
      for (int y = 0; y < CELL; y++) {
        int row = (cy + y) * bits.Stride + cx * 3;
        for (int x = 0; x < CELL; x++) { px[row + x * 3] = b; px[row + x * 3 + 1] = g; px[row + x * 3 + 2] = r; }
      }
    }
    Marshal.Copy(px, 0, bits.Scan0, px.Length);
    made.UnlockBits(bits);
    if (picture != null) picture.Dispose();
    picture = made;
  }

  static byte Bit(byte[] a, int bit) {
    int at = bit >> 3;
    return (byte)(at < a.Length && (a[at] & (0x80 >> (bit & 7))) != 0 ? 255 : 0);
  }

  static void Put(byte[] a, int at, int value, int n) {
    for (int i = 0; i < n; i++) a[at + i] = (byte)(value >> (8 * (n - 1 - i)));
  }

  protected override void OnPaint(PaintEventArgs e) {
    e.Graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
    e.Graphics.DrawImage(picture, new Rectangle(0, 0, picture.Width, picture.Height), 0, 0, picture.Width, picture.Height, GraphicsUnit.Pixel);
  }

  protected override void OnShown(EventArgs e) { base.OnShown(e); Activate(); }
}
