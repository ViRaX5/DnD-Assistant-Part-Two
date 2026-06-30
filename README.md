# 🧙‍♂️ DnD Assistant (Backend API) 🏰

*The man behind the screen.* Welcome to the backend architecture of the **DnD Assistant**. This is the brain of the operation, handling all the real-time websocket magic, database hoarding, and asset management that keeps the campaign running smoothly.

## ✨ Features (The Dungeon Master's Tools)

* **🌐 The Websocket Nexus:** Powered by Socket.io, this server handles real-time bidirectional syncing for map tokens, chat messages, combat turns, and synchronized audio streaming.
* **🗄️ Twin Databases:** * **MySQL (AWS RDS):** Handles structured relational data like User Accounts, Campaigns, and active participants.
    * **MongoDB:** Handles the complex, nested JSON data from the 5e API, like saved custom monsters and dynamic shop inventories.
* **📦 S3 Asset Hoard:** Direct integration with AWS S3 for uploading, storing, and serving campaign assets (battle maps, player tokens, and audio tracks).
* **🔒 Secure Auth:** JWT-based authentication ensuring that only the rightful DM can alter the campaign state.
* **🖼️ Image Forging:** On-the-fly image processing using `sharp` to automatically crop player tokens into perfect circles before saving them to the cloud.

## 🛠️ The Arcane Stack (Tech)

* **Node.js & Express:** The foundation of the API.
* **Socket.io:** For sub-millisecond real-time game state synchronization.
* **MySQL2 & Mongoose:** Our database spellbooks.
* **AWS SDK (S3):** Cloud storage for all user-generated content.
* **Multer & Sharp:** Middleware for handling multipart/form-data (uploads) and processing images.
* **JWT & Argon2:** Cryptography for secure logins.

## 🚀 Getting Started (Starting the Server)

1. **Clone the Grimoire:** `git clone <your-backend-repo-url>`
2. **Gather Materials:** Run `npm install` to install all dependencies.
3. **Prepare the Spells (.env):** Create a `.env` file in the root directory and add your secrets (DO NOT commit this file!):
   ```env
   PORT=8081
   DB_HOST=your-aws-rds-endpoint
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_NAME=your-db-name
   MONGODB_PASSWORD=your-mongo-password
   JWT_SECRET=your-super-secret-key
   BUCKET_NAME=your-s3-bucket-name
   BUCKET_REGION=your-s3-region
