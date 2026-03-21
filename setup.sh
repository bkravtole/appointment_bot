#!/bin/bash

# Setup Helper Script for WhatsApp Appointment Bot
# This script helps you configure the environment correctly

echo "🚀 WhatsApp Appointment Bot - Setup Helper"
echo "==========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14+ first."
    exit 1
fi

echo "✅ Node.js $( node --version) is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm --version) is installed"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please edit with your credentials."
else
    echo ""
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your credentials:"
echo "   - Google Calendar credentials"
echo "   - 11za API credentials (optional)"
echo "   - Supabase credentials (optional)"
echo ""
echo "2. Run the server:"
echo "   npm run dev"
echo ""
echo "3. Test the health endpoint:"
echo "   curl http://localhost:3000/health"
echo ""
echo "📚 For detailed setup instructions, see QUICKSTART.md"
