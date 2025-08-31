# Contributing to {{PACKAGE_NAME}}

Thank you for your interest in contributing! This project welcomes contributions from the community.

## Workflow

1. **Create an Issue** - Discuss your idea or bug report
2. **Fork & Clone** - Fork the repository and clone it locally
3. **Create a Branch** - Create a feature branch for your changes
4. **Write Code** - Implement your changes with tests
5. **Submit PR** - Open a pull request for review
6. **Review & Iterate** - Address feedback and make improvements
7. **Merge** - Maintainers will merge approved PRs

## Development Setup

### Prerequisites
- Node.js 18+ (use volta, nvm, or similar)
- npm or bun

### Installation
```bash
git clone {{REPO_URL}}
cd {{PACKAGE_NAME}}
npm install
```

### Development Commands
```bash
npm run build      # Build the package
npm test           # Run tests
npm run lint       # Lint code
npm run format     # Format code
npm run check      # Type check
```

## Code Quality

- All code is automatically formatted with Biome
- Linting rules are enforced via lint-staged
- Tests are required for new features
- Type checking must pass

## Publishing

Publishing is restricted to maintainers and admins only. The main branch is protected and requires PR reviews.