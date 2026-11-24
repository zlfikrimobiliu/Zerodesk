<script setup>
import CopyBlock from '../components/CopyBlock.vue'

const toc = [
  { id: 'beda', title: '1. Public vs Local' },
  { id: 'cepat', title: '2. Alur cepat' },
  { id: 'login', title: '3. Login console' },
  { id: 'apps', title: '4. Apps (installer)' },
  { id: 'win', title: '5. Agent Windows' },
  { id: 'linux', title: '6. Agent Linux' },
  { id: 'mac', title: '7. Agent macOS' },
  { id: 'monitor', title: '8. Monitor / Clients' },
  { id: 'remote', title: '9. Remote' },
  { id: 'log', title: '10. Log & Sessions' },
  { id: 'set', title: '11. Setting' },
  { id: 'rusak', title: '12. Troubleshooting' },
]

function jump(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="docs-page">
    <div class="workspace-header">
      <h2 class="workspace-title">Dokumentasi publik</h2>
      <p class="workspace-desc">
        Remote lewat internet: agent Zerologic + backend
        <code>zerologic.lokanesa.com</code>. Bukan TightVNC LAN (itu menu Local).
      </p>
    </div>

    <div class="docs">
      <aside class="docs__toc">
        <p class="docs__toc-label">Isi</p>
        <button v-for="item in toc" :key="item.id" type="button" class="docs__toc-link" @click="jump(item.id)">
          {{ item.title }}
        </button>
      </aside>

      <article class="docs__body">
        <section id="beda">
          <h3>1. Public vs Local</h3>
          <p>
            <b>Public</b> memakai agent Zerologic di PC tujuan, control plane, dan (kalau LAN gagal) relay
            <code>wss://zerologic.lokanesa.com/relay</code>. Bisa dari luar kantor.
          </p>
          <p>
            <b>Local</b> menyambung langsung ke TightVNC/x11vnc di LAN (<code>:5900</code>). Tidak lewat backend publik.
            Jangan campur: hapus client di Public tidak mematikan TightVNC; matikan PC di Local tidak unenroll agent.
          </p>
        </section>

        <section id="cepat">
          <h3>2. Alur cepat (jangan loncat)</h3>
          <ol class="docs-steps">
            <li>Login console Zerologic (aplikasi desktop / superadmin).</li>
            <li>Public → <b>Apps</b>: pastikan installer Windows/Linux (macOS jika ada) sudah di-upload dan bertanda siap diunduh.</li>
            <li>Public → <b>Clients</b>: unduh installer sesuai OS PC tujuan.</li>
            <li>Pasang agent di PC tujuan (langkah 5–7). Tunggu 15–45 detik.</li>
            <li>Clients: device muncul <b>Online</b> (bukan Offline).</li>
            <li>Public → <b>Remote</b>: pilih PC itu (bukan PC console sendiri), lalu Hubungkan.</li>
            <li>Cek Public → <b>Log</b> (enroll/online) dan <b>Sessions</b> (sesi remote).</li>
          </ol>
          <p class="docs-note">
            Device enrolled tapi Offline = agent belum heartbeat. Jangan langsung Hubungkan. Lihat bagian 12.
          </p>
        </section>

        <section id="login">
          <h3>3. Login console</h3>
          <ol class="docs-steps">
            <li>Buka aplikasi desktop Zerologic (Tauri), bukan sembarang browser kalau mau Local/VNC.</li>
            <li>Isi username + password superadmin yang sudah dibuat di backend.</li>
            <li>Backend: <code>https://zerologic.lokanesa.com</code>. Cek Setting → Koneksi backend = Live API.</li>
          </ol>
        </section>

        <section id="apps">
          <h3>4. Apps — unggah installer ke server</h3>
          <p>
            Karyawan mengunduh dari Clients. File harus sudah ada di server. Upload hanya dari superadmin di Apps.
          </p>
          <ol class="docs-steps">
            <li>Public → <b>06 Apps</b>.</li>
            <li>Windows: pilih <code>ZerologicAgent-windows-x64.exe</code> dari <code>AGENT-REMOTESYSTEM/dist</code>, lalu Ganti Windows.</li>
            <li>Linux: pilih <code>ZerologicAgent-linux-x64.AppImage</code>, lalu Upload Linux.</li>
            <li>Tunggu progress 100%. Kartu harus “Siap diunduh”.</li>
            <li>Kalau error 404 upload: backend belum punya <code>PUT /api/v1/agents/downloads/:os</code>.</li>
          </ol>
          <p>Build Windows (di PC yang ada Rust):</p>
          <CopyBlock
            label="PowerShell · build agent Windows"
            text="cd AGENT-REMOTESYSTEM
cargo build --release --bin ZerologicAgent-windows-x64"
          />
          <p>Build Linux (dari Windows, Docker):</p>
          <CopyBlock
            label="PowerShell · build AppImage Linux"
            text="cd AGENT-REMOTESYSTEM
docker build -t zerologic-agent-linux .
docker create --name zl-linux-out zerologic-agent-linux
docker cp zl-linux-out:/ZerologicAgent-linux-x64.AppImage dist/ZerologicAgent-linux-x64.AppImage
docker rm zl-linux-out"
          />
        </section>

        <section id="win">
          <h3>5. Pasang agent di Windows (PC tujuan)</h3>
          <ol class="docs-steps">
            <li>Di Clients, pilih Windows → Unduh. Dapatkan <code>ZerologicAgent-windows-x64.exe</code>.</li>
            <li>Salin exe ke PC karyawan. Double-click. Izinkan UAC.</li>
            <li>Installer memasang service <code>ZerologicAgent</code> + helper <code>--desktop</code> (capture layar).</li>
            <li>Jangan remote ke PC console yang sama (Fikri → Fikri). Remote PC lain.</li>
            <li>Firewall Windows: izinkan outbound HTTPS 443 ke <code>zerologic.lokanesa.com</code>. LAN remote memakai TCP <code>17443</code> inbound dari console.</li>
            <li>Enroll key organisasi (sudah di installer/config): <code>zl-org-zerologic</code>.</li>
          </ol>
          <CopyBlock
            label="agent.toml Windows (opsional, jika belum tertulis otomatis)"
            text="api_url = &quot;https://zerologic.lokanesa.com&quot;
enroll_key = &quot;zl-org-zerologic&quot;"
          />
          <p>Letakkan di <code>%APPDATA%\Zerologic\agent.toml</code> atau folder yang sama dengan exe.</p>
          <CopyBlock
            label="CMD · cek service + log"
            text="sc query ZerologicAgent
notepad C:\ProgramData\Zerologic\agent.log"
          />
          <CopyBlock
            label="CMD · uninstall agent"
            text="ZerologicAgent-windows-x64.exe --uninstall"
          />
        </section>

        <section id="linux">
          <h3>6. Pasang agent di Linux (PC / VM tujuan)</h3>
          <p class="docs-warn">
            Jangan jalankan AppImage sebagai root. Capture layar butuh sesi desktop user (<code>DISPLAY=:0</code>).
            Pure Wayland tanpa XWayland belum didukung.
          </p>
          <ol class="docs-steps">
            <li>Unduh <code>ZerologicAgent-linux-x64.AppImage</code> dari Clients (setelah Apps upload).</li>
            <li>Login sebagai user desktop (contoh <code>rycroft</code>), bukan root.</li>
            <li>Salin file ke home, lalu:</li>
          </ol>
          <CopyBlock
            label="Bash · pasang agent (user desktop, bukan root)"
            text="chmod +x ZerologicAgent-linux-x64.AppImage
./ZerologicAgent-linux-x64.AppImage"
          />
          <p>
            Perintah itu menyalin binary ke <code>~/.local/share/zerologic/</code>, menulis autostart + systemd --user, lalu
            menjalankan <code>--desktop</code>.
          </p>
          <CopyBlock
            label="Bash · wajib: ada DISPLAY"
            text="echo $DISPLAY
xdpyinfo -display :0 | head"
          />
          <p><code>DISPLAY</code> harus ada (biasanya <code>:0</code>). Kalau kosong, agent tidak bisa kirim layar.</p>
          <CopyBlock
            label="Bash · clipboard (X11)"
            text="sudo apt update
sudo apt install -y xclip"
          />
          <CopyBlock
            label="Bash · log + jalankan debug (user desktop)"
            text="tail -f ~/.local/share/zerologic/agent.log
DISPLAY=:0 XAUTHORITY=$HOME/.Xauthority ~/.local/share/zerologic/ZerologicAgent-linux-x64 --console"
          />
          <p>Ubuntu Server / VM tanpa GUI (contoh rycroft): pasang desktop, LightDM autologin, dummy X, baru agent.</p>
          <CopyBlock
            label="Bash · cek socket X dan authority"
            text="ls /tmp/.X11-unix/
ls -l ~/.Xauthority
ps aux | grep -E 'Xorg|lightdm' | grep -v grep"
          />
          <CopyBlock
            label="Bash · satu proses agent saja (jangan root)"
            text="pgrep -a ZerologicAgent || true"
          />
        </section>

        <section id="mac">
          <h3>7. Agent macOS</h3>
          <ol class="docs-steps">
            <li>Di Apps, unggah <code>ZerologicAgent-macos-universal.dmg</code> jika sudah di-build.</li>
            <li>Clients → macOS → Unduh.</li>
            <li>Buka DMG, izinkan di System Settings → Privacy (Screen Recording) saat diminta.</li>
            <li>Jika kartu Apps masih “Belum ada di server”, unduhan Clients akan gagal — upload dulu.</li>
          </ol>
        </section>

        <section id="monitor">
          <h3>8. Monitor dan Clients</h3>
          <p><b>Monitor</b> — peta + ringkasan PC online/offline + event terakhir. Bukan tempat remote.</p>
          <p><b>Clients</b> — daftar device hasil enroll: nama, OS, MAC, IP lokal, lokasi, status.</p>
          <ol class="docs-steps">
            <li>Ubah nama: ikon pensil. Nama custom tidak ditimpa hostname agent.</li>
            <li>Hapus client = cabut enroll di control plane. Agent di PC tidak ter-uninstall. Enroll ulang = deviceId baru.</li>
            <li>Status Online butuh heartbeat (sekitar &lt; 45 detik). Enroll sukses ≠ otomatis Online.</li>
            <li>Tombol remote dari Clients hanya untuk device Online.</li>
          </ol>
        </section>

        <section id="remote">
          <h3>9. Remote (layar agent)</h3>
          <ol class="docs-steps">
            <li>Public → Remote. Pilih device <b>online</b> di kiri.</li>
            <li>Jangan pilih PC yang sama dengan console (“PC ini”).</li>
            <li>Hubungkan. Console coba LAN TCP <code>:17443</code> dulu; kalau gagal, fallback relay publik.</li>
            <li>Clipboard: Ctrl+C/V sesuai hint di toolbar. Zoom header tidak mengubah stream remote (dikunci 100%).</li>
            <li>Tutup sesi dari toolbar. Jangan biarkan session menggantung.</li>
          </ol>
          <p class="docs-note">
            Unattended default (Setting) = agent boleh di-remote tanpa popup Izinkan. Require consent = sebaliknya.
          </p>
        </section>

        <section id="log">
          <h3>10. Log dan Sessions publik</h3>
          <p><b>Log publik</b> — enroll, online/idle/offline, mulai/selesai remote, hapus client. Dari API events, bukan TightVNC.</p>
          <p><b>Sessions publik</b> — siapa operator, device, durasi, path p2p atau relay. Session aktif tidak boleh dihapus dulu.</p>
        </section>

        <section id="set">
          <h3>11. Setting (global console)</h3>
          <ol class="docs-steps">
            <li>Relay region default, batas jam session, unattended, require consent, audit, notify offline.</li>
            <li>Simpan ke control plane Go. Panel kanan: mode Live vs Mock, WebSocket presence, URL API.</li>
          </ol>
        </section>

        <section id="rusak">
          <h3>12. Troubleshooting publik</h3>
          <p><b>Tidak muncul di Clients</b> — installer belum di-Apps; enroll key salah; PC offline internet; cek log agent.</p>
          <p><b>Enrolled tapi Offline</b> — proses <code>--desktop</code> tidak jalan; Linux tanpa DISPLAY; dijalankan sebagai root; heartbeat diblokir firewall 443.</p>
          <CopyBlock
            label="Linux · pastikan bukan root + ada X"
            text="whoami
echo $DISPLAY
tail -n 80 ~/.local/share/zerologic/agent.log"
          />
          <p><b>Hubungkan gagal / hitam</b> — pilih device online; bukan PC sendiri; session timeout: klik Hubungkan lagi; cek Sessions.</p>
          <p><b>Linux layar hitam / cursor aneh</b> — session harus X11/XWayland; dummy X harus <code>:0</code> dengan cookie user (bukan root).</p>
          <p><b>Clipboard Linux mati</b> — pasang <code>xclip</code> (X11) atau <code>wl-clipboard</code> (Wayland/XWayland).</p>
        </section>
      </article>
    </div>
  </div>
</template>
