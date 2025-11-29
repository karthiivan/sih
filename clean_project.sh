#!/bin/bash

echo "Cleaning project..."

# Clean Backend
if [ -d "backend-node/node_modules" ]; then
    echo "Removing backend-node/node_modules..."
    rm -rf backend-node/node_modules
fi

# Clean Frontend
if [ -d "frontend/node_modules" ]; then
    echo "Removing frontend/node_modules..."
    rm -rf frontend/node_modules
fi

if [ -d "frontend/build" ]; then
    echo "Removing frontend/build..."
    rm -rf frontend/build
fi

echo "Cleanup complete! Project size should now be minimal."
echo "To reinstall dependencies, run 'npm install' in both backend-node and frontend directories."
