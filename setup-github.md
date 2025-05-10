# Setting Up GitHub Remote Repository

Follow these steps to connect your local Git repository to GitHub:

## 1. Create a new repository on GitHub

1. Go to [GitHub](https://github.com/) and sign in to your account
2. Click on the "+" icon in the top-right corner and select "New repository"
3. Enter "android-lab-platform" as the repository name
4. Add a description (optional): "A web utility for remote Android development and testing workflows"
5. Choose visibility (public or private)
6. Do NOT initialize the repository with a README, .gitignore, or license (we've already created these locally)
7. Click "Create repository"

## 2. Connect your local repository to GitHub

After creating the repository, GitHub will show you commands to connect your existing local repository. Run the following commands in your terminal:

```bash
# Navigate to your project directory if you're not already there
cd android-lab-platform

# Add the GitHub repository as a remote named "origin"
git remote add origin https://github.com/ngoyal78/android-lab-platform.git

# Push your local repository to GitHub
git push -u origin main
```

## 3. Verify the connection

After pushing, refresh your GitHub repository page to see your files. You should now see all your project files on GitHub.

## 4. Subsequent pushes

For future changes, you can simply use:

```bash
git push
```

## 5. Collaborating with others

To allow others to collaborate on your project:

1. Go to your repository on GitHub
2. Click on "Settings"
3. Select "Collaborators" from the left sidebar
4. Click "Add people" and enter their GitHub username or email address
5. Choose the appropriate role for them

## 6. Branching strategy

For collaborative development, consider using the following branching strategy:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/feature-name` - Individual feature branches
- `bugfix/bug-description` - Bug fix branches
- `release/version-number` - Release preparation branches

Example of creating and pushing a feature branch:

```bash
git checkout -b feature/add-device-filtering
# Make changes...
git add .
git commit -m "Add device filtering functionality"
git push -u origin feature/add-device-filtering
