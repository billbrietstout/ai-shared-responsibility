#!/usr/bin/env python3
"""Render gold inventory.json files to diagram.svg and diagram.png.

Layout: one column per trust boundary, boxes for contained nodes, arrows for
data flows. Ids in the SVG data-id attributes match inventory ids. Mermaid
sources in each gold folder use underscore ids; the eval harness treats
underscore and hyphen as the same token.
"""
from __future__ import annotations

import json
import os
import struct
import zlib
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.abspath(__file__))
GOLD = os.path.join(ROOT, "gold")

COL_W = 280
PAD = 28
HEADER_H = 48
BOX_H = 44
BOX_GAP = 16
TOP = 72
BOTTOM = 40
SVG_NS = "http://www.w3.org/2000/svg"


def load_systems():
    systems = []
    for name in sorted(os.listdir(GOLD)):
        inv_path = os.path.join(GOLD, name, "inventory.json")
        if os.path.isfile(inv_path):
            with open(inv_path, encoding="utf-8") as f:
                data = json.load(f)
            data["_dir"] = os.path.join(GOLD, name)
            systems.append(data)
    return systems


def all_nodes(inv):
    nodes = []
    for key, default_type in (
        ("external_actors", "actor"),
        ("components", "process"),
        ("data_stores", "store"),
    ):
        for item in inv.get(key, []):
            node = dict(item)
            node.setdefault("type", default_type)
            nodes.append(node)
    return nodes


def layout(inv):
    nodes = {n["id"]: n for n in all_nodes(inv)}
    boundaries = inv["trust_boundaries"]
    placed = {}
    col_heights = []
    for col, bound in enumerate(boundaries):
        ids = [i for i in bound.get("contains", []) if i in nodes]
        col_heights.append(HEADER_H + len(ids) * (BOX_H + BOX_GAP) + PAD)
        for row, nid in enumerate(ids):
            x = PAD + col * COL_W + 16
            y = TOP + HEADER_H + row * (BOX_H + BOX_GAP)
            placed[nid] = {
                "id": nid,
                "name": nodes[nid]["name"],
                "type": nodes[nid].get("type", "process"),
                "x": x,
                "y": y,
                "w": COL_W - 48,
                "h": BOX_H,
                "cx": x + (COL_W - 48) / 2,
                "cy": y + BOX_H / 2,
                "col": col,
            }
    width = PAD * 2 + len(boundaries) * COL_W
    height = TOP + max(col_heights + [120]) + BOTTOM
    return placed, width, height


def svg_for(inv, placed, width, height):
    parts = [
        f'<svg xmlns="{SVG_NS}" width="{int(width)}" height="{int(height)}" viewBox="0 0 {int(width)} {int(height)}">',
        '<rect width="100%" height="100%" fill="#f8fafc"/>',
        f'<text x="{PAD}" y="36" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">{escape(inv["system_name"])}</text>',
        f'<text x="{PAD}" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#64748b">{escape(inv.get("perspective", ""))}</text>',
    ]
    col_heights = []
    for col, bound in enumerate(inv["trust_boundaries"]):
        ids = bound.get("contains", [])
        h = HEADER_H + max(len(ids), 1) * (BOX_H + BOX_GAP) + 12
        col_heights.append(h)
        x = PAD + col * COL_W
        y = TOP
        parts.append(
            f'<rect x="{x}" y="{y}" width="{COL_W - 16}" height="{h}" rx="8" fill="#fff" stroke="#94a3b8" data-id="{escape(bound["id"])}" data-kind="trust-boundary"/>'
        )
        parts.append(
            f'<text x="{x + 12}" y="{y + 28}" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#1e3a8a">{escape(bound["name"])}</text>'
        )
    for nid, box in placed.items():
        fill = "#e0e7ff" if box["type"] == "process" else "#fef3c7" if box["type"] == "store" else "#dcfce7"
        parts.append(
            f'<rect x="{box["x"]}" y="{box["y"]}" width="{box["w"]}" height="{box["h"]}" rx="6" fill="{fill}" stroke="#334155" data-id="{escape(nid)}" data-kind="component"/>'
        )
        parts.append(
            f'<text x="{box["cx"]}" y="{box["cy"] + 4}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#0f172a">{escape(box["name"])}</text>'
        )
    for flow in inv["data_flows"]:
        a = placed.get(flow["from"])
        b = placed.get(flow["to"])
        if not a or not b:
            continue
        parts.append(
            f'<line x1="{a["cx"]}" y1="{a["cy"]}" x2="{b["cx"]}" y2="{b["cy"]}" stroke="#64748b" stroke-width="1.25" marker-end="url(#arrow)" data-id="{escape(flow["id"])}" data-kind="flow"/>'
        )
    parts.insert(
        3,
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>',
    )
    parts.append("</svg>")
    return "\n".join(parts)


def write_png(path, inv, placed, width, height):
    w, h = int(width), int(height)
    # RGB rows, white background
    img = [[(248, 250, 252)] * w for _ in range(h)]

    def fill_rect(x, y, rw, rh, color, outline=None):
        x0, y0 = max(int(x), 0), max(int(y), 0)
        x1, y1 = min(int(x + rw), w), min(int(y + rh), h)
        for yy in range(y0, y1):
            row = img[yy]
            for xx in range(x0, x1):
                if outline and (yy in (y0, y1 - 1) or xx in (x0, x1 - 1)):
                    row[xx] = outline
                else:
                    row[xx] = color

    def blend_text_bar(x, y, rw, color):
        # Stand-in for labels: a short bar so the PNG is not blank boxes only.
        fill_rect(x, y, rw, 6, color)

    fill_rect(PAD, 18, min(len(inv["system_name"]) * 8, w - 2 * PAD), 10, (15, 23, 42))
    for col, bound in enumerate(inv["trust_boundaries"]):
        ids = bound.get("contains", [])
        bh = HEADER_H + max(len(ids), 1) * (BOX_H + BOX_GAP) + 12
        x = PAD + col * COL_W
        fill_rect(x, TOP, COL_W - 16, bh, (255, 255, 255), (148, 163, 184))
        blend_text_bar(x + 12, TOP + 20, min(len(bound["name"]) * 6, COL_W - 40), (30, 58, 138))
    for box in placed.values():
        if box["type"] == "process":
            fill = (224, 231, 255)
        elif box["type"] == "store":
            fill = (254, 243, 199)
        else:
            fill = (220, 252, 231)
        fill_rect(box["x"], box["y"], box["w"], box["h"], fill, (51, 65, 85))
        blend_text_bar(box["x"] + 10, box["cy"] - 3, min(len(box["name"]) * 6, box["w"] - 20), (15, 23, 42))
    for flow in inv["data_flows"]:
        a = placed.get(flow["from"])
        b = placed.get(flow["to"])
        if not a or not b:
            continue
        # Bresenham
        x0, y0, x1, y1 = int(a["cx"]), int(a["cy"]), int(b["cx"]), int(b["cy"])
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            if 0 <= x0 < w and 0 <= y0 < h:
                img[y0][x0] = (100, 116, 139)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def png_bytes():
        def chunk(tag, data):
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        raw = b"".join(b"\x00" + bytes(ch for px in row for ch in px) for row in img)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png_bytes())


def main():
    for inv in load_systems():
        placed, width, height = layout(inv)
        svg = svg_for(inv, placed, width, height)
        svg_path = os.path.join(inv["_dir"], "diagram.svg")
        png_path = os.path.join(inv["_dir"], "diagram.png")
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg)
        write_png(png_path, inv, placed, width, height)
        print(f"wrote {svg_path} and {png_path}")


if __name__ == "__main__":
    main()
