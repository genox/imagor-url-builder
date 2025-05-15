import { ImagorUrlBuilder } from '~/imagor-url-builder'

export type ImagorClientProps = {
	imagorServer: string
	imagorServerKey?: string
	cacheTtl?: number
}

export async function imagorClient({
	imagorServer,
	imagorServerKey,
	cacheTtl = 0,
}: ImagorClientProps) {
	const builder = new ImagorUrlBuilder({
		imagorServer,
		imagorServerKey,
		cacheTtl,
	})

	if (!imagorServerKey) {
		console.log('Warning: No imagorServerKey provided. Using unsafe mode (no URL signature).')
		builder.unsafe()
	}

	return builder
}
