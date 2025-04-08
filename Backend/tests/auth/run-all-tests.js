/**
 * Run All Authentication Tests
 * 
 * This script runs all the authentication tests in sequence:
 * 1. Unit tests for individual services
 * 2. Edge case tests
 * 3. Security tests
 * 4. Integration tests
 * 5. Performance tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define test files to run
const testFiles = [
  // Unit tests
  'unit/token.service.test.js',
  'unit/session.service.test.js',
  'unit/device.service.test.js',
  
  // Edge case tests
  'edge-cases.test.js',
  
  // Security tests
  'security.test.js',
  
  // Integration tests
  'cross-tab-sync.test.js',
  'cross-device-sync.test.js',
  'selective-logout.test.js',
  'complete-auth-flow.test.js',
  
  // Performance tests (optional, can be commented out for quicker runs)
  // 'performance.test.js',
];

// Function to run a test file
function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`Running test: ${testFile}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const testPath = path.join(__dirname, testFile);
    
    // Check if file exists
    if (!fs.existsSync(testPath)) {
      console.error(`Test file not found: ${testPath}`);
      return resolve(false);
    }
    
    // Run test with Mocha
    const mochaProcess = spawn('npx', ['mocha', testPath, '--timeout', '60000'], {
      stdio: 'inherit',
      shell: true,
    });
    
    mochaProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ Test passed: ${testFile}`);
        resolve(true);
      } else {
        console.error(`\n❌ Test failed: ${testFile}`);
        resolve(false);
      }
    });
    
    mochaProcess.on('error', (error) => {
      console.error(`Error running test: ${error.message}`);
      reject(error);
    });
  });
}

// Run all tests in sequence
async function runAllTests() {
  console.log('\n🔍 Running all authentication tests...\n');
  
  let passedCount = 0;
  let failedCount = 0;
  const failedTests = [];
  
  for (const testFile of testFiles) {
    try {
      const passed = await runTest(testFile);
      if (passed) {
        passedCount++;
      } else {
        failedCount++;
        failedTests.push(testFile);
      }
    } catch (error) {
      console.error(`Error running test ${testFile}:`, error);
      failedCount++;
      failedTests.push(testFile);
    }
  }
  
  // Print summary
  console.log('\n\n');
  console.log(`${'='.repeat(80)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total tests: ${testFiles.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  
  if (failedCount > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test}`);
    });
    
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runAllTests().catch((error) => {
  console.error('Error running tests:', error);
  process.exit(1);
});
