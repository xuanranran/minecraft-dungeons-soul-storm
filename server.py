import functools
import json
import subprocess
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if urlsplit(self.path).path != '/api/time':
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/api/time':
            # Read-only NTP status. Browsers receive time without changing their clocks.
            try:
                status = subprocess.run(
                    ['timedatectl', 'show', '-p', 'NTPSynchronized', '--value'],
                    capture_output=True, text=True, timeout=2,
                )
                synchronized = (status.stdout.strip() == 'yes' if status.returncode == 0
                                else Path('/run/systemd/timesync/synchronized').exists())
            except (OSError, subprocess.TimeoutExpired):
                synchronized = Path('/run/systemd/timesync/synchronized').exists()
            payload = json.dumps({
                'unixMs': time.time_ns() / 1_000_000,
                'synchronized': synchronized,
                'source': 'Debian NTP',
                'timezone': 'Asia/Shanghai',
            }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store, max-age=0')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()


if __name__ == '__main__':
    handler = functools.partial(Handler, directory='/opt/map-rotation')
    ThreadingHTTPServer(('0.0.0.0', 62620), handler).serve_forever()
