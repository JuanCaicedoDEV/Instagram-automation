import ctypes
from logging import log
import os
import subprocess
import sys
import threading
import time
import json
import uvicorn
import webbrowser

# Fix for PyInstaller paths
if getattr(sys, 'frozen', False):
    application_path = os.path.dirname(sys.executable)
else:
    application_path = os.path.dirname(os.path.abspath(__file__))

config_path = os.path.join(application_path, 'config.json')

def load_config():
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_config(config):
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=4)

def prompt_for_config(config):
    print("=========================================")
    print("        INITIAL CONFIGURATION            ")
    print("=========================================\n")
    
    if not config.get('DATABASE_URL'):
        db_url = input("Enter Supabase DATABASE_URL (Required): ").strip()
        if db_url:
            config['DATABASE_URL'] = db_url
        else:
            print("ERROR: DATABASE_URL is required to start the engine.")
            input("Press Enter to exit...")
            sys.exit(1)
            
    if not config.get('GEMINI_API_KEY'):
        gemini = input("Enter Gemini API Key (Optional but recommended): ").strip()
        if gemini:
            config['GEMINI_API_KEY'] = gemini
            
    if not config.get('UPLOAD_POST_API_KEY'):
        upload = input("Enter Upload-Post API Key (Optional): ").strip()
        if upload:
            config['UPLOAD_POST_API_KEY'] = upload
    if not config.get("UPLOAD_POST_USER_ID"):
        upload_id = input("Enter Upload_Post User ID (Required if Upload Post Api Key has been seted): ").strip()
        if upload_id:
            config["UPLOAD_POST_USER_ID"] = upload_id
    if not config.get("X-API-Key"):
        x_api_key = input("Enter a value for X-API-Key header (Required for security): ").strip()
        if x_api_key:
            config["X-API-Key"] = x_api_key

    save_config(config)
    print("\n✅ Configuration saved!\n")
    return config

def run_server():
    from backend.main import app
    # Run uvicorn server in this thread
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

def main():
    """
    #Pedir permisos de admin para escribir el archivo de config.json en Program Files
    if ctypes.windll.shell32.IsUserAnAdmin() == False:
        ctypes.windll.shell32.ShellExecuteW(
                None, "runas", sys.executable, " ".join(sys.argv), None, 0
            )
    """
    process = subprocess.Popen(
        ["python", "desktop_launcher.py"],
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    )
    print(f"PID: {process.pid}")
    config = load_config()
    config = prompt_for_config(config)
        
    # Inject into environment for FastAPI to pick up
    os.environ['DATABASE_URL'] = config.get('DATABASE_URL', '')
    os.environ['GEMINI_API_KEY'] = config.get('GEMINI_API_KEY', '')
    os.environ['UPLOAD_POST_API_KEY'] = config.get('UPLOAD_POST_API_KEY', '')
    os.environ["UPLOAD_POST_USER_ID"] = config.get("UPLOAD_POST_USER_ID", "")
    os.environ["X-API-Key"] = config.get("X-API-Key", "")
    
    # We want local storage, and we want to write next to the executable
    os.environ['STORAGE_PROVIDER'] = 'local'
    images_dir = os.path.join(application_path, "generated_images")
    uploads_dir = os.path.join(application_path, "uploads")
    print(f"Path de la carpeta de uploads: {uploads_dir}")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(uploads_dir, exist_ok=True)
    
    os.environ['LOCAL_STORAGE_DIR'] = images_dir
    os.environ['LOCAL_UPLOADS_DIR'] = uploads_dir
    
    # Ensure current working directory is the app bundle so static assets can be found
    # PyInstaller unpacks the app to a temp location (_MEIPASS)
    if getattr(sys, 'frozen', False):
        os.chdir(sys._MEIPASS)
        
    print("Starting Content Engine...")
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    
    # Wait for the server to be ready
    time.sleep(2)

    print("Launching Desktop Window...")
    webbrowser.open('http://127.0.0.1:8000')
    
    # Keep the main thread alive since uvicorn is running in a daemon thread
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down Content Engine...")
        sys.exit(0)

if __name__ == '__main__':
    main()
