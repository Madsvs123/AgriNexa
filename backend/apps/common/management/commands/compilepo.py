"""Compile .po catalogues to .mo without the GNU gettext binaries.

Django reads only compiled .mo files, and `compilemessages` shells out to
`msgfmt`. That puts a gettext install in the path of every build image and
every developer machine. The .mo container is a documented, stable binary
format, so compiling it here keeps translations working with nothing but
Python.

Usage:
    python manage.py compilepo              # every locale in LOCALE_PATHS
    python manage.py compilepo --locale ar
"""

import array
import re
import struct
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

# Identifies a file as a gettext catalogue, little-endian.
MO_MAGIC = 0x950412DE

_ESCAPES = {
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "\\": "\\",
    '"': '"',
}


def unescape(value: str) -> str:
    out, i = [], 0
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            out.append(_ESCAPES.get(nxt, nxt))
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def parse_po(text: str) -> dict:
    """Parse a .po file into {msgid: msgstr}, including plural forms.

    Plurals are stored the way gettext stores them: the key is
    "singular\\x00plural" and the value joins the forms with \\x00.
    """
    entries: dict[str, str] = {}
    msgid = msgid_plural = None
    msgstrs: dict[int, str] = {}
    msgstr = None
    current = None  # which buffer a bare "continuation" line appends to
    fuzzy = False
    pending_fuzzy = False

    def flush():
        nonlocal msgid, msgid_plural, msgstr, msgstrs, fuzzy
        if msgid is not None and not fuzzy:
            if msgid_plural is not None:
                forms = [msgstrs[k] for k in sorted(msgstrs)]
                if any(f for f in forms):
                    entries[f"{msgid}\x00{msgid_plural}"] = "\x00".join(forms)
            elif msgstr:
                entries[msgid] = msgstr
        msgid = msgid_plural = msgstr = None
        msgstrs = {}
        fuzzy = False

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            if line.startswith("#,") and "fuzzy" in line:
                # Fuzzy entries are unreviewed guesses; gettext ignores them
                # and so do we, falling back to the source string.
                pending_fuzzy = True
            continue
        if line.startswith("msgid_plural "):
            msgid_plural = unescape(line[len("msgid_plural ") :].strip().strip('"'))
            current = "msgid_plural"
        elif line.startswith("msgid "):
            flush()
            fuzzy = pending_fuzzy
            pending_fuzzy = False
            msgid = unescape(line[len("msgid ") :].strip().strip('"'))
            current = "msgid"
        elif line.startswith("msgstr["):
            m = re.match(r'msgstr\[(\d+)\]\s+"(.*)"$', line)
            if m:
                idx = int(m.group(1))
                msgstrs[idx] = unescape(m.group(2))
                current = f"msgstr[{idx}]"
        elif line.startswith("msgstr "):
            msgstr = unescape(line[len("msgstr ") :].strip().strip('"'))
            current = "msgstr"
        elif line.startswith('"'):
            chunk = unescape(line.strip().strip('"'))
            if current == "msgid":
                msgid = (msgid or "") + chunk
            elif current == "msgid_plural":
                msgid_plural = (msgid_plural or "") + chunk
            elif current == "msgstr":
                msgstr = (msgstr or "") + chunk
            elif current and current.startswith("msgstr["):
                idx = int(current[7:-1])
                msgstrs[idx] = msgstrs.get(idx, "") + chunk
    flush()
    return entries


def write_mo(entries: dict, path: Path) -> int:
    """Serialise {msgid: msgstr} into the gettext .mo binary layout."""
    # Sorted keys: the format requires the id table to be ordered so readers
    # can binary-search it.
    items = sorted(entries.items())
    ids = b""
    strs = b""
    offsets = []
    for msgid, msgstr in items:
        encoded_id = msgid.encode("utf-8")
        encoded_str = msgstr.encode("utf-8")
        offsets.append((len(ids), len(encoded_id), len(strs), len(encoded_str)))
        ids += encoded_id + b"\x00"
        strs += encoded_str + b"\x00"

    count = len(items)
    key_start = 7 * 4 + 16 * count  # header + two offset tables
    value_start = key_start + len(ids)
    key_offsets = []
    value_offsets = []
    for id_off, id_len, str_off, str_len in offsets:
        key_offsets += [id_len, id_off + key_start]
        value_offsets += [str_len, str_off + value_start]

    output = struct.pack(
        "Iiiiiii",
        MO_MAGIC,
        0,              # revision
        count,
        7 * 4,          # offset of the msgid table
        7 * 4 + count * 8,  # offset of the msgstr table
        0,              # hash table size (unused)
        0,              # hash table offset
    )
    output += array.array("i", key_offsets + value_offsets).tobytes()
    output += ids
    output += strs
    path.write_bytes(output)
    return count


class Command(BaseCommand):
    help = "Compile .po files to .mo using pure Python (no gettext required)."

    def add_arguments(self, parser):
        parser.add_argument("--locale", "-l", action="append", dest="locales", default=[])

    def handle(self, *args, **options):
        locale_paths = [Path(p) for p in getattr(settings, "LOCALE_PATHS", [])]
        if not locale_paths:
            raise CommandError("LOCALE_PATHS is empty; nothing to compile.")

        wanted = set(options["locales"])
        compiled = 0
        for base in locale_paths:
            if not base.exists():
                continue
            for po in sorted(base.glob("*/LC_MESSAGES/*.po")):
                locale = po.parent.parent.name
                if wanted and locale not in wanted:
                    continue
                entries = parse_po(po.read_text(encoding="utf-8"))
                mo = po.with_suffix(".mo")
                n = write_mo(entries, mo)
                compiled += 1
                self.stdout.write(f"{locale}: {n} message(s) -> {mo.relative_to(base.parent)}")

        if not compiled:
            self.stdout.write(self.style.WARNING("No .po files found."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Compiled {compiled} catalogue(s)."))
