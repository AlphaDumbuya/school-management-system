# PostgreSQL Setup Guide for Windows

This guide walks you through setting up PostgreSQL locally on Windows for the School Management System.

## 🎯 Goal

Get PostgreSQL running locally so the application can connect to it.

## 📥 Step 1: Download PostgreSQL

1. Open your browser and go to: https://www.postgresql.org/download/windows/
2. Click **"Download the installer"**
3. Choose the **latest version** (e.g., PostgreSQL 16.x)
4. Wait for download to complete

## 💾 Step 2: Install PostgreSQL

1. **Run the installer** (`postgresql-16.x-x64.exe`)
2. Click through the installation wizard:
   - **Next** on welcome screen
   - **Choose installation directory** (default is fine: `C:\Program Files\PostgreSQL\16`)
   - **Select Components** (keep defaults selected):
     - ✅ PostgreSQL Server
     - ✅ pgAdmin 4
     - ✅ Stack Builder
     - ✅ Command Line Tools
   - **Click Next**

3. **Choose Data Directory** (where databases will be stored)
   - Default: `C:\Program Files\PostgreSQL\16\data`
   - Click **Next**

4. **Set Superuser Password**
   - **Username:** `postgres` (default, keep this)
   - **Password:** `postgres` (for development - change in production!)
   - **Confirm Password:** `postgres`
   - **Write this down!** You'll need it.
   - Click **Next**

5. **Set Port**
   - **Port:** `5432` (default - keep this)
   - Click **Next**

6. **Locale**
   - Select your **system locale** (usually your country)
   - Click **Next**

7. **Ready to Install**
   - Review settings
   - Click **Install**
   - Wait for installation (2-5 minutes)

8. **Complete Installation**
   - Uncheck "Stack Builder" (optional, we don't need it)
   - Click **Finish**

## ✅ Step 3: Verify Installation

1. **Open Command Prompt** (`cmd.exe`)
2. **Check PostgreSQL version:**
   ```bash
   psql --version
   ```
   You should see: `psql (PostgreSQL) 16.x`

3. **Try to connect to PostgreSQL:**
   ```bash
   psql -U postgres
   ```
   - Enter password: `postgres`
   - If successful, you'll see: `postgres=#`
   - Type `\q` to quit

## 🗄️ Step 4: Create Application Database

1. **Open Command Prompt**
2. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres
   ```
   Enter password: `postgres`

3. **Create database for the application:**
   ```sql
   CREATE DATABASE school_management;
   ```

4. **Verify it was created:**
   ```sql
   \l
   ```
   You should see `school_management` in the list.

5. **Exit PostgreSQL:**
   ```sql
   \q
   ```

## 🔧 Step 5: Configure Application

1. **Open `.env` file** in the project root
2. **Update database configuration:**
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=school_management
   ```

## ▶️ Step 6: Verify Connection

1. **Open project folder** in Command Prompt/PowerShell
2. **Test database connection:**
   ```bash
   npm run db:migrate
   ```
   - If successful, you'll see migration messages
   - If error, check your `.env` file

## 🎉 Done!

PostgreSQL is now set up and ready. You can now:

```bash
# Setup database tables
npm run db:migrate

# Load sample data
npm run db:seed

# Start the application
npm run dev
```

## 🆘 Troubleshooting

### Error: "psql is not recognized"

**Cause:** PostgreSQL's bin folder is not in your system PATH

**Solution:**
1. Open Environment Variables (Windows)
2. Add `C:\Program Files\PostgreSQL\16\bin` to your PATH
3. Restart Command Prompt

### Error: "connection refused" or "ECONNREFUSED"

**Cause:** PostgreSQL is not running

**Solution:**
- Windows Services:
  1. Press `Win+R`, type `services.msc`, press Enter
  2. Find "postgresql-x64-16" or "PostgreSQL" service
  3. Right-click → "Start"

- Or in Command Prompt (admin):
  ```bash
  net start postgresql-x64-16
  ```

### Error: "password authentication failed"

**Cause:** Wrong password

**Solution:**
1. Reset PostgreSQL password:
   ```bash
   psql -U postgres -d postgres
   ALTER USER postgres WITH PASSWORD 'postgres';
   \q
   ```

2. Update `.env` with correct password

### Error: "database does not exist"

**Cause:** Database not created

**Solution:**
```bash
psql -U postgres
CREATE DATABASE school_management;
\q
```

### Can't connect from application

**Checklist:**
- [ ] PostgreSQL service is running
- [ ] Port 5432 is not blocked by firewall
- [ ] `.env` has correct credentials
- [ ] Database name exists
- [ ] Connection string is correct

**Test connection:**
```bash
psql -h localhost -U postgres -d school_management
```

## 🎯 Next Steps

1. ✅ PostgreSQL installed and running
2. ✅ Database created
3. ✅ `.env` configured
4. → **Next:** Run `npm run db:migrate` to setup tables
5. → **Then:** Run `npm run dev` to start application

## 💡 Tips

- **Keep PostgreSQL running:** It should auto-start on Windows startup
- **pgAdmin:** A visual database tool is installed at `http://localhost:5050`
- **Backup data:** Regularly backup your `school_management` database
- **Change password for production:** Don't use default password in production

## 📚 Additional Resources

- PostgreSQL Documentation: https://www.postgresql.org/docs/
- pgAdmin Documentation: https://www.pgadmin.org/docs/
- Connection String Format: https://www.postgresql.org/docs/current/libpq-connect-using-params.html

---

**PostgreSQL is now ready for development! 🚀**
