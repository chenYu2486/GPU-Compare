from pathlib import Path
from rapidocr_onnxruntime import RapidOCR

image_path = Path(r"C:\Users\17872\Desktop\GPUexecuting\微信图片_20260401003051_160_51.png")
engine = RapidOCR()
results, _ = engine(str(image_path))

items = []
for box, text, score in results or []:
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    items.append({
        "x": sum(xs) / len(xs),
        "y": sum(ys) / len(ys),
        "text": text,
        "score": score,
    })

items.sort(key=lambda i: (i["y"], i["x"]))

rows = []
tolerance = 9
for item in items:
    if not rows or abs(rows[-1]["y"] - item["y"]) > tolerance:
        rows.append({"y": item["y"], "items": [item]})
    else:
        row = rows[-1]
        row["items"].append(item)
        row["y"] = (row["y"] * (len(row["items"]) - 1) + item["y"]) / len(row["items"])

for idx, row in enumerate(rows):
    row["items"].sort(key=lambda i: i["x"])
    texts = [it["text"] for it in row["items"]]
    print(f"{idx:03d} y={row['y']:.1f} :: {' | '.join(texts)}")
