import os
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

    save_config(config)
    print("\n✅ Configuration saved!\n")
    return config

def run_server():
    from backend.main import app
    # Run uvicorn server in this thread
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

def main():
    config = load_config()
    if not config.get('DATABASE_URL') or not config.get('GEMINI_API_KEY') or not config.get('UPLOAD_POST_API_KEY'):
        config = prompt_for_config(config)
        
    # Inject into environment for FastAPI to pick up
    os.environ['DATABASE_URL'] = config.get('DATABASE_URL', '')
    os.environ['GEMINI_API_KEY'] = config.get('GEMINI_API_KEY', '')
    os.environ['UPLOAD_POST_API_KEY'] = config.get('UPLOAD_POST_API_KEY', '')
    
    # We want local storage, and we want to write next to the executable
    os.environ['STORAGE_PROVIDER'] = 'local'
    images_dir = os.path.join(application_path, "generated_images")
    uploads_dir = os.path.join(application_path, "uploads")
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
