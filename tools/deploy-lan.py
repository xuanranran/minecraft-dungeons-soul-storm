"""Publish an already validated Jamstack build to the existing LAN static server.

Requires paramiko and STORM_DEPLOY_PASSWORD. Retains previous entry documents
and leaves existing content-hashed assets available to already-open clients.
"""
import datetime
import io
import json
import os
import posixpath
import shlex
import tarfile
import tempfile
from pathlib import Path

import paramiko

root = Path(__file__).resolve().parents[1]
build = (root / 'dist').resolve()
if build.parent != root or not (build / 'routes.json').is_file():
    raise RuntimeError('Build and validate the static site before deploying')
route_count = len(json.loads((build / 'routes.json').read_text(encoding='utf-8')))
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
remote = '/opt/map-rotation'
backup = remote + '/backup-jamstack-' + stamp
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.2.190', username='root',
               password=os.environ['STORM_DEPLOY_PASSWORD'], timeout=15)
try:
    # Only the new HTML entry points are replaced; old JS/assets remain usable.
    # Keep a rollback archive of all existing HTML before touching the live files.
    command = ('mkdir -p ' + shlex.quote(backup) + ' && cd ' + shlex.quote(remote)
               + " && find . -path './backup-*' -prune -o -name '*.html' -type f -print0"
               + ' | tar --null -T - -czf ' + shlex.quote(backup + '/previous-entries.tar.gz'))
    _, stdout, stderr = client.exec_command(command, timeout=30)
    if stdout.channel.recv_exit_status():
        raise RuntimeError(stderr.read().decode())
    with tempfile.TemporaryDirectory(prefix='dungeons-jamstack-') as folder:
        archives = []
        for kind in ('resources', 'entries'):
            path = Path(folder) / (kind + '.tar.gz')
            with tarfile.open(path, 'w:gz') as archive:
                for source in sorted(build.rglob('*')):
                    if not source.is_file() or source.is_symlink():
                        continue
                    if (source.suffix == '.html') != (kind == 'entries'):
                        continue
                    name = source.relative_to(build).as_posix()
                    if kind == 'entries':
                        # This server already supplies NTP time; public Pages has no API.
                        html = source.read_text(encoding='utf-8').replace(
                            '<html ', '<html data-time-endpoint="./api/time" ', 1).encode('utf-8')
                        info = archive.gettarinfo(str(source), arcname=name)
                        info.size = len(html)
                        archive.addfile(info, io.BytesIO(html))
                    else:
                        archive.add(source, arcname=name)
            archives.append(path)
        with client.open_sftp() as sftp:
            for path in archives:
                target = posixpath.join(backup, path.name)
                sftp.put(str(path), target)
                command = 'tar -xzf ' + shlex.quote(target) + ' -C ' + shlex.quote(remote)
                _, stdout, stderr = client.exec_command(command, timeout=60)
                if stdout.channel.recv_exit_status():
                    raise RuntimeError(stderr.read().decode())
    print(f'LAN deployed: {route_count} static routes; previous entries archived at ' + backup)
finally:
    client.close()
