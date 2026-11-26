# ⚡ UNITE — Real-Time Collaborative Code Editor

### 🚀 Code Together. Build Together. Ship Together.

**UNITE** is a browser-based collaborative Integrated Development Environment (IDE) designed to bring developers together in a shared coding workspace. Collaborate in real time, edit code simultaneously, manage project files, execute programs and work together from anywhere.

Built to make collaborative software development seamless, interactive and accessible.

---

## 🌌 Project Overview

Traditional development workflows often require developers to switch between code editors, communication tools and execution environments to collaborate.

**Unite brings these experiences into one unified workspace.**

With real-time synchronization, collaborative editing, multi-language support and an integrated development environment, Unite aims to make team-based coding more efficient and intuitive.

### ✨ Core Features

| Feature | Description |
|---|---|
| 👥 Real-Time Collaboration | Multiple developers editing the same file simultaneously |
| ⚡ Live Synchronization | Instant document updates using CRDT-based synchronization |
| 🎯 Collaborative Cursors | View teammates' cursor positions and selections |
| 🗂️ File Explorer | Create, rename, delete and organize project files |
| 💻 Monaco Editor | Professional code editing with syntax highlighting |
| 🌐 Multi-Language Support | JavaScript, TypeScript, Python, Java, C, C++ and more |
| ▶️ Code Execution | Execute supported programs through isolated runtimes |
| ⌨️ Integrated Terminal | Interactive terminal experience within the IDE |
| 🔗 Workspace Sharing | Invite developers using secure workspace invitations |
| 🔐 Authentication | Secure user authentication and workspace access |
| 💾 Persistent Storage | Maintain workspace files and collaborative document states |
| 🔄 Reconnection | Restore collaboration after temporary disconnections |

---

## 🎨 Design Philosophy

Unite follows a premium monochromatic design language.

**Visual Identity:**
- Pure white and absolute black.
- Sophisticated black-to-white gradient overlays.
- Minimalist interface with refined spacing.
- Premium translucent surfaces.
- Subtle shadows and elegant depth.
- Smooth transitions and micro-interactions.
- High-contrast typography.

Inspired by the visual precision of modern developer tools and the simplicity of premium software interfaces.

---

## 🛠️ Technology Stack

### Frontend
- ⚛️ React
- 📘 TypeScript
- ⚡ Vite
- 🎨 Tailwind CSS
- 🧩 shadcn/ui
- 🎬 Framer Motion
- 💻 Monaco Editor
- 🖥️ xterm.js

### Backend
- 🟢 Node.js
- 🚀 Express.js
- 🔌 WebSockets
- 🛡️ Zod

### Real-Time Collaboration
- 🔄 Yjs
- ⚡ Hocuspocus
- 🎯 y-monaco
- 📡 Yjs Awareness Protocol

### Database & Authentication
- 🐘 Supabase PostgreSQL
- 🔐 Supabase Auth
- 🔗 Prisma ORM (where appropriate)

### Code Execution
- 🌐 WebContainers
- 🐍 Pyodide
- ⚙️ Secure hosted execution providers

### Development & Deployment
- 🧰 Git
- 🐙 GitHub
- ▲ Vercel
- ☁️ Node.js-compatible backend hosting

---

## 🏗️ System Architecture

Unite follows a modular full-stack architecture that separates the user interface, application services, real-time collaboration and execution environments.

```text
                 UNITE PLATFORM
                       |
          +------------+------------+
          |                         |
     FRONTEND                  BACKEND
          |                         |
   React + TypeScript         Node.js + Express
          |                         |
   +------+------+           +------+------+
   |             |           |             |
 Monaco       xterm.js    REST APIs    WebSockets
 Editor       Terminal        |             |
   |             |            |        Hocuspocus
   |             |            |             |
   +-------------+------------+-------------+
                              |
                   +----------+----------+
                   |                     |
              Supabase              Execution
              PostgreSQL            Providers
              Supabase Auth         |
                                    +-- WebContainers
                                    +-- Pyodide
                                    +-- Hosted Runners
```

### 🔄 Collaboration Workflow

1. A developer creates a workspace.
2. Other developers join through an invitation.
3. Each participant connects to the shared collaboration service.
4. Monaco Editor integrates with a shared Yjs document.
5. Changes are synchronized through WebSockets.
6. Yjs CRDTs reconcile concurrent modifications.
7. Awareness communicates cursor positions and participant presence.
8. Collaborative document states are persisted.

---

## 📁 Project Structure

Unite uses a feature-based modular architecture to maintain clean separation of responsibilities.

```text
unite/
│
├── public/
│   └── assets/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── landing/
│   │   ├── authentication/
│   │   ├── workspaces/
│   │   ├── editor/
│   │   ├── collaboration/
│   │   ├── file-explorer/
│   │   ├── terminal/
│   │   ├── execution/
│   │   └── presence/
│   │
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── constants/
│   └── utils/
│
├── server/
│   └── src/
│       ├── api/
│       ├── auth/
│       ├── middleware/
│       ├── workspace/
│       ├── collaboration/
│       ├── execution/
│       ├── terminal/
│       ├── database/
│       └── security/
│
├── shared/
│   ├── types/
│   ├── schemas/
│   └── constants/
│
├── prisma/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── collaboration/
│   └── security/
│
├── docs/
│
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Ensure the following are installed:

- Node.js (LTS)
- npm
- Git
- Supabase account

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/unite.git

cd unite
```

### 2. Install Dependencies

```bash
npm install
```

Install frontend and backend dependencies according to the project workspace configuration.

### 3. Configure Environment Variables

Create a `.env` file using the provided example:

```bash
cp .env.example .env
```

Configure the required credentials:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

DATABASE_URL=

SERVER_PORT=5000
CLIENT_URL=http://localhost:5173
```

Never expose service-role keys or backend secrets through frontend environment variables.

### 4. Configure Supabase

1. Create a Supabase project.
2. Configure PostgreSQL.
3. Enable the required authentication providers.
4. Configure database access policies.
5. Apply database migrations.

### 5. Start Development

Use the scripts configured in the root package.json.

Example:

```bash
npm run dev
```

Start the frontend, backend and persistent collaboration service according to their individual development scripts.

---

## 🔐 Security Architecture

Security is an essential part of Unite.

- Authenticated workspace access.
- Role-based permissions.
- Secure invitation tokens.
- WebSocket authentication.
- Backend authorization.
- Request validation.
- Protected environment variables.
- Isolated code execution.
- Execution time and output limits.
- Terminal session restrictions.

User-provided code must never execute directly on the main application server.

---

## 🧪 Testing Strategy

The project follows a modular testing approach.

| Testing Area | Objective |
|---|---|
| Unit Testing | Validate individual modules |
| Integration Testing | Verify API and database interactions |
| Collaboration Testing | Verify synchronization across multiple clients |
| Execution Testing | Validate supported language runtimes |
| Security Testing | Verify permissions and execution restrictions |
| Build Testing | Ensure production builds are successful |

An essential collaboration test involves two independent browser sessions editing the same document simultaneously.

---

## 🗺️ Development Roadmap

- [x] Project concept and brand identity
- [x] Technical architecture planning
- [x] Modular folder structure planning
- [ ] Frontend foundation and design system
- [ ] Landing page and authentication
- [ ] Workspace creation and joining
- [ ] Monaco Editor integration
- [ ] File explorer and project management
- [ ] Yjs and Hocuspocus integration
- [ ] Real-time collaborative editing
- [ ] Collaborative cursors and presence
- [ ] Multi-language editor support
- [ ] Browser-based code execution
- [ ] Integrated terminal
- [ ] Workspace persistence
- [ ] Security implementation
- [ ] Automated testing
- [ ] Production deployment

---

## 🎯 Project Vision

The vision behind Unite is simple:

**Make collaborative coding feel like working on the same computer, even when developers are miles apart.**

Unite aims to eliminate collaboration barriers by bringing code editing, synchronization, execution and teamwork into one unified development environment.

---

## 🤝 Contributing

Contributions, suggestions and improvements are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test your implementation.
5. Submit a pull request.

Maintain the existing modular architecture and coding conventions.

---

## 👨‍💻 Development

**Project:** Unite  
**Category:** Collaborative Web IDE  
**Architecture:** Full-Stack Web Application  
**Primary Focus:** Real-Time Multi-User Development

---

<p align="center">

### ⚡ UNITE

**Code Together. Build Together. Ship Together.**

*One Workspace. Multiple Minds. Infinite Possibilities.*

</p>
