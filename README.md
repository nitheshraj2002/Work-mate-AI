# 🤖 WorkMate AI - Intelligent Role-Based Chatbot System for IT Organizations

## 📌 Project Overview

WorkMate AI is an AI-powered role-based chatbot developed to simplify communication and automate support within IT organizations. The system provides personalized assistance for Employees, Managers, and HR personnel by answering queries, managing information, and improving workplace productivity.

The chatbot is built using **Rasa** for conversational AI, **Python (Flask)** for the backend, **React (Vite)** for the frontend, and **Google Gemini AI** for intelligent AI-generated responses.

One of the key features of WorkMate AI is its **dual-mode operation**:

- **Offline Mode:** Uses the **Rasa AI model** to provide chatbot responses without requiring an internet connection.
- **Online Mode:** Uses the **Google Gemini API** to generate advanced AI-powered responses when an internet connection and a valid Gemini API key are available.

This hybrid approach ensures that the chatbot remains functional even when internet connectivity is unavailable while providing more intelligent and dynamic responses online.

---

## ✨ Features

- 🔐 Secure User Login & Authentication
- 👨‍💼 Role-Based Access (Employee, Manager, HR)
- 🤖 AI-Powered Chatbot using Rasa
- 🌐 Online AI Responses using Google Gemini API
- 💻 Offline Chatbot Support using Rasa
- 🔄 Automatic Switching Between Online and Offline Modes
- 📂 File Upload Support
- 💬 Natural Language Processing (NLP)
- 📊 User-Friendly Dashboard
- 🎨 Modern Responsive UI
- 📁 Database Integration
- ⚡ Fast and Lightweight Architecture

---

## 🌐 Online & Offline Working

### 🟢 Online Mode
When a valid **Google Gemini API Key** is configured and an internet connection is available, WorkMate AI uses **Gemini AI** to generate intelligent, context-aware responses for user queries.

### 🔵 Offline Mode
If the internet is unavailable or the Gemini API is not configured, the chatbot automatically uses the locally trained **Rasa AI model** to continue providing responses. This ensures uninterrupted chatbot functionality without relying on external services.

This dual-mode architecture makes WorkMate AI reliable, scalable, and suitable for organizations that require continuous chatbot availability.


## 🛠️ Tech Stack

### Frontend
- React.js (Vite)
- JavaScript
- CSS
- HTML

### Backend
- Python
- Flask
- Rasa Framework
- Google Gemini AI

### Database
- SQLite / MySQL

### Tools
- Git
- GitHub
- VS Code

---

## 📂 Project Structure

```
WorkMate-AI/
│
├── backend/
│   ├── actions/
│   ├── data/
│   ├── routes/
│   ├── uploads/
│   ├── app.py
│   ├── domain.yml
│   ├── config.yml
│   └── ...
│
├── client/
│   └── my-project/
│       ├── src/
│       ├── public/
│       └── ...
│
├── screenshots/
├── README.md
└── .gitignore
```

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/WorkMate-AI.git
```

### Backend Setup

```bash
cd backend

python -m venv rasa_env

# Windows
rasa_env\Scripts\activate

pip install -r requirements.txt
```

### Train the Rasa Model

> **Note:** The `backend/models` folder is not included because trained models are generated files.

```bash
rasa train
```

### Run Rasa Server

```bash
rasa run --enable-api
```

### Run Action Server

```bash
rasa run actions
```

### Frontend Setup

```bash
cd client/my-project

npm install

npm run dev
```

## 🎯 Future Enhancements

- Voice Assistant Support
- Multi-language Chatbot
- Email Notifications
- Analytics Dashboard
- Cloud Deployment
- Advanced AI Features

---

## 👨‍💻 Author

**Nithesh Raj**

MCA Graduate | Full Stack Developer | AI Enthusiast

---

## ⭐ Support

If you found this project helpful, please consider giving it a ⭐ on GitHub.
