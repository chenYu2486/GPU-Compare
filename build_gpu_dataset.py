import json
import re
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


IMAGE_PATH = Path(r"C:\Users\17872\Desktop\GPUexecuting\微信图片_20260401003051_160_51.png")
OUTPUT_PATH = Path(r"C:\Users\17872\Desktop\GPUexecuting\gpu_dataset.json")
JS_OUTPUT_PATH = Path(r"C:\Users\17872\Desktop\GPUexecuting\gpu-data.js")


def group_rows(items, tolerance=9):
    items = sorted(items, key=lambda i: (i["y"], i["x"]))
    rows = []
    for item in items:
        if not rows or abs(rows[-1]["y"] - item["y"]) > tolerance:
            rows.append({"y": item["y"], "items": [item]})
        else:
            row = rows[-1]
            row["items"].append(item)
            row["y"] = (row["y"] * (len(row["items"]) - 1) + item["y"]) / len(row["items"])
    return rows


def clean_text(text):
    return (
        text.replace(" ", "")
        .replace("|", "")
        .replace("？", "?")
        .replace("Royai", "Royal")
        .replace("iNomad", "Nomad")
    )


def split_name_ts(name):
    match = re.match(r"^(.*?)(\d{4,5})$", name)
    if not match:
        return name, None
    return match.group(1), match.group(2)


DISPLAY_NAME_MAP = {
    "RTX5090(D)": "RTX 5090 (D)",
    "RTX4090": "RTX 4090",
    "RTX4090D": "RTX 4090 D",
    "RTX5080": "RTX 5080",
    "RX7900XTX": "RX 7900 XTX",
    "RX9070XT": "RX 9070 XT",
    "RTX4080S": "RTX 4080 Super",
    "RTX4080": "RTX 4080",
    "RTX5070TI": "RTX 5070 Ti",
    "RX7900XT": "RX 7900 XT",
    "RX9070": "RX 9070",
    "RTX5090M": "RTX 5090 M",
    "RTX4070TIS": "RTX 4070 Ti Super",
    "RTX5080M": "RTX 5080 M",
    "RTX4070TI": "RTX 4070 Ti",
    "RTX4090M": "RTX 4090 M",
    "RX9070GRE": "RX 9070 GRE",
    "RTX5070": "RTX 5070",
    "RX7900GRE": "RX 7900 GRE",
    "RX6950XT": "RX 6950 XT",
    "RTX3090TI": "RTX 3090 Ti",
    "RTX4070S": "RTX 4070 Super",
    "RX6900XT": "RX 6900 XT",
    "RX7800XT": "RX 7800 XT",
    "RTX3090": "RTX 3090",
    "RTX3080TI": "RTX 3080 Ti",
    "RX6800XT": "RX 6800 XT",
    "RTX4080M": "RTX 4080 M",
    "RTX308012GB": "RTX 3080 12GB",
    "RTX5070TIM": "RTX 5070 Ti M",
    "RTX4070": "RTX 4070",
    "RTX3080": "RTX 3080",
    "RX7700XT": "RX 7700 XT",
    "RX9060XT16GB": "RX 9060 XT 16GB",
    "RX6800": "RX 6800",
    "RTX5060TI": "RTX 5060 Ti",
    "RX9060XT8GB": "RX 9060 XT 8GB",
    "RX6600XT": "RX 6600 XT",
    "RTX3070TI": "RTX 3070 Ti",
    "RX5700XT": "RX 5700 XT",
    "ARCB580": "Arc B580",
    "RTX2070": "RTX 2070",
    "RTX5070M": "RTX 5070 M",
    "RTX2060S": "RTX 2060 Super",
    "RTX2080TI": "RTX 2080 Ti",
    "RTX3060": "RTX 3060",
    "RTX5060": "RTX 5060",
    "RTX3060M": "RTX 3060 M",
    "RTX3070": "RTX 3070",
    "RX5700": "RX 5700",
    "RX6750XT": "RX 6750 XT",
    "RTX4050M": "RTX 4050 M",
    "RTX4060TI": "RTX 4060 Ti",
    "RX6600": "RX 6600",
    "RTX3080TIM": "RTX 3080 Ti M",
    "RX5600XT": "RX 5600 XT",
    "RX6700XT": "RX 6700 XT",
    "GTX1080": "GTX 1080",
    "ARCA770": "Arc A770",
    "RTX2060": "RTX 2060",
    "RX6750GRE12G": "RX 6750 GRE 12G",
    "GTX1070TI": "GTX 1070 Ti",
    "RTX5060M": "RTX 5060 M",
    "GTX1660TI": "GTX 1660 Ti",
    "ARCB570": "Arc B570",
    "RTX3050": "RTX 3050",
    "RTX4070M": "RTX 4070 M",
    "GTX1070": "GTX 1070",
    "ARCA750": "Arc A750",
    "GTX1660S": "GTX 1660 Super",
    "RTX3060TI": "RTX 3060 Ti",
    "GTX1660": "GTX 1660",
    "RTX3080M": "RTX 3080 M",
    "RX6500XT": "RX 6500 XT",
    "RTX2080S": "RTX 2080 Super",
    "GTX1650S": "GTX 1650 Super",
    "RTX3070TIM": "RTX 3070 Ti M",
    "ARCA380": "Arc A380",
    "RX6750GRE10G": "RX 6750 GRE 10G",
    "RX580": "RX 580",
    "RTX2080": "RTX 2080",
    "GTX10606G": "GTX 1060 6G",
    "RX7600": "RX 7600",
    "GTX10605G": "GTX 1060 5G",
    "RX7650GRE": "RX 7650 GRE",
    "GTX10603G": "GTX 1060 3G",
    "ARCA580": "Arc A580",
    "RX5802048SP": "RX 580 2048SP",
    "RTX4060M": "RTX 4060 M",
    "RX6400": "RX 6400",
    "RTX3070M": "RTX 3070 M",
    "GTX1650": "GTX 1650",
    "RTX4060": "RTX 4060",
    "GTX1050TI": "GTX 1050 Ti",
    "RTX5050M": "RTX 5050 M",
    "GTX1630": "GTX 1630",
    "RTX2070S": "RTX 2070 Super",
    "GTX1050": "GTX 1050",
    "RX6650XT": "RX 6650 XT",
    "GT1030": "GT 1030",
    "GTX1080TI": "GTX 1080 Ti",
    "RTX5050": "RTX 5050",
}


def clean_name(raw_name):
    return DISPLAY_NAME_MAP.get(raw_name, raw_name)


def parse_value(value):
    if value in {None, "", "?"}:
        return None
    return int(value)


def infer_vendor(name):
    if name.startswith("RTX") or name.startswith("GTX") or name.startswith("GT "):
        return "NVIDIA"
    if name.startswith("RX"):
        return "AMD"
    if name.startswith("Arc"):
        return "Intel"
    return "Unknown"


def infer_mobile(name):
    return name.endswith(" M")


def infer_model_code(name):
    match = re.search(r"(\d{3,4})", name)
    return match.group(1) if match else ""


engine = RapidOCR()
results, _ = engine(str(IMAGE_PATH))

items = []
for box, text, score in results or []:
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    items.append({
        "x": sum(xs) / len(xs),
        "y": sum(ys) / len(ys),
        "text": clean_text(text),
        "score": score,
    })

rows = group_rows(items)
panels = [(0, 640), (640, 1275), (1275, 2000)]
data = []
unparsed = []

for row in rows:
    if row["y"] < 100:
        continue
    for panel_index, (x0, x1) in enumerate(panels):
        texts = [item["text"] for item in sorted(row["items"], key=lambda i: i["x"]) if x0 <= item["x"] < x1]
        if not texts:
            continue
        if texts[0] in {"显卡型号", "(2K光栅)", "TimeSpy"}:
            continue
        name = texts[0]
        values = texts[1:]
        if len(texts) == 4:
            name, ts = split_name_ts(name)
            values = [ts] + values
        if len(values) != 4:
            unparsed.append({"panel": panel_index, "y": row["y"], "raw": texts})
            continue
        data.append({
            "panel": panel_index,
            "y": round(row["y"], 1),
            "name": name,
            "ts": values[0],
            "tse": values[1],
            "pr": values[2],
            "sn": values[3],
        })

cleaned = []
for index, item in enumerate(data, start=1):
    display_name = clean_name(item["name"])
    cleaned.append({
        "rank": index,
        "rawName": item["name"],
        "name": display_name,
        "vendor": infer_vendor(display_name),
        "segment": "Laptop" if infer_mobile(display_name) else "Desktop",
        "modelCode": infer_model_code(display_name),
        "ts": parse_value(item["ts"]),
        "tse": parse_value(item["tse"]),
        "pr": parse_value(item["pr"]),
        "sn": parse_value(item["sn"]),
    })

cleaned.sort(key=lambda gpu: (gpu["ts"] is None, -(gpu["ts"] or -1)))
for rank, gpu in enumerate(cleaned, start=1):
    gpu["rank"] = rank

OUTPUT_PATH.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
JS_OUTPUT_PATH.write_text(
    "window.GPU_DATA = " + json.dumps(cleaned, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
print(f"WROTE {OUTPUT_PATH}")
print(f"WROTE {JS_OUTPUT_PATH}")
print(f"COUNT {len(cleaned)}")
for row in unparsed:
    print(f"UNPARSED panel={row['panel']} y={row['y']:.1f} raw={row['raw']}")
for gpu in cleaned:
    if None in {gpu['ts'], gpu['tse'], gpu['pr'], gpu['sn']}:
        print(f"MISSING {gpu['name']} :: ts={gpu['ts']} tse={gpu['tse']} pr={gpu['pr']} sn={gpu['sn']}")
