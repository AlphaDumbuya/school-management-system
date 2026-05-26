# Git Repository Setup Guide

This guide walks you through setting up a Git repository for the School Management System and pushing it to GitHub, GitLab, or another Git hosting service.

## Prerequisites

- Git installed on your machine
- GitHub, GitLab, or Gitea account (or another Git hosting service)
- SSH key configured (recommended) or personal access token

## Step 1: Initialize Local Git Repository

The repository has already been initialized locally. Verify it:

```bash
# Check Git status
git status

# View Git configuration
git config --list

# View commit history
git log --oneline
```

## Step 2: Create Remote Repository

### Option A: GitHub

1. Go to https://github.com/new
2. Enter repository name: `school-management-system`
3. Add description: "Comprehensive School Management System - Multi-tenant, scalable education platform"
4. Choose visibility: Private (recommended) or Public
5. Do NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Option B: GitLab

1. Go to https://gitlab.com/projects/new
2. Enter project name: `school-management-system`
3. Add description: "Comprehensive School Management System - Multi-tenant, scalable education platform"
4. Choose visibility: Private (recommended) or Public
5. Do NOT initialize with README, .gitignore, or license
6. Click "Create project"

### Option C: Gitea (Self-hosted)

1. Go to your Gitea instance
2. Click "+" → "New Repository"
3. Enter repository name: `school-management-system`
4. Add description
5. Do NOT initialize with README, .gitignore, or license
6. Click "Create Repository"

## Step 3: Add Remote Repository

After creating the remote repository, add it to your local Git configuration:

```bash
# Add remote repository (replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/school-management-system.git

# Or if using SSH (recommended):
git remote add origin git@github.com:YOUR_USERNAME/school-management-system.git

# Verify remote was added
git remote -v
```

## Step 4: Configure Git User (if not already done)

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email
git config --global user.email "your.email@example.com"

# Verify configuration
git config --global --list
```

## Step 5: Review Staged Changes

```bash
# Check what will be committed
git status

# View changes
git diff --cached

# View all files that will be committed
git ls-files
```

## Step 6: Create Initial Commit

```bash
# Stage all files (already done, but verify)
git add .

# Create initial commit
git commit -m "Initial commit: Phase 1 - Project Setup and Infrastructure

- Initialize Git repository with comprehensive .gitignore
- Set up root workspace with npm workspaces
- Create Docker containerization (backend, frontend, services)
- Configure PostgreSQL database with 17 tables
- Set up Redis caching and RabbitMQ messaging
- Configure environment variables for all deployment scenarios
- Create comprehensive documentation and setup guides
- Seed database with demo data for testing
- All services healthy and operational"

# View commit
git log --oneline -1
```

## Step 7: Push to Remote Repository

```bash
# Push to remote (first time)
git push -u origin main

# Or if your default branch is 'master':
git push -u origin master

# Verify push was successful
git remote -v
git branch -vv
```

## Step 8: Verify Remote Repository

1. Go to your repository on GitHub/GitLab
2. Verify all files are present
3. Check that `.env` and `.env.local` are NOT present (should be in .gitignore)
4. Verify commit history is correct

## Troubleshooting

### "fatal: not a git repository"

```bash
# Reinitialize Git
git init

# Add remote
git remote add origin <your-repo-url>

# Check status
git status
```

### "Permission denied (publickey)"

This means SSH authentication failed. Use HTTPS instead:

```bash
# Remove SSH remote
git remote remove origin

# Add HTTPS remote
git remote add origin https://github.com/YOUR_USERNAME/school-management-system.git

# Try pushing again
git push -u origin main
```

### "fatal: 'origin' does not appear to be a 'git' repository"

```bash
# Check remotes
git remote -v

# If empty, add remote
git remote add origin <your-repo-url>
```

### "Updates were rejected because the tip of your current branch is behind"

```bash
# Pull latest changes
git pull origin main

# Then push
git push origin main
```

### "fatal: The current branch main has no upstream branch"

```bash
# Push with -u flag to set upstream
git push -u origin main
```

## Setting Up SSH Key (Recommended)

### Generate SSH Key

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Or for older systems:
ssh-keygen -t rsa -b 4096 -C "your.email@example.com"

# Press Enter to accept default location
# Enter passphrase (optional but recommended)
```

### Add SSH Key to GitHub/GitLab

**GitHub**:
1. Go to https://github.com/settings/keys
2. Click "New SSH key"
3. Paste your public key (from `~/.ssh/id_ed25519.pub`)
4. Click "Add SSH key"

**GitLab**:
1. Go to https://gitlab.com/-/profile/keys
2. Paste your public key
3. Click "Add key"

### Test SSH Connection

```bash
# Test GitHub
ssh -T git@github.com

# Test GitLab
ssh -T git@gitlab.com

# Should see: "Hi USERNAME! You've successfully authenticated..."
```

## Branching Strategy

### Create Development Branch

```bash
# Create and switch to development branch
git checkout -b develop

# Push development branch
git push -u origin develop

# Set default branch to main in repository settings
```

### Create Feature Branches

```bash
# Create feature branch for Phase 2
git checkout -b feature/phase-2-authentication

# Make changes and commit
git add .
git commit -m "Phase 2: Implement JWT authentication"

# Push feature branch
git push -u origin feature/phase-2-authentication

# Create pull request on GitHub/GitLab
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

```bash
# Good commit message
git commit -m "Add JWT authentication service

- Implement JWT token generation and validation
- Add password hashing with bcrypt
- Create authentication middleware
- Add unit tests for auth service"

# Bad commit message
git commit -m "fix stuff"
```

## Useful Git Commands

```bash
# View commit history
git log --oneline
git log --graph --all --decorate

# View changes
git diff
git diff --cached
git diff HEAD~1

# Undo changes
git restore <file>              # Discard changes in working directory
git restore --staged <file>     # Unstage file
git reset HEAD~1                # Undo last commit (keep changes)
git reset --hard HEAD~1         # Undo last commit (discard changes)

# Stash changes
git stash                        # Save changes temporarily
git stash pop                    # Restore stashed changes

# View branches
git branch -a                    # List all branches
git branch -vv                   # List branches with tracking info

# Switch branches
git checkout <branch>
git switch <branch>              # Newer syntax

# Merge branches
git merge <branch>

# Rebase
git rebase <branch>

# Cherry-pick
git cherry-pick <commit>
```

## GitHub/GitLab Configuration

### Add Collaborators

**GitHub**:
1. Go to repository Settings
2. Click "Collaborators"
3. Add team members

**GitLab**:
1. Go to project Settings
2. Click "Members"
3. Add team members

### Set Up Branch Protection

**GitHub**:
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Require pull request reviews
4. Require status checks to pass

**GitLab**:
1. Go to Settings → Repository
2. Expand "Protected branches"
3. Add rule for `main` branch
4. Require approvals

### Set Up CI/CD

**GitHub Actions**:
1. Create `.github/workflows/ci.yml`
2. Define build, test, and deploy steps

**GitLab CI/CD**:
1. Create `.gitlab-ci.yml`
2. Define pipeline stages

## Continuous Integration Setup

### GitHub Actions Example

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Lint
      run: npm run lint
    
    - name: Build
      run: npm run build
    
    - name: Test
      run: npm run test
```

## Deployment Setup

### GitHub Pages (for documentation)

```bash
# Create gh-pages branch
git checkout --orphan gh-pages
git rm -rf .
echo "# Documentation" > README.md
git add README.md
git commit -m "Initial gh-pages commit"
git push -u origin gh-pages
```

### Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create school-management-system

# Set environment variables
heroku config:set DATABASE_URL=...
heroku config:set JWT_SECRET=...

# Deploy
git push heroku main
```

## Backup and Recovery

### Create Local Backup

```bash
# Clone repository to backup location
git clone --mirror <repo-url> school-management-system.git

# Update backup
cd school-management-system.git
git fetch --all
```

### Restore from Backup

```bash
# Clone from backup
git clone school-management-system.git school-management-system
```

## Security Best Practices

1. **Never commit secrets**:
   - `.env` files
   - API keys
   - Database passwords
   - Private keys

2. **Use .gitignore**:
   - Already configured
   - Review before committing

3. **Use SSH keys**:
   - More secure than HTTPS
   - Easier for automation

4. **Enable 2FA**:
   - GitHub: https://github.com/settings/security
   - GitLab: https://gitlab.com/-/profile/two_factor_auth

5. **Review commits before pushing**:
   - Use `git diff` to review changes
   - Use `git log` to review history

## Next Steps

1. Create remote repository on GitHub/GitLab
2. Add remote to local repository
3. Push initial commit
4. Set up branch protection rules
5. Configure CI/CD pipeline
6. Add team members as collaborators
7. Start Phase 2 development

## Support

For Git help:
- `git help <command>` - Get help for specific command
- https://git-scm.com/doc - Official Git documentation
- https://github.com/git-tips/tips - Git tips and tricks

---

**Ready to push to remote repository!**
