import { Methods } from '~/methods'

export interface ImagorUrlBuilderConfig {
	imagorServer: string
	imagorServerKey?: string
	defaultFilters?: string[]
	cacheTtl?: number
}

export type ImagorMetaDataResponse = {
	width: number
	height: number
	format: string
	content_type: string
	orientation: number
	pages: number
	bands: number
	exif: Record<string, unknown>
}

export class ImagorUrlBuilder {
	private parts: { order: number; value: string }[] = []
	private readonly filters: Set<string>
	private readonly imagorServer: string
	private readonly imagorServerKey: string
	private readonly cacheTtl: number
	private readonly methodsOrderMap: Map<string, number>
	private memoCache: Map<string, Promise<string>> = new Map()

	// Pre-compute method order array once
	private static readonly METHODS_ORDER = [
		Methods.UNSAFE,
		Methods.META,
		Methods.FIT_IN,
		Methods.FULL_FIT_IN,
		Methods.FIT,
		Methods.FULL,
		Methods.STRETCH,
		Methods.ADAPTIVE,
		Methods.DIMENSIONS,
		Methods.PADDING,
		Methods.SMART,
		Methods.FILTERS,
		Methods.IMAGE,
	]

	constructor({
		imagorServer,
		imagorServerKey = '',
		defaultFilters = [],
		cacheTtl = 0,
	}: ImagorUrlBuilderConfig) {
		if (!imagorServer) {
			throw new Error('Missing API URL for ImagorUrlBuilder')
		}
		this.imagorServer = imagorServer
		this.imagorServerKey = imagorServerKey
		this.filters = new Set(defaultFilters)
		this.cacheTtl = cacheTtl

		// Create method order lookup map for O(1) access
		this.methodsOrderMap = new Map(
			ImagorUrlBuilder.METHODS_ORDER.map((method, index) => [method, index]),
		)
	}

	// Static factory method
	static create(config: ImagorUrlBuilderConfig): ImagorUrlBuilder {
		return new ImagorUrlBuilder(config)
	}

	private orderLookup(method: string): number {
		return this.methodsOrderMap.get(method) ?? 99
	}

	/**
	 * Enables metadata-only mode.
	 * When enabled, the server will return only the image metadata in JSON format instead of the actual image.
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	meta(): this {
		this.parts.push({ order: this.orderLookup(Methods.META), value: Methods.META })
		return this
	}

	/**
	 * Sets the URL as unsafe, bypassing image validation and signature checking.
	 * Use with caution, as it may expose your application to URL tampering.
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	unsafe(): this {
		this.parts.push({ order: this.orderLookup(Methods.UNSAFE), value: Methods.UNSAFE })
		return this
	}

	/**
	 * Specifies that the image should fit within the specified dimensions without cropping.
	 * The image will be resized to fit within the imaginary box of specified width and height,
	 * maintaining the original aspect ratio.
	 *
	 * Example: An 800x600 image with fit-in of 300x200 would result in a 267x200 image.
	 * Example: A 400x600 image with fit-in of 300x200 would result in a 133x200 image.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	fitIn(): this {
		this.parts.push({ order: this.orderLookup(Methods.FIT_IN), value: Methods.FIT_IN })
		return this
	}

	/**
	 * Specifies that the image should use full-fit-in mode.
	 * Instead of using the largest dimension for fitting, it uses the smallest one.
	 *
	 * Example: An 800x600 image with full-fit-in of 300x200 would result in a 300x225 image.
	 * Example: A 400x600 image with full-fit-in of 300x200 would result in a 300x450 image.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	fullFitIn(): this {
		this.parts.push({ order: this.orderLookup(Methods.FULL_FIT_IN), value: Methods.FULL_FIT_IN })
		return this
	}

	/**
	 * Adjusts the image to fit within the requested dimensions while maintaining aspect ratio.
	 * Similar to fit-in but applied as a filter.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	fit(): this {
		this.parts.push({ order: this.orderLookup(Methods.FIT), value: Methods.FIT })
		return this
	}

	/**
	 * Resizes the image filling the requested dimensions even if that means losing aspect ratio.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	full(): this {
		this.parts.push({ order: this.orderLookup(Methods.FULL), value: Methods.FULL })
		return this
	}

	/**
	 * Stretches the image to fit the specified dimensions exactly.
	 * This mode will distort the image if the aspect ratio doesn't match.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	stretch(): this {
		this.parts.push({ order: this.orderLookup(Methods.STRETCH), value: Methods.STRETCH })
		return this
	}

	/**
	 * Uses adaptive resizing to preserve the image's content as much as possible.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	adaptive(): this {
		this.parts.push({ order: this.orderLookup(Methods.ADAPTIVE), value: Methods.ADAPTIVE })
		return this
	}

	/**
	 * Specifies the dimensions for the output image.
	 * Uses smart crop and resize algorithms to format the image to exactly these dimensions.
	 *
	 * @param width Width in pixels, or 0 for proportional scaling, or 'orig' to keep original dimension
	 * @param height Height in pixels, or 0 for proportional scaling, or 'orig' to keep original dimension
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Set exact dimensions to 300x200 pixels
	 * builder.dimensions(300, 200)
	 *
	 * @example
	 * // Keep original width, resize height to 200 pixels
	 * builder.dimensions('orig', 200)
	 */
	dimensions(width: number | 'orig', height: number | 'orig'): this {
		const widthStr = width === 'orig' ? 'orig' : width.toString()
		const heightStr = height === 'orig' ? 'orig' : height.toString()
		this.parts.push({
			order: this.orderLookup(Methods.DIMENSIONS),
			value: `${widthStr}x${heightStr}`,
		})
		return this
	}

	/**
	 * Shorthand to set only the width, with proportional height.
	 * The height will be calculated automatically to maintain the aspect ratio.
	 *
	 * @param width Width in pixels, or 'orig' to maintain original width
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Resize to 300px width, height will be proportional
	 * builder.width(300)
	 */
	width(width: number | 'orig'): this {
		const widthStr = width === 'orig' ? 'orig' : width.toString()
		this.parts.push({ order: this.orderLookup(Methods.DIMENSIONS), value: `${widthStr}x0` })
		return this
	}

	/**
	 * Shorthand to set only the height, with proportional width.
	 * The width will be calculated automatically to maintain the aspect ratio.
	 *
	 * @param height Height in pixels, or 'orig' to maintain original height
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Resize to 200px height, width will be proportional
	 * builder.height(200)
	 */
	height(height: number | 'orig'): this {
		const heightStr = height === 'orig' ? 'orig' : height.toString()
		this.parts.push({ order: this.orderLookup(Methods.DIMENSIONS), value: `0x${heightStr}` })
		return this
	}

	/**
	 * Shorthand to set both dimensions to original size.
	 * This will not perform any cropping or resizing on the image.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	originalSize(): this {
		this.parts.push({ order: this.orderLookup(Methods.DIMENSIONS), value: `origxorig` })
		return this
	}

	/**
	 * Resize the image proportionally to a percentage of its original size.
	 *
	 * @param percentage Percentage of original size (1-100)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Resize to 50% of original dimensions
	 * builder.proportion(50)
	 */
	proportion(percentage: number): this {
		this.parts.push({
			order: this.orderLookup(Methods.DIMENSIONS),
			value: `${percentage}p`,
		})
		return this
	}

	/**
	 * Enables smart cropping for the image.
	 * The server will try to detect the most important areas of the image and crop accordingly.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	smart(): this {
		this.parts.push({ order: this.orderLookup(Methods.SMART), value: Methods.SMART })
		return this
	}

	/**
	 * Performs manual cropping of the image before other operations.
	 * This is useful for applications that provide custom real-time cropping capabilities.
	 * The crop is performed before other operations, so it can be used as a preparation step
	 * before resizing and smart-cropping.
	 *
	 * @param left Left (x) coordinate of the top-left corner
	 * @param top Top (y) coordinate of the top-left corner
	 * @param right Right (x) coordinate of the bottom-right corner
	 * @param bottom Bottom (y) coordinate of the bottom-right corner
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Crop the image to a rectangle with top-left at (10,20) and bottom-right at (300,400)
	 * builder.crop(10, 20, 300, 400)
	 */
	crop(left: number, top: number, right: number, bottom: number): this {
		this.filters.add(`crop(${left},${top},${right},${bottom})`)
		return this
	}

	/**
	 * Removes surrounding space in images.
	 * Uses the color of a specific pixel to determine what's considered background.
	 *
	 * @param tolerance Optional color tolerance (0-442 for RGB images). Higher values allow more colors to be trimmed.
	 * @param basedOn Optional orientation from where to get the reference pixel color ('top-left' or 'bottom-right')
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Basic trim with default settings (uses top-left pixel with no tolerance)
	 * builder.trim()
	 *
	 * @example
	 * // Trim with a tolerance of 50 using the bottom-right pixel as reference
	 * builder.trim(50, 'bottom-right')
	 */
	trim(tolerance?: number, basedOn?: 'top-left' | 'bottom-right'): this {
		if (tolerance !== undefined && basedOn) {
			this.filters.add(`trim(${tolerance},${basedOn})`)
		} else if (tolerance !== undefined) {
			this.filters.add(`trim(${tolerance})`)
		} else {
			this.filters.add('trim()')
		}
		return this
	}

	/**
	 * Adds a custom filter to the image processing pipeline.
	 * This can be used for adding specialized filters beyond the provided methods.
	 *
	 * @param filter Filter definition in the format expected by the Imagor service
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	filter(filter: string): this {
		this.filters.add(filter)
		return this
	}

	/**
	 * Sets the focal point area for the image.
	 * This helps preserve the most important part of the image during resizing operations.
	 *
	 * @param left Left (x) coordinate of the top-left corner
	 * @param top Top (y) coordinate of the top-left corner
	 * @param right Right (x) coordinate of the bottom-right corner
	 * @param bottom Bottom (y) coordinate of the bottom-right corner
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	focal(left: number, top: number, right: number, bottom: number): this {
		this.filters.add(`focal(${left}x${top}:${right}x${bottom})`)
		return this
	}

	/**
	 * Fills in any transparent areas of the image with the specified color.
	 *
	 * @param color Color in hexadecimal format (e.g., 'FF0000' for red) or special values:
	 *   - 'blur' to fill with blurred original image
	 *   - 'auto' to use the top-left pixel color
	 *   - 'none' to make transparent
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	fill(color: string): this {
		this.filters.add(`fill(${color})`)
		return this
	}

	/**
	 * Applies a Gaussian blur to the image.
	 *
	 * @param radius Radius of the blur operation
	 * @param sigma Optional sigma value for the Gaussian function
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	blur(radius: number, sigma?: number): this {
		this.filters.add(sigma ? `blur(${radius},${sigma})` : `blur(${radius})`)
		return this
	}

	/**
	 * Sets a background color to replace any transparent areas in the image.
	 *
	 * @param color Color in hexadecimal format (e.g., 'FF0000' for red)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	background(color: string): this {
		this.filters.add(`background(${color})`)
		return this
	}

	/**
	 * Rotates the image by the specified angle (in degrees).
	 *
	 * @param angle Rotation angle in degrees
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	rotate(angle: number): this {
		this.filters.add(`rotate(${angle})`)
		return this
	}

	/**
	 * Flips the image vertically (mirror effect along the horizontal axis).
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	vflip(): this {
		this.filters.add('vflip()')
		return this
	}

	/**
	 * Flips the image horizontally (mirror effect along the vertical axis).
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	hflip(): this {
		this.filters.add('hflip()')
		return this
	}

	/**
	 * Adds padding to the image.
	 *
	 * @param leftTop Left and top padding values in pixels
	 * @param rightBottom Optional right and bottom padding values in pixels
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Add 10px padding to all sides
	 * builder.padding({ x: 10, y: 10 })
	 *
	 * @example
	 * // Add 10px left/top padding and 20px right/bottom padding
	 * builder.padding({ x: 10, y: 10 }, { x: 20, y: 20 })
	 */
	padding(leftTop: { x: number; y: number }, rightBottom?: { x: number; y: number }): this {
		const value = rightBottom
			? `${leftTop.x}x${leftTop.y}:${rightBottom.x}x${rightBottom.y}`
			: `${leftTop.x}x${leftTop.y}`
		this.parts.push({ order: this.orderLookup(Methods.PADDING), value })
		return this
	}

	/**
	 * Allows the image to be upscaled when fit-in is used.
	 * By default, the image is not resized if it is smaller than the specified dimensions
	 * when using fit-in. This method enables upscaling.
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	upscale(): this {
		this.filters.add('upscale()')
		return this
	}

	/**
	 * Adds a text label to the image.
	 *
	 * @param text Text to display (URL encoded if needed)
	 * @param x Horizontal position ('left', 'right', 'center' or number)
	 * @param y Vertical position ('top', 'bottom', 'center' or number)
	 * @param size Font size
	 * @param color Color in hexadecimal format (without '#') or color name
	 * @param alpha Optional transparency (0-100, where 0 is opaque and 100 is transparent)
	 * @param font Optional font name
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Add centered text with size 24 and red color
	 * builder.label('Hello World', 'center', 'center', 24, 'FF0000')
	 */
	label(
		text: string,
		x: number | string,
		y: number | string,
		size: number,
		color: string,
		alpha?: number,
		font?: string,
	): this {
		const params = [text, x, y, size, color]
		if (alpha !== undefined) params.push(alpha.toString())
		if (font !== undefined) params.push(font)

		this.filters.add(`label(${params.join(',')})`)
		return this
	}

	/**
	 * Adds rounded corners to the image.
	 *
	 * @param radiusX Horizontal radius in pixels
	 * @param radiusY Optional vertical radius (defaults to radiusX if not provided)
	 * @param color Optional background color for the corners
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 *
	 * @example
	 * // Add rounded corners with 10px radius
	 * builder.roundCorner(10)
	 */
	roundCorner(radiusX: number, radiusY?: number, color?: string): this {
		const params: (number | string)[] = [radiusX]
		if (radiusY !== undefined) params.push(radiusY)
		if (color !== undefined) params.push(color)

		this.filters.add(`round_corner(${params.join(',')})`)
		return this
	}

	/**
	 * Specifies the page number for PDFs or frame number for animated images.
	 *
	 * @param num Page/frame number (starts from 1)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	page(num: number): this {
		this.filters.add(`page(${num})`)
		return this
	}

	/**
	 * Specifies the DPI to render at for PDF and SVG files.
	 *
	 * @param num DPI value
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	dpi(num: number): this {
		this.filters.add(`dpi(${num})`)
		return this
	}

	/**
	 * Sets the watermark for the image.
	 *
	 * @param url URL of the watermark image
	 * @param x Horizontal position (number, 'left', 'right', 'center', or 'repeat')
	 * @param y Vertical position (number, 'top', 'bottom', 'center', or 'repeat')
	 * @param alpha Transparency (0-100, where 0 is opaque and 100 is transparent)
	 * @param wRatio Optional width ratio (percentage of image width)
	 * @param hRatio Optional height ratio (percentage of image height)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	watermark(
		url: string,
		x: number | string,
		y: number | string,
		alpha: number,
		wRatio?: number,
		hRatio?: number,
	): this {
		const params = [url, x, y, alpha]
		if (wRatio !== undefined) params.push(wRatio)
		if (hRatio !== undefined) params.push(hRatio)

		this.filters.add(`watermark(${params.join(',')})`)
		return this
	}

	/**
	 * Specifies the output format of the image.
	 *
	 * @param format Image format to convert to
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	format(format: 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'avif' | 'jp2'): this {
		this.filters.add(`format(${format})`)
		return this
	}

	/**
	 * Sets the source image URL.
	 *
	 * @param src Image source URL or path
	 * @param order Optional order parameter (default is 99)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	src(src: string, order = 99): this {
		this.parts.push({ order, value: src })
		return this
	}

	/**
	 * Removes all metadata from the resulting image.
	 * This is a shorthand for calling both strip_exif() and strip_icc().
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	stripMetadata(): this {
		this.filters.add('strip_exif()')
		this.filters.add('strip_icc()')
		return this
	}

	/**
	 * Makes the image progressive (applies to JPEG format).
	 *
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	progressive(): this {
		this.filters.add('progressive()')
		return this
	}

	/**
	 * Sets the image quality level.
	 *
	 * @param quality Quality level (0-100)
	 * @returns The current ImagorUrlBuilder instance for method chaining
	 */
	quality(quality: number): this {
		this.filters.add(`quality(${quality})`)
		return this
	}

	/**
	 * Generates and returns the complete image URL.
	 * The URL is cached for repeated calls with the same parameters.
	 * After generating the URL, the internal state is reset.
	 *
	 * @returns Promise resolving to the generated URL string
	 */
	async getUrl(): Promise<string> {
		// Generate a cache key from current state
		const cacheKey = JSON.stringify({
			src: this.src,
			parts: this.parts,
			filters: Array.from(this.filters),
		})

		// Return from cache if available
		if (this.memoCache.has(cacheKey)) {
			const url = this.memoCache.get(cacheKey)!
			
			// Reset state after retrieving from cache
			this.parts = []
			this.filters.clear()
			
			return url
		}

		const urlPromise = this.generateUrl()
		this.memoCache.set(cacheKey, urlPromise)
		
		// Get the URL then reset state
		const url = await urlPromise
		
		// Reset state after generating URL
		this.parts = []
		this.filters.clear()
		
		return url
	}

	private async generateUrl(): Promise<string> {
		// Check if we should and can sign the URL
		const hasUnsafe = this.parts.some((part) => part.value === Methods.UNSAFE)
		if (!hasUnsafe && !this.imagorServerKey) {
			throw new Error(
				'Signing key is missing for ImagorUrlBuilder. Either set the key in the constructor or use the unsafe() method.',
			)
		}

		const filtersArray = Array.from(this.filters)
		if (!filtersArray.some((filter) => filter.startsWith('format('))) {
			filtersArray.push('format(jpeg)')
		}
		if (!filtersArray.some((filter) => filter.startsWith('quality('))) {
			filtersArray.push('quality(70)')
		}
		if (this.cacheTtl > 0) {
			filtersArray.push(`expire(${Date.now() + this.cacheTtl})`)
		}

		// Add filters to parts
		const filters = filtersArray.length ? `filters:${filtersArray.join(':')}` : ''
		const partsWithFilters = [
			...this.parts,
			{ order: this.orderLookup(Methods.FILTERS), value: filters },
		].filter((part) => part.value !== '') // Filter out empty values

		// Build URL
		const url = partsWithFilters
			.sort((a, b) => a.order - b.order)
			.map((part) => part.value)
			.join('/')

		// Sign URL
		return `${this.imagorServer}/${await this.sign(url, this.imagorServerKey)}`
	}

	private async digest(message: string, key: string): Promise<string> {
		if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
			// Browser environment
			const encoder = new TextEncoder()
			const keyData = encoder.encode(key)
			const messageData = encoder.encode(message)

			const cryptoKey = await window.crypto.subtle.importKey(
				'raw',
				keyData,
				{ name: 'HMAC', hash: 'SHA-1' },
				false,
				['sign'],
			)

			const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData)

			console.info(
				'It is highly recommended to NOT sign the URL in the browser, otherwise you will expose your Imagor secret to the public.',
			)

			return this.arrayBufferToBase64(signature).replace(/\+/g, '-').replace(/\//g, '_')
		} else {
			// Node.js environment - using dynamic import instead of require
			try {
				// Use dynamic import for Node.js crypto
				const { createHmac } = await import('crypto')
				return createHmac('sha1', key)
					.update(message)
					.digest('base64')
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
			} catch (error) {
				console.error('Failed to import crypto:', error)
				throw new Error('Crypto functionality not available')
			}
		}
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		if (typeof btoa === 'function') {
			const bytes = new Uint8Array(buffer)
			let binary = ''
			const len = bytes.byteLength
			for (let i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i] as number)
			}
			return btoa(binary)
		} else {
			// Node.js
			return Buffer.from(buffer).toString('base64')
		}
	}

	private async sign(path: string, secret: string): Promise<string> {
		const hash = await this.digest(path, secret)
		return hash + '/' + path
	}
}
