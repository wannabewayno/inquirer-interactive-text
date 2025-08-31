# Open Source Software Typescript + NPM

This template provides a complete TypeScript package structure with modern tooling for publishing to npm.

## Features Included

- ✅ TypeScript with dual ESM/CommonJS output (tshy)
- ✅ Biome for formatting and linting
- ✅ Mocha + Chai testing setup
- ✅ Husky + lint-staged for git hooks
- ✅ Proper package.json exports
- ✅ GitHub Actions ready structure

## Quick Setup

1. **Clone/Copy this template**
2. **Run the setup script**: `npm run template:setup`
3. **Install dependencies**: `npm install`
4. **Provide NPM Token**: Add an NPM auth token a the repository secret `NPM_TOKEN` this enables the CD runner to publish packages.
5. **Configure Branch Protection Rules**: Ensure `main/master` is protected and can only accept code via pull requests. 
6. **Start coding**: Replace src/ content with your package logic


## Available Scripts

- `npm run build` - Build the package
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run check` - Type check

## Building with tshy
[tshy](https://github.com/isaacs/tshy) is the TypeScript HYbridizer build system that uses tsc under the hood. It's configured out of the box to proivide ESM and CommonJS build targets for your package.

It mostly just works, but I wanted to provide some context around the 'exports' property in the `package.json`. By default it is 

## Publishing

Publishing happens automatically via the workflow file `.github/workflows/npm-publish.yaml`.
Simply use npm to semantically update the version:
```bash
npm version <patch|minor|major>
```
A new 'bump' commit will be added to the repository tagged with a semver tag `v<major>.<minor>.<patch>)`.
The github action's workflow listens for semver tags and will test and publish the package to npm on your behalf.
