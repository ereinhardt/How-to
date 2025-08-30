import subprocess
import os
import re
import shlex 

def download_youtube_video_as_mp4(video_url, cookies_file_path=None):
    """
    Lädt ein YouTube-Video in der höchsten Qualität als MP4-Datei
    in den Downloads-Ordner von macOS herunter und konvertiert es mit ffmpeg
    zu einer vollständig kompatiblen MP4-Datei (H.264 + AAC).

    https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc?pli=1
    Cokkie Netscpe-Format
    
    Args:
        video_url (str): Die URL des YouTube-Videos.
        cookies_file_path (str, optional): Pfad zur cookies.txt Datei. Defaults to None.
    """
    try:
        # Pfad zum Downloads-Ordner auf macOS
        download_path = os.path.join(os.path.expanduser("~"), "Downloads")

        # Dateiname-Muster für den Download (temporär)
        output_template = os.path.join(download_path, "%(title)s.%(ext)s")

        # yt-dlp Befehl
        command = [
            'yt-dlp',
            '-f', 'bv*+ba/best',
            '--merge-output-format', 'mp4',
            '-o', output_template
        ]

        if cookies_file_path:
            if os.path.exists(cookies_file_path):
                command.extend(['--cookies', cookies_file_path])
                print(f"Verwende Cookies aus: {cookies_file_path}")
            else:
                print(f"⚠️ Cookie-Datei nicht gefunden unter: {cookies_file_path}. Fahre ohne Cookies fort.")
        
        command.append(video_url)

        print(f"Starte Download von: {video_url}")
        print(f"Zielordner: {download_path}")
        # print(f"Verwendeter yt-dlp Befehl: {' '.join(shlex.quote(arg) for arg in command)}")


        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, encoding='utf-8')

        progress_re = re.compile(r"\[download\]\s+(\d+\.?\d*)%")
        final_filename = None

        for line in process.stdout:
            print(line, end='')
            
            match_progress = progress_re.search(line)
            # if match_progress: # Progress printing can be noisy with full log
            #     progress = float(match_progress.group(1))
            
            if "[Merger] Merging formats into" in line or "[ffmpeg] Merging formats into" in line:
                match_filename = re.search(r'Merging formats into "?([^"]+)"?', line)
                if match_filename:
                    final_filename = match_filename.group(1).strip()
            elif "[download] Destination:" in line and not final_filename:
                 match_dest_filename = re.search(r'\[download\] Destination: (.*)', line)
                 if match_dest_filename:
                     potential_filename = match_dest_filename.group(1).strip()
                     if potential_filename.endswith(('.mp4', '.mkv', '.webm', '.mp3', '.m4a', '.opus')):
                        final_filename = potential_filename
            elif "[ExtractAudio] Destination:" in line:
                match_audio_filename = re.search(r'\[ExtractAudio\] Destination: (.*)', line)
                if match_audio_filename:
                    final_filename = match_audio_filename.group(1).strip()

        process.wait()

        if process.returncode == 0 and final_filename:
            print(f"\nDownload abgeschlossen! Datei: {final_filename}")

            if not os.path.isabs(final_filename):
                final_filename = os.path.join(download_path, os.path.basename(final_filename))
                print(f"Angenommener absoluter Pfad: {final_filename}")

            if not os.path.exists(final_filename):
                print(f"❌ Fehler: Die heruntergeladene Datei {final_filename} wurde nicht gefunden. Überprüfe den Pfad.")
                return

            base, ext = os.path.splitext(final_filename)
            converted_filename = base + "_konvertiert.mp4"
            
            print(f"\nStarte Umwandlung in kompatibles Format: {converted_filename}")

            ffmpeg_command = [
                'ffmpeg',
                '-i', final_filename,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                converted_filename
            ]
            
            try:
                print(f"Führe ffmpeg-Befehl aus: {' '.join(shlex.quote(arg) for arg in ffmpeg_command)}")
                # Run ffmpeg and let its output go to the console
                subprocess.run(ffmpeg_command, check=True) 
                print(f"✅ Umwandlung erfolgreich! Datei gespeichert unter: {converted_filename}")
                # Optionally remove the original file
                # try:
                #     os.remove(final_filename)
                #     print(f"Originaldatei {final_filename} gelöscht.")
                # except OSError as e:
                #     print(f"Fehler beim Löschen der Originaldatei {final_filename}: {e}")

            except subprocess.CalledProcessError as e:
                print(f"\n❌ Fehler bei der Umwandlung mit ffmpeg:")
                print(f"Command: {' '.join(shlex.quote(arg) for arg in e.cmd)}")
                print(f"Return code: {e.returncode}")
                # ffmpeg's direct error output should have appeared above in the console.
                print("Überprüfen Sie die ffmpeg-Ausgabe oben auf spezifische Fehler.")
                print("Stellen Sie sicher, dass ffmpeg korrekt installiert ist und die Eingabedatei gültig ist.")

        elif process.returncode != 0:
            print(f"\n❌ Fehler beim Download (yt-dlp exit code: {process.returncode}).")
        else:
            print("\n❌ Download abgeschlossen, aber der Dateiname konnte nicht ermittelt werden für die Konvertierung.")

    except FileNotFoundError as e:
        print(f"\nFehler: {e}")
        print("Stelle sicher, dass yt-dlp und ffmpeg installiert und im PATH sind.")
    except Exception as e:
        print(f"\nEin unerwarteter Fehler ist aufgetreten: {e}")

if __name__ == "__main__":
    video_url_input = input("Bitte gib die YouTube-Video-URL ein: ")
    if video_url_input:
        use_cookies = input("Möchtest du eine Cookie-Datei verwenden? (j/n): ").strip().lower()
        cookie_path_input = None
        if use_cookies == 'j':
            default_cookie_path = os.path.join(os.path.expanduser("~"), "Downloads", "cookies.txt")
            cookie_path_input = input(f"Bitte gib den Pfad zur Cookie-Datei ein (Enter für '{default_cookie_path}'): ").strip()
            if not cookie_path_input:
                cookie_path_input = default_cookie_path
        
        download_youtube_video_as_mp4(video_url_input, cookie_path_input)
    else:
        print("❗ Keine URL eingegeben.")