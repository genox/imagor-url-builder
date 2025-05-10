# Imagor URL Builder

[![CI](https://github.com/genox/imagor-url-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/genox/imagor-url-builder/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@genox%2Fimagor-url-builder.svg)](https://www.npmjs.com/package/@genox/imagor-url-builder)

A TypeScript library for building URLs to use with the [Imagor](https://github.com/cshum/imagor) image processing server.

## Installation

```bash
# Using npm
npm install @genox/imagor-url-builder

# Using yarn
yarn add @genox/imagor-url-builder
```

## Basic Usage

```typescript
import { imagorClient } from '@genox/imagor-url-builder';

// Initialize the client
const client = await imagorClient({
  imagorServer: 'https://your-imagor-server.com',
  imagorServerKey: 'your-optional-key' // Optional if your server doesn't use keys
});

// Build an image processing URL
const imageUrl = await client
  .dimensions(300, 200)    // Resize to 300x200
  .format('webp')          // Convert to WebP format
  .quality(80)             // Set quality to 80%
  .stripMetadata()         // Remove metadata
  .src('https://example.com/original-image.jpg')
  .getUrl();

// Use the URL with your <img> tag or fetch request
console.log(imageUrl);
// Output: https://your-imagor-server.com/hash_if_signed/300x200/filters:format(webp):quality(80):strip_exif():strip_icc()/https://example.com/original-image.jpg
```

## Features

- Type-safe API with TypeScript
- Fluent interface for method chaining
- Support for all Imagor operations:
  - Resizing
  - Cropping
  - Format conversion
  - Quality adjustment
  - Metadata handling
  - And more...
- Support for metadata retrieval
- Works with both signed and unsigned URLs

## API Overview

### Initialization

```typescript
const client = await imagorClient({
  imagorServer: 'https://your-imagor-server.com',  // Required
  imagorServerKey: 'your-key',                     // Optional
  cacheTtl: 0                                      // Optional cache time in seconds
});
```

### Common Operations

```typescript
// Resize
client.dimensions(width, height)

// Format conversion
client.format('webp') // Supports: webp, jpeg, png, etc.

// Quality
client.quality(80) // 0-100

// Metadata
client.stripMetadata() // Removes EXIF and ICC data

// Get metadata instead of image
client.meta().src('https://example.com/image.jpg').getUrl()
// Returns a URL that provides JSON metadata when requested
```

## Testing

This project includes integration tests that verify the functionality with an actual Imagor server. To run the tests:

```bash
yarn test
```

The tests use Docker to spin up an Imagor server instance for testing.

## License

MIT
