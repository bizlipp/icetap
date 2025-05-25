/**
 * DataStackULTRA Configuration Module
 * Defines configuration options for data storage, caching, and schema validation
 */

(function(global) {
  'use strict';

  /**
   * @typedef {Object} StorageConfig
   * @property {string} persistentStrategy - Strategy for persistent storage ('localStorage', 'indexedDB', 'webSQL', 'custom')
   * @property {string} memoryStrategy - Strategy for in-memory storage ('map', 'weakMap', 'custom')
   * @property {number} maxCachedItems - Maximum number of items to keep in memory cache
   * @property {number} itemExpiryTime - Default expiry time for cached items in milliseconds
   * @property {boolean} compressionEnabled - Whether to compress data before storage
   * @property {boolean} encryptionEnabled - Whether to encrypt data before storage
   * @property {string} encryptionKey - Key to use for encryption (if enabled)
   */

  /**
   * @typedef {Object} SchemaConfig
   * @property {boolean} validationEnabled - Whether to validate data against schemas
   * @property {string} validationStrategy - Strategy for schema validation ('ajv', 'zod', 'yup', 'custom')
   * @property {boolean} strictMode - Whether to use strict mode for validation
   * @property {boolean} coercionEnabled - Whether to coerce types during validation
   */

  /**
   * @typedef {Object} TransformConfig
   * @property {boolean} autoSerialize - Whether to automatically serialize/deserialize objects
   * @property {string} serializationFormat - Format for serialization ('json', 'bson', 'protobuf', 'custom')
   * @property {boolean} compactOutput - Whether to remove whitespace from serialized data
   */

  /**
   * @typedef {Object} DataStackConfig
   * @property {StorageConfig} storage - Storage configuration
   * @property {SchemaConfig} schema - Schema validation configuration
   * @property {TransformConfig} transform - Data transformation configuration
   * @property {Object} logging - Logging configuration
   * @property {boolean} logging.enabled - Whether to log operations
   * @property {string} logging.level - Log level ('debug', 'info', 'warn', 'error')
   * @property {boolean} logging.verbose - Whether to include verbose details in logs
   */

  /**
   * Default configuration for DataStackULTRA
   * @type {DataStackConfig}
   */
  const DEFAULT_CONFIG = Object.freeze({
    storage: {
      persistentStrategy: 'localStorage',
      memoryStrategy: 'map',
      maxCachedItems: 1000,
      itemExpiryTime: 3600000, // 1 hour
      compressionEnabled: false,
      encryptionEnabled: true, // Enabled encryption
      encryptionKey: 'default-development-encryption-key-replace-this!'
    },
    schema: {
      validationEnabled: true,
      validationStrategy: 'simple',
      strictMode: true,
      coercionEnabled: false
    },
    transform: {
      autoSerialize: true,
      serializationFormat: 'json',
      compactOutput: true
    },
    logging: {
      enabled: true,
      level: 'info',
      verbose: false
    }
  });

  /**
   * Create a configuration by merging default with custom options
   * @param {Partial<DataStackConfig>} options - Custom configuration options
   * @returns {DataStackConfig} - Merged configuration
   */
  function createConfig(options = {}) {
    // Deep merge default config with provided options
    const config = {
      storage: {
        ...DEFAULT_CONFIG.storage,
        ...(options.storage || {})
      },
      schema: {
        ...DEFAULT_CONFIG.schema,
        ...(options.schema || {})
      },
      transform: {
        ...DEFAULT_CONFIG.transform,
        ...(options.transform || {})
      },
      logging: {
        ...DEFAULT_CONFIG.logging,
        ...(options.logging || {})
      }
    };
    
    // Validate configuration
    if (config.storage.encryptionEnabled && !config.storage.encryptionKey) {
      console.warn('Storage encryption is enabled but no encryptionKey is provided. Encryption will be DISABLED for storage.');
      config.storage.encryptionEnabled = false;
    }
    
    if (!['localStorage', 'indexedDB', 'webSQL', 'custom'].includes(config.storage.persistentStrategy)) {
      console.warn(`Invalid persistent storage strategy: ${config.storage.persistentStrategy}, using localStorage`);
      config.storage.persistentStrategy = 'localStorage';
    }
    
    if (!['map', 'weakMap', 'custom'].includes(config.storage.memoryStrategy)) {
      console.warn(`Invalid memory storage strategy: ${config.storage.memoryStrategy}, using map`);
      config.storage.memoryStrategy = 'map';
    }
    
    if (!['simple', 'ajv', 'zod', 'yup', 'custom'].includes(config.schema.validationStrategy)) {
      console.warn(`Invalid validation strategy: ${config.schema.validationStrategy}, using simple`);
      config.schema.validationStrategy = 'simple';
    }
    
    if (!['json', 'bson', 'protobuf', 'custom'].includes(config.transform.serializationFormat)) {
      console.warn(`Invalid serialization format: ${config.transform.serializationFormat}, using json`);
      config.transform.serializationFormat = 'json';
    }
    
    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      console.warn(`Invalid logging level: ${config.logging.level}, using info`);
      config.logging.level = 'info';
    }
    
    // Return immutable configuration
    return Object.freeze(config);
  }

  // Expose to the global object
  global.DEFAULT_CONFIG = DEFAULT_CONFIG;
  global.createConfig = createConfig;

})(typeof window !== 'undefined' ? window : this); 