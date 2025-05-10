import { beforeEach, describe, expect, it, vi } from 'vitest'
import { imagorClient, ImagorUrlBuilder } from '../src'
import { IMAGOR_API_KEY, IMAGOR_API_URL } from './config'
import { ImagorClientProps } from '../src/client'

// Mock console.log to verify warnings
vi.spyOn(console, 'log').mockImplementation(() => {})

// Mock the ImagorUrlBuilder class
vi.mock('../src/imagor-url-builder', () => {
	// Create a mock function for the unsafe method
	const unsafeMock = vi.fn().mockReturnThis()
	
	return {
		ImagorUrlBuilder: vi.fn().mockImplementation((config) => {
			// Simulate the real implementation's validation
			if (!config.imagorServer) {
				throw new Error('Missing API URL for ImagorUrlBuilder')
			}
			return {
				unsafe: unsafeMock
			}
		}),
	}
})

describe('Imagor Client', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should initialize ImagorUrlBuilder with correct config', async () => {
		// Arrange
		const params = {
			imagorServer: IMAGOR_API_URL,
			imagorServerKey: IMAGOR_API_KEY,
		}

		// Act
		await imagorClient(params)
		// Assert
		expect(ImagorUrlBuilder).toHaveBeenCalledWith({
			imagorServer: IMAGOR_API_URL,
			imagorServerKey: IMAGOR_API_KEY,
			cacheTtl: 0,
		})
	})

	it('should return an instance of ImagorUrlBuilder', async () => {
		// Arrange
		const params = {
			imagorServer: IMAGOR_API_URL,
			imagorServerKey: IMAGOR_API_KEY,
		}

		// Act
		const result = await imagorClient(params)

		// Assert
		expect(result).toBeDefined()
	})
	
	it('should call unsafe() automatically when imagorServerKey is not provided', async () => {
		// Arrange
		const params = {
			imagorServer: IMAGOR_API_URL,
			// No imagorServerKey provided
		}

		// Act
		const result = await imagorClient(params)

		// Assert
		expect(console.log).toHaveBeenCalledWith(
			'Warning: No imagorServerKey provided. Using unsafe mode (no URL signature).'
		)
		expect(result.unsafe).toHaveBeenCalled()
	})

	it('should throw an error when imagorServer parameter is missing', async () => {
		// Arrange
		const params = {
			// No imagorServer provided
			imagorServerKey: IMAGOR_API_KEY,
		}

		// Act & Assert
		await expect(imagorClient(<ImagorClientProps>params)).rejects.toThrow(
			'Missing API URL for ImagorUrlBuilder',
		)
	})

	it('should throw an error when no parameters are provided', async () => {
		// Act & Assert
		// @ts-expect-error Testing invalid input
		await expect(imagorClient()).rejects.toThrow(
			"Cannot destructure property 'imagorServer' of 'undefined'",
		)
	})

	it('should throw an error when empty parameters object is provided', async () => {
		// Arrange
		const params = {}

		// Act & Assert
		// @ts-expect-error Testing invalid input
		await expect(imagorClient(params)).rejects.toThrow('Missing API URL for ImagorUrlBuilder')
	})
})
