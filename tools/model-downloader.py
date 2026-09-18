import os
import sys
import urllib.request
import urllib.error

"""
A standalone script to download the EmbeddingGemma model used for question matching.

It fetches the fp32 ONNX files from the Hugging Face repository and stores them
in `models/embeddinggemma-300m` in the project root, which is where the server
expects them. Files that already exist are skipped, so an interrupted run can
simply be repeated.

Usage:
    python tools/model-downloader.py
"""

REPO = "onnx-community/embeddinggemma-300m-ONNX"
MODEL_DIR_NAME = "embeddinggemma-300m"

# onnx/model.onnx only holds the graph, the fp32 weights live in model.onnx_data
FILES = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "onnx/model.onnx",
    "onnx/model.onnx_data",
]


# Render a single line progress bar for the current download
def show_progress(block_count, block_size, total_size):
    downloaded = block_count * block_size

    if total_size <= 0:
        sys.stdout.write(f"\r    {downloaded / 1024 / 1024:.1f} MB")
        sys.stdout.flush()
        return

    percent = min(100, downloaded * 100 / total_size)
    done = int(percent / 2)

    sys.stdout.write(
        f"\r    [{'#' * done}{'.' * (50 - done)}] {percent:5.1f}% "
        f"({downloaded / 1024 / 1024:.1f}/{total_size / 1024 / 1024:.1f} MB)"
    )
    sys.stdout.flush()


# Download a single repository file, writing to a .part file until it is complete
def download_file(model_dir, file_name):
    target = os.path.join(model_dir, *file_name.split("/"))
    partial_target = target + ".part"

    if os.path.exists(target):
        print(f"  skipping {file_name} (already present)")
        return

    os.makedirs(os.path.dirname(target), exist_ok=True)

    url = f"https://huggingface.co/{REPO}/resolve/main/{file_name}"
    print(f"  downloading {file_name}")

    try:
        urllib.request.urlretrieve(url, partial_target, show_progress)
        print()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as error:
        if os.path.exists(partial_target):
            os.remove(partial_target)
        raise RuntimeError(f"download of {file_name} failed: {error}")

    os.rename(partial_target, target)


# Download every required model file into the project's models folder
def download_model():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(project_root, "models", MODEL_DIR_NAME)

    os.makedirs(model_dir, exist_ok=True)

    print(f"Downloading {REPO} into {model_dir}")

    for file_name in FILES:
        download_file(model_dir, file_name)

    print("\nModel is ready.")


if __name__ == "__main__":
    try:
        download_model()
    except RuntimeError as error:
        print(f"\nError: {error}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nAborted. Run the script again to resume.")
        sys.exit(1)
