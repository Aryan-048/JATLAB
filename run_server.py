#!/usr/bin/env python3
"""
run_server.py - One-Click Offline Launcher for GATLAB Communication Simulator
Starts a lightweight local HTTP server and opens the browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable caching headers and cross-origin isolation for Web Workers
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = CustomHandler
    
    # Try finding an open port if 3000 is occupied
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), handler) as httpd:
                url = f"http://localhost:{port}"
                print("=" * 60)
                print(f"  GATLAB Communication Lab Practice Simulator Running!")
                print(f"  Local URL: {url}")
                print(f"  Press Ctrl+C in terminal to stop.")
                print("=" * 60)
                webbrowser.open(url)
                httpd.serve_forever()
        except OSError:
            port += 1

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nSimulator server stopped.")
        sys.exit(0)

