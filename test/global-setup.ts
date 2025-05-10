// No need to manage services here, as they are started by concurrently in package.json
// This file is still required by the test setup but will not perform any actions

// Setup function that runs once before all test files
export async function setup() {
	console.log('Global setup: Services are managed by concurrently in package.json')
}

// Teardown function that runs once after all test files
export async function teardown() {
	console.log('Global teardown: Services are managed by concurrently in package.json')
}
