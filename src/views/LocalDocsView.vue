<script setup>
import CopyBlock from '../components/CopyBlock.vue'

const toc = [
  { id: 'apa', title: '1. Apa itu Local' },
  { id: 'cepat', title: '2. Alur cepat' },
  { id: 'kantor', title: '3. Kantor & PC' },
  { id: 'win', title: '4. TightVNC Windows' },
  { id: 'linux', title: '5. x11vnc Linux' },
  { id: 'service', title: '6. x11vnc tetap nyala' },
  { id: 'hubung', title: '7. Hubungkan' },
  { id: 'daya', title: '8. Reboot / Shutdown' },
  { id: 'wol', title: '9. Hidupkan (WOL)' },
  { id: 'log', title: '10. Log & Sessions lokal' },
  { id: 'rusak', title: '11. Troubleshooting' },
]

function jump(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="docs-page">
    <div class="workspace-header">
      <h2 class="workspace-title">Dokumentasi lokal</h2>
      <p class="workspace-desc">
        TightVNC/x11vnc di LAN kantor. Data kantor/PC hanya di console ini (bukan backend publik).
        Pakai aplikasi desktop Zerologic, bukan browser biasa.
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
        <section id="apa">
          <h3>1. Apa itu Local</h3>
          <p>
            Console (contoh IP <code>192.168.0.11</code>) menyambung TCP ke PC kantor port <b>5900</b>.
            Viewer di Zerologic = noVNC. Yang harus ada di PC tujuan adalah <b>VNC server</b>, bukan viewer.
          </p>
          <p class="docs-warn">
            <code>xtightvncviewer</code> di Linux adalah client (untuk melihat PC lain dari Linux itu sendiri).
            Zerologic Hubungkan membutuhkan server: TightVNC Server di Windows, atau <code>x11vnc</code> di Linux yang membagikan
            <code>DISPLAY=:0</code>. Jangan pakai <code>tightvncserver</code> — itu membuat sesi X baru, bukan layar yang sedang dipakai.
          </p>
        </section>

        <section id="cepat">
          <h3>2. Alur cepat</h3>
          <ol class="docs-steps">
            <li>Local → Kantor: tambah perusahaan + subnet (contoh <code>192.168.0.0/24</code>).</li>
            <li>Di PC Windows: pasang TightVNC <b>Server</b>, password, port 5900, clipboard share, bukan view-only.</li>
            <li>Di PC Linux: pasang <code>x11vnc</code>, password, listen 5900, systemd (bagian 5–6).</li>
            <li>Tambah PC: nama, IP LAN, port 5900, password VNC. MAC boleh kosong dulu (terisi otomatis saat online).</li>
            <li>Kartu harus Online + ms. Hubungkan / klik layar / klik kanan = jendela kontrol.</li>
            <li>Online: Reboot / Shutdown. Offline: Hidupkan (butuh MAC + WOL).</li>
          </ol>
        </section>

        <section id="kantor">
          <h3>3. Tambah kantor dan PC</h3>
          <ol class="docs-steps">
            <li>Local → <b>01 Kantor</b>.</li>
            <li>Form kiri: Nama perusahaan, Subnet LAN opsional (<code>192.168.0.0/24</code>), Tambah kantor.</li>
            <li>Klik perusahaan di daftar kiri. Banner hijau = console ada di LAN yang sama.</li>
            <li>Tambah PC: Nama, IP privat (10.x / 172.16–31.x / 192.168.x), port 5900, password TightVNC/x11vnc.</li>
            <li>MAC: isi <code>AA:BB:CC:DD:EE:FF</code> atau <b>Ambil dari LAN</b> saat PC online (tabel ARP).</li>
            <li>User/password Windows opsional (cadangan RPC shutdown). Jalur utama shutdown = ketik lewat VNC.</li>
            <li>Simpan. Filter Semua / Online / Offline. Hapus kantor menghapus semua PC di daftar console, tidak mematikan mesin.</li>
          </ol>
        </section>

        <section id="win">
          <h3>4. TightVNC Server di Windows (PC tujuan)</h3>
          <ol class="docs-steps">
            <li>Unduh TightVNC Windows dari situs resmi TightVNC. Pasang <b>TightVNC Server</b> (boleh tanpa Viewer).</li>
            <li>Set password server (bukan view-only). Password ini yang diisi di form PC Zerologic.</li>
            <li>Port RFB: <b>5900</b>. Centang jalankan sebagai service, start with Windows.</li>
            <li>Configuration: Allow loopback, share clipboard / primary, Accept connections, tidak “Disconnect existing” kecuali perlu.</li>
            <li>
              Jangan centang <b>Remove wallpaper</b> / <b>Blank screen</b>. Default TightVNC mematikan wallpaper
              (kadang blank monitor) selama ada client — desktop jadi hitam, taskbar masih kelihatan.
              Saat session ditutup, wallpaper kembali. ZeroDesk tidak mengirim perintah “hitamkan layar”;
              itu pengaturan server di PC tujuan. Tray TightVNC → Configuration → Server: hilangkan kedua opsi itu,
              Apply, atau pakai perintah registry di bawah lalu reload service.
            </li>
            <li>Firewall: izinkan inbound TCP 5900 dari LAN (File and Printer Sharing tidak cukup untuk VNC).</li>
            <li>User harus login ke desktop (bukan lock screen) untuk shutdown lewat Win+R dari Zerologic.</li>
          </ol>
          <CopyBlock
            label="CMD admin · izinkan port 5900 di firewall"
            text="netsh advfirewall firewall add rule name=&quot;TightVNC 5900&quot; dir=in action=allow protocol=TCP localport=5900"
          />
          <CopyBlock
            label="CMD · cek TightVNC listen 5900"
            text="netstat -ano | findstr :5900"
          />
          <CopyBlock
            label="CMD admin · wallpaper tetap tampil saat di-remote (lalu restart TightVNC)"
            text="reg add HKLM\SOFTWARE\TightVNC\Server /v RemoveWallpaper /t REG_DWORD /d 0 /f
reg add HKLM\SOFTWARE\TightVNC\Server /v BlankScreen /t REG_DWORD /d 0 /f
&quot;%ProgramFiles%\TightVNC\tvnserver.exe&quot; -reload"
          />
        </section>

        <section id="linux">
          <h3>5. x11vnc di Linux (contoh rycroft 192.168.0.55)</h3>
          <p>
            Viewer <code>xtightvncviewer</code> tidak membuka port 5900. Pasang <code>x11vnc</code>, user pemilik sesi X
            (contoh <code>rycroft</code>), <code>DISPLAY=:0</code>.
          </p>
          <ol class="docs-steps">
            <li>Pastikan ada socket X:</li>
          </ol>
          <CopyBlock
            label="Bash · cek X :0"
            text="ls /tmp/.X11-unix/
ls -l /home/rycroft/.Xauthority"
          />
          <p>Harus ada <code>X0</code> dan file <code>.Xauthority</code> milik user desktop.</p>
          <CopyBlock
            label="Bash · pasang x11vnc + simpan password"
            text="sudo apt update
sudo apt install -y x11vnc
sudo mkdir -p /home/rycroft/.vnc
sudo chown rycroft:rycroft /home/rycroft/.vnc
sudo -u rycroft x11vnc -storepasswd /home/rycroft/.vnc/passwd"
          />
          <p>Isi password (sama dengan field Password TightVNC di Zerologic). Jangan pakai <code>-localhost no</code> — x11vnc 0.9.16 menolak argumen <code>no</code> dan langsung keluar.</p>
          <CopyBlock
            label="Bash · tes sekali (biarkan terminal terbuka)"
            text="sudo -u rycroft env DISPLAY=:0 XAUTHORITY=/home/rycroft/.Xauthority \
  x11vnc -display :0 -auth /home/rycroft/.Xauthority \
  -rfbauth /home/rycroft/.vnc/passwd \
  -rfbport 5900 -shared -forever -repeat -noxdamage"
          />
          <p>Log sukses memuat <code>PORT=5900</code>. Lalu:</p>
          <CopyBlock
            label="Bash · pastikan listen"
            text="ss -lntp | grep 5900"
          />
          <p>Harus <code>0.0.0.0:5900</code> atau <code>*:5900</code>. <code>ufw status</code> inactive = tidak perlu buka firewall. Kalau aktif:</p>
          <CopyBlock
            label="Bash · UFW"
            text="sudo ufw allow 5900/tcp
sudo ufw reload
sudo ufw status"
          />
        </section>

        <section id="service">
          <h3>6. x11vnc tetap jalan (systemd)</h3>
          <p>Ctrl+C di terminal mematikan x11vnc. Pasang service:</p>
          <CopyBlock
            label="Bash · buat + nyalakan service x11vnc"
            text="sudo tee /etc/systemd/system/x11vnc.service >/dev/null <<'EOF'
[Unit]
Description=x11vnc display :0
After=display-manager.service
Wants=display-manager.service

[Service]
Type=simple
User=rycroft
Group=rycroft
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/rycroft/.Xauthority
ExecStartPre=/bin/sh -c 'until [ -S /tmp/.X11-unix/X0 ]; do sleep 1; done'
ExecStart=/usr/bin/x11vnc -display :0 -auth /home/rycroft/.Xauthority -rfbauth /home/rycroft/.vnc/passwd -rfbport 5900 -shared -forever -repeat -noxdamage -o /home/rycroft/.vnc/x11vnc.log
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now x11vnc
sudo systemctl status x11vnc --no-pager
ss -lntp | grep 5900"
          />
          <p>Ganti <code>rycroft</code> jika user desktop berbeda. Jangan Ctrl+C service ini.</p>
          <CopyBlock
            label="Bash · log & restart"
            text="sudo journalctl -u x11vnc -f
tail -f /home/rycroft/.vnc/x11vnc.log
sudo systemctl restart x11vnc"
          />
        </section>

        <section id="hubung">
          <h3>7. Hubungkan dari Zerologic</h3>
          <ol class="docs-steps">
            <li>Hanya di aplikasi desktop Zerologic (Tauri). Browser biasa tidak punya proxy VNC.</li>
            <li>Kartu Online (probe TCP 5900). Password di form harus sama dengan server.</li>
            <li>Hubungkan / klik preview / klik kanan → jendela baru. Paste di toolbar untuk clipboard ke remote.</li>
            <li>Thumbnail preview view-only (maks 6 stream). Saat shutdown, preview dilepas dulu supaya tidak bentrok.</li>
          </ol>
        </section>

        <section id="daya">
          <h3>8. Reboot dan Shutdown</h3>
          <ol class="docs-steps">
            <li>Hanya saat kartu Online. Konfirmasi kartu Zerologic (bukan popup browser).</li>
            <li>Jalur utama: TightVNC/x11vnc mengirim Win+R lalu <code>shutdown /s /t 0 /f</code> atau <code>/r</code>. User harus login, VNC bukan view-only, Win+R tidak diblokir policy.</li>
            <li>Cadangan: RPC Windows <code>shutdown /m \\IP</code> (timeout 5 detik, tidak menggantung console). Sering gagal jika firewall/admin share mati.</li>
            <li>Linux: perintah Win+R tidak berlaku. Matikan dari sesi VNC (menu OS) atau SSH di mesin itu.</li>
          </ol>
        </section>

        <section id="wol">
          <h3>9. Hidupkan (Wake-on-LAN)</h3>
          <p>PC mati tidak bisa dihidupkan lewat VNC. Zerologic mengirim magic packet ke MAC, dari semua NIC console (penting jika ada Hyper-V 172.x dan LAN 192.168.x).</p>
          <ol class="docs-steps">
            <li>Saat PC masih online, biarkan probe jalan — MAC tercatat otomatis di kartu. Atau Ubah PC → Ambil dari LAN.</li>
            <li>BIOS/UEFI: enable Wake on LAN / PME. Adapter Windows: Power Management → Allow magic packets.</li>
            <li>Kabel LAN (bukan Wi-Fi saja). PSU standby harus menyala.</li>
            <li>Kartu Offline → Hidupkan. Console menunggu probe ~30 detik.</li>
          </ol>
          <p class="docs-note">
            Jika PC sudah lama mati sebelum fitur MAC ada, ARP cache hilang. Isi MAC manual (stiker NIC / <code>ipconfig /all</code> saat pernah nyala).
          </p>
          <CopyBlock
            label="CMD Windows · lihat MAC (di PC tujuan, saat masih nyala)"
            text="ipconfig /all"
          />
        </section>

        <section id="log">
          <h3>10. Log dan Sessions lokal</h3>
          <p><b>02 Log</b> — konek, putus, gagal konek, shutdown, reboot, WOL, tambah/hapus PC/kantor. Hanya di console ini.</p>
          <p><b>03 Sessions</b> — jendela TightVNC: operator, kantor, PC, durasi, path <code>lan</code>. Bukan session agent P2P/relay.</p>
        </section>

        <section id="rusak">
          <h3>11. Troubleshooting lokal</h3>
          <p><b>Gagal konek TightVNC / kartu Offline</b> — tidak ada yang listen 5900; password salah; IP salah; ufw; Hyper-V isolation; x11vnc sudah Ctrl+C.</p>
          <p><b>x11vnc “unrecognized option no”</b> — hapus <code>-localhost no</code>, pakai perintah di bagian 5.</p>
          <p><b>webSocketsHandshake di log x11vnc</b> — probe/thumbnail Zerologic. Abaikan jika jendela remote tetap bergambar. Statistik KeyEvent/Framebuffer = sesi nyata.</p>
          <p><b>Not Responding saat Shutdown (versi lama)</b> — sudah diatasi: perintah RPC ber-timeout. Restart aplikasi kalau masih binary lama.</p>
          <p><b>Hidupkan: MAC belum tercatat</b> — nyalakan PC sekali di LAN, atau isi MAC di Ubah PC.</p>
          <p><b>Windows layar hitam / wallpaper hilang saat Hubungkan, normal lagi setelah Tutup</b> — TightVNC Server <b>Remove wallpaper</b> (default on) atau <b>Blank screen</b>. Matikan di Configuration, atau perintah registry di bagian 4. Bukan setting ZeroDesk.</p>
          <p><b>Taskbar dobel / layar letterbox</b> — TightVNC membagikan semua monitor atau scaling Windows 125–150%. Di PC tujuan: satu monitor, scale 100%, atau share primary saja.</p>
          <p><b>Linux layar dummy hitam</b> — x11vnc membagikan :0; pastikan LightDM/user sudah login ke desktop itu.</p>
          <CopyBlock
            label="Bash · diagnosis cepat 5900"
            text="ss -lntp | grep 5900
systemctl is-active x11vnc
tail -n 40 /home/rycroft/.vnc/x11vnc.log"
          />
        </section>
      </article>
    </div>
  </div>
</template>
