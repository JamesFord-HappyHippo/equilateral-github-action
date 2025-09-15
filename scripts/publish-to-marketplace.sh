#!/bin/bash

# Script to publish EquilateralAgents GitHub Action to GitHub Marketplace

echo "Publishing EquilateralAgents GitHub Action to GitHub Marketplace..."
echo ""

# Check if we're in the right directory
if [ ! -f "action.yml" ]; then
    echo "Error: action.yml not found. Please run from the root of the GitHub Action repository."
    exit 1
fi

# Build the action
echo "Building action..."
npm run package

# Create release tag
VERSION="v1.0.0"
echo "Creating release $VERSION..."

# Initialize git if needed
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit: EquilateralAgents GitHub Action v1.0.0"
fi

# Create GitHub repository if it doesn't exist
echo "Setting up GitHub repository..."
gh repo create equilateral-ai/github-action \
    --public \
    --description "GitHub Action for EquilateralAgents - AI-enhanced code review and automation" \
    --homepage "https://equilateral.ai" \
    || echo "Repository may already exist, continuing..."

# Set remote
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/equilateral-ai/github-action.git

# Push code
echo "Pushing code to GitHub..."
git push -u origin main --force

# Create release with marketplace category
echo "Creating GitHub release for Marketplace..."
gh release create $VERSION \
    --title "EquilateralAgents GitHub Action v1.0.0" \
    --notes "## 🚀 Initial Release

### Features
- AI-enhanced code review
- Automated security scanning
- Test execution and reporting
- Documentation generation
- Multi-agent orchestration

### Supported Events
- Pull requests
- Push to main/master
- Issue comments
- Manual workflow dispatch

### Configuration
See README.md for detailed configuration options.

### Requirements
- Node.js 16+
- GitHub token with appropriate permissions
- Optional: AI provider API keys (OpenAI, Anthropic, AWS)

### Getting Started
\`\`\`yaml
- uses: equilateral-ai/github-action@v1.0.0
  with:
    task: 'code-review'
    ai-provider: 'openai'
  env:
    OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
\`\`\`

### License
Apache-2.0" \
    --prerelease=false

echo ""
echo "✅ GitHub Action published successfully!"
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/equilateral-ai/github-action/releases"
echo "2. Click on your release"
echo "3. Click 'Publish this Action to the GitHub Marketplace'"
echo "4. Select appropriate categories (CI/CD, Code Quality, etc.)"
echo "5. Add branding (icon and color)"
echo "6. Submit for review"
echo ""
echo "Marketplace URL will be: https://github.com/marketplace/actions/equilateral-agents"