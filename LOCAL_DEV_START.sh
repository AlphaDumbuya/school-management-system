#!/bin/bash

# School Management System - Local Development Startup Script
# This script sets up and starts all services for local development

set -e

echo "🚀 School Management System - Local Development Setup"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version) detected${NC}"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null && ! docker ps &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found locally, will try Docker${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cat > .env << 'EOF'
# Local Development Environment
NODE_ENV=development
PORT=3000
JWT_SECRET=dev-secret-change-in-production-123456789
REFRESH_TOKEN_SECRET=dev-refresh-secret-987654321
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=debug
VITE_API_URL=http://localhost:3000/api
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Install backend dependencies
echo ""
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    npm install --silent
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Backend dependencies already installed${NC}"
fi
cd ..

# Install frontend dependencies
echo ""
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    npm install --silent
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
fi
cd ..

# Install mobile dependencies
echo ""
echo -e "${BLUE}📦 Installing mobile dependencies...${NC}"
cd mobile
if [ ! -d "node_modules" ]; then
    npm install --silent
    echo -e "${GREEN}✓ Mobile dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Mobile dependencies already installed${NC}"
fi
cd ..

echo ""
echo -e "${GREEN}=================================================="
echo "✓ Setup complete!"
echo "=================================================="
echo ""
echo -e "${BLUE}Starting services...${NC}"
echo ""

# Create a function to handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}Services stopped${NC}"
}

trap cleanup EXIT

# Start backend
echo -e "${BLUE}▶️  Starting backend on port 3000...${NC}"
cd backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 3
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    cat /tmp/backend.log
    exit 1
fi
cd ..

# Start frontend
echo -e "${BLUE}▶️  Starting frontend on port 5173...${NC}"
cd frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
    cat /tmp/frontend.log
    exit 1
fi
cd ..

echo ""
echo -e "${GREEN}=================================================="
echo "🎉 All services running!"
echo "=================================================="
echo ""
echo -e "${BLUE}Access points:${NC}"
echo -e "  Frontend:    ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:3000/api${NC}"
echo -e "  Health:      ${GREEN}http://localhost:3000/health${NC}"
echo ""
echo -e "${BLUE}Test Credentials:${NC}"
echo -e "  Admin:   ${GREEN}admin@example.com / Admin123!@${NC}"
echo -e "  Teacher: ${GREEN}teacher@example.com / Teacher123!@${NC}"
echo -e "  Student: ${GREEN}student@example.com / Student123!@${NC}"
echo ""
echo -e "${BLUE}Phase 12 Features:${NC}"
echo -e "  ✓ Real-time Dashboard (WebSocket)"
echo -e "  ✓ Advanced Filtering"
echo -e "  ✓ Export (PDF, Excel, CSV)"
echo -e "  ✓ Dashboard Builder"
echo -e "  ✓ Dark Mode"
echo -e "  ✓ Mobile App"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for services to run
wait
