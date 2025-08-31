#!/usr/bin/env node
import { input, confirm, select, Separator } from '@inquirer/prompts';
import { writeFile, readFile, rename, unlink, rm } from 'node:fs/promises';
import licenses from './licenses/index.js';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import validator from 'validator';
import template from './utils/template.js';

const NO_LICENSE = 'NO_LICENSE';

const rootDir = process.cwd();
const git = simpleGit({ baseDir: rootDir });

function gitRemoteToHttps(gitUrl: string): string {
  return gitUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
}

async function main() {
  console.log('🚀 Setting things up...\n');

  // Get defaults from git and/or the environment.
  const packageName = path.basename(rootDir);
  const authorName = await git.getConfig('user.name').then(({ value }) => value);
  const authorEmail = await git.getConfig('user.email').then(({ value }) => value);
  const repoUrl = await git.getConfig('remote.origin.url').then(({ value }) => value);

  const httpsUrl = repoUrl ? gitRemoteToHttps(repoUrl) : undefined;

  const { LICENSE, CONTRIBUTING, KEYWORDS, ...variables } = {
    PACKAGE_NAME: await input({
      message: 'Package Name',
      default: packageName ?? undefined,
      required: true,
    }),
    PACKAGE_DESCRIPTION: await input({
      message: 'Short Description',
    }),
    AUTHOR_NAME: await input({
      message: 'Author Name (full)',
      default: authorName ?? undefined,
      required: true,
    }),
    AUTHOR_EMAIL: await input({
      message: 'Author email',
      default: authorEmail ?? undefined,
      validate: (value: string) => validator.isEmail(value) || 'Please enter a valid email address.',
    }),
    REPO_URL: await input({
      message: 'Repository url',
      default: httpsUrl,
      validate: (value: string) => validator.isURL(value) || 'Please enter a valid URL.',
      required: true,
    }),
    KEYWORDS: await input({
      message: 'Keywords (Comma separated)',
    }).then(keywords => keywords.split(',').map(k => k.trim())),
    LICENSE: await select({
      message: 'Add a license?',
      choices: [
        { name: 'No License', value: NO_LICENSE },
        new Separator(),
        ...Object.entries(licenses).map(([key, value]) => {
          return { name: value.name, value: key };
        }),
      ],
    }),
    CONTRIBUTING: await confirm({
      message: 'Add a contributing file?',
      default: true,
    }),
  };

  const license = licenses[LICENSE as keyof typeof licenses];
  const licenseName = license ? license.name : 'No License';
  const contributingText = CONTRIBUTING
    ? 'Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.'
    : 'This project is not currently accepting contributions.';

  const templateVariables = {
    ...variables,
    YEAR: new Date().getFullYear().toString(),
    LICENSE: licenseName,
    CONTRIBUTING_TEXT: contributingText,
  };

  const templateFile = async (fileName: string) => {
    const packageJSON = await readFile(fileName, 'utf8').catch(err => {
      console.log(err);
      return null;
    });

    if (packageJSON === null) return;

    const templatedPackageJSON = template(packageJSON, templateVariables);
    await writeFile(fileName, templatedPackageJSON);
    console.log(`✅ Updated ${fileName}`);
  };

  // Template the package.json
  const packageJSON = await readFile('package.json', 'utf8').catch(err => {
    console.log(err);
    return null;
  });

  if (packageJSON) {
    const packageJson = JSON.parse(packageJSON);
    packageJson.name = templateVariables.PACKAGE_NAME;
    packageJson.description = templateVariables.PACKAGE_DESCRIPTION;

    const author: { name?: string; email?: string } = {};
    if (templateVariables.AUTHOR_NAME) author.name = templateVariables.AUTHOR_NAME;
    if (templateVariables.AUTHOR_EMAIL) author.email = templateVariables.AUTHOR_EMAIL;
    packageJson.author = author;

    packageJson.keywords = KEYWORDS;

    packageJson.homepage = `${templateVariables.REPO_URL}#readme`;
    packageJson.repository.url = `git+${templateVariables.REPO_URL}.git`;

    Reflect.deleteProperty(packageJson.scripts, 'template:setup');

    await writeFile('package.json', JSON.stringify(packageJson, null, 2));
  }

  // Add a license if the user has specified one
  if (LICENSE !== NO_LICENSE) {
    // Template the license
    const templatedLicense = template(licenses[LICENSE as keyof typeof licenses].content, templateVariables);

    // Write the license to LICENSE
    await writeFile('LICENSE', templatedLicense, 'utf-8');

    console.log(`✅ Add ${LICENSE} License`);
  }

  // Template the README.md
  await templateFile('README.template.md');

  // Move the current README that contains 'how to use this template' to oss.npm.md for later reference
  await rename('README.md', 'oss.npm.md');

  // Move README.template.md to README.md
  await rename('README.template.md', 'README.md');

  // Add a contributing file if the user has specified one
  if (CONTRIBUTING) {
    await templateFile('CONTRIBUTING.md');
    console.log('✅ Added CONTRIBUTING.md');
  } else {
    await unlink('CONTRIBUTING.md');
  }

  console.log('🎉 Template setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run `npm install`');
  console.log('2. Add repository secret NPM_TOKEN=<your npm api key>');
  console.log('3. Configure branch protection rules for ');

  // Delete the setup files. we no longer need them
  await rm('./setup', { recursive: true, force: true });
}

main();
