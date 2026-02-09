# Percisio Sense

Medical 3D visualization and AI assistant application for analyzing anatomical structures.

## Features

- **3D Medical Model Viewer**: Interactive 3D visualization of anatomical segments
- **AI Chatbot**: Medical assistant powered by OpenAI GPT-4
- **Segment Filtering**: Show/hide specific anatomical structures
- **Navigation History**: Undo/redo camera movements and filters
- **Segment Information**: Detailed statistics on anatomical structures
- **Quick Actions**: Fast access to common organs

## Tech Stack

- **Frontend**: React, Three.js, React Three Fiber, Zustand
- **Backend**: Node.js, Express, OpenAI API
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
OPENAI_API_KEY=your_api_key_here
PORT=4000
```

### Running the Application

```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown by Vite).

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Viewer3D/      # 3D viewer components
│   │   └── Chatbot/       # Chat interface components
│   ├── utils/              # Utility functions
│   └── store.js            # Zustand state management
└── public/
    └── models/
        └── segments/       # OBJ/MTL segment files

backend/
└── index.js                # Express server and OpenAI integration
```

## Build

```bash
# Build frontend for production
cd frontend
npm run build
```

## License

ISC
