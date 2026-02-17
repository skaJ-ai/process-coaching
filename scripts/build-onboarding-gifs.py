from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FRAMES_ROOT = ROOT / "frontend" / "public" / "onboarding" / ".frames"
OUT_ROOT = ROOT / "frontend" / "public" / "onboarding"

JOBS = [
    ("01-add-node", "01-add-node.gif"),
    ("02-connect-nodes", "02-connect-nodes.gif"),
    ("03-decision-label", "03-decision-label.gif"),
    ("04-save-flow", "04-save-flow.gif"),
]


def build_gif(frame_dir: Path, out_file: Path) -> None:
    frames = sorted(frame_dir.glob("frame-*.png"))
    if not frames:
        raise RuntimeError(f"No frames found: {frame_dir}")

    images = [Image.open(f).convert("P", palette=Image.ADAPTIVE) for f in frames]
    first, rest = images[0], images[1:]
    durations = [650] * len(images)
    durations[-1] = 1200
    first.save(
        out_file,
        save_all=True,
        append_images=rest,
        optimize=True,
        duration=durations,
        loop=0,
    )


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for frame_name, gif_name in JOBS:
        frame_dir = FRAMES_ROOT / frame_name
        out_file = OUT_ROOT / gif_name
        build_gif(frame_dir, out_file)
        print(f"BUILT {out_file}")


if __name__ == "__main__":
    main()

