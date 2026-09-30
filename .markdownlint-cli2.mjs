// @ts-check
import markdownlintRules from './.markdownlint.json' with { type: 'json' };

const args = process.argv.slice(2);

let hasFileArguments = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--config') {
    i++; // Skip next element
    continue;
  }

  if (!arg.startsWith('-')) {
    hasFileArguments = true;
    break;
  }
}

const options = {
  config: markdownlintRules,
};

if (!hasFileArguments) {
  options.globs = [
    '**/*.md', // Include all markdown files
    '!**/node_modules/**', // Exclude all node_modules folders
    '!**/upgrade-plan/**', // Legacy implementation notes are not published quality-gated guides.
    '!CLAUDE.md', // Repository instructions are not user-facing documentation.
    // '!**/CHANGELOG.md', // Exclude specific file
    '!.changeset/*.md', // Exclude specific directory
    '!.planning/**', // Exclude planning docs
  ];

  if (process.env.MDLINT_CONTEXT === 'root') {
    // Exclude generated/workspace docs and legacy planning material from the root gate.
    // Those trees have their own documentation ownership and contain historical drafts.
    options.globs.push(
      '!packages/**',
      '!apps/**',
      '!docs/upgrade-plan/**',
      '!docs/vi/**',
      '!CLAUDE.md'
    );
  }
}

export default options;
