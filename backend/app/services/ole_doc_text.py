"""Extract body text from legacy Microsoft Word .doc (OLE) files without Office installed."""
from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import List, Optional

logger = logging.getLogger(__name__)

_BINARY_TO_UNICODE = {
    0x82: "\u201a",
    0x83: "\u0192",
    0x84: "\u201e",
    0x85: "\u2026",
    0x86: "\u2020",
    0x87: "\u2021",
    0x88: "\u02c6",
    0x89: "\u2030",
    0x8a: "\u0160",
    0x8b: "\u2039",
    0x8c: "\u0152",
    0x8e: "\u017d",
    0x91: "\u2018",
    0x92: "\u2019",
    0x93: "\u201c",
    0x94: "\u201d",
    0x95: "\u2022",
    0x96: "\u2013",
    0x97: "\u2014",
    0x98: "\u02dc",
    0x99: "\u2122",
    0x9a: "\u0161",
    0x9b: "\u203a",
    0x9c: "\u0153",
    0x9e: "\u017e",
    0x9f: "\u0178",
}


def _u16(buf: bytes, off: int) -> int:
    return buf[off] | (buf[off + 1] << 8)


def _u32(buf: bytes, off: int) -> int:
    return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)


def _binary_to_unicode(raw: bytes) -> str:
    chars: List[str] = []
    for b in raw:
        if b in _BINARY_TO_UNICODE:
            chars.append(_BINARY_TO_UNICODE[b])
        elif b == 0:
            continue
        else:
            chars.append(chr(b))
    return "".join(chars)


def _clean_word_text(text: str) -> str:
    # Map Word special chars similar to word-extractor filters.clean
    repl = {
        "\x02": "",
        "\x05": "",
        "\x07": "\t",
        "\x08": "",
        "\x0b": "\n",
        "\x0c": "\n",
        "\x0e": "",
        "\x13": "",
        "\x14": "",
        "\x15": "",
        "\x1e": "\u2011",
    }
    out = []
    for ch in text:
        if ch in repl:
            out.append(repl[ch])
        elif ord(ch) < 32 and ch not in "\n\t\r":
            continue
        else:
            out.append(ch)
    text = "".join(out).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_ole_doc_text(data: bytes) -> Optional[str]:
    """
    Read the WordDocument piece table and return body text.
    Returns None if the bytes are not a readable OLE Word document.
    """
    try:
        import olefile
    except ImportError:
        logger.warning("olefile not installed; cannot parse legacy .doc")
        return None

    if len(data) < 8 or data[:4] != b"\xd0\xcf\x11\xe0":
        return None

    try:
        with olefile.OleFileIO(BytesIO(data)) as ole:
            if not ole.exists("WordDocument"):
                return None
            word = ole.openstream("WordDocument").read()
            if len(word) < 0x4C + 4:
                return None
            magic = _u16(word, 0)
            if magic != 0xA5EC:
                # Some exporters still store readable piece tables; continue cautiously.
                logger.debug("Unexpected Word magic: %s", hex(magic))

            flags = _u16(word, 0x0A)
            table_name = "1Table" if (flags & 0x0200) else "0Table"
            if not ole.exists(table_name):
                # Try the other table stream
                alt = "0Table" if table_name == "1Table" else "1Table"
                if not ole.exists(alt):
                    return None
                table_name = alt
            table = ole.openstream(table_name).read()

            ccp_text = _u32(word, 0x004C)
            if ccp_text <= 0 or ccp_text > 50_000_000:
                return None

            pos = _u32(word, 0x01A2)
            if pos >= len(table):
                return None

            # Skip any grpprl that precedes the piece table (clx)
            while pos < len(table) and table[pos] == 1:
                pos += 1
                if pos + 2 > len(table):
                    return None
                skip = _u16(table, pos)
                pos += 2 + skip

            if pos >= len(table) or table[pos] != 2:
                return None
            pos += 1
            if pos + 4 > len(table):
                return None
            piece_table_size = _u32(table, pos)
            pos += 4
            if piece_table_size < 4 or pos + piece_table_size > len(table) + 4:
                # piece_table_size includes the trailing sentinel CP array math from file format
                pass

            pieces = (piece_table_size - 4) // 12
            if pieces <= 0 or pieces > 100_000:
                return None

            texts: List[str] = []
            start_cp = 0
            for x in range(pieces):
                # Piece descriptor descriptor is 8 bytes after the (pieces+1) CP array
                desc_off = pos + ((pieces + 1) * 4) + (x * 8) + 2
                if desc_off + 4 > len(table):
                    break
                start_file_pos = _u32(table, desc_off)
                unicode = (start_file_pos & 0x40000000) == 0
                if not unicode:
                    # Clear bit 30 with a 32-bit mask (avoid Python ~ infinite-width pitfall)
                    start_file_pos = (start_file_pos & 0xBFFFFFFF) // 2

                l_start = _u32(table, pos + (x * 4))
                l_end = _u32(table, pos + ((x + 1) * 4))
                tot_length = l_end - l_start
                if tot_length <= 0:
                    continue
                bpc = 2 if unicode else 1
                size = bpc * tot_length
                chunk = word[start_file_pos : start_file_pos + size]
                if unicode:
                    piece_text = chunk.decode("utf-16le", errors="ignore")
                else:
                    piece_text = _binary_to_unicode(chunk)
                texts.append(piece_text)
                start_cp += len(piece_text)
                if start_cp >= ccp_text:
                    # Trim to main document body length
                    joined = "".join(texts)
                    return _clean_word_text(joined[:ccp_text])

            joined = "".join(texts)
            if ccp_text and len(joined) > ccp_text:
                joined = joined[:ccp_text]
            cleaned = _clean_word_text(joined)
            return cleaned or None
    except Exception:
        logger.exception("OLE .doc text extraction failed")
        return None
