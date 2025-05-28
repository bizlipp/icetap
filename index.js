/**
 * DataStackULTRA
 * Comprehensive data management system with storage, validation, and transformations
 */

(function(global) {
  'use strict';

  /**
   * Main DataStack class that integrates storage, schema validation, and transformations
   */
  class DataStack {
    /**
     * Create a new DataStack instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
      // Use global.createConfig and global.DEFAULT_CONFIG
      this.config = global.createConfig ? global.createConfig(options) : (global.DEFAULT_CONFIG || {});
      
      // Initialize components using global constructors
      this.storage = new global.StorageManager(this.config); // Pass the full config object
      this.schema = new global.SchemaManager(this.config);   // Pass the full config object
      this.transform = new global.TransformManager(this.config); // Pass the full config object
      
      // Register common schemas if validation is enabled
      // This was previously here, but SchemaManager now handles this in its own constructor if enabled.
      // if (this.config.schema.validationEnabled) {
      //   this.schema.registerCommonSchemas(); 
      // }
      console.log("DataStackULTRA Initialized with config:", this.config);
    }
    
    /**
     * Store data with optional validation and transformation
     * @param {string} key - Storage key
     * @param {*} data - Data to store
     * @param {Object} options - Storage options including schema and transform details
     * @returns {Promise<boolean>} - Success status
     */
    async set(key, data, options = {}) {
      let valueToStore = data;
      
      if (options.transform) {
        valueToStore = this.transform.transform(valueToStore, options.transform);
      }
      
      if (options.schema && this.schema.isEnabled()) {
        const validation = this.schema.validate(valueToStore, options.schema);
        if (!validation.isValid) {
          console.error(`Validation failed for key '${key}':`, validation.errors.join(', '));
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        if (this.schema.config.coercionEnabled && validation.validatedData !== null && validation.validatedData !== undefined) {
            valueToStore = validation.validatedData;
        }
      }
      
      return this.storage.set(key, valueToStore, options);
    }
    
    /**
     * Retrieve data with optional transformation
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @param {Object} options - Retrieval options including transform details
     * @returns {Promise<*>} - Retrieved data
     */
    async get(key, defaultValue = null, options = {}) {
      const value = await this.storage.get(key, defaultValue, options); // Pass options for persistent flag
      
      // The storage.get method now handles decryption and defaultValue logic more robustly.
      // If value received is the defaultValue, it means it wasn't found or an error occurred during get/decrypt.
      if (value === defaultValue && defaultValue !== null) { // If defaultValue is null, it might be a legitimate stored null
          // Only return defaultValue if it was explicitly provided as non-null and matches, or if storage.get truly returned it.
          // This check might be redundant if storage.get is robust.
          const exists = await this.storage.has(key, options);
          if (!exists) return defaultValue;
      }
      if (value === null && defaultValue !== null) { // If a null was retrieved but a non-null default was expected, return default.
          const exists = await this.storage.has(key, options);
          if(!exists) return defaultValue; // If it truly doesn't exist, return default.
      }

      if (options.transform) {
        return this.transform.transform(value, options.transform);
      }
      
      return value;
    }
    
    async has(key, options = {}) { // Added options for persistent flag
      return this.storage.has(key, options);
    }
    
    async remove(key, options = {}) { // Added options
      return this.storage.remove(key, options);
    }
    
    async clear(options = {persistent: true, memoryToo: true}) { // Expose options
      return this.storage.clear(options);
    }
    
    async keys(options = {}) { // Added options
      return this.storage.keys(options);
    }

    async entries(options = {}) { // Added options for persistent flag
        if (typeof this.storage.entries === 'function') {
            return this.storage.entries(options);
        } else {
            console.warn("StorageManager does not support entries directly, fetching keys and then values.");
            const keys = await this.storage.keys(options);
            const entries = [];
            for (const key of keys) {
                entries.push([key, await this.get(key, null, options)]);
            }
            return entries;
        }
    }
    
    async size(options = {}) { // Added options
      return this.storage.size(options);
    }
    
    registerSchema(name, schema) {
      return this.schema.registerSchema(name, schema);
    }
    
    registerTransform(name, pipeline) {
      return this.transform.registerPipeline(name, pipeline);
    }
    
    createModel(name, schema, options = {}) {
      if (!name || typeof name !== 'string') {
        throw new Error('Model name must be a non-empty string');
      }
      if (!schema || typeof schema !== 'object') {
        throw new Error('Model schema must be an object');
      }
      this.registerSchema(name, schema);
      const keyPrefix = options.keyPrefix || `model:${name}:`;
      // const mapper = this.transform.createMapper(schema); // createMapper is placeholder

      return {
        create: async (id, data) => {
          const key = `${keyPrefix}${id}`;
          if (await this.has(key)) {
            throw new Error(`Model instance with ID ${id} already exists`);
          }
          // Use options from createModel for persistence setting of model data
          await this.set(key, data, { schema: name, persistent: options.persistent !== undefined ? options.persistent : true });
          return { id, ...data };
        },
        get: async (id) => {
          const key = `${keyPrefix}${id}`;
          // Use options from createModel for persistence setting of model data
          const data = await this.get(key, null, { persistent: options.persistent !== undefined ? options.persistent : true });
          return data === null ? null : { id, ...data };
        },
        update: async (id, data) => {
          const key = `${keyPrefix}${id}`;
          const existing = await this.get(key, null, { persistent: options.persistent !== undefined ? options.persistent : true });
          if (existing === null) {
            throw new Error(`Model instance with ID ${id} not found`);
          }
          const merged = { ...existing, ...data, id }; // ensure id is part of merged, not just from data
          delete merged.id; // remove from payload to be validated, re-add from id param
          await this.set(key, merged, { schema: name, persistent: options.persistent !== undefined ? options.persistent : true });
          return { id, ...merged };
        },
        delete: async (id) => {
          const key = `${keyPrefix}${id}`;
          return this.remove(key, { persistent: options.persistent !== undefined ? options.persistent : true });
        },
        getAll: async () => {
          const allModelKeys = (await this.keys({ persistent: options.persistent !== undefined ? options.persistent : true }))
                               .filter(k => k.startsWith(keyPrefix));
          const instances = [];
          for (const key of allModelKeys) {
            const data = await this.get(key, null, { persistent: options.persistent !== undefined ? options.persistent : true });
            if (data !== null) {
              const id = key.substring(keyPrefix.length);
              instances.push({ id, ...data });
            }
          }
          return instances;
        },
        // map: (data) => mapper(data), // createMapper is a placeholder
        validate: (data) => this.schema.validate(data, name)
      };
    }

    getStorageManager() {
      return this.storage;
    }
    getSchemaManager() {
      return this.schema;
    }
    getTransformManager() {
      return this.transform;
    }
  } // End DataStack Class

  // Expose DataStack class to global for instantiation (e.g., new global.DataStack())
  global.DataStack = DataStack;

  // Optional: Create a default instance if desired, and expose it directly.
  // This matches the pattern of `window.DataStackULTRA = new DataStack();` from index.html more closely.
  // Ensure this runs after all other files (config, storage, schema, transform) are loaded and their globals are set.
  // This could be done in index.html itself after all scripts are loaded, or here.
  // For safety, it's better to let index.html do the instantiation after all scripts are confirmed loaded.
  
  // Helper function to create an instance, also exposed
  function createDataStack(options = {}) {
    return new DataStack(options);
  }
  global.createDataStack = createDataStack;

  // Helper to get/create a default instance (singleton-like)
  // let defaultInstance = null;
  // function getDefaultInstance(options = {}) {
  //   if (!defaultInstance) {
  //     defaultInstance = new DataStack(options);
  //   }
  //   return defaultInstance;
  // }
  // global.getDefaultInstance = getDefaultInstance;

})(typeof window !== 'undefined' ? window : this);

// At the top of index.js, after DataStackULTRA instantiation (This part needs to be in index.html or after DataStack is on window)
/*
(async () => {
  if (window.DataStackULTRA) {
    const masterLogCache = await window.DataStackULTRA.get('masterLogCache', [], {persistent: true});
    if (masterLogCache && masterLogCache.length > 0) {
        console.log("Successfully loaded masterLogCache from DataStackULTRA storage on startup:", masterLogCache.length, "entries.");
    } else {
        console.log("No pre-existing masterLogCache found in DataStackULTRA storage or cache is empty.");
    }

    const loadedCalls = await window.DataStackULTRA.get('loadedCalls', [], {persistent: true});
    if (loadedCalls && loadedCalls.length > 0) {
      console.log("Successfully loaded loadedCalls from DataStackULTRA storage on startup:", loadedCalls.length, "entries.");
      // If you have a global parsedCalls array in index.html that needs to be populated:
      // window.parsedCalls = loadedCalls;
      // And then potentially call rendering functions from index.html
    } else {
      console.log("No pre-existing loadedCalls found in DataStackULTRA storage or cache is empty.");
    }

    const activeAuditFile = await window.DataStackULTRA.get('activeAuditFile', null, {persistent: true});
    if (activeAuditFile) {
        console.log("Successfully loaded activeAuditFile from DataStackULTRA storage on startup:", activeAuditFile);
        // If you have a UI element to update with this:
        // document.getElementById('someFileDisplayElement').textContent = activeAuditFile;
    } else {
        console.log("No activeAuditFile found in DataStackULTRA storage.");
    }
  } else {
    console.error("DataStackULTRA not initialized on window when attempting startup load.");
  }
})();
*/ 