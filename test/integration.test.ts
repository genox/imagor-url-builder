import { describe, expect, it } from 'vitest'
import fetch from 'node-fetch'
import { imagorClient } from '../src'
import { IMAGOR_API_KEY, IMAGOR_API_URL, TEST_IMAGE_URL } from './config'
import { ImagorMetaDataResponse } from '../src/imagor-url-builder'

describe('Imagor Integration Test', () => {
	it('should resize an image to 200x200, format to webp, and strip metadata', async () => {
		const builder = await imagorClient({
			imagorServer: IMAGOR_API_URL,
			imagorServerKey: IMAGOR_API_KEY,
		})

		const imageUrl = await builder
			.dimensions(200, 200)
			.format('webp')
			.stripMetadata()
			.src(TEST_IMAGE_URL)
			.getUrl()

		const response = await fetch(imageUrl)

		expect(response.status).toBe(200)

		const contentType = response.headers.get('content-type')
		expect(contentType).toBe('image/webp')
	})

	it('should retrieve the metadata of an image', async () => {
		const builder = await imagorClient({
			imagorServer: IMAGOR_API_URL,
			imagorServerKey: IMAGOR_API_KEY,
		})

		const metadataUrl = await builder.meta().src(TEST_IMAGE_URL).getUrl()
		const response = await fetch(metadataUrl)

		expect(response.status).toBe(200)

		const contentType = response.headers.get('content-type')
		expect(contentType).toContain('application/json')

		const metadata = (await response.json()) as ImagorMetaDataResponse

		expect(metadata).toHaveProperty('width')
		expect(metadata).toHaveProperty('height')
		expect(metadata).toHaveProperty('format')
		expect(metadata).toHaveProperty('orientation')

		expect(typeof metadata.width).toBe('number')
		expect(typeof metadata.height).toBe('number')
		expect(typeof metadata.format).toBe('string')

		expect(metadata.width).toBeGreaterThan(0)
		expect(metadata.height).toBeGreaterThan(0)
	})
})
