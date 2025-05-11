import { ImagorUrlBuilder } from '~/imagor-url-builder'

export type ImagorClientProps = {
	imagorServer: string
	imagorServerKey?: string
}

// Cache to store shared instances of ImagorUrlBuilder
const builderInstances = new Map<string, ImagorUrlBuilder>()

export async function imagorClient({ imagorServer, imagorServerKey }: ImagorClientProps) {
	// Create a unique key for this configuration
	const instanceKey = JSON.stringify({ imagorServer, imagorServerKey })
	
	// Check if we already have an instance with these parameters
	if (!builderInstances.has(instanceKey)) {
		// Create a new instance if none exists
		const builder = new ImagorUrlBuilder({
			imagorServer: imagorServer,
			imagorServerKey: imagorServerKey,
			cacheTtl: 0,
		})
		
		if (!imagorServerKey) {
			console.log('Warning: No imagorServerKey provided. Using unsafe mode (no URL signature).')
			builder.unsafe()
		}
		
		// Store the instance in our cache
		builderInstances.set(instanceKey, builder)
	}
	
	// Return the cached instance
	return builderInstances.get(instanceKey)!
}

/**
 * Clears all cached ImagorUrlBuilder instances
 * Useful for testing or when you need to reset the state
 */
export function clearImagorClientInstances() {
	builderInstances.clear()
}
