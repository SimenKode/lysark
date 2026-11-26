#!/usr/bin/env python3
"""Drive the owner's Windows 11 test VM (libvirt domain "win11") from the host.

There is no guest agent in the VM and the host firewall blocks connections
from the VM to the host, so testing goes like this:

  1. Put the files on a CD image and insert it into the VM's empty CD drive:
       genisoimage -quiet -J -r -V LYSARK -o release/lysark-test.iso <folder>
       virsh change-media win11 sdb "$PWD/release/lysark-test.iso" --insert --live
     (the image must be readable by libvirt; release/ is, /tmp is not)
  2. Type, click and take screenshots with this script.
  3. Eject and delete the image afterwards:
       virsh change-media win11 sdb --eject --live

Usage: tools/windows-vm.py <command> [args] [<command> [args] ...]
  type "<text>"     type text (the VM uses a Norwegian keyboard layout)
  key KEY_A+KEY_B   press a key combination (Linux key names, e.g. KEY_LEFTMETA+KEY_R)
  click X Y         left click at a position in screen pixels (1920 x 1200)
  dclick X Y        double click
  sleep SECONDS
  shot PATH         save PATH.ppm (full size) and PATH.jpg (1280 wide, for viewing)

Things that bit the first time:
  - A window that opens does not always get keyboard focus. Click in it
    before typing, and look at a screenshot before pressing Enter.
  - The Run dialog (Win+R) remembers the last command. Select all and type
    over it; never press Enter on text you did not type.
  - Coordinates read off the 1280 wide .jpg must be multiplied by 1.5.
  - The first start of Lysark takes about half a minute.
  - When the VM or the host is busy, a long line that is typed can come
    out garbled: AltGr (used for $ { } [ ] @) is left hanging, and the rest
    arrives as control characters. Look at the whole line before Enter. To
    clear it: key KEY_RIGHTALT, then key KEY_ESC. For anything longer than
    a short command, put a script on the CD image and type only
    "powershell -ep bypass -file d:\\p.ps1" (no AltGr in it).
"""
import json, subprocess, sys, time
import os

DOM = os.environ.get('LYSARK_VM', 'win11')
# char -> (key, shift, altgr) on a Norwegian layout
BASE = {c: (f'KEY_{c.upper()}', False, False) for c in 'abcdefghijklmnopqrstuvwxyz'}
BASE.update({c: (f'KEY_{c}', True, False) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'})
BASE.update({c: (f'KEY_{c}', False, False) for c in '0123456789'})
BASE.update({
  ' ': ('KEY_SPACE', 0, 0), '.': ('KEY_DOT', 0, 0), ',': ('KEY_COMMA', 0, 0), '-': ('KEY_SLASH', 0, 0),
  '_': ('KEY_SLASH', 1, 0), ':': ('KEY_DOT', 1, 0), ';': ('KEY_COMMA', 1, 0), '/': ('KEY_7', 1, 0),
  '\\': ('KEY_EQUAL', 0, 0), '"': ('KEY_2', 1, 0), '=': ('KEY_0', 1, 0), '(': ('KEY_8', 1, 0),
  ')': ('KEY_9', 1, 0), '+': ('KEY_MINUS', 0, 0), '?': ('KEY_MINUS', 1, 0), "'": ('KEY_BACKSLASH', 0, 0),
  '*': ('KEY_BACKSLASH', 1, 0), '!': ('KEY_1', 1, 0), '#': ('KEY_3', 1, 0), '%': ('KEY_5', 1, 0),
  '&': ('KEY_6', 1, 0), '$': ('KEY_4', 0, 1), '@': ('KEY_2', 0, 1), '{': ('KEY_7', 0, 1),
  '[': ('KEY_8', 0, 1), ']': ('KEY_9', 0, 1), '}': ('KEY_0', 0, 1), '|': ('KEY_GRAVE', 0, 0),
  '<': ('KEY_102ND', 0, 0), '>': ('KEY_102ND', 1, 0),
})
def key(*names):
    subprocess.run(['virsh', 'send-key', DOM, '--codeset', 'linux', '--holdtime', '40', *names], check=True, stdout=subprocess.DEVNULL)
    time.sleep(0.03)
def type_text(text):
    for ch in text:
        k, shift, altgr = BASE[ch]
        mods = (['KEY_LEFTSHIFT'] if shift else []) + (['KEY_RIGHTALT'] if altgr else [])
        key(*mods, k)
def qmp(cmd, args):
    out = subprocess.run(['virsh', 'qemu-monitor-command', DOM, json.dumps({'execute': cmd, 'arguments': args})], capture_output=True, text=True)
    if out.returncode: sys.exit(out.stderr)
def move(x, y, w=1920, h=1200):
    qmp('input-send-event', {'events': [
        {'type': 'abs', 'data': {'axis': 'x', 'value': int(x / w * 32767)}},
        {'type': 'abs', 'data': {'axis': 'y', 'value': int(y / h * 32767)}}]})
def click(x, y, button='left', double=False):
    move(x, y); time.sleep(0.15)
    for _ in range(2 if double else 1):
        qmp('input-send-event', {'events': [{'type': 'btn', 'data': {'down': True, 'button': button}}]})
        time.sleep(0.05)
        qmp('input-send-event', {'events': [{'type': 'btn', 'data': {'down': False, 'button': button}}]})
        time.sleep(0.08)
def shot(path):
    subprocess.run(['virsh', 'screenshot', DOM, path + '.ppm'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['convert', path + '.ppm', '-resize', '1280x800', '-quality', '82', path + '.jpg'], check=True)
if __name__ == '__main__':
    a = sys.argv[1:]
    i = 0
    while i < len(a):
        c = a[i]
        if c == 'type': type_text(a[i + 1]); i += 2
        elif c == 'key': key(*a[i + 1].split('+')); i += 2
        elif c == 'click': click(float(a[i + 1]), float(a[i + 2])); i += 3
        elif c == 'dclick': click(float(a[i + 1]), float(a[i + 2]), double=True); i += 3
        elif c == 'sleep': time.sleep(float(a[i + 1])); i += 2
        elif c == 'shot': shot(a[i + 1]); i += 2
        else: sys.exit('unknown ' + c)
