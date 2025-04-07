/**
 * Authentication System Test Runner
 * 
 * Runs all authentication system tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test files
const TEST_FILES = [
  'tests/auth/user.test.js',
  'tests/auth/token.test.js',
  'tests/auth/session.test.js',
  'tests/auth/device.test.js',
  'tests/auth/integrated.test.js'
];

// Results storage
const results = {};

/**
 * Run a test file
 * @param {string} testFile - Path to test file
 * @returns {Promise<boolean>} - Test result
 */
function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`Running test: ${testFile}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const testProcess = spawn('node', [testFile], {
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      const passed = code === 0;
      console.log(`\nTest ${testFile} ${passed ? 'PASSED' : 'FAILED'} with exit code ${code}`);
      resolve(passed);
    });
    
    testProcess.on('error', (error) => {
      console.error(`Error running test ${testFile}:`, error);
      reject(error);
    });
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting authentication system tests...');
  
  // Create tests directory if it doesn't exist
  const testsDir = path.join(__dirname, 'tests', 'auth');
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  
  // Run each test file
  for (const testFile of TEST_FILES) {
    try {
      const result = await runTest(testFile);
      results[testFile] = result;
    } catch (error) {
      console.error(`Error running test ${testFile}:`, error);
      results[testFile] = false;
    }
  }
  
  // Print summary
  console.log('\n\n');
  console.log(`${'='.repeat(80)}`);
  console.log('Authentication System Test Results');
  console.log(`${'='.repeat(80)}`);
  
  for (const [testFile, passed] of Object.entries(results)) {
    console.log(`${testFile}: ${passed ? 'PASSED' : 'FAILED'}`);
  }
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\nOverall result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run all tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
