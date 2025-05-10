import { afterAll, beforeAll } from 'vitest'

// Any local test setup can go here
beforeAll(() => {
	console.log('Local test setup running...')
})

// Any local test teardown can go here
afterAll(() => {
	console.log('Local test teardown running...')
})
