# Git Workflow Guide

This guide explains the Git workflow for the School Management System project.

## Repository

- **Repository**: https://github.com/AlphaDumbuya/school-management-system
- **Default Branch**: `main`
- **Protocol**: HTTPS

## Initial Setup

The repository has been initialized with Phase 1 implementation complete.

### Commit History

```
7b9c784 (HEAD -> main, origin/main) feat: Phase 1 - Project Setup and Infrastructure Complete
```

## Cloning the Repository

```bash
# Clone the repository
git clone https://github.com/AlphaDumbuya/school-management-system.git
cd school-management-system

# Verify remote
git remote -v
```

## Branch Strategy

### Main Branch (`main`)

- **Purpose**: Production-ready code
- **Protection**: Only accepts pull requests
- **Commits**: Only through merged pull requests
- **Tags**: Release versions (e.g., v1.0.0)

### Development Branch (`develop`)

- **Purpose**: Integration branch for development
- **Should be created**: Before starting Phase 2

### Feature Branches

- **Naming**: `feature/<feature-name>` or `feature/<phase>-<feature>`
- **Format**: `feature/phase-2-authentication`, `feature/user-login`
- **Created from**: `develop`
- **Merged to**: `develop` (via pull request)

### Bugfix Branches

- **Naming**: `bugfix/<bug-name>`
- **Format**: `bugfix/auth-validation-error`
- **Created from**: `develop`
- **Merged to**: `develop` (via pull request)

### Hotfix Branches

- **Naming**: `hotfix/<issue-name>`
- **Format**: `hotfix/critical-database-error`
- **Created from**: `main`
- **Merged to**: `main` (via pull request)
- **Also merged to**: `develop`

## Commit Message Format

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Code style changes (formatting, missing semicolons)
- **refactor**: Code refactoring without feature or fix
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Build, dependencies, or CI/CD changes
- **ci**: CI/CD configuration changes

### Scope

- `auth`: Authentication related
- `db`: Database related
- `api`: API related
- `ui`: User interface related
- `docs`: Documentation
- `deploy`: Deployment related

### Examples

```bash
# Feature commit
git commit -m "feat(auth): implement JWT authentication

- Create login endpoint
- Implement token generation
- Add token validation middleware"

# Bug fix commit
git commit -m "fix(db): handle connection pool exhaustion

- Add connection timeout handling
- Implement retry logic
- Log connection pool status"

# Documentation commit
git commit -m "docs(setup): update Docker setup guide

- Add troubleshooting section
- Update quick start instructions"
```

## Workflow for Phase 2

### 1. Create Development Branch

```bash
# Switch to main
git checkout main

# Pull latest changes
git pull origin main

# Create develop branch
git checkout -b develop

# Push develop branch to remote
git push -u origin develop
```

### 2. Create Feature Branch

```bash
# Switch to develop
git checkout develop

# Pull latest changes
git pull origin develop

# Create feature branch
git checkout -b feature/phase-2-authentication

# Make changes...

# Stage changes
git add .

# Commit changes
git commit -m "feat(auth): implement JWT authentication

- Create login endpoint
- Implement password hashing
- Add token validation middleware"

# Push feature branch
git push -u origin feature/phase-2-authentication
```

### 3. Create Pull Request

```bash
# On GitHub:
# 1. Go to https://github.com/AlphaDumbuya/school-management-system
# 2. Click "Pull requests" tab
# 3. Click "New pull request" button
# 4. Select:
#    - Base: develop
#    - Compare: feature/phase-2-authentication
# 5. Add title and description
# 6. Click "Create pull request"
```

### 4. Review and Merge

```bash
# Approve and merge on GitHub, or locally:
git checkout develop
git pull origin develop
git merge feature/phase-2-authentication
git push origin develop

# Delete feature branch
git branch -d feature/phase-2-authentication
git push origin --delete feature/phase-2-authentication
```

## Common Git Commands

### Viewing History

```bash
# View commit log
git log

# View log with graph
git log --graph --oneline --all

# View commits in range
git log main..develop

# View commits by author
git log --author="John Doe"

# View commits with specific files
git log -- backend/src/services/authService.ts
```

### Branching

```bash
# List local branches
git branch

# List remote branches
git branch -r

# List all branches
git branch -a

# Create new branch
git checkout -b feature/my-feature

# Switch branch
git checkout feature/my-feature

# Delete local branch
git branch -d feature/my-feature

# Delete remote branch
git push origin --delete feature/my-feature

# Rename branch
git branch -m old-name new-name
```

### Staging and Committing

```bash
# View status
git status

# View diff
git diff

# Stage specific file
git add backend/src/services/authService.ts

# Stage all changes
git add .

# Unstage file
git reset HEAD backend/src/services/authService.ts

# Discard changes to file
git checkout -- backend/src/services/authService.ts

# Commit changes
git commit -m "feat(auth): implement authentication"

# Amend last commit
git commit --amend --no-edit

# View staged changes
git diff --cached
```

### Pushing and Pulling

```bash
# Push to remote
git push origin feature/my-feature

# Push with upstream tracking
git push -u origin feature/my-feature

# Pull from remote
git pull origin develop

# Fetch without merging
git fetch origin

# View remote information
git remote -v
```

### Undoing Changes

```bash
# View reflog
git reflog

# Revert specific commit
git revert <commit-hash>

# Reset to previous commit (soft)
git reset --soft <commit-hash>

# Reset to previous commit (hard)
git reset --hard <commit-hash>

# Stash changes
git stash

# Apply stashed changes
git stash pop
```

## Best Practices

### Commits

1. **Commit Often**: Make small, focused commits
2. **Clear Messages**: Write descriptive commit messages
3. **Atomic Commits**: One logical change per commit
4. **Test Before Commit**: Run tests before committing
5. **No Merge Commits**: Use rebase instead

### Branches

1. **Short-lived Branches**: Delete after merging
2. **Descriptive Names**: Use clear branch names
3. **One Feature per Branch**: Focus on single feature
4. **Keep Updated**: Regularly pull from main
5. **Update Before Merging**: Rebase on latest develop

### Pull Requests

1. **Clear Description**: Explain changes and rationale
2. **Link Issues**: Reference related issues
3. **Request Reviews**: Ask for peer review
4. **Check CI**: Ensure all checks pass
5. **Squash if Needed**: Clean up commit history before merge

## Typical Phase Workflow

```
Phase Setup:
├── Create develop branch from main
└── Set as default branch

Phase Development:
├── feature/phase-2-task-1 → develop (PR)
├── feature/phase-2-task-2 → develop (PR)
├── feature/phase-2-task-3 → develop (PR)
└── feature/phase-2-task-4 → develop (PR)

Phase Completion:
├── Create release branch: release/phase-2
├── Final testing and fixes
└── Merge to main with tag: v0.2.0

Back to Development:
└── Merge main back to develop
```

## Handling Conflicts

### During Pull

```bash
# Pull with conflicts
git pull origin develop

# Check conflicted files
git status

# Edit conflicted files (look for <<<<<<, ======, >>>>>> markers)

# Stage resolved files
git add <resolved-file>

# Complete merge
git commit -m "merge: resolve conflicts from develop"
```

### During Rebase

```bash
# Rebase with conflicts
git rebase develop

# Edit conflicted files

# Stage resolved files
git add <resolved-file>

# Continue rebase
git rebase --continue

# Or abort rebase
git rebase --abort
```

## Environment Files

**Never commit**:
- `.env`
- `.env.local`
- `.env.*.local`
- `secrets/`
- `*.pem` (private keys)

**Always commit**:
- `.env.example`
- `.env.docker`
- `.gitignore`

## Protected Files

These files are critical and should have careful review:

- `docker-compose.yml` - Service configuration
- `knexfile.ts` - Database configuration
- `.env.example` - Environment template
- `package.json` - Dependencies
- Database migrations

## CI/CD Integration

(To be configured in Phase 2)

Planned CI/CD checks:
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests (Vitest)
- Integration tests
- Code coverage

## Useful Aliases

Add to your `.gitconfig`:

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual 'log --graph --oneline --all'
```

## Release Process

(To be implemented after Phase 1)

```bash
# Create release branch
git checkout -b release/v0.2.0
git push -u origin release/v0.2.0

# Make final changes and commit

# Create pull request to main
# After merge:

# Tag release
git tag v0.2.0
git push origin v0.2.0

# Merge back to develop
git checkout develop
git pull origin main
git push origin develop
```

## Support

For Git issues:

1. Check [Pro Git Book](https://git-scm.com/book/en/v2)
2. Run `git help <command>`
3. Visit [GitHub Help](https://docs.github.com/)
4. Check [Conventional Commits](https://www.conventionalcommits.org/)

## Quick Reference

```bash
# Clone repository
git clone https://github.com/AlphaDumbuya/school-management-system.git

# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push to GitHub
git push -u origin feature/my-feature

# Create pull request on GitHub

# Update local main
git checkout main
git pull origin main

# Delete local branch
git branch -d feature/my-feature
```

---

**Repository**: https://github.com/AlphaDumbuya/school-management-system  
**Default Branch**: main  
**Status**: Phase 1 Complete, Ready for Phase 2
