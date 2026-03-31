from pathlib import Path

try:
    from rapidocr_onnxruntime import RapidOCR
except Exception as exc:
    print("IMPORT_ERROR", repr(exc))
    raise

image_path = Path(r"C:\Users\17872\Desktop\GPUexecuting\微信图片_20260401003051_160_51.png")
engine = RapidOCR()
results, _ = engine(str(image_path))

if not results:
    print("NO_RESULTS")
else:
    for item in results:
        print(item)
