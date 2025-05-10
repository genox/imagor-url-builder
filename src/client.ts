import { ImagorUrlBuilder } from '~/imagor-url-builder'

export type ImagorClientProps = {
	imagorServer: string
	imagorServerKey?: string
}

export async function imagorClient({ imagorServer, imagorServerKey }: ImagorClientProps) {
	const builder = new ImagorUrlBuilder({
		imagorServer: imagorServer,
		imagorServerKey: imagorServerKey,
		cacheTtl: 0,
	})
	
	if (!imagorServerKey) {
		console.log('Warning: No imagorServerKey provided. Using unsafe mode (no URL signature).')
		builder.unsafe()
	}
	
	return builder
}
