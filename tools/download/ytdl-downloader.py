import subprocess
import os
import re
import shlex


# Download YouTube video as MP4 and convert to compatible format
def download_youtube_video_as_mp4(video_url, cookies_file_path=None):
    """
    Downloads a YouTube video in highest quality as MP4 file
    to the macOS Downloads folder and converts it with ffmpeg
    to a fully compatible MP4 file (H.264 + AAC).

    https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?pli=1
    Cookie Netscape Format

    Args:
        video_url (str): The URL of the YouTube video.
        cookies_file_path (str, optional): Path to the cookies.txt file. Defaults to None.
    """
    try:
        download_path = os.path.join(os.path.expanduser("~"), "Downloads")

        output_template = os.path.join(download_path, "%(title)s.%(ext)s")

        command = [
            "yt-dlp",
            "-f",
            "bv*+ba/best",
            "--merge-output-format",
            "mp4",
            "-o",
            output_template,
        ]

        if cookies_file_path:
            if os.path.exists(cookies_file_path):
                command.extend(["--cookies", cookies_file_path])
                print(f"Using cookies from: {cookies_file_path}")
            else:
                print(
                    f"Cookie file not found at: {cookies_file_path}. Continuing without cookies."
                )

        command.append(video_url)

        print(f"Starting download from: {video_url}")
        print(f"Target folder: {download_path}")

        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding="utf-8",
        )

        progress_re = re.compile(r"\[download\]\s+(\d+\.?\d*)%")
        final_filename = None

        for line in process.stdout:
            print(line, end="")

            match_progress = progress_re.search(line)

            if (
                "[Merger] Merging formats into" in line
                or "[ffmpeg] Merging formats into" in line
            ):
                match_filename = re.search(r'Merging formats into "?([^"]+)"?', line)
                if match_filename:
                    final_filename = match_filename.group(1).strip()
            elif "[download] Destination:" in line and not final_filename:
                match_dest_filename = re.search(r"\[download\] Destination: (.*)", line)
                if match_dest_filename:
                    potential_filename = match_dest_filename.group(1).strip()
                    if potential_filename.endswith(
                        (".mp4", ".mkv", ".webm", ".mp3", ".m4a", ".opus")
                    ):
                        final_filename = potential_filename
            elif "[ExtractAudio] Destination:" in line:
                match_audio_filename = re.search(
                    r"\[ExtractAudio\] Destination: (.*)", line
                )
                if match_audio_filename:
                    final_filename = match_audio_filename.group(1).strip()

        process.wait()

        if process.returncode == 0 and final_filename:
            print(f"\nDownload completed! File: {final_filename}")

            if not os.path.isabs(final_filename):
                final_filename = os.path.join(
                    download_path, os.path.basename(final_filename)
                )
                print(f"Assumed absolute path: {final_filename}")

            if not os.path.exists(final_filename):
                print(
                    f"Error: The downloaded file {final_filename} was not found. Check the path."
                )
                return

            base, ext = os.path.splitext(final_filename)
            converted_filename = base + "_konvertiert.mp4"

            print(f"\nStarting conversion to compatible format: {converted_filename}")

            ffmpeg_command = [
                "ffmpeg",
                "-i",
                final_filename,
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                converted_filename,
            ]

            try:
                print(
                    f"Executing ffmpeg command: {' '.join(shlex.quote(arg) for arg in ffmpeg_command)}"
                )
                subprocess.run(ffmpeg_command, check=True)
                print(
                    f"Conversion successful! File saved at: {converted_filename}"
                )
                try:
                    os.remove(final_filename)
                    print(f"Original file {final_filename} deleted.")
                except OSError as e:
                    print(
                        f"Error deleting original file {final_filename}: {e}"
                    )

            except subprocess.CalledProcessError as e:
                print(f"\nError during conversion with ffmpeg:")
                print(f"Command: {' '.join(shlex.quote(arg) for arg in e.cmd)}")
                print(f"Return code: {e.returncode}")
                print("Check the ffmpeg output above for specific errors.")
                print(
                    "Make sure ffmpeg is correctly installed and the input file is valid."
                )

        elif process.returncode != 0:
            print(f"\nError during download (yt-dlp exit code: {process.returncode}).")
        else:
            print(
                "\nDownload completed, but the filename could not be determined for conversion."
            )

    except FileNotFoundError as e:
        print(f"\nError: {e}")
        print("Make sure yt-dlp and ffmpeg are installed and in PATH.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")


if __name__ == "__main__":
    video_url_input = input("Please enter the YouTube video URL: ")
    if video_url_input:
        use_cookies = (
            input("Would you like to use a cookie file? (y/n): ").strip().lower()
        )
        cookie_path_input = None
        if use_cookies == "y":
            default_cookie_path = os.path.join(
                os.path.expanduser("~"), "Downloads", "cookies.txt"
            )
            cookie_path_input = input(
                f"Please enter the path to the cookie file (Enter for '{default_cookie_path}'): "
            ).strip()
            if not cookie_path_input:
                cookie_path_input = default_cookie_path

        download_youtube_video_as_mp4(video_url_input, cookie_path_input)
    else:
        print("No URL entered.")
