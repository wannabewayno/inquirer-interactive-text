import { gray, green, italic } from 'yoctocolors';
import { interactiveText } from './dist/esm/index.js';

// Simple test of the interactive text framework
async function testInteractiveText() {
  console.log('Testing Interactive Text Framework...\n');
  
  try {
    const result = await interactiveText({
      fields: [
        [
          { id: 'namespace', required: false, placeholder: 'namespace?' },
          { id: 'type', required: true, placeholder: '<type>' },
          { id: 'scope', required: false, placeholder: 'scope?' },
          { id: 'subject', required: true, placeholder: '<subject>' },
        ],
        [
          { id: 'body', required: false, multiline: true, placeholder: 'body?' }
        ]
      ],
      renderer: {
        template: '[{namespace}] {type}({scope}): {subject}\n\n{body}',
      },
    });

    console.log('\nResult:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

const highlight = (text, isEdit, isFocused) => {
  if (isEdit && isFocused) return italic(gray(text));
  if (isFocused) return green(text);
  return text;
}


// Test with function template
async function testFunctionTemplate() {
  console.log('Testing Function Template...\n');
  
  try {
    const result = await interactiveText({
      fields: [
        [
          { id: 'name', required: true, placeholder: 'Enter name' },
          { id: 'age', required: false, placeholder: 'Enter age' }
        ]
      ],
      renderer: (state, isEdit, _errors, focused) => {
        return `Name: ${highlight(state.name || '<name>', isEdit, focused === 'name')}, Age: ${highlight(state.age || '<age>', isEdit, focused === 'age')}`;
      },
      initialValues: {
        name: '',
        age: ''
      }
    });

    console.log('\nResult:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run tests
if (process.argv[2] === 'commit') {
  testInteractiveText();
} else if (process.argv[2] === 'function') {
  testFunctionTemplate();
} else {
  console.log('Usage: node test-interactive.js [commit|function]');
  console.log('  commit   - Test commit message template');
  console.log('  function - Test function template');
}