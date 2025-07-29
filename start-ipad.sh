#!/bin/bash

echo "🚀 Starting PicVoice for iPad access..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Get the local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Your computer's IP address: $LOCAL_IP"
echo "📱 Access from iPad: http://$LOCAL_IP:3000"
echo ""
echo "💡 Make sure your iPad and computer are on the same WiFi network"
echo "🔒 If you have a firewall, you may need to allow port 3000"
echo ""

# Start the server
echo "🎯 Starting server..."
npm start 