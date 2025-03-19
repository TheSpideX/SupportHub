\
#!/bin/bash

# Script to clean Git-related files and prepare for a new repository

echo "Cleaning Git files from project..."

# Remove all Git-related directories and files
find . -name ".git" -type d -exec rm -rf {} +
find . -name ".gitignore" -exec rm {} \;
find . -name ".gitattributes" -exec rm {} \;
find . -name ".gitmodules" -exec rm {} \;
find . -name ".github" -type d -exec rm -rf {} +


echo "Git files removed successfully. Project is ready for a new repository."